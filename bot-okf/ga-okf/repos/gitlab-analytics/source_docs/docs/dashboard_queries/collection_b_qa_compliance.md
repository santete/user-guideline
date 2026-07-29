# Collection B — QA COMPLIANCE Dashboard
**Refresh:** Daily (after dbt run) | **Primary user:** QA Manager, Team Lead

> ✅ **Verified vs dev DB (172.27.62.107) 2026-07-28** — SQL khớp 100% với card đang
> deploy (`src/metabase/setup_dashboards.py :: panels_collection_b`), chạy thật OK.
> Row count trong ngoặc là số liệu dev tại thời điểm verify.
> Các câu SQL dưới đã **lược Metabase field-filter `[[...]]`** (optional, mặc định không lọc) cho dễ đọc — bản deploy có kèm để lọc theo date/project/author/department.

---

## B1 — Compliance Score Distribution — *(5 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user` cho filter department)

```sql
SELECT
    CASE
        WHEN compliance_score < 20  THEN '0–20'
        WHEN compliance_score < 40  THEN '20–40'
        WHEN compliance_score < 60  THEN '40–60'
        WHEN compliance_score < 80  THEN '60–80'
        ELSE                             '80–100'
    END                             AS "Score Bucket",
    COUNT(*)                        AS "MR Count",
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS "Pct %"
FROM gitlab_kpi.v_compliance_mgmt
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1
```

**Sample:** `0–20 → 317 MRs (4.1%) · 20–40 → 3340 (42.7%) · 40–60 → 2663 (34.1%)`

**Metabase setup:**
- Visualization: Bar chart (not stacked)
- Color buckets: 0–40 = red, 40–60 = amber, 60–80 = yellow, 80–100 = green
- Default date: last 30 days

---

## B2 — Compliance Grade Trend (Weekly %) — *(8 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
SELECT
    created_week                                                          AS "Week",
    ROUND(100.0 * COUNT(*) FILTER (WHERE compliance_grade='PASS')    / NULLIF(COUNT(*),0), 1) AS "PASS %",
    ROUND(100.0 * COUNT(*) FILTER (WHERE compliance_grade='WARNING')  / NULLIF(COUNT(*),0), 1) AS "WARNING %",
    ROUND(100.0 * COUNT(*) FILTER (WHERE compliance_grade='FAIL')     / NULLIF(COUNT(*),0), 1) AS "FAIL %",
    COUNT(*)                                                               AS "Total MRs"
FROM gitlab_kpi.v_compliance_mgmt
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE created_week >= NOW() - INTERVAL '8 weeks'
GROUP BY created_week
ORDER BY created_week
```

**Sample:** `2026-06-22 → PASS 0.8% · WARNING 15.7% · FAIL 83.6% (1314 MRs)`

**Metabase setup:**
- Visualization: Line chart, 3 series
- Series: PASS (green), WARNING (amber), FAIL (red) — all as % lines
- Add reference line: PASS = 80% target
- Alert: if FAIL rate > 25% for any week → email QA Manager

---

## B4 — Violation Heatmap × Developer × Type — *(1556 rows)*

**View:** `gitlab_kpi.v_compliance_violation_detail` (+ `dim_user`)

```sql
SELECT
    author_username             AS "Developer",
    violation_label             AS "Violation Type",
    COUNT(*)                    AS "Count"
FROM gitlab_kpi.v_compliance_violation_detail
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY author_username, violation_label
ORDER BY author_username, COUNT(*) DESC
```

**Sample:** `anhdn23 → "Branch name không theo chuẩn" 114 · "MR chưa được assign reviewer" 114`

**Metabase setup:**
- Visualization: Pivot table
- Rows: `Developer`, Columns: `Violation Type`, Values: `Count`
- Color scale: 0 = white, 1–2 = light yellow, 3–5 = orange, >5 = red
- Interpretation: Red cells = repeat offenders → coaching priority

---

## B5 — MR Size Distribution Trend (8 weeks) — *(35 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
SELECT
    created_week                AS "Week",
    size_label                  AS "Size",
    COUNT(*)                    AS "MR Count"
FROM gitlab_kpi.v_compliance_mgmt
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE created_week >= NOW() - INTERVAL '8 weeks'
GROUP BY created_week, size_label
ORDER BY created_week
```

