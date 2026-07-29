# Dashboard Catalog — gitlab-analytics
**Version:** 2.0 | **Cập nhật:** 2026-05-19
**Standard:** MR Compliance Guide v1.6 (ENG-STD-MR-002) — distilled tại `docs/ai/internal_rules/01_MR_Compliance.md`

> **Single source of truth:**
> - **Card inventory + SQL** → `src/metabase/setup_dashboards.py` (53 cards script-managed; provisioned via Metabase REST API)
> - **Per-collection query refs** → `docs/dashboard_queries/collection_*.md`
> - **Compliance scoring** → `docs/ai/internal_rules/01_MR_Compliance.md` (v1.6 — 10 scoring + 2 advisory criteria)
>
> Catalog này là **doc cấp guide** — mô tả mục đích collection + bảng inventory chuẩn. Khi cần chính xác từng dòng SQL, dùng file ở trên.

---

## Mục đích tài liệu

Tài liệu này mô tả toàn bộ hệ thống dashboard Metabase của gitlab-analytics:
- **Công dụng của từng collection** — tại sao nó tồn tại, ai dùng, khi nào dùng
- **Card inventory chính thức** — đối chiếu với `setup_dashboards.py`
- **Quan hệ drill-down giữa các card**

**Đọc tài liệu này trước khi:** thêm chart mới, xoá chart, thay đổi query, onboard thành viên mới vào QA/EM role.

---

## Tổng quan hệ thống dashboard

| Collection | Refresh | Audience | Cards |
|---|---|---|---|
| **A — OPS HEALTH** | 15 phút (real-time) | QA Engineer, DevOps | 7 |
| **B — QA COMPLIANCE** | Daily (sau dbt run) | QA Manager, Team Lead | 16 |
| **C — ENGINEERING MGMT** | Weekly (Thứ Hai) | Engineering Manager | 6 |
| **D — DEEP DIVE** | On-demand | QA Engineer, Tech Lead | 8 |
| **E — FORMULA TRANSPARENCY** | Daily (sau dbt run) | QA Manager, Dev, EM | 9 |
| **F — KPI CONTROL PANEL** | Daily | EM, QA Lead, C-level | 9 |
| **Tổng** | | | **55** |

**Nguyên tắc thiết kế dashboard (SA-enforced):**
- L4 (Metabase) chỉ **đọc** từ `gitlab_kpi.*` views — không bao giờ write
- Mọi tính toán nằm trong dbt models, không trong Metabase query
- Mỗi card phải trả lời được: "Nhìn vào đây xong tôi làm gì?"

---

## Collection A — OPS HEALTH

**Mục đích cốt lõi:** Trả lời câu hỏi "Hệ thống data pipeline có đang chạy đúng không?" trong vòng 30 giây. Đây là **bảng điều khiển vận hành** — không phải để phân tích xu hướng, mà để phát hiện sự cố ngay khi xảy ra.

**Câu hỏi trung tâm:**
> "Data tôi đang nhìn trên dashboard có phải là data mới nhất và đáng tin không?"

**Người dùng:**
- QA Engineer: mở đầu tiên mỗi sáng trước khi triage violations
- DevOps on-call: kiểm tra khi có cảnh báo pipeline

### Inventory (7 cards)

| ID | Name | View / Source | Chart | Mục đích |
|---|---|---|---|---|
| A1 | Pipeline Health Status | `v_ops_pipeline_health` | Single Number ×3 | ETL có đang chạy đúng giờ không (HEALTHY/DEGRADED/BLOCKED) |
| A2 | Data Freshness — All Sources | `v_data_freshness` | Table | Mỗi nguồn (MR/commits/pipelines/...) cập nhật cách đây bao lâu |
| A3a | Ingestion Volume — 30 Days | `v_ingestion_volume_daily` | Stacked Bar | Số rows ingest mỗi ngày, breakdown theo source — phát hiện sụt giảm bất thường |
| A3b | Zero-Ingestion Days Alert | `v_ingestion_volume_daily` | Table | Ngày nào trong 7d gần đây có source = 0 rows (data gap detector) |
| A4 | Active Violations Feed | `v_violations` | Table (sortable) | Vi phạm trong 7 ngày qua — feed cho QA triage |
| A5 | Violations by Project (7 ngày) | `v_compliance_violation_detail` | Stacked Bar | Project nào nhiều violation nhất tuần này, breakdown theo loại |
| A6 | ETL Run History — Last 10 Runs | `gitlab_raw.pipeline_state` | Table | Cursors + last_success_at của từng source, debug khi nghi ngờ ETL stuck |

