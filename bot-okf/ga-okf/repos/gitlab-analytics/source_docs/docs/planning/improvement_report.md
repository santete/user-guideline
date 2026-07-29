# Báo cáo Cải tiến Toàn diện — GitLab Analytics Pipeline
# ENG-ANA-001 | 2026-04-13 → 2026-04-14

---

## 1. Tổng quan

Phiên làm việc bao gồm 4 giai đoạn chính:
1. **Gap Analysis** — phân tích dữ liệu đã cào, đánh giá thiếu gì cho compliance + KPI
2. **Data Improvement Plan (DIP)** — 3 phases bổ sung data extraction
3. **Dimension Layer + Dashboard Skill** — dim_user, v_kpi_control_panel, Collection F
4. **Dashboard Consolidation** — audit A-E, xóa trùng, thêm filter, thêm cards insight

---

## 2. Data Extraction Improvements (DIP 3 Phases)

### Phase 1 — Quick Wins: MR Enrichment

| Hạng mục | Chi tiết |
|----------|---------|
| **reviewer_usernames** | Cào từ MR list endpoint. Thực tế: ~0% MRs có reviewer (teams chưa adopt) |
| **approved_by_usernames** | Cào từ `/approvals` endpoint. Thực tế: chỉ 5-6 projects dùng approval |
| **merge_username** | Cào từ `/changes` endpoint. Thực tế: 96% MRs merged có merge_user |
| **is_draft** | Cào từ MR list endpoint. Thực tế: 7 draft MRs |
| **label_names** | Đã extract từ v1.0 nhưng bị drop khỏi staging — khôi phục lại |
| **group_members** | 617 members extracted. Email null (private) — dùng username + name |

**Gotcha phát hiện:** dlt không map Python list → PostgreSQL text[]. Phải lưu comma-separated text, staging parse bằng `string_to_array()`.

### Phase 2 — Review Quality KPI

| Hạng mục | Chi tiết |
|----------|---------|
| **NO_REVIEWER violation** | 20,207 MRs (99.7%) — advisory, score_weight=0 |
| **NOT_APPROVED violation** | 19,460 MRs (96.3%) — advisory, score_weight=0 |
| **mr_notes extraction** | 5,141 notes từ 1,549 MRs. Review rate: 1.6% |
| **v_review_quality** | time_to_first_comment (avg 1.9h), review_count, discussion_resolved_pct |
| **Identity mapping fix** | v_weekly_kpi join: email_prefix match (48%) + name match (24%) → ~72% coverage |

**Gotcha phát hiện:** compliance_updater generate violation_severity KHÔNG có trailing comma, nhưng file có column thủ công phía sau → syntax error. Phải fix tay sau mỗi `compliance_updater apply`.

### Phase 3 — Advanced Metrics

| Hạng mục | Chi tiết |
|----------|---------|
| **pipeline_jobs** | Table sẵn sàng, chờ extraction fill |
| **test_reports** | Table sẵn sàng, chờ extraction fill |
| **v_dora_metrics** | DORA 4: deploy freq, lead time, MTTR, change failure rate. Maturity levels: Elite/High/Low |
| **v_reviewer_workload** | Per-reviewer weekly: MRs reviewed, comments, response time, self-review detection |

**Gotcha phát hiện:** PostgreSQL `lead() FILTER (WHERE ...)` không tồn tại — phải dùng `LATERAL JOIN` thay thế. `round(double precision, int)` cũng không tồn tại — phải cast `::numeric`.

---

## 3. Dimension Layer + Dashboard Skill

### dim_user

| Hạng mục | Chi tiết |
|----------|---------|
| **seed_department_mapping.csv** | 35 users → 3 departments (Engineering, Engineering Management, QA). QA/HR điền thêm |
| **dim_user view** | username + name + role_label + department + team + manager_username |
| **Role labels** | Guest (10), Reporter (20), Developer (30), Maintainer (40), Owner (50) |
| **Unassigned** | 188/617 users chưa có department — fallback 'Unassigned' qua LEFT JOIN |

### v_kpi_control_panel

Central filterable view — 1 row per MR, enriched với user dimensions. Powers toàn bộ Collection F.

### Collection F — 10 cards

F1 Scorecard, F2 Dept Comparison, F3 Developer Timeline, F4 Project Health Matrix, F5 Role Analysis, F6 KPI Summary, F7 Monthly Trend, F8 Segmentation, F9 Executive Tiles, F10 Gap Waterfall.

### Slash Commands

| Command | Mục đích |
|---------|---------|
| `/insight` | Phân tích compliance + KPI theo 5 lenses. Output: executive summary + findings + actions |
| `/kpi-dashboard` | Generate Metabase card definition từ câu hỏi user. Output: SQL + template_tags + viz |

---

## 4. Dashboard Consolidation (Audit A-E)

### Cards đã XÓA (trùng lắp)