**Sample:** `2026-06-08 → M 1 · XS 4 · 2026-06-15 → XS 6`

**Metabase setup:**
- Visualization: Bar chart (stacked %)
- Stack order: XS / S / M / L / XL
- Colors: XS=green, S=light-green, M=yellow, L=orange, XL=red
- Alert: XL% > 20% for 2 consecutive weeks → notify Team Lead

---

## B6 — Protected Branch MRs — Compliance — *(863 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
SELECT
    m.project_name                AS "Project",
    m.iid                         AS "MR #",
    m.author_username             AS "Author",
    m.compliance_score            AS "Score",
    m.compliance_grade            AS "Grade",
    m.violation_count             AS "Violations",
    CASE WHEN m.ci_passed THEN 'PASS' ELSE 'FAIL' END AS "CI",
    ROUND(m.test_coverage::numeric, 1) AS "Coverage %",
    m.size_label                  AS "Size",
    m.state                       AS "State",
    m.created_at                  AS "Created"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.is_protected_target = true
  AND m.created_at >= NOW() - INTERVAL '7 days'
ORDER BY m.compliance_score ASC, m.created_at DESC
```

**Sample:** `business-policy-api !2702 · khanhhc2 · score 5 · FAIL · 9 viol · CI FAIL · 0.0% cov · XL · merged`

**Metabase setup:**
- Visualization: Table
- Row color: FAIL = red, WARNING = amber, PASS = green (on `Grade`)
- Default filter: last 7 days, is_protected_target = true
- Critical insight: Any FAIL that has `merged_at IS NOT NULL` = already shipped to prod with violations

---

## B7 — CI Pass Rate by Project (8 weeks) — *(60 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
WITH top_projects AS (
    SELECT project_name
    FROM gitlab_kpi.v_compliance_mgmt
    WHERE created_week >= NOW() - INTERVAL '8 weeks'
    GROUP BY project_name
    ORDER BY COUNT(*) DESC
    LIMIT 10
)
SELECT
    m.project_name              AS "Project",
    m.created_week              AS "Week",
    ROUND(100.0 * COUNT(*) FILTER (WHERE m.ci_passed) / NULLIF(COUNT(*),0), 1) AS "CI Pass Rate %",
    COUNT(*)                    AS "MR Count"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_week >= NOW() - INTERVAL '8 weeks'
  AND m.project_name IN (SELECT project_name FROM top_projects)
GROUP BY m.project_name, m.created_week
ORDER BY m.created_week, m.project_name
```

**Sample:** `fcp-pricing-portal 2026-06-22 → 59.5% (79 MRs) · airflow-dag → 0.0% (51 MRs)`

**Metabase setup:**
- Visualization: Line chart, one line per project (top-10 by MR volume)
- Reference line: 85% target
- Alert: any project < 70% for 2 consecutive weeks → email Team Lead + DevOps

---

## B7b — CI Fail Detail per MR (drill-down from B7) — *(500 rows)*

**View:** `gitlab_kpi.v_mr_compliance` (+ `dim_user`)

```sql
SELECT
    m.project_name                                              AS "Project",
    '!' || m.iid::text                                          AS "MR",
    m.author_username                                           AS "Author",
    m.title                                                     AS "Title",
    m.state                                                     AS "State",
    CASE WHEN m.ci_passed THEN 'PASS' ELSE 'FAIL' END          AS "CI",
    m.ci_status                                                 AS "CI Status",
    m.test_coverage                                             AS "Coverage %",
    m.compliance_score                                          AS "Score",
    m.source_branch                                             AS "Branch",
    m.created_at::date                                          AS "Created"
FROM gitlab_kpi.v_mr_compliance m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_at >= NOW() - INTERVAL '30 days'
  AND NOT m.ci_passed
ORDER BY m.created_at DESC
LIMIT 500
```