**Action triggers:**
- A1 `hours_since_last_run > 26` → missed 2 daily runs → check GitLab CI scheduler
- A1 `consecutive_failures ≥ 3` → trigger Healer agent, escalate to human
- A3b returns rows → có source bỏ ăn ≥ 1 ngày, check extraction logs
- A4 `score < 60` count > 20 trong ngày → flood, có thể là rule mới quá strict hoặc team-wide regression

---

## Collection B — QA COMPLIANCE

**Mục đích cốt lõi:** Đo lường **sức khỏe compliance của toàn team** theo thời gian. QA Manager dùng để báo cáo định kỳ, trả lời "chúng ta có đang cải thiện không?", và xác định nơi cần tập trung coaching.

**Câu hỏi trung tâm:**
> "Team có đang tuân thủ MR Compliance Guide v1.6 không? Tốt hơn hay xấu hơn so với tuần trước?"

**Người dùng:**
- QA Manager: weekly report, monthly review
- Team Lead: weekly 1:1 prep, coaching decision

**Lưu ý kiến trúc:** Mọi card trong collection B đều đọc từ `gitlab_kpi.v_compliance_mgmt`, `gitlab_kpi.v_compliance_violation_detail`, hoặc `gitlab_kpi.v_review_quality` — view được dbt build từ `gitlab_raw`. QA Manager không cần biết SQL.

### Inventory (16 cards)

| ID | Name | View | Chart | Mục đích |
|---|---|---|---|---|
| B1 | Compliance Score Distribution | `v_compliance_mgmt` | Bar (histogram) | Phân phối điểm 0–100 theo bucket — snapshot team health |
| B2 | Compliance Grade Trend (Weekly %) | `v_compliance_mgmt` | Line (PASS/WARN/FAIL) | Trend 8 tuần pass rate / warning / fail % |
| B4 | Violation Heatmap — Developer × Type | `v_compliance_violation_detail` | Pivot table | Dev × violation_type — coaching cá nhân hoá |
| B5 | MR Size Distribution Trend (8 weeks) | `v_compliance_mgmt` | Stacked Bar | XS/S/M/L/XL ratio theo tuần — coaching về MR splitting |
| B6 | Protected Branch MRs — Compliance | `v_compliance_mgmt` | Table | MRs vào protected branch — compliance phải nghiêm hơn |
| B7 | CI Pass Rate by Project (8 weeks) | `v_compliance_mgmt` | Line | CI green rate trend per project |
| B7b | CI Fail Detail per MR (drill-down) | `v_compliance_mgmt` | Table | Drill-down từ B7: MR cụ thể nào fail CI tuần đó |
| B8 | Cycle Time — Avg / P50 / P90 (12 weeks) | `v_cycle_time_stats` | Line | Cycle time trend với percentile |
| B9 | Test Coverage Trend by Project (12 weeks) | `v_compliance_mgmt` | Line | Coverage % trend per project |
| B9b | Coverage Detail per MR (drill-down) | `v_mr_compliance` | Table | Drill-down từ B9: MR cụ thể nào dragging coverage |
| B10 | Review Activity Summary (30d) | `v_review_quality` | Bar | Số review per reviewer trong 30d (DIP Phase 2) |
| B11 | Review Detail per MR (drill-down) | `v_review_quality` | Table | Drill-down từ B10: từng MR có bao nhiêu review, ai review |
| B12 | Week-over-Week Compliance Delta | `v_compliance_mgmt` | Bar | WoW thay đổi pass rate per project — phát hiện regression |
| B13 | Author Compliance Trend (30 days) | `v_compliance_mgmt` | Line (top 5 declining) | Top declining authors 30d — coaching trigger |
| B14 | Screenshot Adoption — UI MRs (8 weeks) | `v_compliance_mgmt` | Line | **[Phase A v1.6 advisory]** % MR UI có screenshot theo tuần |
| B15 | Rebase Compliance Rate (8 weeks) | `v_compliance_mgmt` | Line | **[Phase A v1.6 advisory]** % MR rebased trước merge theo tuần |

