# Collection E — Compliance Formula & Scoring Transparency
**Refresh:** Daily (after dbt run) | **Primary user:** QA Manager, Engineering Manager, Developer

> ✅ **Verified vs dev DB 2026-07-28** — SQL khớp 100% với card đang deploy
> (`src/metabase/setup_dashboards.py :: panels_collection_e`), chạy thật OK.
> Row count trong ngoặc là số liệu dev tại thời điểm verify.
> Các câu SQL dưới đã **lược Metabase field-filter `[[...]]`** (optional, mặc định không lọc) cho dễ đọc — bản deploy có kèm để lọc theo date/project/author/department.

---

## E1 — Compliance Criterion Weight Table (30d) — *(12 rows)*

**View:** `gitlab_kpi.v_compliance_criterion_stats`

```sql
SELECT
    s.sort_order                                                AS "#",
    s.criterion_label                                           AS "Tiêu chí",
    s.category                                                  AS "Hạng mục",
    s.severity                                                  AS "Mức độ",
    s.max_pts                                                   AS "Điểm tối đa",
    ROUND(AVG(s.avg_pts_earned)::numeric, 1)                    AS "Điểm TB đạt",
    ROUND(AVG(s.pass_rate)::numeric, 1)                         AS "Pass rate (%)",
    ROUND(AVG(s.fail_rate)::numeric, 1)                         AS "Fail rate (%)",
    ROUND(AVG(s.avg_pts_lost)::numeric, 1)                      AS "Điểm TB mất",
    SUM(s.total_mrs)                                            AS "Tổng MR"
FROM gitlab_kpi.v_compliance_criterion_stats s
WHERE s.created_month >= DATE_TRUNC('month', NOW() - INTERVAL '30 days')
GROUP BY s.sort_order, s.criterion_label, s.category, s.severity, s.max_pts
ORDER BY s.sort_order
```

**Sample:** `1 · CI pass/fail · Quality Gate · BLOCKER · 25 pts · TB đạt 11.1 · pass 44.4% · mất 13.9 · 8917 MR`

**Metabase setup:**
- Visualization: Table, full width
- Title: `Công thức tính điểm — ENG-STD-MR-002 v1.6`
- Subtitle: `Điểm tối đa: 100 | PASS ≥80 | WARNING 60–79 | FAIL <60 | 2 advisory criteria (screenshot/rebased) không tính vào score`
- Mini bar chart trong cột "Pass rate (%)" (Table → column settings → show mini bar)
- Conditional formatting — cột "Pass rate (%)": < 60% → đỏ, 60–79% → cam, ≥ 80% → xanh
- Conditional formatting — cột "Điểm TB mất": > 10 → đỏ, 5–10 → cam
- Default date: last 30 days; 12 hàng (bao gồm 2 advisory criteria screenshot/rebased)

---

## E3 — Score Decomposition by Category — Weekly Trend (12w) — *(66 rows)*

**View:** `gitlab_kpi.v_compliance_criterion_stats`

```sql
SELECT
    s.created_week                                              AS "Tuần",
    s.category                                                  AS "Hạng mục",
    ROUND(AVG(s.avg_pts_earned)::numeric, 2)                    AS "Điểm TB đạt",
    ROUND(AVG(s.avg_pts_lost)::numeric, 2)                      AS "Điểm TB mất",
    SUM(s.total_mrs)                                            AS "Tổng MR"
FROM gitlab_kpi.v_compliance_criterion_stats s
WHERE s.created_week >= DATE_TRUNC('week', NOW() - INTERVAL '12 weeks')
GROUP BY s.created_week, s.category
ORDER BY s.created_week, s.category
```

**Sample:** `2026-05-11 · AI Compliance · TB đạt 0.0 · TB mất 5.0 · 2 MR`

**Metabase setup:**
- Visualization: Bar chart → stacked
- X axis: "Tuần"; Y axis: "Điểm TB đạt" (stacked by "Hạng mục")
- 5 màu cố định theo category:
  - Quality Gate → #E53935 (đỏ)
  - MR Size → #FB8C00 (cam)
  - Documentation → #1E88E5 (xanh dương)
  - AI Compliance → #8E24AA (tím)
  - Naming Convention → #43A047 (xanh lá)
- Reference line: y = 100 (max possible)
- Tooltip: hiển thị cả "Điểm TB mất" để thấy gap

---

## E5 — Criterion × Project Heatmap — Pass Rate (30d) — *(494 rows)*

**View:** `gitlab_kpi.v_compliance_criterion_stats`