**Sample:** `ecom-platform-web !353 · hieupc · merged · CI FAIL · status unknown · 0.0% cov · score 25 · hieupc_sp1_v1.3 · 2026-07-28`

> 🔎 **Drill-down từ B7** — chỉ MR có `NOT ci_passed`. Giới hạn 500 dòng, drill-down (không dùng làm bảng chính, mở khi click từ line chart B7).

**Metabase setup:**
- Visualization: Table
- Pin-left: `MR`, `Author`. Click-through `MR` → `{{GITLAB_URL}}/{{project_path}}/-/merge_requests/{{iid}}`
- Sort mặc định `Created` DESC; row highlight khi `CI Status = failed`

---

## B8 — Cycle Time — Avg / P50 / P90 (12 weeks) — *(7 rows)*

**View:** `gitlab_kpi.v_cycle_time_stats`

```sql
SELECT
    week                        AS "Week",
    merged_count                AS "Merged MRs",
    avg_hours                   AS "Avg (hours)",
    p50_hours                   AS "P50 / Median (hours)",
    p90_hours                   AS "P90 (hours)",
    fast_merge_pct              AS "< 24h %",
    long_tail_pct               AS "> 72h %"
FROM gitlab_kpi.v_cycle_time_stats
WHERE week >= NOW() - INTERVAL '12 weeks'
  AND is_protected_target = false
ORDER BY week
```

**Sample:** `2026-06-22 → 529 merged · avg 3.2h · P50 0.0h · P90 0.2h · <24h 98.1% · >72h 1.3%`

**Metabase setup:**
- Visualization: Line chart, 3 lines: `Avg (hours)`, `P50 / Median (hours)`, `P90 (hours)`
- Filter toggle: `is_protected_target = true` for protected-branch focus
- Reference line: 48h (2 business days target)
- Insight: p90 > 72h consistently → code review bottleneck, not outlier

---

## B9 — Test Coverage Trend by Project (12 weeks) — *(7 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
WITH top_projects AS (
    SELECT project_name
    FROM gitlab_kpi.v_compliance_mgmt
    WHERE created_week >= NOW() - INTERVAL '12 weeks'
    GROUP BY project_name
    ORDER BY COUNT(*) DESC
    LIMIT 10
)
SELECT
    m.created_week              AS "Week",
    COUNT(*) FILTER (WHERE m.test_coverage >= 80)                       AS "Green (>=80%)",
    COUNT(*) FILTER (WHERE m.test_coverage BETWEEN 60 AND 79.99)        AS "Yellow (60-79%)",
    COUNT(*) FILTER (WHERE m.test_coverage > 0 AND m.test_coverage < 60) AS "Red (<60%)",
    COUNT(*) FILTER (WHERE m.test_coverage = 0)                         AS "No Data"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_week >= NOW() - INTERVAL '12 weeks'
  AND m.project_name IN (SELECT project_name FROM top_projects)
GROUP BY m.created_week
ORDER BY m.created_week
```

**Sample:** `2026-06-22 → Green 0 · Yellow 0 · Red 0 · No Data 390` (coverage phần lớn chưa được report)

**Metabase setup:**
- Visualization: Stacked bar, X=`Week`, series = Green/Yellow/Red/No Data count
- Colors: Green threshold ≥80%, Yellow 60–79%, Red <60%, No Data = grey
- Alert: tỷ lệ No Data cao kéo dài → coverage report chưa được wire vào CI

---

## B9b — Coverage Detail per MR (drill-down from B9) — *(500 rows)*

**View:** `gitlab_kpi.v_mr_compliance` (+ `dim_user`)

```sql
SELECT
    m.project_name                                              AS "Project",
    '!' || m.iid::text                                          AS "MR",
    m.author_username                                           AS "Author",
    m.title                                                     AS "Title",
    m.state                                                     AS "State",
    m.test_coverage                                             AS "Coverage %",
    m.coverage_delta                                            AS "Coverage Delta %",
    CASE
        WHEN m.test_coverage >= 80 THEN 'Green'
        WHEN m.test_coverage >= 60 THEN 'Yellow'
        WHEN m.test_coverage >  0  THEN 'Red'
        ELSE 'No Data'
    END                                                         AS "Coverage Zone",
    m.mr_size                                                   AS "LOC",
    m.compliance_score                                          AS "Score",
    CASE WHEN m.ci_passed THEN 'PASS' ELSE 'FAIL' END          AS "CI",
    m.created_at::date                                          AS "Created"