**Drill-down chains:**
- B7 → B7b (CI fail detail)
- B9 → B9b (coverage detail per MR)
- B10 → B11 (review detail per MR)
- B13 (declining author) → D2/E6 (single-MR audit)

**Phase A v1.6 advisory (B14/B15):** R-MR-005 (screenshot khi MR UI) + R-MR-006 (rebase) thêm 2026-05-17 với `score_weight=0` → preserve 0–100 score contract, surface adoption signal. Cards hiện đang empty vì data gap (xem `docs/mr-compliance/v1.6_ci_quality_gate_plan.md` cho roadmap fill data).

---

## Collection C — ENGINEERING MGMT

**Mục đích cốt lõi:** Cung cấp **strategic view** cho Engineering Manager. Khác với Collection B (compliance focus), Collection C đo **đầu ra**, **AI adoption**, và **distribution chất lượng commits**.

**Câu hỏi trung tâm:**
> "Team tôi có đang phát triển đúng hướng không? Ai cần support? Project nào rủi ro cao?"

**Người dùng:**
- Engineering Manager: monthly review, quarterly planning
- Team Lead: weekly 1:1 preparation

### Inventory (6 cards)

| ID | Name | View | Chart | Mục đích |
|---|---|---|---|---|
| C1 | Team Leaderboard — Current Month | `v_team_leaderboard` | Table (parameterized) | Per developer: avg_score, violation_rate, trend, grade |
| C1b | Developer MR Detail (drill-down from C1) | `v_compliance_mgmt` | Table | Per developer all MRs trong tháng — chuẩn bị 1:1 |
| C2 | AI Adoption — Commit % by Project (12w) | `v_ai_adoption` | Line | AI commit% theo project theo tuần |
| C4 | Weekly Commit Quality — Good vs AI vs Bad | `v_weekly_kpi` | Stacked Bar | Clean / AI / bad_msg / long_msg per week |
| C6 | Long Commit Messages (>500 chars) — 30d | `v_long_commit_violations` | Table | Dev/project nào viết commit message dài bất thường — Push Rules check |
| C9 | Compliance Improvement Roadmap — Fix Priority | `v_compliance_violation_detail` | Table | Violation type theo `avg_points_lost × occurrence` — chọn fix priority |

**Cards đã ARCHIVED** (vốn ở Collection C): C3 (Productivity Matrix scatter), C5 (Project Health Scorecard), C7, C8 — replaced bởi F4 (Project Health Matrix) ở Collection F.

---

## Collection D — DEEP DIVE Investigation

**Mục đích cốt lõi:** Bộ công cụ **điều tra on-demand**. Không dùng hàng ngày — dùng khi có câu hỏi cụ thể ("tại sao MR !87 bị điểm thấp?", "dev này vi phạm gì trong 3 tháng qua?").

**Câu hỏi trung tâm:**
> "Tôi cần biết chính xác chuyện gì đã xảy ra với MR/developer/project cụ thể này."

**Người dùng:**
- QA Engineer: điều tra incident, chuẩn bị 1:1
- QA Manager: verify specific violation before escalation
- DevOps: investigate webhook DLQ + pipeline failure streaks

### Inventory (8 cards)

