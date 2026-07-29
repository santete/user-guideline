# Collection C — ENGINEERING MANAGEMENT Dashboard
**Refresh:** Weekly (Monday after dbt run) | **Primary user:** Engineering Manager, Team Lead

> ✅ **Verified vs dev DB (172.27.62.107) 2026-07-28** — SQL khớp 100% với card đang
> deploy (`src/metabase/setup_dashboards.py :: panels_collection_c`), chạy thật OK.
> Row count trong ngoặc là số liệu dev tại thời điểm verify.
> Các câu SQL dưới đã **lược Metabase field-filter `[[...]]`** (optional, mặc định không lọc) cho dễ đọc — bản deploy có kèm để lọc theo date/project/author/department.

---

## C1 — Team Leaderboard: Current Month (Table) — *(418 rows)*

**View:** `gitlab_kpi.v_team_leaderboard` (+ `dim_user` cho filter department)

```sql
SELECT
    author_name                 AS "Developer",
    active_weeks                AS "Active Weeks",
    mr_count                    AS "MRs",
    avg_compliance_score        AS "Avg Score",
    violation_rate              AS "Violation Rate %",
    ai_commit_pct               AS "AI Commit %",
    bad_commit_msgs             AS "Bad Commit Msgs",
    score_trend                 AS "Trend",
    score_delta                 AS "Score Δ",
    monthly_grade               AS "Grade"
FROM gitlab_kpi.v_team_leaderboard
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE month = (SELECT MAX(month) FROM gitlab_kpi.v_team_leaderboard)
ORDER BY avg_compliance_score DESC
```

**Sample:** `DaiTQ5 · 1 wk · 56 MRs · score 80.1 · viol 100% · AI 85.7% · trend IMPROVING (Δ+10.9) · PASS`

**Metabase setup:**
- Visualization: Table, sortable columns
- Row color on `monthly_grade`: PASS = green, WARNING = amber, FAIL = red
- `score_trend` column icons: IMPROVING = ↑, STABLE = →, DECLINING = ↓, NEW = ★
- `score_delta` color: positive = green text, negative = red text
- Parameter filter: `month` → allow viewing any past month for 1:1 prep

---

## C1b — Developer MR Detail (drill-down from C1) (Table) — *(500 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` (+ `dim_user` cho filter department)

```sql
SELECT
    m.project_name                                              AS "Project",
    '!' || m.iid::text                                          AS "MR",
    m.author_username                                           AS "Author",
    m.title                                                     AS "Title",
    m.state                                                     AS "State",
    m.compliance_score                                          AS "Score",
    m.compliance_grade                                          AS "Grade",
    m.size_label                                                AS "Size",
    m.mr_size                                                   AS "LOC",
    CASE WHEN m.ci_passed THEN 'PASS' ELSE 'FAIL' END          AS "CI",
    m.test_coverage                                             AS "Coverage %",
    ROUND(m.cycle_time_hours, 1)                                AS "Cycle (h)",
    COALESCE(array_to_string(m.violations, ', '), '')           AS "Violations",
    m.created_at::date                                          AS "Created"
FROM gitlab_kpi.v_compliance_mgmt m
LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
WHERE m.created_at >= NOW() - INTERVAL '60 days'
ORDER BY m.created_at DESC
LIMIT 500
```

> 🔎 **Drill-down card** — chi tiết MR 60 ngày, capped `LIMIT 500` để bảo vệ render Metabase. Người dùng vào từ C1 (click Developer) rồi lọc theo author qua field-filter của bản deploy.

**Sample:** `ecom-platform-web !353 · hieupc · merged · score 25 · FAIL · S/83 LOC · CI FAIL · 7 violations · 2026-07-28`

**Metabase setup:**
- Visualization: Table. Pin-left `Project`, `MR`, `Author`.
- Row color trên `Grade`: FAIL = red, WARNING = amber, PASS = green; `CI` = FAIL → red.
- `Violations` là chuỗi gộp (array_to_string) — hiển thị dạng text wrap.
- Đây là drill-down (`LIMIT 500`): dùng field-filter author/project/date của bản deploy để thu hẹp trước khi đọc.

---

## C2 — AI Adoption: Commit % by Project — 12 weeks (Line chart) — *(60 rows)*

**View:** `gitlab_kpi.v_ai_adoption`

```sql
WITH top_projects AS (
    SELECT project_name
    FROM gitlab_kpi.v_ai_adoption
    WHERE week >= NOW() - INTERVAL '12 weeks'
    GROUP BY project_name
    ORDER BY SUM(total_commits) DESC
    LIMIT 10
)
SELECT
    a.week                      AS "Week",
    a.project_name              AS "Project",
    a.ai_commit_pct             AS "AI Commit %",
    a.ai_loc_pct                AS "AI LOC %",
    a.total_commits             AS "Total Commits",
    a.ai_commits                AS "AI Commits"
FROM gitlab_kpi.v_ai_adoption a
WHERE a.week >= NOW() - INTERVAL '12 weeks'
  AND a.project_name IN (SELECT project_name FROM top_projects)
ORDER BY a.week, a.project_name
```

**Sample:** `2026-06-22 · airflow-dag · AI commit 0.0% · AI LOC 0.0% · 161 commits · 0 AI`