FROM gitlab_kpi.v_mr_compliance m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_at >= NOW() - INTERVAL '30 days'
ORDER BY m.test_coverage ASC, m.created_at DESC
LIMIT 500
```

**Sample:** `ecom-platform-web !353 · hieupc · merged · 0.0% cov · Δ null · No Data · 83 LOC · score 25 · CI FAIL · 2026-07-28`

> 🔎 **Drill-down từ B9** — sort coverage tăng dần (worst-first). Giới hạn 500 dòng, drill-down. `Coverage Delta %` có thể null khi MR không có baseline coverage.

**Metabase setup:**
- Visualization: Table
- Pin-left: `MR`, `Author`. Color `Coverage Zone`: Green/Yellow/Red/grey
- Click-through `MR` → `{{GITLAB_URL}}/{{project_path}}/-/merge_requests/{{iid}}`

---

## B10 — Review Activity Summary (30d) — *(374 rows)*

**View:** `gitlab_kpi.v_review_quality` (+ `dim_user`)

```sql
SELECT
    rq.project_name AS "Project",
    COUNT(*) AS "Total MRs",
    COUNT(*) FILTER (WHERE rq.has_review) AS "Reviewed",
    ROUND(100.0 * COUNT(*) FILTER (WHERE rq.has_review) / NULLIF(COUNT(*), 0), 1) AS "Review Rate %",
    ROUND(AVG(rq.time_to_first_comment_hours) FILTER (WHERE rq.time_to_first_comment_hours IS NOT NULL)::numeric, 1) AS "Avg Time to Review (h)",
    ROUND(AVG(rq.human_comment_count)::numeric, 1) AS "Avg Comments",
    ROUND(AVG(rq.discussion_resolved_pct) FILTER (WHERE rq.discussion_resolved_pct IS NOT NULL)::numeric, 1) AS "Avg Resolution %"
FROM gitlab_kpi.v_review_quality rq
LEFT JOIN gitlab_kpi.dim_user du ON du.username = rq.author_username
WHERE rq.created_at >= NOW() - INTERVAL '30 days'
GROUP BY rq.project_name
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) FILTER (WHERE rq.has_review)::float / NULLIF(COUNT(*), 0) DESC
```

**Sample:** `b2b-crm-administration-api → 13 MRs · 6 reviewed · 46.2% rate · 1.6h to review · 0.5 comments`

> ℹ️ `HAVING COUNT(*) >= 2` — loại project có <2 MR/30d để tránh noise. Sort theo review-rate giảm dần.

**Metabase setup:**
- Visualization: Table
- Sort mặc định `Review Rate %` DESC; color rule: <50% amber, <25% đỏ
- Insight: project review-rate thấp + `Avg Comments` ~0 → rubber-stamp review, cần Team Lead theo dõi

---

## B11 — Review Detail per MR (drill-down from B10) — *(500 rows)*

**View:** `gitlab_kpi.v_review_quality` (+ `dim_user`)

```sql
SELECT
    rq.project_name                                             AS "Project",
    '!' || rq.iid::text                                         AS "MR",
    rq.author_username                                          AS "Author",
    rq.title                                                    AS "Title",
    rq.state                                                    AS "State",
    CASE WHEN rq.has_review  THEN 'Yes' ELSE 'No' END          AS "Reviewed?",
    CASE WHEN rq.has_approval THEN 'Yes' ELSE 'No' END         AS "Approved?",
    rq.human_comment_count                                      AS "Comments",
    rq.review_note_count                                        AS "Review Threads",
    rq.unique_commenters                                        AS "Reviewers",
    rq.self_comment_count                                       AS "Self-comments",
    rq.time_to_first_comment_hours                              AS "1st Review (h)",
    rq.time_to_approval_hours                                   AS "Time to Approve (h)",
    rq.review_duration_hours                                    AS "Review Duration (h)",
    CASE WHEN rq.total_resolvable > 0
         THEN rq.resolved_count || '/' || rq.total_resolvable
         ELSE '-' END                                           AS "Resolved",
    rq.discussion_resolved_pct                                  AS "Resolved %",
    rq.created_at::date                                         AS "Created"