| ID | Name | View | Chart | Mục đích |
|---|---|---|---|---|
| D3 | Violation Category Deep Dive (30 days) | `v_compliance_violation_detail` | Table + trend | Parameterized by `violation_type` — list MRs + trend |
| D5 | AI Disclosure Tracker — Undisclosed Summary | `v_ai_disclosure_tracker` | Table | Dev nào có AI commits nhưng không khai báo trong MR description |
| D6a | Pipeline Failures — Current Streaks | `v_pipeline_failures` | Table | Branches đang fail liên tiếp; severity + protected flag |
| D6b | Pipeline Failure Trend (7 days) | `v_pipeline_failures` | Line | Failure count theo ngày 7d gần đây |
| D7 | Outlier MRs — XL Size (>700 LOC) | `v_mr_compliance` | Table | All XL MRs 30d — coaching về MR splitting |
| D8 | Webhook DLQ Monitor | `v_dlq_monitor` | Table (triage priority) | Webhook events fail chưa xử lý; CRITICAL flag → alert ngay |
| D9 | Reviewer Workload Analysis | `v_reviewer_workload` | Table | Reviewer nào quá tải (top 10), avg review per MR |
| D10 | Recurring Violator Alert — 3+ Weeks Same Violation | `v_compliance_violation_detail` | Table | Dev cùng 1 violation_type 3 tuần liên tiếp — escalation signal |

**Cards đã ARCHIVED:** D1 (Single Developer Full Profile — replaced bởi F1+F3), D2 (Single MR Compliance Audit — replaced bởi E6+F6), D4 (Branch Naming List — merged vào D3 với `branch_prefix_used`), D6 (split thành D6a + D6b).

---

## Collection E — FORMULA TRANSPARENCY

**Mục đích cốt lõi:** Giải thích **tại sao** một MR được điểm như vậy. Collection này tồn tại để:
1. Developer hiểu công thức và tự cải thiện
2. QA kiểm tra logic tính điểm có đúng không
3. EM tin tưởng vào số liệu

**Câu hỏi trung tâm:**
> "Điểm 73/100 này đến từ đâu? Tiêu chí nào team đang làm kém nhất?"

**Người dùng:**
- QA Manager: validate formula, trust in numbers
- Developer: self-service "tại sao tôi bị trừ điểm"
- Engineering Manager: understand what drives the KPI

### Inventory (9 cards)

| ID | Name | View | Chart | Mục đích |
|---|---|---|---|---|
| E1 | Compliance Criterion Weight Table (30d) | `v_compliance_criterion_stats` | Table (mini bar) | 12 criterion (10 scoring + 2 advisory): max_pts, pass_rate, avg_pts_lost |
| E3 | Score Decomposition by Category — Weekly (12w) | `v_compliance_criterion_stats` | Stacked Bar | avg_pts_earned per category theo tuần — category nào đang kéo điểm |
| E5 | Criterion × Project Heatmap — Pass Rate (30d) | `v_compliance_criterion_stats` | Heatmap table | criterion × project pass rate — project/criterion nào weak |
| E6 | Individual MR Score Breakdown | `v_mr_score_breakdown` | Table (12 rows/MR) | Per criterion per MR: earned/max points, PASS/PARTIAL/FAIL |
| E8 | Formula Source & Detection Reference (v1.6) | Hardcoded VALUES | Static table | Per criterion: nguồn DB, cột nguồn, detection logic, công thức điểm |
| E9 | Detection Flag Distribution — Sanity Check (30d) | `v_mr_compliance` | Table (warning) | TRUE%/NULL% per boolean flag — phát hiện extraction bug |
| E10 | Raw Input Trace — Formula Debug per MR (50) | `v_mr_score_breakdown` + `v_mr_compliance` | Table | 50 MR gần nhất × 12 criterion với giá trị raw + computed |
| E11 | Commit Convention per MR | `v_mr_commit_convention` | Table | Per MR: tỷ lệ commit subject match Conventional Commits |
| E12 | Score Simulator — Impact of Fixing Top Violations | `v_compliance_mgmt` + `v_compliance_violation_detail` | Table | "Nếu fix top 3 violation, score trung bình sẽ tăng bao nhiêu?" |

**Cards đã ARCHIVED:** E2 (Criterion Pass Rate — merged vào E1), E4 (Points Left on Table — merged vào E1 cột `avg_pts_lost`), E7 (Formula Live Reference — replaced by E1 với mini bar).

**v1.6 advisory rows in E1/E5/E6:** 2 dòng/cột `screenshot_when_ui` + `rebased` với `is_advisory=true` — frontend lọc cờ này để tách "scoring breakdown" vs "adoption widget". E1 hiển thị weight=0 + ghi chú "Advisory — không tính vào compliance_score". E6 hiển thị PASS/FAIL nhưng `pct_of_score=NULL`.

---

