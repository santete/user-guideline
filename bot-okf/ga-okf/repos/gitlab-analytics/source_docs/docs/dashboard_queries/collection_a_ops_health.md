# Collection A — OPS HEALTH Dashboard
**Auto-refresh:** 15 phút | **Primary user:** QA Engineer, DevOps on-call

> ✅ **Verified vs dev DB (172.27.62.107) 2026-07-28** — SQL khớp 100% với card đang
> deploy (`src/metabase/setup_dashboards.py :: panels_collection_a`), chạy thật OK.
> Row count trong ngoặc là số liệu dev tại thời điểm verify.
> Các câu SQL dưới đã **lược Metabase field-filter `[[...]]`** (optional, mặc định không lọc) cho dễ đọc — bản deploy có kèm để lọc theo date/project/author/department.

---

## A1 — Pipeline Health Status (Single Number tile) — *(1 row)*

**View:** `gitlab_kpi.v_ops_pipeline_health`

```sql
SELECT status_label             AS "Status",
       hours_since_last_run     AS "Hours Since Last Run",
       consecutive_failures     AS "Consecutive Failures",
       run_count                AS "Total Runs",
       last_successful_run      AS "Last Success"
FROM gitlab_kpi.v_ops_pipeline_health
```

**Sample:** `🟢 HEALTHY | 14.0h | 0 | 11 | 2026-07-28 04:28`

**Metabase setup:**
- Visualization: Single Number → field `status_label`
- Conditional formatting: contains "BLOCKED" → red, "DEGRADED" → amber
- Metric phụ: `hours_since_last_run` (color > 26 = đỏ, đã lỡ 2 daily run); `consecutive_failures` (≥1 amber, ≥3 đỏ)

---

## A2 — Data Freshness — All Sources (Table) — *(1 row)*

**View:** `gitlab_kpi.v_data_freshness`

```sql
SELECT mr_lag_hours              AS "MR Lag (hours)",
       mr_freshness_status       AS "MR Status",
       last_mr_sync              AS "Last MR Sync",
       commit_lag_hours          AS "Commit Lag (hours)",
       commit_freshness_status   AS "Commit Status",
       last_commit_sync          AS "Last Commit Sync",
       pipeline_lag_hours        AS "Pipeline Lag (hours)",
       pipeline_freshness_status AS "Pipeline Status",
       last_pipeline_sync        AS "Last Pipeline Sync"
FROM gitlab_kpi.v_data_freshness
```

**Sample:** MR lag 1.7h (OK) · Commit lag 1.6h (OK) · Pipeline lag 1.3h (OK)

**Metabase setup:** 3 nhóm cột lag/status/sync. Color rule mỗi `*_lag_hours`: `<2=green, 2–24=amber, >24=red`. Sub-text: "Last updated: {last_*_sync}".

---

## A3a — Ingestion Volume — 30 Days (Stacked Bar) — *(30 rows)*

**View:** `gitlab_kpi.v_ingestion_volume_daily`

```sql
SELECT
    iv.day                                                              AS "Date",
    SUM(iv.row_count) FILTER (WHERE iv.source_table = 'merge_requests') AS "MR Rows",
    SUM(iv.row_count) FILTER (WHERE iv.source_table = 'commits')        AS "Commit Rows",
    SUM(iv.row_count) FILTER (WHERE iv.source_table = 'pipelines')      AS "Pipeline Rows",
    SUM(iv.row_count) FILTER (WHERE iv.source_table = 'mr_commits')     AS "MR Commit Rows"
FROM gitlab_kpi.v_ingestion_volume_daily iv
GROUP BY iv.day
ORDER BY iv.day
```

**Sample:** `2026-07-01 → MR 442 · Commit 1340 · Pipeline 2454 · MR-Commit 1400`

**Metabase setup:** Bar (stacked). X=`Date`, Y=4 series row-count. Filter default 30 ngày.

---

## A3b — Zero-Ingestion Days Alert (Table) — *(0 rows = healthy)*

**View:** `gitlab_kpi.v_ingestion_volume_daily`

```sql
SELECT iv.day, iv.source_table, iv.row_count
FROM gitlab_kpi.v_ingestion_volume_daily iv
WHERE iv.is_zero_day = true
  AND iv.day >= (NOW() - INTERVAL '7 days')::date
ORDER BY iv.day DESC
```

> ⚠️ **0 rows là TRẠNG THÁI TỐT** — không có ngày nào ingestion = 0 trong 7 ngày. Card chỉ hiện dòng khi có sự cố. Lưu ý cast `(NOW() - INTERVAL '7 days')::date` — sửa 2026-05-17 để không bỏ sót ngày biên (date vs timestamptz).