FROM gitlab_kpi.v_review_quality rq
LEFT JOIN gitlab_kpi.dim_user du ON du.username = rq.author_username
WHERE rq.created_at >= NOW() - INTERVAL '30 days'
ORDER BY rq.created_at DESC
LIMIT 500
```

**Sample:** `ecom-platform-web !353 · hieupc · merged · Reviewed? No · Approved? No · 0 comments · 0 reviewers · resolved -`

> 🔎 **Drill-down từ B10** — chi tiết từng MR review. Giới hạn 500 dòng, drill-down. Cột time/resolved có thể null khi MR chưa từng được review.

**Metabase setup:**
- Visualization: Table
- Pin-left: `MR`, `Author`, `Reviewed?`. Color `Reviewed?`=No → amber
- Click-through `MR` → `{{GITLAB_URL}}/{{project_path}}/-/merge_requests/{{iid}}`

---

## B12 — Week-over-Week Compliance Delta — *(3 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
WITH weekly AS (
    SELECT
        m.created_week AS week,
        COUNT(*) AS mr_count,
        ROUND(AVG(m.compliance_score)::numeric, 1) AS avg_score,
        ROUND(100.0 * COUNT(*) FILTER (WHERE m.compliance_grade = 'PASS')
              / NULLIF(COUNT(*), 0), 1) AS pass_rate,
        ROUND(100.0 * COUNT(*) FILTER (WHERE array_length(m.violations, 1) > 0)
              / NULLIF(COUNT(*), 0), 1) AS violation_rate
    FROM gitlab_kpi.v_compliance_mgmt m
    LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
    WHERE m.created_week >= NOW() - INTERVAL '3 weeks'
    GROUP BY m.created_week
),
ranked AS (
    SELECT *,
        LAG(avg_score) OVER (ORDER BY week) AS prev_score,
        LAG(mr_count) OVER (ORDER BY week) AS prev_mr_count,
        LAG(violation_rate) OVER (ORDER BY week) AS prev_violation_rate
    FROM weekly
)
SELECT
    week AS "Week",
    mr_count AS "MRs",
    avg_score AS "Avg Score",
    CASE WHEN prev_score IS NOT NULL
         THEN ROUND((avg_score - prev_score)::numeric, 1) END AS "Score Delta",
    CASE WHEN avg_score > COALESCE(prev_score, avg_score) THEN 'Improving'
         WHEN avg_score < COALESCE(prev_score, avg_score) THEN 'Declining'
         ELSE 'Stable' END AS "Trend",
    violation_rate AS "Violation Rate %",
    pass_rate AS "Pass Rate %"
FROM ranked
ORDER BY week DESC
```

**Sample:** `2026-07-27 → 450 MRs · avg 41.7 · Δ +1.7 · Improving · viol 100.0% · pass 2.0%`

> ℹ️ Cửa sổ 3 tuần để có 2 delta hợp lệ. `Score Delta` tuần cũ nhất = null (không có LAG). `Trend` fallback về `Stable` khi chưa có prev_score.

**Metabase setup:**
- Visualization: Table
- Color `Trend`: Improving = green, Declining = red, Stable = grey
- Color `Score Delta`: >0 green, <0 red

---

## B13 — Author Compliance Trend (30 days) — *(30 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)