## Collection F — KPI CONTROL PANEL

**Mục đích cốt lõi:** **Executive dashboard với cross-filterable KPIs**. EM và C-level vào đây để xem tổng quan và drill xuống Department / Role / Project / Developer — không cần SQL.

**Câu hỏi trung tâm:**
> "Phòng nào / role nào / project nào đang dẫn dắt? Developer nào ở segment nào (Champion / At-Risk / ...) ?"

**Người dùng:**
- Engineering Manager: monthly + quarterly review
- QA Lead: cross-functional analysis
- C-level: high-level KPI tiles

**Lưu ý kiến trúc:** Toàn bộ collection F đọc từ 1 view duy nhất `gitlab_kpi.v_kpi_control_panel` (denormalized cross-domain) + `v_weekly_kpi` + `v_dora_metrics` + `v_project_health_scorecard` cho F4. Tất cả card share cùng 6 filter (`date_from`, `date_to`, `department`, `role_label`, `project_name`, `author_username`) qua `_f_tags()` helper trong `setup_dashboards.py`.

### Inventory (9 cards)

| ID | Name | View | Chart | Mục đích |
|---|---|---|---|---|
| F9 | Executive KPI Tiles | `v_kpi_control_panel` | Single Number ×4 | Total MRs / Avg Score / Pass Rate % / Violation Rate % |
| F1 | Developer Compliance Scorecard | `v_kpi_control_panel` + `v_weekly_kpi` | Table | Per developer: MR count, commits, LOC, score, pass rate, coverage, cycle time |
| F2 | So sánh giữa các Phòng (Department Comparison) | `v_kpi_control_panel` | Bar | Department: MR count, avg score, violation rate, active devs |
| F3 | Developer Timeline — Score Trend | `v_kpi_control_panel` | Line (top 15) | Score trend 12 tuần cho top 15 active developer (or filtered) |
| F4 | Project Health Matrix (Compliance + DORA) | `v_kpi_control_panel` + `v_dora_metrics` + `v_project_health_scorecard` | Table | Per project: score, CI %, coverage, cycle, AI %, deploy/wk, lead time, MTTR, CFR, Health (GREEN/YELLOW/RED) |
| F5 | Role-based Analysis | `v_kpi_control_panel` | Bar | Per role (Owner/Maintainer/Developer/Reporter): avg score + pass rate |
| F6 | KPI Summary — All Metrics | `v_kpi_control_panel` | Table (500 rows) | Full row-level MR list — all metrics, mọi filter combo |
| F7 | Monthly Compliance Trend by Department | `v_kpi_control_panel` | Line | Department monthly avg score — long-term trend |
| F8 | Developer Segmentation — Compliance × Output | `v_kpi_control_panel` | Table | Per dev: segment ∈ {Champion, Speed Demon, Careful, At-Risk} dựa trên score × MR count |

**Filter behavior:** 6 filter của F8 (`_f_tags(8)`) — most permissive, dùng `_f_where()` (đầy đủ optional WHERE chain). F2/F5/F7 lược bớt filter không liên quan (`role_label`, `author_username`, ...) để chart không bị over-filtered.

---

## Phase A v1.6 expansion (2026-05-17)

**Bối cảnh:** MR Compliance Guide nâng lên v1.6 (`docs/ai/internal_rules/01_MR_Compliance.md`) — thêm R-MR-005 (screenshot/GIF khi MR UI/Frontend) + R-MR-006 (rebase với target branch). Phase A surface 2 rule này ở **advisory mode** (score_weight=0) — track adoption mà không thay đổi 0–100 score contract.

**dbt view changes (auto-pickup, không cần edit Metabase):**
- `v_compliance_violation_detail` — thêm 2 code `NO_SCREENSHOTS_UI` + `NOT_REBASED` (label/category/score_weight/severity); category = `Security & Process`
- `v_compliance_criterion_stats` — thêm criterion `screenshot_when_ui` (5pt display) + `rebased` (3pt display); cờ `is_advisory=true`
- `v_mr_score_breakdown` — 12 dòng/MR thay vì 10; `pct_of_score=NULL` cho 2 advisory row
- `stg_merge_requests` — `is_rebased` derive từ `diverged_commits_count` (3-state: null=unknown=PASS, 0=rebased=PASS, >0=NOT_REBASED)