**Metabase setup:** Table alert. Hiện dòng nào = "Zero-ingestion day detected". Cân nhắc gắn Metabase alert email khi > 0 rows.

---

## A4 — Active Violations Feed (Table — live triage queue) — *(863 rows, 7 ngày)*

**View:** `gitlab_kpi.v_violations` (+ `dim_user` cho filter department)

```sql
SELECT
    v.project_name                                            AS "Project",
    '!' || v.iid::text                                        AS "MR",
    v.author_username                                         AS "Author",
    v.state                                                   AS "State",
    v.compliance_score                                        AS "Score",
    v.violation_count                                         AS "# Violations",
    v.mr_size                                                 AS "LOC",
    v.size_label                                              AS "Size",
    v.ci_status                                               AS "CI",
    ROUND((EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600.0)::numeric, 1) AS "Age (h)"
FROM gitlab_kpi.v_violations v
LEFT JOIN gitlab_kpi.dim_user du ON du.username = v.author_username
WHERE v.created_at > NOW() - INTERVAL '7 days'
ORDER BY v.compliance_score ASC, v.created_at DESC
```

> 🔧 **Fix 2026-07-28**: cột "Age (h)" phải cast `::numeric` — `ROUND(double precision, int)` không tồn tại trong PostgreSQL. Đây là bug đã báo, nay đã sửa.

**Sample:** `business-policy-api !2702 · khanhhc2 · merged · score 5 · 9 viol · 1271 LOC · XL · 20.9h`

**Metabase setup:**
- Table. Row color: score <40 đỏ, 40–59 amber, 60–79 vàng.
- Pin-left: `MR`, `Author`, `Score`. Auto-refresh 15 phút.
- Click-through `MR` → `{{GITLAB_URL}}/{{project_path}}/-/merge_requests/{{iid}}`

---

## A5 — Violations by Project (7 ngày) (Bar) — *(144 rows)*

**View:** `gitlab_kpi.v_compliance_violation_detail` (+ `dim_user`)

```sql
WITH recent AS (
    SELECT d.project_name, d.violation_label, d.violation_type, d.created_at
    FROM gitlab_kpi.v_compliance_violation_detail d
    LEFT JOIN gitlab_kpi.dim_user du ON du.username = d.author_username
    WHERE d.created_at > NOW() - INTERVAL '7 days'
),
top_projects AS (
    SELECT project_name FROM recent
    GROUP BY project_name ORDER BY COUNT(*) DESC LIMIT 15
)
SELECT
    r.project_name    AS "Project",
    r.violation_label AS "Violation Type",
    COUNT(*)          AS "Count"
FROM recent r
WHERE r.project_name IN (SELECT project_name FROM top_projects)
GROUP BY r.project_name, r.violation_label
ORDER BY COUNT(*) DESC
```

**Sample:** `airflow-dag → "MR chưa được assign reviewer" 73 · "Không có ticket reference" 73`

**Metabase setup:** Bar (stacked). X=`Project`, Y=`Count`, series=`Violation Type`. Giới hạn top-15 project.

---

## A6 — ETL Run History — Last 10 Runs (Table) — *(9 rows)*

**View:** `gitlab_kpi.v_pipeline_state`

> 🆕 **Thêm 2026-07-28** (migration 015). Card query `gitlab_kpi.v_pipeline_state` — view wrap `gitlab_raw.pipeline_state` để Metabase read role (`analytics_ro`) truy cập được. Trước đó card trỏ thẳng `gitlab_raw.pipeline_state` → **permission denied** (read role không có quyền trên `gitlab_raw`). Đây là bug đã báo, nay đã sửa.

```sql
SELECT
    key AS "Metric",
    value AS "Value",
    updated_at::timestamp AS "Updated At"
FROM gitlab_kpi.v_pipeline_state
ORDER BY
    CASE key
        WHEN 'last_successful_run'       THEN 1
        WHEN 'consecutive_failures'      THEN 2
        WHEN 'last_failure'              THEN 3
        WHEN 'last_mr_updated_at'        THEN 4
        WHEN 'last_commit_date'          THEN 5
        WHEN 'last_pipeline_updated_at'  THEN 6
        WHEN 'run_count'                 THEN 7
        WHEN 'schema_version'            THEN 8
        ELSE 9
    END
```

**Sample:** `last_successful_run = 2026-07-27 21:28 · consecutive_failures = 0 · last_failure = (null)`

**Metabase setup:** Table 3 cột. Không cần color rule — đây là bảng metadata checkpoint ETL.
```
