# Collection D — DEEP DIVE Investigation Dashboard
**Refresh:** On-demand | **Primary user:** QA Engineer (incident investigation, 1:1 prep)

> ✅ **Verified vs dev DB (172.27.62.107) 2026-07-28** — SQL khớp 100% với card đang
> deploy (`src/metabase/setup_dashboards.py :: panels_collection_d`), chạy thật OK.
> Row count trong ngoặc là số liệu dev tại thời điểm verify.
> Các câu SQL dưới đã **lược Metabase field-filter `[[...]]`** (optional, mặc định không lọc) cho dễ đọc — bản deploy có kèm để lọc theo date/project/author/department.

---

## D3 — Violation Category Deep Dive (30 days) (Table) — *(500 rows)*

**View:** `gitlab_kpi.v_compliance_violation_detail` (+ `dim_user` cho filter department)

```sql
SELECT
    d.project_name              AS "Project",
    d.iid                       AS "MR #",
    d.author_username           AS "Author",
    d.violation_type            AS "Type",
    d.violation_label           AS "Violation",
    d.compliance_score          AS "Score",
    d.state                     AS "State",
    d.is_protected_target       AS "Protected Branch",
    d.created_at                AS "Created"
FROM gitlab_kpi.v_compliance_violation_detail d
LEFT JOIN gitlab_kpi.dim_user du ON du.username = d.author_username
WHERE d.created_at > NOW() - INTERVAL '30 days'
ORDER BY d.created_at DESC
LIMIT 500
```

**Sample:** `ecom-platform-web !353 · hieupc · BRANCH_NAMING_VIOLATION "Branch name không theo chuẩn" · score 25 · merged · protected`

**Metabase setup:**
- Panel 1 & 2: hiển thị với mọi `violation_type` (dropdown param lọc theo `Type`)
- Panel 3 (branch prefix breakdown): thêm như 1 card riêng trong cùng dashboard,
  hardcoded `violation_type = 'BRANCH_NAMING_VIOLATION'` — không cần parameter

---

## D5 — AI Disclosure Tracker — Undisclosed Summary (Table) — *(8 rows)*

**View:** `gitlab_kpi.v_ai_disclosure_tracker` (+ `dim_user` cho filter department)

```sql
SELECT
    author_username             AS "Developer",
    COUNT(*)                    AS "Total MRs (with AI commits)",
    COUNT(*) FILTER (WHERE ai_disclosure_status = 'DISCLOSED')   AS "Disclosed",
    COUNT(*) FILTER (WHERE ai_disclosure_status = 'UNDISCLOSED') AS "Undisclosed",
    COUNT(*) FILTER (WHERE ai_disclosure_status = 'FALSE_POSITIVE') AS "False Positive",
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ai_disclosure_status = 'DISCLOSED')
        / NULLIF(COUNT(*), 0),
    1)                          AS "Disclosure Rate %"
FROM gitlab_kpi.v_ai_disclosure_tracker
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE has_ai_commits_in_window = true
GROUP BY author_username
ORDER BY "Undisclosed" DESC, "Total MRs (with AI commits)" DESC
```

**Sample:** `hungpnh2 · 16 MRs · 11 disclosed · 5 undisclosed · 0 false-positive · 68.8% rate`

**Metabase setup:**
- Visualization: Table. Sort mặc định `Undisclosed` DESC — dev nào nhiều AI work chưa khai báo nhất lên đầu.
- Color rule `Disclosure Rate %`: `<50 đỏ, 50–79 amber, ≥80 green`.

---

## D6a — Pipeline Failures — Current Streaks (Table) — *(109 rows)*

**View:** `gitlab_kpi.v_pipeline_failures`

```sql
WITH latest_per_branch AS (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY project_name, ref
               ORDER BY created_at DESC
           ) AS rn
    FROM gitlab_kpi.v_pipeline_failures
    WHERE failure_streak >= 2
)
SELECT
    project_name                AS "Project",
    ref                         AS "Branch",
    failure_streak              AS "Consecutive Failures",
    severity                    AS "Severity",
    is_protected_branch         AS "Protected",
    hours_since_failure         AS "Hours Broken",
    streak_started_at           AS "Broken Since",
    source                      AS "Trigger"
FROM latest_per_branch
WHERE rn = 1
ORDER BY failure_streak DESC, is_protected_branch DESC
```