**Metabase setup — 2 separate charts:**

**Chart 1: AI Commit %**
- Visualization: Line chart, one line per `Project` (top-10 project theo total commits)
- Y-axis: `AI Commit %`
- Reference line: 30% (AI_ADOPTION target from thresholds.py)
- Alert: any project < 10% for 4+ consecutive weeks → flag for workshop

**Chart 2: AI LOC %**
- Same structure, use `AI LOC %`
- Reference line: 35% target

---

## C4 — Weekly Commit Quality: Good vs AI vs Bad (Stacked bar) — *(8 rows)*

**View:** `gitlab_kpi.v_weekly_kpi` (+ `dim_user` cho filter department)

```sql
SELECT
    week                        AS "Week",
    SUM(ai_commits)             AS "AI Commits",
    SUM(total_commits) - SUM(ai_commits) - SUM(bad_commit_msg_count) AS "Clean Commits",
    SUM(bad_commit_msg_count)   AS "Bad Message Commits",
    SUM(long_commit_count)      AS "Long Message Commits (>500ch)"
FROM gitlab_kpi.v_weekly_kpi
LEFT JOIN gitlab_kpi.dim_user du ON du.username = author_username
WHERE week >= NOW() - INTERVAL '8 weeks'
GROUP BY week
ORDER BY week
```

**Sample:** `2026-06-22 → Clean 990 · AI 5 · Bad msg 4017 · Long msg 267`

**Metabase setup:**
- Visualization: Bar chart (stacked)
- Stacks: `Clean Commits` (green) / `AI Commits` (purple) / `Bad Message Commits` (red) / `Long Message Commits (>500ch)` (orange)
- Alert: `Bad Message Commits` / total > 20% for any week → Slack #engineering-quality

---

## C6 — Long Commit Messages (>500 chars) — Last 30 days (Table) — *(294 rows)*

**View:** `gitlab_kpi.v_long_commit_violations` (+ `dim_user` cho filter department)

```sql
SELECT
    author_name                 AS "Developer",
    author_email                AS "Email",
    project_name                AS "Project",
    COUNT(*)                    AS "Long Msg Count",
    MAX(committed_date)         AS "Latest Occurrence"
FROM gitlab_kpi.v_long_commit_violations lc
LEFT JOIN gitlab_kpi.dim_user du ON du.name = lc.author_name OR du.username = lc.author_name
WHERE lc.committed_date > NOW() - INTERVAL '30 days'
GROUP BY lc.author_name, lc.author_email, lc.project_name
ORDER BY COUNT(*) DESC
```

**Sample:** `daitq5-byte · daitq5@fpt.com · idp-portal-hr-web · 46 long msgs · latest 2026-07-23 12:56`

**Metabase setup:**
- Visualization: Table, sort mặc định theo `Long Msg Count` DESC.
- Group theo Developer × Project trong 30 ngày; `Latest Occurrence` = commit gần nhất vi phạm.
- Color `Long Msg Count`: > 20 = amber, > 40 = red — đây là danh sách nhắc nhở coaching commit-message.

---

## C9 — Compliance Improvement Roadmap: Fix Priority (Table) — *(10 rows)*

**View:** `gitlab_kpi.v_compliance_violation_detail` (+ `v_compliance_mgmt` cho mẫu số, `dim_user` cho filter department)

```sql
SELECT
    d.violation_type AS "Violation",
    d.violation_category AS "Category",
    d.violation_severity AS "Severity",
    d.score_weight AS "Points at Stake",
    COUNT(*) AS "Affected MRs",
    ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM gitlab_kpi.v_compliance_mgmt WHERE created_at >= NOW() - INTERVAL '30 days'), 0), 1) AS "Fail Rate %",
    ROUND(d.score_weight * COUNT(*) / NULLIF((SELECT COUNT(*) FROM gitlab_kpi.v_compliance_mgmt WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::numeric, 1) AS "Avg Points Lost/MR",
    CASE d.violation_severity
        WHEN 'BLOCKER' THEN 'Fix ngay — block quality gate'
        WHEN 'REQUIRED' THEN 'Cai thien qua training + tooling'
        ELSE 'Nice to have'
    END AS "Recommended Action"
FROM gitlab_kpi.v_compliance_violation_detail d
LEFT JOIN gitlab_kpi.dim_user du ON du.username = d.author_username
WHERE d.created_at >= NOW() - INTERVAL '30 days'
GROUP BY d.violation_type, d.violation_category, d.violation_severity, d.score_weight
ORDER BY d.score_weight * COUNT(*) DESC
```

**Sample:** `CI_FAILED · Quality Gate · BLOCKER · 25 pts · 3993 MRs · 51.1% fail · 12.8 avg lost · "Fix ngay — block quality gate"`

**Metabase setup:**
- Visualization: Table, sort theo tổng điểm mất (`score_weight × count`) DESC — top-10 vi phạm gây thiệt hại điểm nhiều nhất trong 30 ngày.
- Color `Severity`: BLOCKER = red, REQUIRED = amber, còn lại = grey.
- Cột `Recommended Action` là gợi ý hành động sinh từ `violation_severity` — dùng làm backlog ưu tiên cho EM.