```sql
SELECT
    m.author_username AS "Author",
    COUNT(*) AS "Total MRs",
    COUNT(*) FILTER (WHERE m.compliance_grade_trend_4w = 'improving')  AS "Improving",
    COUNT(*) FILTER (WHERE m.compliance_grade_trend_4w = 'stable')     AS "Stable",
    COUNT(*) FILTER (WHERE m.compliance_grade_trend_4w = 'declining')  AS "Declining",
    ROUND(100.0 * COUNT(*) FILTER (WHERE m.compliance_grade_trend_4w = 'declining')
          / NULLIF(COUNT(*), 0), 1)                                    AS "Declining %",
    ROUND(AVG(m.compliance_score)::numeric, 1)                         AS "Avg Score",
    ROUND(AVG(m.author_4w_avg_prior)::numeric, 1)                      AS "Author 4w Avg"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_at >= NOW() - INTERVAL '30 days'
  AND m.compliance_grade_trend_4w != 'first_mr'
GROUP BY m.author_username
HAVING COUNT(*) >= 3
ORDER BY "Declining %" DESC, "Total MRs" DESC
LIMIT 30
```

**Sample:** `tuanna235 → 6 MRs · 0 improving / 1 stable / 5 declining · 83.3% declining · avg 21.7 · 4w 43.7`

> ℹ️ Loại `first_mr` (author chưa đủ lịch sử 4 tuần) và `HAVING COUNT(*) >= 3`. Sort theo `Declining %` giảm dần → top-30 author cần chú ý.

**Metabase setup:**
- Visualization: Table
- Pin-left: `Author`. Color `Declining %`: >50% đỏ, 25–50% amber
- Insight: `Avg Score` thấp hơn `Author 4w Avg` = đang tụt so với chính mình → coaching topic

---

## B14 — Screenshot Adoption — UI MRs (8 weeks) — *(8 rows)* — *Phase A v1.6 advisory*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)
**Rule:** R-MR-005 — MR touching UI/Frontend phải có screenshot/GIF (advisory, `score_weight=0`)

```sql
SELECT
    m.created_week                                                              AS "Week",
    COUNT(*) FILTER (WHERE m.is_ui_related)                                     AS "UI MRs",
    COUNT(*) FILTER (WHERE m.is_ui_related AND m.has_screenshots)               AS "UI w/ Screenshots",
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE m.is_ui_related AND m.has_screenshots)
        / NULLIF(COUNT(*) FILTER (WHERE m.is_ui_related), 0),
    1)                                                                          AS "Screenshot %"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_week >= NOW() - INTERVAL '8 weeks'
GROUP BY m.created_week
ORDER BY m.created_week
```

**Sample:** `2026-06-08 → UI MRs 0 · w/ screenshots 0 · Screenshot % null` (chưa có UI MR nào trong tuần)

**Metabase setup:**
- Visualization: Line chart, Y-axis `Screenshot %` %
- Reference line: 80% (target khi promote v1.7)
- Filter: department / project (standard B-collection filters)
- Insight: nếu `UI MRs` thấp (<10/tuần) → noise, đợi đủ sample; nếu `Screenshot %` < 50% kéo dài → coaching topic cho Frontend leads

---

## B15 — Rebase Compliance Rate (8 weeks) — *(8 rows)* — *Phase A v1.6 advisory*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user`)
**Rule:** R-MR-006 — MR phải rebased với target branch trước merge (advisory, `score_weight=0`)

```sql
SELECT
    m.created_week                                                              AS "Week",
    COUNT(*) FILTER (WHERE m.diverged_commits_count IS NOT NULL)                AS "MRs w/ Known Diverged",
    COUNT(*) FILTER (WHERE m.diverged_commits_count = 0)                        AS "Rebased MRs",
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE m.diverged_commits_count = 0)
        / NULLIF(COUNT(*) FILTER (WHERE m.diverged_commits_count IS NOT NULL), 0),
    1)                                                                          AS "Rebase %"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_week >= NOW() - INTERVAL '8 weeks'
GROUP BY m.created_week
ORDER BY m.created_week
```

**Sample:** `2026-06-08 → Known Diverged 0 · Rebased 0 · Rebase % null`

**Metabase setup:**
- Visualization: Line chart, Y-axis `Rebase %` %
- Reference line: 90% (target khi promote v1.7)
- Filter: department / project (standard B-collection filters)
- Gotcha: `diverged_commits_count IS NULL` = MR pre-Phase-A v1.6 (extractor chưa pass `include_diverged_commits_count=true`) — KHÔNG tính vào denominator để tránh false signal trên historical MRs.