**Sample:** `sr-ticket-api · dev · 174 consecutive · CRITICAL · protected · 2.2h broken · trigger push`

**Metabase setup:**
- Visualization: Table (active fires — 1 dòng / branch, chỉ branch còn streak ≥ 2).
- Row color trên `Severity`: CRITICAL = red, còn lại amber; pin-left `Project`, `Branch`, `Consecutive Failures`.
- `Protected` = true → ưu tiên xử lý trước (đã sort `is_protected_branch DESC`).

---

## D6b — Pipeline Failure Trend (7 days) (Bar) — *(62 rows)*

**View:** `gitlab_kpi.v_pipeline_failures`

```sql
WITH top_projects AS (
    SELECT project_name
    FROM gitlab_kpi.v_pipeline_failures
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY project_name
    ORDER BY COUNT(*) DESC
    LIMIT 15
)
SELECT
    failure_day                 AS "Date",
    f.project_name              AS "Project",
    COUNT(*)                    AS "Failures",
    MAX(failure_streak)         AS "Max Streak"
FROM gitlab_kpi.v_pipeline_failures f
WHERE f.created_at > NOW() - INTERVAL '7 days'
  AND f.project_name IN (SELECT project_name FROM top_projects)
GROUP BY failure_day, f.project_name
ORDER BY failure_day ASC
```

**Sample:** `2026-07-22 · callcenter-ivr-api · 8 failures · max streak 40`

**Metabase setup:**
- Visualization: Bar (stacked). X=`Date`, Y=`Failures`, series=`Project`. Giới hạn top-15 project theo tổng failure 7 ngày.
- `Max Streak` dùng làm tooltip/detail để nhận biết branch nào vỡ liên tục.

---

## D7 — Outlier MRs — XL Size (>700 LOC) (Table) — *(749 rows)*

**View:** `gitlab_kpi.v_mr_compliance` (+ `dim_user` cho filter department)

```sql
SELECT
    m.project_name              AS "Project",
    m.iid                       AS "MR #",
    m.author_username           AS "Author",
    m.title                     AS "Title",
    m.mr_size                   AS "LOC",
    m.additions                 AS "+ Lines",
    m.deletions                 AS "- Lines",
    ROUND(m.cycle_time_hours, 1) AS "Cycle Time (h)",
    m.compliance_score          AS "Score",
    m.state                     AS "State",
    m.created_at                AS "Created"
FROM gitlab_kpi.v_mr_compliance m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.size_label = 'XL'
  AND m.created_at > NOW() - INTERVAL '30 days'
ORDER BY m.mr_size DESC
```

**Sample:** `tddhddtt-inside-api !266 · nguyennc14 · 5303 LOC (+135/-5168) · cycle 0.0h · score 5 · merged`

**Metabase setup:**
- Visualization: Table. Sort mặc định `LOC` DESC — MR khổng lồ lên đầu.
- Color rule `LOC`: `>2000 đỏ, 700–2000 amber`. Pin-left `MR #`, `Author`, `LOC`.
- Click-through `MR #` → GitLab MR page để review chi tiết.

---

## D8 — Webhook DLQ Monitor (Table) — *(1 row)*

**View:** `gitlab_kpi.v_dlq_monitor`

```sql
SELECT
    "Priority", "Event Type", "Unresolved", "Last Hour", "Last 24h",
    "Hours Since Latest", "Resolution Rate %", "Most Common Error"
FROM (
    SELECT
        triage_priority             AS "Priority",
        event_type                  AS "Event Type",
        unresolved_count            AS "Unresolved",
        failures_last_hour          AS "Last Hour",
        failures_last_24h           AS "Last 24h",
        ROUND(hours_since_latest, 1) AS "Hours Since Latest",
        resolution_rate             AS "Resolution Rate %",
        most_common_error           AS "Most Common Error"
    FROM gitlab_kpi.v_dlq_monitor
    WHERE 1=1
    UNION ALL
    SELECT 'HEALTHY', '— No DLQ failures recorded —', 0, 0, 0, NULL, NULL, NULL
    WHERE NOT EXISTS (SELECT 1 FROM gitlab_kpi.v_dlq_monitor)
) sub
ORDER BY
    CASE "Priority" WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'HEALTHY' THEN 5 ELSE 4 END,
    "Unresolved" DESC NULLS LAST
```