| Card | Lý do xóa | Card thay thế |
|------|-----------|---------------|
| A2b (Commit Lag scalar) | 3 scalar riêng lẻ → gộp 1 table | A2 (merged table) |
| A2c (Pipeline Lag scalar) | Tương tự | A2 (merged table) |
| C2b (AI LOC %) | Trùng C2a, chỉ khác metric | C2a (thêm LOC columns) |
| D2 (Latest MR Breakdown) | Chỉ show 1 MR — E6 đã thay với filter | E6 |
| B6 (Protected Branch 7d) | Overlap với A5 Active Violations | A5 + filter |

### Cards đã SỬA (vi phạm / thiếu sót)

| Card | Vấn đề | Fix |
|------|--------|-----|
| C6 | Dùng `gitlab_raw.commits` trực tiếp | Đổi sang `v_long_commit_violations` |
| D4 | Dùng `gitlab_raw.merge_requests` trực tiếp | Đổi sang `v_compliance_violation_detail` |
| A6 (A5 cũ) | Title "24h" nhưng query 7d | Sửa title thành "7 ngày" |
| A2 | 3 scalar cards | Merge thành 1 table card |

### Cards đã THÊM (HIGH priority improvements)

| Card | Collection | Mục đích |
|------|-----------|---------|
| A6 ETL Run History | A | Lịch sử pipeline state — debug khi fail |
| B10 Review Activity | B | Review rate, avg time, comments per project |
| B11 Dev x Week Heatmap | B | Color-coded score per dev per week |
| B12 WoW Delta | B | So sánh tuần này vs trước: score delta, trend |
| C7 DORA Summary | C | Deploy freq, lead time, MTTR, CFR per project |
| C8 Dept KPI Summary | C | Per-department: headcount, score, violation rate |
| C9 Improvement Roadmap | C | Prioritize violations theo impact |
| D9 Reviewer Workload | D | Who reviews, how many, response time |
| D10 Recurring Violator | D | Devs vi phạm 3+ tuần liên tiếp |
| E12 Score Simulator | E | "Fix violation X → score tăng bao nhiêu" |
| F9 Executive Tiles | F | 4 KPI tiles: Total MRs, Avg Score, Pass Rate, Violation Rate |
| F10 Gap Waterfall | F | Points lost per violation — waterfall chart |

### Filters đã thêm

Tất cả cards B/C/D (trước đó 0% filter) giờ có template_tags:
- `date_from` / `date_to` (date picker)
- `project_name` (text)
- `author_username` (text)

Collection F thêm: `department`, `role_label`

---

## 5. Số liệu trước/sau

| Metric | Bắt đầu | Kết thúc | Delta |
|--------|---------|----------|-------|
| dbt models | 24 | **33** | +9 |
| Metabase cards | ~50 | **58** | +8 net |
| Filter coverage | 12/51 (24%) | **46/58 (79%)** | +55pp |
| Data sources | 4 | **8** | +4 |
| Violations tracked | 10 | **12** | +2 |
| User dimensions | user, project, date | +department, role, team, manager | +4 |
| Skills | 0 | **2** | +2 |
| Extraction fields (MR) | 23 | **27** | +4 |
| Group members | 0 | **617** | +617 |
| MR notes | 0 | **5,141** | +5,141 |

---

## 6. Hiện trạng Compliance (thực tế)

| Metric | Giá trị | Nhận xét |
|--------|---------|----------|
| Avg compliance score | **31.2/100** | 70% điểm bị mất |
| PASS rate (>=80) | **0.0%** | Chưa MR nào đạt PASS |
| Score band 20-39 | **58.5%** MRs | Phần lớn |
| Score band 40-59 | **39.9%** MRs | Phần nhỏ hơn |
| Top violations | NO_REVIEWER, NO_AI_DISCLOSURE, BRANCH_NAMING | Mỗi ~13% tổng violations |
| Review coverage | **1.6%** | Gần như không review |
| Reviewer adoption | **0.0%** | Chưa assign reviewer |
| Top human reviewer | huytk4 (46 MRs/week, 0.3h avg) | 1 người review nhiều nhất |
| AI reviewer | codybot (238 MRs/week) | Bot review nhiều hơn người |

---

## 7. Đề xuất tiếp theo (chưa implement)

### CRITICAL
- **S-1:** Fill `seed_department_mapping.csv` đầy đủ — hiện chỉ 35/617 users (5.6%)
- **S-2:** Cân nhắc hạ threshold PASS từ 80 → 60 tạm thời (0% PASS = team demotivated)

### HIGH
- **S-3:** Thiết lập dashboard auto-refresh schedule (A: 15 phút, B-F: daily)
- **S-4:** Thêm "Last Updated" timestamp vào mỗi dashboard header
- **S-5:** Tổ chức training session cho QA Manager + EM cách dùng dashboard

### MEDIUM
- B-5: B10 thêm metric "MR merged without any comment" (98.4%)
- C-4: C3 Productivity Matrix đổi sang scatter plot
- D-3: D5 AI Disclosure thêm AI Commit Count + LOC%
- D-5: D9 highlight khi self-review > 50%
- E-3: E5 Heatmap color coding theo severity
- F-2: F4 traffic light emoji cho Health column
- F-4: F8 Segmentation thêm "Suggested Action" column

---

*Tài liệu tạo bởi Claude Code | 2026-04-14*