**Cards mới (script-managed):** B14 (Screenshot Adoption) + B15 (Rebase Compliance Rate) — đã deploy vào panels_collection_b. Query lấy denominator từ `is_ui_related=true` (B14) hoặc `diverged_commits_count IS NOT NULL` (B15).

**Decision: advisory weight (option B):**
- Giữ score 0–100 ổn định → không phải migrate Metabase filter "score < 80 = warning"
- 2 rule REQUIRED severity → vẫn appear trong alert + leaderboard nhưng không trừ điểm
- Khi adoption stabilises (target v1.7) → promote sang `score_weight > 0` + bump total max

**Data gap (still pending):** B14/B15 hiện empty vì (a) extraction chưa re-run với `include_diverged_commits_count`, (b) dataset chưa có UI labels populated. Roadmap fill data + CI quality gate đề xuất xem `docs/mr-compliance/v1.6_ci_quality_gate_plan.md`.

---

## Cleanup history (cards archived hoặc replaced)

| Date | Cards archived | Lý do |
|---|---|---|
| 2026-04 (DIP Phase A) | B3, C3, C5, C7, C8, D1, D4, E2, E4, F10 | Duplicate / replaced bởi view-driven hoặc merge vào card khác |
| 2026-05-14 | A3 (renamed → A3a, plus new A3b) | Split ingestion volume thành 30d trend + zero-day alert |
| 2026-05-14 | D6 (renamed → D6a + D6b) | Tách "current streaks" vs "trend 7d" |
| 2026-05-14 | E7 (merged vào E1) | E1 với mini bar cover được use case của E7 |
| 2026-05-14 | 6 version-drift cards (A2 ×3, A5, B11, C2 prefix collision) | Cleanup sau audit reconciliation |
| 2026-05-17 | — | **2 cards added:** B14 + B15 (Phase A v1.6 advisory) |

**Final state (2026-05-19):** 55 active cards = 55 script-managed = 0 drift. Bất kỳ card ngoài 55 trong Metabase production → ARCHIVED hoặc cần promote vào `setup_dashboards.py`.

---

## Tham chiếu

| Tài liệu | Nội dung |
|---|---|
| [../dashboard_queries/collection_a_ops_health.md](../dashboard_queries/collection_a_ops_health.md) | Query chi tiết Collection A |
| [../dashboard_queries/collection_b_qa_compliance.md](../dashboard_queries/collection_b_qa_compliance.md) | Query chi tiết Collection B |
| [../dashboard_queries/collection_c_engineering_mgmt.md](../dashboard_queries/collection_c_engineering_mgmt.md) | Query chi tiết Collection C |
| [../dashboard_queries/collection_d_deep_dive.md](../dashboard_queries/collection_d_deep_dive.md) | Query chi tiết Collection D |
| [../dashboard_queries/collection_e_formula_transparency.md](../dashboard_queries/collection_e_formula_transparency.md) | Query chi tiết Collection E |
| [../ai/internal_rules/01_MR_Compliance.md](../ai/internal_rules/01_MR_Compliance.md) | MR Compliance Guide v1.6 (distilled — single source of truth) |
| [../mr-compliance/MR_Compliance_Guide_v1.4.md](../mr-compliance/MR_Compliance_Guide_v1.4.md) | MR Compliance Guide v1.4 (historical — full prose) |
| [../mr-compliance/compliance_spec.yaml](../mr-compliance/compliance_spec.yaml) | YAML source-of-truth: 12 violations + score weights |
| [../mr-compliance/v1.6_ci_quality_gate_plan.md](../mr-compliance/v1.6_ci_quality_gate_plan.md) | Phase A v1.6 data fill + CI quality gate plan |
| [../reference/schema_reference.md](../reference/schema_reference.md) | Schema gitlab_raw + gitlab_kpi |
| [qa_dashboard_guide.md](qa_dashboard_guide.md) | QA/EM user guide — cách đọc dashboard + checklist hàng ngày |
| `src/metabase/setup_dashboards.py` | **Canonical inventory** — 55 cards script-managed |