> ⚠️ **1 row `HEALTHY` là TRẠNG THÁI TỐT** — không có DLQ failure nào. Card luôn hiện tối thiểu 1 dòng nhờ nhánh `UNION ALL ... WHERE NOT EXISTS` (fallback khi view rỗng).

**Sample:** `HEALTHY · — No DLQ failures recorded — · 0 unresolved`

**Metabase setup:**
- Visualization: Table
- Row color on `Priority`: CRITICAL = red, HIGH = orange, MEDIUM = amber, RESOLVED = green
- Alert: any row with `Priority = 'CRITICAL'` → immediate Slack + email to DevOps
- Manual resolution: `UPDATE gitlab_raw.webhook_dlq SET replayed=true WHERE id=<n>` after fixing the handler

---

## D9 — Reviewer Workload Analysis (Table) — *(12 rows)*

**View:** `gitlab_kpi.v_reviewer_workload`

```sql
SELECT
    reviewer_username AS "Reviewer",
    week AS "Week",
    mrs_reviewed AS "MRs Reviewed",
    total_comments AS "Comments",
    total_review_notes AS "Review Notes",
    projects_reviewed AS "Projects",
    avg_response_time_hours AS "Avg Response (h)",
    self_review_count AS "Self Reviews"
FROM gitlab_kpi.v_reviewer_workload
WHERE week >= NOW() - INTERVAL '4 weeks'
ORDER BY week DESC, mrs_reviewed DESC
```

**Sample:** `khanhtv21 · week 2026-07-27 · 1 MR reviewed · 15 comments · 1 project · avg response 0.4h · 1 self-review`

**Metabase setup:**
- Visualization: Table. Sort mặc định `Week` DESC rồi `MRs Reviewed` DESC.
- Watch `Self Reviews` > 0 (dev tự review MR mình) và `Avg Response (h)` cao (reviewer chậm phản hồi).

---

## D10 — Recurring Violator Alert — 3+ Weeks Same Violation (Table) — *(1002 rows)*

**View:** `gitlab_kpi.v_compliance_violation_detail` (+ `dim_user` cho filter department)

```sql
WITH weekly_violations AS (
    SELECT
        d.author_username,
        d.violation_type,
        DATE_TRUNC('week', d.created_at)::date AS week
    FROM gitlab_kpi.v_compliance_violation_detail d
    LEFT JOIN gitlab_kpi.dim_user du ON du.username = d.author_username
    WHERE d.created_at >= NOW() - INTERVAL '8 weeks'
    GROUP BY d.author_username, d.violation_type, DATE_TRUNC('week', d.created_at)::date
),
streaks AS (
    SELECT author_username, violation_type, COUNT(DISTINCT week) AS weeks_with_violation
    FROM weekly_violations
    GROUP BY author_username, violation_type
    HAVING COUNT(DISTINCT week) >= 3
)
SELECT
    s.author_username AS "Developer",
    s.violation_type AS "Recurring Violation",
    s.weeks_with_violation AS "Weeks Affected",
    CASE
        WHEN s.weeks_with_violation >= 6 THEN 'CRITICAL — Needs 1:1'
        WHEN s.weeks_with_violation >= 4 THEN 'HIGH — Training needed'
        ELSE 'MEDIUM — Monitor'
    END AS "Action Required"
FROM streaks s
ORDER BY s.weeks_with_violation DESC, s.author_username
```

**Sample:** `sangnt31 · CI_FAILED · 8 weeks affected · CRITICAL — Needs 1:1`

**Metabase setup:**
- Visualization: Table. Mỗi dòng = 1 cặp (developer, violation_type) tái diễn ≥ 3 tuần trong 8 tuần gần nhất.
- Row color trên `Action Required`: CRITICAL = red, HIGH = amber, MEDIUM = vàng.
- Dùng cho chuẩn bị 1:1 / escalation: sort `Weeks Affected` DESC đưa vi phạm dai dẳng nhất lên đầu.