```sql
SELECT
    s.project_name                                              AS "Project",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'ci_pass'), 0)
                                                                AS "CI (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'coverage_absolute'), 0)
                                                                AS "Coverage (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'coverage_delta'), 0)
                                                                AS "Cov Delta (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'mr_size'), 0)
                                                                AS "MR Size (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'description'), 0)
                                                                AS "Desc (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'description_template'), 0)
                                                                AS "Template (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'ticket_ref'), 0)
                                                                AS "Ticket (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'ai_disclosure'), 0)
                                                                AS "AI (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'branch_naming'), 0)
                                                                AS "Branch (%)",
    ROUND(MAX(s.pass_rate) FILTER (WHERE s.criterion_name = 'mr_title'), 0)
                                                                AS "Title (%)",
    SUM(s.total_mrs) / 10                                       AS "Tổng MR"
FROM gitlab_kpi.v_compliance_criterion_stats s
WHERE s.created_month >= DATE_TRUNC('month', NOW() - INTERVAL '30 days')
GROUP BY s.project_name
ORDER BY s.project_name
```

**Sample:** `FoxPro · CI 100 · Cov 0 · Delta 100 · Size 100 · Desc 0 · Tmpl 0 · Ticket 0 · AI 0 · Branch 0 · Title 100 · 3.6 MR`

**Metabase setup:**
- Visualization: Table
- Conditional formatting cho TẤT CẢ cột % (10 cột):
  - < 60 → background đỏ (#FFCDD2), text đỏ đậm
  - 60–79 → background cam nhạt (#FFE0B2), text cam đậm
  - ≥ 80 → background xanh nhạt (#C8E6C9), text xanh đậm
- Column widths: Project (150px), các % (70px), Tổng MR (80px)
- Row click → filter E6 theo project_name (Metabase cross-filter)

---

## E6 — Individual MR Score Breakdown — *(200 rows)*

**View:** `gitlab_kpi.v_mr_score_breakdown`

```sql
SELECT
    sort_order                                                  AS "#",
    criterion_label                                             AS "Tiêu chí",
    category                                                    AS "Hạng mục",
    severity                                                    AS "Mức độ",
    max_pts                                                     AS "Điểm tối đa",
    pts_earned                                                  AS "Điểm đạt",
    pts_gap                                                     AS "Điểm mất",
    criterion_result                                            AS "Kết quả",
    pct_of_score                                                AS "% score"
FROM gitlab_kpi.v_mr_score_breakdown
WHERE 1=1
ORDER BY sort_order
LIMIT 200
```

> ℹ️ Card có `LIMIT 200` — bản deploy dùng field-filter `mr_iid` / `project_name` để drill-down 1 MR; khi không lọc, hiển thị 200 dòng gần nhất theo sort_order.

**Sample:** `1 · CI pass/fail · Quality Gate · BLOCKER · 25 pts · đạt 25 · mất 0 · PASS · 55.6% score`

**Metabase setup:**
- Visualization: Table
- Conditional formatting cột "Kết quả": PASS → xanh (#43A047), PARTIAL → cam (#FB8C00), FAIL → đỏ (#E53935)
- Conditional formatting cột "Điểm mất": > 0 → đậm cam/đỏ tuỳ giá trị
- Filters: `mr_iid` (Number input), `project_name` (Text input hoặc dropdown)
- Thêm "summary row" ở cuối bảng (Metabase Table → Show totals) với sum(pts_earned) và sum(max_pts)
- Kết hợp với card header tóm tắt MR (iid, author, score, grade) ở trên cùng

---

## E8 — Formula Source & Detection Reference (v1.4) — *(10 rows)*

**View:** Static VALUES table — hardcoded trong `panels_collection_e`, reflects compliance spec
**Viz:** Table (full width) — update khi compliance_spec thay đổi + dbt run

```sql
SELECT
    sort_order                  AS "#",
    criterion                   AS "Tiêu chí",
    category                    AS "Hạng mục",
    severity                    AS "Mức độ",
    max_pts                     AS "Điểm tối đa",
    source_layer                AS "Tầng nguồn",
    source_table                AS "Bảng/View nguồn",
    source_column               AS "Cột nguồn",
    detection_logic             AS "Logic phát hiện (Python/SQL)",
    points_formula              AS "Công thức điểm (CASE WHEN)"
FROM (VALUES
    (1,
     'CI Pass/Fail',
     'Quality Gate',  'BLOCKER',  25,
     'stg_merge_requests → v_mr_compliance',
     'gitlab_raw.pipelines',
     'status, updated_at, ref (branch)',
     'JOIN latest pipeline per (project_id, source_branch) ORDER BY updated_at DESC. status=''success'' → ci_passed=TRUE. Fallback: merge_requests.ci_passed if already set.',
     'ci_passed=TRUE → 25 pts | FALSE → 0 pts'),

    (2,
     'Coverage absolute',
     'Quality Gate',  'REQUIRED', 10,
     'stg_pipelines → v_mr_compliance (latest_coverage CTE)',
     'gitlab_raw.pipelines',
     'coverage (FLOAT, nullable), status, ref',
     'Latest SUCCESSFUL pipeline (is_success=true, coverage IS NOT NULL) per (project_id, source_branch). NULL coverage = no test data for this branch.',
     'coverage≥80% → 10 pts | coverage≥60% → 5 pts | coverage<60% → 0 pts | coverage IS NULL → 0 pts (no data, not penalised by violation)'),

    (3,
     'Coverage delta',
     'Quality Gate',  'REQUIRED',  5,
     'stg_pipelines → v_mr_compliance (project_coverage_trend CTE)',
     'gitlab_raw.pipelines',
     'coverage, created_at, project_id',
     'recent_avg = AVG(coverage) WHERE created_at > NOW()-2w AND is_success AND coverage IS NOT NULL per project_id. prior_avg = AVG same for 2–4w window. delta = recent_avg - prior_avg. Neutral when either window is NULL (new project / CI gap).',
     'delta≥-5% → 5 pts | delta<-5% → 0 pts + COVERAGE_DROPPING violation | either window NULL → 5 pts (neutral — benefit of doubt)'),

    (4,
     'MR Size',
     'MR Size',       'BLOCKER',  15,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'additions (INT), deletions (INT) — từ single MR endpoint, KHÔNG phải list endpoint',
     'mr_size = COALESCE(additions,0) + COALESCE(deletions,0). diff_overflow=TRUE khi GitLab truncate diff (>10k lines) → count là partial, warning only. additions/deletions chỉ có ở GET /projects/:id/merge_requests/:iid (single), KHÔNG có ở list endpoint.',
     'mr_size≤400 LOC → 15 pts (XS/S/M) | mr_size≤700 → 8 pts (L) | mr_size>700 → 0 pts + MR_TOO_LARGE violation'),

    (5,
     'Description present',
     'Documentation', 'BLOCKER',  10,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'description (TEXT, nullable)',
     'Python extraction: has_description = len(description or '''') > 50. Minimum 50 chars để tránh placeholder như "fix bug" count là description.',
     'has_description=TRUE → 10 pts | FALSE → 0 pts + NO_DESCRIPTION violation'),

    (6,
     'Description template',
     'Documentation', 'REQUIRED',  5,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'description (TEXT) — parsed for 5 section headers',
     'Python extraction: has_description_template = count of found sections ≥ 3. Sections: §1=##.*[Tt]hay đổi/làm gì, §2=##.*[Tt]icket, §3=##.*[Kk]iểm tra, §4=##.*[Cc]hecklist/[Ss]elf-review, §5=##.*AI Disclosure. Violation only if has_description=TRUE but template missing.',
     'has_description_template=TRUE → 5 pts | FALSE → 0 pts + DESCRIPTION_MISSING_TEMPLATE (only when has_description=TRUE)'),

    (7,
     'Ticket reference',
     'Documentation', 'REQUIRED', 10,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'description (TEXT) — regex search',
     'Python extraction: has_ticket_ref = regex match for Jira key (ABC-123, PROJECT-456) OR GitLab issue ref (#123, !456) anywhere in description. Case-insensitive. Common patterns: "closes #123", "refs ABC-456", "PROJ-789".',
     'has_ticket_ref=TRUE → 10 pts | FALSE → 0 pts + NO_TICKET_REF violation'),

    (8,
     'AI Disclosure',
     'AI Compliance', 'REQUIRED',  5,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'description (TEXT) — checkbox state detection',
     'Python extraction: has_ai_disclosure = find "- [x] Không dùng AI" OR "- [x] Dùng AI" in description (GitLab saves ticked checkboxes as [x]). has_ai_disclosure_section (weaker) = section header present regardless of tick. has_ai_prefix = commit messages contain [AI] prefix.',
     'has_ai_disclosure=TRUE → 5 pts | FALSE → 0 pts + NO_AI_DISCLOSURE violation'),

    (9,
     'Branch naming',
     'Naming Convention', 'REQUIRED', 10,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'source_branch (TEXT)',
     'Python extraction: has_valid_branch_name = regex match ^(feat|fix|refactor|chore|hotfix|release|docs|test|ci|perf)/[A-Za-z0-9]+-[0-9]+-[a-z0-9-]+$. Type prefix + ticket-id + kebab-case description.',
     'has_valid_branch_name=TRUE → 10 pts | FALSE → 0 pts + BRANCH_NAMING_VIOLATION violation'),

    (10,
     'MR Title format',
     'Naming Convention', 'REQUIRED',  5,
     'gitlab_raw → stg_merge_requests',
     'gitlab_raw.merge_requests',
     'title (TEXT)',
     'Python extraction: has_conventional_title = Conventional Commits format: optional [AI] prefix, type(scope)!?: subject. Types: feat|fix|refactor|chore|docs|test|ci|perf|style|build|revert. ! = breaking change. Subject must be non-empty after colon.',
     'has_conventional_title=TRUE → 5 pts | FALSE → 0 pts + MR_TITLE_VIOLATION violation')

) AS t(sort_order, criterion, category, severity, max_pts,
       source_layer, source_table, source_column, detection_logic, points_formula)
ORDER BY sort_order
```

> Static VALUES table: 10 rows, 1 per scoring criterion (advisory screenshot/rebased không nằm trong bảng nguồn này).

**Mục đích:** Traceability — từ số điểm trên dashboard → biết chính xác đang đọc cột nào từ bảng nào với logic gì. Dùng khi cần debug hoặc điều chỉnh formula.

**Metabase setup:**
- Visualization: Table, full width
- Column widths: # (40px), Tiêu chí (160px), Hạng mục/Mức độ/Điểm (80px), các cột text dài (300–400px)
- Highlight cột "Công thức điểm (CASE WHEN)" — đây là cột để kiểm tra xem CASE WHEN đang đúng chưa
- **Không có filter** — đây là bảng định nghĩa tĩnh, không phụ thuộc data

---

## E9 — Detection Flag Distribution — Sanity Check (30d) — *(13 rows)*

**View:** `gitlab_kpi.v_mr_compliance` (+ `dim_user` cho filter department)

```sql
WITH base AS (
    SELECT
        m.ci_passed,
        m.has_description,
        m.has_description_template,
        m.has_ticket_ref,
        m.has_ai_disclosure,
        m.has_ai_disclosure_section,
        m.has_ai_prefix,
        m.has_valid_branch_name,
        m.has_conventional_title,
        m.test_coverage,
        m.coverage_delta,
        m.diff_overflow,
        m.mr_size,
        m.size_label
    FROM gitlab_kpi.v_mr_compliance m
    LEFT JOIN gitlab_kpi.dim_user du ON du.username = m.author_username
    WHERE m.created_at >= NOW() - INTERVAL '30 days'
),
totals AS (
    SELECT
        COUNT(*)                                                        AS total_mrs,
        COUNT(*) FILTER (WHERE ci_passed = true)                       AS ci_true,
        COUNT(*) FILTER (WHERE ci_passed = false)                      AS ci_false,
        COUNT(*) FILTER (WHERE ci_passed IS NULL)                      AS ci_null,
        COUNT(*) FILTER (WHERE has_description = true)                 AS desc_true,
        COUNT(*) FILTER (WHERE has_description = false)                AS desc_false,
        COUNT(*) FILTER (WHERE has_description IS NULL)                AS desc_null,
        COUNT(*) FILTER (WHERE has_description_template = true)        AS tmpl_true,
        COUNT(*) FILTER (WHERE has_description_template = false)       AS tmpl_false,
        COUNT(*) FILTER (WHERE has_description_template IS NULL)       AS tmpl_null,
        COUNT(*) FILTER (WHERE has_ticket_ref = true)                  AS ticket_true,
        COUNT(*) FILTER (WHERE has_ticket_ref = false)                 AS ticket_false,
        COUNT(*) FILTER (WHERE has_ticket_ref IS NULL)                 AS ticket_null,
        COUNT(*) FILTER (WHERE has_ai_disclosure = true)               AS ai_disc_true,
        COUNT(*) FILTER (WHERE has_ai_disclosure = false)              AS ai_disc_false,
        COUNT(*) FILTER (WHERE has_ai_disclosure IS NULL)              AS ai_disc_null,
        COUNT(*) FILTER (WHERE has_ai_disclosure_section = true)       AS ai_sec_true,
        COUNT(*) FILTER (WHERE has_ai_disclosure_section = false)      AS ai_sec_false,
        COUNT(*) FILTER (WHERE has_ai_disclosure_section IS NULL)      AS ai_sec_null,
        COUNT(*) FILTER (WHERE has_ai_prefix = true)                   AS ai_pfx_true,
        COUNT(*) FILTER (WHERE has_ai_prefix = false)                  AS ai_pfx_false,
        COUNT(*) FILTER (WHERE has_ai_prefix IS NULL)                  AS ai_pfx_null,
        COUNT(*) FILTER (WHERE has_valid_branch_name = true)           AS branch_true,
        COUNT(*) FILTER (WHERE has_valid_branch_name = false)          AS branch_false,
        COUNT(*) FILTER (WHERE has_valid_branch_name IS NULL)          AS branch_null,
        COUNT(*) FILTER (WHERE has_conventional_title = true)          AS title_true,
        COUNT(*) FILTER (WHERE has_conventional_title = false)         AS title_false,
        COUNT(*) FILTER (WHERE has_conventional_title IS NULL)         AS title_null,
        COUNT(*) FILTER (WHERE test_coverage IS NULL)                  AS cov_null,
        COUNT(*) FILTER (WHERE test_coverage IS NOT NULL)              AS cov_present,
        COUNT(*) FILTER (WHERE coverage_delta IS NULL)                 AS delta_null,
        COUNT(*) FILTER (WHERE coverage_delta IS NOT NULL)             AS delta_present,
        COUNT(*) FILTER (WHERE diff_overflow = true)                   AS overflow_count,
        COUNT(*) FILTER (WHERE mr_size = 0)                            AS zero_size_count
    FROM base
)
SELECT
    ord                                                                 AS "#",
    flag_name                                                           AS "Flag / Cột",
    source_note                                                         AS "Nguồn & ghi chú",
    true_n                                                              AS "TRUE / Có dữ liệu",
    false_n                                                             AS "FALSE / Không có",
    null_n                                                              AS "NULL",
    total_mrs                                                           AS "Tổng MR",
    ROUND(100.0 * true_n  / NULLIF(total_mrs, 0), 1)                    AS "TRUE %",
    ROUND(100.0 * null_n  / NULLIF(total_mrs, 0), 1)                    AS "NULL %",
    expected_range                                                       AS "Khoảng bình thường",
    CASE
        WHEN ROUND(100.0 * true_n / NULLIF(total_mrs, 0), 1) = 0
         AND flag_name NOT LIKE '%coverage%' AND flag_name NOT LIKE '%overflow%'
        THEN '🔴 0% — kiểm tra extraction'
        WHEN ROUND(100.0 * null_n / NULLIF(total_mrs, 0), 1) > 30
         AND flag_name IN ('ci_passed','has_description')
        THEN '🔴 NULL% cao — join bị thiếu?'
        WHEN ROUND(100.0 * true_n / NULLIF(total_mrs, 0), 1) = 100
        THEN '🟡 100% — kiểm tra logic có quá lỏng?'
        ELSE '🟢 Bình thường'
    END                                                                  AS "Cảnh báo"
FROM totals
CROSS JOIN LATERAL (VALUES
    (1,  'ci_passed',              'pipelines.status per branch (latest pipeline join)',
         ci_true,  ci_false,  ci_null,  '50–90% TRUE thường, 0% NULL vì có fallback'),
    (2,  'has_description',        'merge_requests.description (len > 50 chars)',
         desc_true, desc_false, desc_null, '60–95% TRUE tuỳ team'),
    (3,  'has_description_template','description — ≥3/5 sections regex (Python extraction)',
         tmpl_true, tmpl_false, tmpl_null, 'thấp hơn has_description vì yêu cầu template'),
    (4,  'has_ticket_ref',         'description — Jira key / GitLab issue regex',
         ticket_true, ticket_false, ticket_null, '50–85% TRUE'),
    (5,  'has_ai_disclosure',      'description — checkbox [x] ticked (scored, 5pts)',
         ai_disc_true, ai_disc_false, ai_disc_null, 'thường thấp, mục tiêu 30%+'),
    (6,  'has_ai_disclosure_section','description — section header present (unscored, weaker)',
         ai_sec_true, ai_sec_false, ai_sec_null, 'cao hơn has_ai_disclosure nếu checkbox chưa tích'),
    (7,  'has_ai_prefix',          'commit messages — [AI] prefix present (informational)',
         ai_pfx_true, ai_pfx_false, ai_pfx_null, 'informational, không ảnh hưởng score'),
    (8,  'has_valid_branch_name',  'source_branch — regex ^type/ticket-desc',
         branch_true, branch_false, branch_null, '40–80% TRUE, tùy team đã train chưa'),
    (9,  'has_conventional_title', 'title — Conventional Commits regex',
         title_true, title_false, title_null, '30–70% TRUE'),
    (10, 'test_coverage (NOT NULL)','pipelines.coverage — có dữ liệu coverage hay không',
         cov_present, cov_null, 0, 'NULL nghĩa là branch chưa có pipeline pass với coverage'),
    (11, 'coverage_delta (NOT NULL)','coverage 2w vs 4w window — cả 2 window phải có data',
         delta_present, delta_null, 0, 'NULL nhiều = bình thường với project mới hoặc CI không chạy coverage'),
    (12, 'diff_overflow (warning)', 'merge_requests.diff_overflow — GitLab truncated diff >10k lines',
         overflow_count, total_mrs - overflow_count, 0, 'nên gần 0, nếu cao thì mr_size không chính xác'),
    (13, 'mr_size = 0 (suspect)',  'mr_size = additions+deletions — nên > 0 cho MR thực',
         zero_size_count, total_mrs - zero_size_count, 0, 'nếu cao → extraction chưa lấy single-MR endpoint')
) AS v(ord, flag_name, source_note, true_n, false_n, null_n, expected_range)
ORDER BY ord
```

**Sample:** `1 · ci_passed · 3822 TRUE / 3993 FALSE / 0 NULL · 7815 MR · 48.9% TRUE · 🟢 Bình thường`

**Cách đọc:**

| Tín hiệu | Nghĩa | Action |
|----------|-------|--------|
| `TRUE % = 0%` (flag boolean) | Detection bị lỗi hoặc chưa ai đáp ứng | Debug Python extraction, chạy lại extraction |
| `TRUE % = 100%` (flag boolean) | Logic quá lỏng, không filter đúng | Kiểm tra regex/threshold |
| `NULL % > 30%` cho ci_passed/has_description | Join bị thiếu dữ liệu | Check stg_merge_requests join |
| `mr_size = 0` cao | extraction chưa dùng single MR endpoint | Xem `merge_requests.py` — phải call `/projects/:id/merge_requests/:iid` |
| `test_coverage NULL` cao | Bình thường nếu branch chưa có CI pass với coverage | Không phải lỗi |

**Metabase setup:**
- Visualization: Table
- Conditional formatting cột "Cảnh báo": text contains 🔴 → background đỏ nhạt
- Refresh: hàng ngày (sau dbt run)

---

## E10 — Raw Input Trace — Formula Debug per MR (recent 50) — *(500 rows)*

**View:** `gitlab_kpi.v_mr_score_breakdown` JOIN `gitlab_kpi.v_mr_compliance` (+ `dim_user`)

```sql
SELECT
    b.iid                                                               AS "MR !iid",
    b.project_name                                                      AS "Project",
    b.author_username                                                   AS "Author",
    b.compliance_score                                                  AS "Score tổng",
    b.compliance_grade                                                  AS "Grade",
    b.sort_order                                                        AS "#",
    b.criterion_label                                                   AS "Tiêu chí",
    b.category                                                          AS "Hạng mục",
    b.severity                                                          AS "Mức độ",
    -- Raw input value that was fed into this criterion's formula
    CASE b.criterion_name
        WHEN 'ci_pass'
            THEN m.ci_passed::text
              || ' [ci_status=' || m.ci_status || ']'
        WHEN 'coverage_absolute'
            THEN CASE WHEN m.test_coverage IS NULL
                      THEN 'NULL — không có coverage data trên branch này'
                      ELSE m.test_coverage::text || '%'
                 END
        WHEN 'coverage_delta'
            THEN CASE WHEN m.coverage_delta IS NULL
                      THEN 'NULL → +5pts neutral (chưa đủ 2 window data)'
                      ELSE m.coverage_delta::text || '% so với 2 tuần trước'
                 END
        WHEN 'mr_size'
            THEN m.mr_size::text
              || ' LOC (size_label=' || m.size_label || ')'
              || CASE WHEN m.diff_overflow THEN ' ⚠️ diff_overflow=TRUE, count là partial' ELSE '' END
        WHEN 'description'
            THEN m.has_description::text
              || ' [description len threshold: 50 chars]'
        WHEN 'description_template'
            THEN m.has_description_template::text
              || ' [cần ≥3/5 sections]'
        WHEN 'ticket_ref'
            THEN m.has_ticket_ref::text
              || ' [Jira key hoặc #issue trong description]'
        WHEN 'ai_disclosure'
            THEN m.has_ai_disclosure::text
              || ' [checkbox=[x]] | section_header='
              || m.has_ai_disclosure_section::text
              || ' | prefix=[AI] in commits='
              || m.has_ai_prefix::text
        WHEN 'branch_naming'
            THEN m.has_valid_branch_name::text
              || ' [branch: ' || LEFT(m.source_branch, 50) || ']'
        WHEN 'mr_title'
            THEN m.has_conventional_title::text
              || ' [title: ' || LEFT(m.title, 60) || ']'
    END                                                                 AS "Giá trị thực tế từ DB",
    b.max_pts                                                           AS "Điểm tối đa",
    b.pts_earned                                                        AS "Điểm đạt",
    b.pts_gap                                                           AS "Điểm mất",
    b.criterion_result                                                  AS "Kết quả"
FROM gitlab_kpi.v_mr_score_breakdown b
JOIN gitlab_kpi.v_mr_compliance m
  ON m.id = b.id
LEFT JOIN gitlab_kpi.dim_user du ON du.username = b.author_username
WHERE 1=1
ORDER BY b.created_at DESC, b.iid DESC, b.sort_order
LIMIT 500
```

> ℹ️ Card có `LIMIT 500` — ~50 MR gần nhất × 10 tiêu chí. Cột "Giá trị thực tế từ DB" là điểm khác biệt so với E6: E6 cho "tại sao được X điểm", E10 cho "công thức đọc giá trị gì từ DB".

**Sample:** `!249 · ftel-scm-api · huydv10 · score 20 · FAIL · 1 · CI pass/fail · false [ci_status=unknown] · 25/0/25 · FAIL`

**Use case chính:**
- Dev hỏi "tại sao MR của tôi bị -5 điểm AI Disclosure?" → mở E10, filter theo author → thấy `has_ai_disclosure=false, section_header=true` → biết là đã có section nhưng chưa tích checkbox
- QA kiểm tra "coverage_delta đang tính đúng chưa?" → xem cột "Giá trị thực tế" cho coverage_delta → so sánh với giá trị trong GitLab pipeline

**Metabase setup:**
- Visualization: Table
- Frozen columns: MR !iid, Project, Author, Score tổng, Grade (5 cols đầu)
- Conditional formatting cột "Kết quả": PASS=xanh, PARTIAL=cam, FAIL=đỏ
- Default sort: created_at DESC (MR mới nhất lên đầu)
- Group by MR: dùng Metabase "pivot" hoặc sort by iid để nhóm 10 tiêu chí cùng MR lại

---

## E11 — Commit Convention per MR — *(200 rows)*

**View:** `gitlab_kpi.v_mr_commit_convention`

```sql
SELECT
    '!' || iid::text                                                    AS "MR !iid",
    "Project",
    "Author",
    "State",
    "Compliance Score"                                                  AS "Score",
    "Grade",
    "Total Commits",
    "Conventional Commits"                                              AS "Conv. Commits",
    "Convention Rate (%)"                                               AS "Conv. Rate (%)",
    "AI Commits",
    "Breaking Commits"                                                  AS "Breaking",
    "Bad Commits",
    "Convention Health",
    "MR Title OK",
    "AI Disclosed",
    "MR Size (LOC)"                                                     AS "Size (LOC)",
    "Size Label"
FROM gitlab_kpi.v_mr_commit_convention
WHERE 1=1
ORDER BY created_at DESC
LIMIT 200
```

> ℹ️ Card có `LIMIT 200` — 200 MR gần nhất theo created_at DESC. Card mới, surface commit-level convention health (conventional-commit rate, breaking/AI/bad commit counts) song song với MR-level score.

**Sample:** `!353 · ecom-platform-web · hieupc · merged · score 25 · F · 1/1 commits · 100% conv · health FULL · title OK · 83 LOC · S`

**Metabase setup:**
- Visualization: Table
- Conditional formatting cột "Convention Health": FULL → xanh, PARTIAL → cam, LOW → đỏ
- Conditional formatting cột "Conv. Rate (%)": < 50 → đỏ, 50–79 → cam, ≥ 80 → xanh
- Conditional formatting cột "Bad Commits" / "Breaking": > 0 → cam/đỏ
- Cột boolean "MR Title OK" / "AI Disclosed": icon check/x
- Filters: author / project / state / date range (field-filter, mặc định không lọc)

---

## E12 — Score Simulator — Impact of Fixing Top Violations — *(10 rows)*

**View:** `gitlab_kpi.v_compliance_mgmt` + `gitlab_kpi.v_compliance_violation_detail` (+ `dim_user`)

```sql
WITH current_state AS (
    SELECT
        ROUND(AVG(cm.compliance_score)::numeric, 1) AS current_avg_score,
        COUNT(*) AS total_mrs
    FROM gitlab_kpi.v_compliance_mgmt cm
    LEFT JOIN gitlab_kpi.dim_user du1 ON du1.username = cm.author_username
    WHERE cm.created_at >= NOW() - INTERVAL '30 days'
),
violation_impact AS (
    SELECT
        d.violation_type,
        d.score_weight,
        COUNT(*) AS affected_mrs,
        ROUND(d.score_weight::numeric * COUNT(*)::numeric
              / NULLIF((SELECT total_mrs FROM current_state), 0), 1) AS avg_score_gain_if_fixed
    FROM gitlab_kpi.v_compliance_violation_detail d
    LEFT JOIN gitlab_kpi.dim_user du2 ON du2.username = d.author_username
    WHERE d.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY d.violation_type, d.score_weight
)
SELECT
    vi.violation_type AS "Violation",
    vi.score_weight AS "Points per Fix",
    vi.affected_mrs AS "Affected MRs",
    vi.avg_score_gain_if_fixed AS "Avg Score Gain if Fixed",
    ROUND(cs.current_avg_score + vi.avg_score_gain_if_fixed, 1) AS "Projected Avg Score",
    CASE
        WHEN cs.current_avg_score + vi.avg_score_gain_if_fixed >= 80 THEN 'Reaches PASS!'
        WHEN cs.current_avg_score + vi.avg_score_gain_if_fixed >= 60 THEN 'Reaches WARNING'
        ELSE 'Still below 60'
    END AS "Impact Level"
FROM violation_impact vi, current_state cs
ORDER BY vi.avg_score_gain_if_fixed DESC
```

> ℹ️ Card mới, "what-if" cho management: nếu toàn team fix hết 1 loại violation thì team avg score tăng bao nhiêu, có vượt ngưỡng WARNING (60) / PASS (80) không.

**Sample:** `CI_FAILED · 25 pts/fix · 3993 MRs · +12.8 gain · projected 52.3 · Still below 60`

**Metabase setup:**
- Visualization: Table
- Conditional formatting cột "Impact Level": "Reaches PASS!" → xanh, "Reaches WARNING" → cam, "Still below 60" → đỏ nhạt
- Conditional formatting cột "Avg Score Gain if Fixed": mini bar theo giá trị
- Sort mặc định: "Avg Score Gain if Fixed" DESC (đòn bẩy lớn nhất lên đầu)
- Không cần filter — snapshot 30 ngày, top violations toàn team

---

## Metabase Collection E — Layout

```
Row 1: [E1 — Compliance Criterion Weight Table (full width)]
        Quick reference + live performance, 12 hàng (gồm 2 advisory).

Row 2: [E3 — Score Decomposition by Category, Weekly Stacked (full width)]

Row 3: [E5 — Project × Criterion Heatmap (full width)]

Row 4: [E6 — Individual MR Drill-down (full width)]

─── COMMIT / SIMULATOR ─────────────────────────────────────────────────────

Row 5: [E11 — Commit Convention per MR (full width)]

Row 6: [E12 — Score Simulator (full width)]

─── FORMULA TRANSPARENCY (dành cho QA debug & kiểm tra logic) ───────────────

Row 7: [E8 — Formula Source & Detection Reference (full width)]
        Static table: bảng/cột/logic cho từng tiêu chí

Row 8: [E9 — Detection Flag Health Check (full width)]
        Live: phân phối TRUE/FALSE/NULL — phát hiện extraction bug

Row 9: [E10 — Raw Input Trace (full width)]
        Live: ~50 MR gần nhất × 10 tiêu chí — debug giá trị thực tế feed vào formula
```

**Global filters trên Collection:**
- Date range (date_from / date_to) — default: last 30 ngày
- Project name — default: ALL
- MR iid — chỉ áp dụng cho E6
- **E8 không có filter** — static reference table

> **Lịch sử drift:** E2 (Criterion Pass Rate — Worst First) và E4 (Points Left on Table) đã **remove khỏi production**. E7 đã hợp nhất vào E1 trước đó. Doc này đồng bộ đúng 9 card đang deploy: E1, E3, E5, E6, E8, E9, E10, E11, E12.
