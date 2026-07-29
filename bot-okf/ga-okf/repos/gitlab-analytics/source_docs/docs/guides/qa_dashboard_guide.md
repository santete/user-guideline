# QA Dashboard Guide — Hướng dẫn đọc hiểu Dashboard Metabase
> ENG-ANA-001 | v2.1 | Cập nhật: 2026-05-19
>
> Dành cho: QA Engineer, QA Lead, Engineering Manager, Tech Lead
>
> Compliance Formula: **v1.6** (10 tiêu chí scoring + 2 advisory, 12 loại vi phạm)
>
> Single source of truth: `docs/ai/internal_rules/01_MR_Compliance.md` (rule definitions), `src/metabase/setup_dashboards.py` (card inventory).

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Hệ thống tính điểm Compliance v1.6](#2-hệ-thống-tính-điểm-compliance-v16)
3. [Collection A — OPS HEALTH](#3-collection-a--ops-health)
4. [Collection B — QA COMPLIANCE](#4-collection-b--qa-compliance)
5. [Collection C — ENGINEERING MGMT](#5-collection-c--engineering-mgmt)
6. [Collection D — DEEP DIVE](#6-collection-d--deep-dive)
7. [Collection E — FORMULA TRANSPARENCY](#7-collection-e--formula-transparency)
8. [Collection F — KPI CONTROL PANEL](#8-collection-f--kpi-control-panel)
9. [Lịch kiểm tra & Checklist](#9-lịch-kiểm-tra--checklist)
10. [Câu hỏi thường gặp](#10-câu-hỏi-thường-gặp)

---

## 1. Tổng quan hệ thống

### Kiến trúc Dashboard

```
GitLab API v4
   |
   v
ETL Pipeline (dlt) ---> PostgreSQL (gitlab_raw)
                              |
                              v
                         dbt transform ---> KPI Views (gitlab_kpi)
                              |
                              v
                         Metabase (port 3000)
                              |
                    +---------+---------+---------+---------+---------+
                    |         |         |         |         |         |
                 Coll. A   Coll. B   Coll. C   Coll. D   Coll. E   Coll. F
                OPS HEALTH  QA       MGMT     DEEP DIVE  FORMULA    KPI
                            COMPLIANCE                  TRANSPARENCY CONTROL
```

### 6 Collections — ai cần xem gì

| Collection | Dashboard | Đối tượng chính | Tần suất xem |
|---|---|---|---|
| **A** | OPS: Pipeline & Data Health | DevOps, QA Lead | Hàng ngày (sáng) |
| **B** | QA: Compliance & Violations | QA Engineer, QA Lead | Hàng ngày + tuần |
| **C** | MGMT: Team Performance & AI Adoption | Engineering Manager | Hàng tuần + tháng |
| **D** | DRILL: Investigation & Deep Analysis | QA Lead, Tech Lead | Khi cần điều tra |
| **E** | FORMULA: Compliance Scoring Transparency | Mọi người | Khi cần hiểu điểm |
| **F** | KPI: Compliance Insight & Control Panel | EM, QA Lead, C-level | Tuần + tháng |

---

## 2. Hệ thống tính điểm Compliance v1.6

### 10 tiêu chí scoring, tổng 100 điểm

| # | Tiêu chí | Hạng mục | Mức độ | Điểm tối đa | Đạt khi nào |
|---|---|---|---|---|---|
| 1 | **CI Pipeline pass** | Quality Gate | BLOCKER | 25 | Pipeline status = success |
| 2 | **Test coverage tuyệt đối** | Quality Gate | REQUIRED | 10 | >= 80% = 10, >= 60% = 5, < 60% = 0 |
| 3 | **Coverage delta (xu hướng)** | Quality Gate | GOOD_PRACTICE | 5 | Không giảm so với 2 tuần trước = 5, giảm < 5% = 3, giảm >= 5% = 0 |
| 4 | **MR size hợp lý** | MR Size | REQUIRED | 15 | <= 200 LOC = 15, <= 400 = 12, <= 700 = 8, > 700 = 0 |
| 5 | **Có mô tả MR** | Documentation | REQUIRED | 10 | Description > 50 ký tự |
| 6 | **Dùng description template** | Documentation | GOOD_PRACTICE | 5 | Có dùng MR template của team |
| 7 | **Có tham chiếu ticket** | Documentation | REQUIRED | 10 | Có link Jira/GitLab issue trong description |
| 8 | **AI disclosure** | AI Compliance | REQUIRED | 5 | Tách 2 chiều — xem ghi chú dưới bảng |
| 9 | **Branch naming convention** | Naming Convention | REQUIRED | 10 | Theo format: feature/xxx, fix/xxx, hotfix/xxx... |
| 10 | **MR title convention** | Naming Convention | GOOD_PRACTICE | 5 | Theo Conventional Commits: feat:, fix:, chore:... |

> **Severity v1.6**: Mức độ `INFO` (v1.4) đã được rename thành `GOOD_PRACTICE` ở tiêu chí 3, 6, 10 — vẫn trừ điểm như cũ, nhưng phản ánh đúng tính chất "khuyến nghị" (không phải "thông tin").
>
> **AI Disclosure (tiêu chí 8 — v1.6 tách 2 chiều)**:
> - `R-COMMIT-002-AI` — tag `[AI]` cuối subject line của mỗi commit do AI sinh
> - `R-MR-003-AI-DISCLOSURE` — MR description PHẢI chọn ĐÚNG 1 trong 2 option (✅ Có dùng AI / ❌ Không dùng AI), mutually exclusive
>
> Điểm cộng đủ 5 khi **cả 2 chiều khớp nhau**; mismatch (vd tick "không AI" nhưng có commit `[AI]`) → 0 điểm + violation `NO_AI_DISCLOSURE`.

### 2 tiêu chí advisory (v1.6 Phase A — không trừ điểm, chỉ flag)

| Rule ID | Tiêu chí | Khi nào áp dụng | Hành vi |
|---|---|---|---|
| `R-MR-005-SCREENSHOTS-UI` | Screenshot cho MR UI | MR có `is_ui_related = true` (chạm UI/component) | Khuyến nghị attach screenshot trước/sau. Track ở [B14]. |
| `R-MR-006-REBASED` | Rebase trước MR | MR có `diverged_commits_count = 0` (đã rebase trên base branch) | Khuyến nghị rebase để giữ history linear. Track ở [B15]. |

> **Advisory weight = 0** — không ảnh hưởng compliance score, chỉ tracking trend. Phase B (Q3/2026) sẽ review xem có promote thành scoring criteria hay không.

### Ngưỡng đánh giá

| Score | Grade | Ý nghĩa | Hành động |
|---|---|---|---|
| **80 - 100** | PASS | Tuân thủ tốt | Không cần can thiệp |
| **60 - 79** | WARNING | Cần chú ý | Nhắc nhở developer |
| **0 - 59** | FAIL | Vi phạm nghiêm trọng | Yêu cầu fix trước khi merge |

### 12 loại vi phạm

| Violation Code | Tiêu chí bị vi phạm | Điểm mất | Hành động |
|---|---|---|---|
| `CI_FAILED` | CI Pipeline | -25 | Kiểm tra CI log: test fail hay infra lỗi? |
| `LOW_COVERAGE` | Coverage tuyệt đối | -5 ~ -10 | Bổ sung unit test |
| `COVERAGE_DROPPING` | Coverage delta | -2 ~ -5 | Code mới chưa có test tương ứng |
| `MR_TOO_LARGE` | MR size | -7 ~ -15 | Split MR thành nhiều phần nhỏ |
| `NO_DESCRIPTION` | Mô tả MR | -10 | Điền description theo template |
| `DESCRIPTION_MISSING_TEMPLATE` | Description template | -5 | Enable MR template trong repo |
| `NO_TICKET_REF` | Tham chiếu ticket | -10 | Thêm link Jira/GitLab issue |
| `NO_AI_DISCLOSURE` | AI disclosure | -5 | Thêm checkbox AI trong MR description |
| `BRANCH_NAMING_VIOLATION` | Branch naming | -10 | Đổi tên branch theo format chuẩn |
| `MR_TITLE_VIOLATION` | MR title | -5 | Sửa title theo Conventional Commits |
| `NO_REVIEWER` | Review process | 0 (flag) | Assign reviewer cho MR |
| `NOT_APPROVED` | Review process | 0 (flag) | Yêu cầu approval trước merge |

> **Lưu ý:** `NO_REVIEWER` và `NOT_APPROVED` hiện là flag cảnh báo, chưa trừ điểm, nhưng được track để báo cáo review quality.

---

## 3. Collection A — OPS HEALTH

**Dashboard: "OPS: Pipeline & Data Health"**

> Mục đích: Đảm bảo hệ thống đang hoạt động bình thường, data đang fresh, extraction không bị gián đoạn.
> Xem: Mỗi sáng trước khi xem bất kỳ dashboard nào khác.

### [A1] Pipeline Health Status

- **Loại:** Scalar (1 con số/trạng thái)
- **View:** `v_ops_pipeline_health`
- **Hiển thị:** Trạng thái ETL pipeline dưới dạng đèn giao thông

| Trạng thái | Nghĩa | Hành động |
|---|---|---|
| HEALTHY | 0 failures, ETL chạy đúng lịch | Không cần làm gì |
| DEGRADED | 1-2 failures liên tiếp | Healer đang tự retry, theo dõi thêm 1 run |
| **BLOCKED** | >= 3 failures liên tiếp | **Healer đã bỏ cuộc.** Cần can thiệp thủ công ngay (xem ops_runbook.md) |

- **`hours_since_last_run`:** Nếu > 26h = bỏ lỡ 2 lần chạy liên tiếp.

**Cách đọc:** Nếu thấy BLOCKED, toàn bộ data trên dashboard khác **không đáng tin** cho đến khi pipeline được khôi phục.

---

### [A2] Data Freshness — All Sources

- **Loại:** Table (1 dòng duy nhất)
- **View:** `v_data_freshness`
- **Hiển thị:** Thời gian sync cuối cùng và độ trễ (lag) cho 3 nguồn data chính

| Cột | Ý nghĩa |
|---|---|
| `mr_lag_hours` | Bao lâu chưa sync Merge Requests |
| `commit_lag_hours` | Bao lâu chưa sync Commits |
| `pipeline_lag_hours` | Bao lâu chưa sync Pipelines |

| Lag | Status | Nghĩa |
|---|---|---|
| < 2h | OK | Data fresh, tin tưởng được |
| 2 - 24h | WARNING | Có thể bỏ lỡ 1 run, kiểm tra |
| > 24h | **CRITICAL** | Pipeline chết hoặc bị skip nhiều lần |

**Quy tắc vàng:** Luôn kiểm tra card này TRƯỚC KHI đọc bất kỳ số liệu nào. Data stale = mọi insight đều sai.

---

### [A3a] Ingestion Volume — 30 Days

- **Loại:** Bar chart (stacked)
- **View:** `v_ingestion_volume_daily`
- **Hiển thị:** Số rows được ingest mỗi ngày, chia theo source (MR, commits, pipelines, mr_commits)

**Cách đọc:**
- **Pattern bình thường:** Ngày thường cao (200+ MRs, 1000+ commits), cuối tuần thấp (< 100)
- **Ngày = 0:** Extraction bị fail hoặc GitLab API outage — kiểm tra pipeline state
- **Spike đột biến:** Backfill hoặc cursor bị reset — bình thường nếu có chủ đích
- **Xu hướng giảm dần:** Team giảm hoạt động hoặc extraction window bị thu hẹp

**Filter:** `date_from`, `date_to`

---

### [A3b] Zero-Ingestion Days Alert

- **Loại:** Table
- **View:** `v_ingestion_volume_daily` (filter `is_zero_day = true`)
- **Hiển thị:** Danh sách ngày nào, source nào có 0 rows trong 7 ngày gần nhất

**Cách đọc:** Nếu bảng trống = tốt. Nếu có dòng nào = extraction bị miss ngày đó, cần kiểm tra log và xem xét backfill.

---

### [A4] Active Violations Feed

- **Loại:** Table (danh sách MR)
- **View:** `v_violations` JOIN `dim_user`
- **Hiển thị:** MR **đang vi phạm ngay lúc này** trên nhánh protected (main/master/develop/staging)

| Cột | Ý nghĩa |
|---|---|
| Project | Tên project |
| MR ! | Số MR (click để vào GitLab) |
| Author | Người tạo MR |
| Score | Điểm compliance (0-100) |
| # Violations | Số lượng vi phạm |
| LOC | Kích thước thay đổi |
| Size | XS / S / M / L / XL |
| CI | Pass hay fail |
| Age (h) | Bao lâu MR tồn tại chưa fix |

**Đây là hàng đợi triage hàng ngày của QA.** Ưu tiên:

| Score | Mức ưu tiên | Hành động |
|---|---|---|
| < 40 | **CRITICAL** | Block merge ngay, yêu cầu fix |
| 40 - 59 | HIGH | Yêu cầu fix trước end-of-day |
| 60 - 79 | MEDIUM | Cảnh báo, theo dõi |

**Dấu hiệu đáng lo:**
- Cùng author xuất hiện > 3 lần/tuần -> cần coaching 1:1
- Cùng project > 5 MRs vi phạm -> vấn đề systemic, escalate lên team lead
- `Age > 48h` mà score vẫn thấp -> MR bị bỏ quên, escalate

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [A5] Violations by Project (7 ngay)

- **Loại:** Bar chart (stacked)
- **View:** `v_compliance_violation_detail`
- **Hiển thị:** Top 15 project có nhiều vi phạm nhất, phân tách theo loại violation

**Cách đọc pattern:**

| Pattern | Nghĩa | Hành động |
|---|---|---|
| Thanh cao, toàn `CI_FAILED` | CI infra có vấn đề | Kiểm tra flaky test, CI runner |
| Thanh cao, toàn `NO_DESCRIPTION` | Team chưa quen process | Setup MR template, training |
| Thanh cao, đa dạng violation | Nhiều vấn đề cùng lúc | Cần coaching tổng thể cho team |
| 1 project chiếm > 50% tổng | Rủi ro tập trung | Ưu tiên can thiệp project này |

**Filter:** `date_from/to`, `project_name`

---

### [A6] ETL Run History — Last 10 Runs

- **Loại:** Table
- **Source:** `gitlab_raw.pipeline_state` (raw key-value)
- **Hiển thị:** Trạng thái chi tiết pipeline: cursors, failure count, run count

**Cách đọc:** Dành cho ops/debug. Xem:
- `consecutive_failures` = 0 -> pipeline lành
- `last_mr_updated_at` quá cũ so với hiện tại -> cursor bị stuck
- `run_count` tăng đều -> pipeline đang scheduled chạy đúng

---

## 4. Collection B — QA COMPLIANCE

**Dashboard: "QA: Compliance & Violations"**

> Mục đích: Đánh giá tình trạng tuân thủ toàn diện, xu hướng theo thời gian, phân tích root cause vi phạm.
> Xem: Hàng ngày (triage) và hàng tuần (báo cáo).

### [B1] Compliance Score Distribution

- **Loại:** Bar chart
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Phân bổ MR theo nhóm điểm (0-20, 20-40, 40-60, 60-80, 80-100) trong 30 ngày

**Cách đọc:**
- **Lý tưởng:** Cột 80-100 chiếm > 80% tổng MR
- **Cảnh báo:** Cột 0-20 hoặc 20-40 có nhiều MR -> nhiều MR fail nặng
- **Phân bố hai đỉnh** (bimodal: cột 80-100 cao VÀ 0-40 cao) -> team có 2 nhóm rõ rệt: người tuân thủ tốt và người không tuân thủ -> cần coaching cá nhân, không phải training chung

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B2] Compliance Grade Trend (Weekly %)

- **Loại:** Line chart (multi-series)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** % PASS / WARNING / FAIL theo tuần, 8 tuần gần nhất

**Cách đọc:**
- **Đường PASS% đi lên** -> team đang cải thiện
- **Đường FAIL% đi lên** -> team đang tệ đi, cần can thiệp
- **PASS% giảm đột ngột 1 tuần** -> kiểm tra: deadline sprint? team member mới? CI infra issue?
- **WARNING% tăng dần** -> team "gần đạt" nhưng chưa vượt qua, cần push thêm

**Mục tiêu:** PASS% >= 80% mỗi tuần.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B4] Violation Heatmap — Developer x Type

- **Loại:** Table (pivot)
- **View:** `v_compliance_violation_detail` JOIN `dim_user`
- **Hiển thị:** Ma trận developer vs loại vi phạm, mỗi ô = số lần vi phạm trong 30 ngày

**Cách đọc:**

| Pattern | Nghĩa | Hành động |
|---|---|---|
| 1 developer, nhiều cột có giá trị | Không nắm process chung | Coaching tổng thể (1:1) |
| Nhiều developer, cùng 1 cột cao | Vấn đề systemic | Fix process/tooling cho toàn team |
| 1 ô rất cao (> 10) | Repeat offender | Cần intervention cấp bách |

**Ví dụ:** Nếu cột `NO_DESCRIPTION` cao ở nhiều developer -> team chưa có MR template -> fix bằng tooling (setup template), không phải coaching cá nhân.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B5] MR Size Distribution Trend (8 weeks)

- **Loại:** Bar chart (stacked)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Phân bổ MR size (XS/S/M/L/XL) theo tuần, 8 tuần gần nhất

**Size labels:**

| Label | LOC (additions + deletions) |
|---|---|
| XS | <= 50 |
| S | 51 - 200 |
| M | 201 - 400 |
| L | 401 - 700 |
| **XL** | **> 700** (vi phạm MR_TOO_LARGE) |

**Cách đọc:**
- **XL slice tăng dần** -> developer không split ticket, planning issue
- **Chủ yếu XS/S** -> team đang split tốt, healthy
- **XL spike 1 tuần** -> kiểm tra: có feature lớn? migration? refactor?

**Tại sao quan trọng:** MR lớn khó review, dễ miss bug, merge chậm. Research cho thấy MR > 400 LOC có review quality giảm đáng kể.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B6] Protected Branch MRs — Compliance

- **Loại:** Table
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** MR target nhánh protected (main / master / develop / staging) trong 7 ngày gần nhất, sort theo compliance score tăng dần (xấu nhất trên cùng)

| Cột | Ý nghĩa |
|---|---|
| Project / MR # / Author | Định danh MR |
| Score / Grade | Điểm compliance + grade (PASS / WARNING / FAIL) |
| Violations | Số vi phạm |
| CI | PASS / FAIL |
| Coverage % | Test coverage tại thời điểm merge |
| Size | XS / S / M / L / XL |
| State / Created | Trạng thái + ngày tạo |

**Cách đọc:**
- **Score thấp + protected target** -> rủi ro cao nhất: code chất lượng kém merge vào nhánh release
- **CI FAIL + merged** -> bypass CI, kiểm tra: ai approve? có exception process?
- **XL size + protected** -> change lớn vào nhánh release, đáng review thủ công
- **Liệt kê trống** -> hoặc 7 ngày qua không có MR vào protected, hoặc pipeline lag (xem A2)

**Tại sao quan trọng:** Protected branches drive deployment — vi phạm ở đây impact production trực tiếp, không như feature branch.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B7] CI Pass Rate by Project (8 weeks)

- **Loại:** Line chart (multi-series, top 10 project)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** % CI pass theo tuần cho từng project

**Cách đọc:**
- **Đường project giảm dần** -> CI đang xấu đi, kiểm tra: flaky test? dependency issue?
- **Đường project < 50%** -> **nghiêm trọng**, hơn nửa MR fail CI, team đang merge blind
- **Tất cả project giảm cùng lúc** -> vấn đề infra (CI runner, shared library), không phải từng project

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B7b] CI Fail Detail per MR (drill-down from B7)

- **Loại:** Table (drill-down từ B7)
- **View:** `v_mr_compliance` JOIN `dim_user`
- **Hiển thị:** Danh sách MR có CI fail trong 30 ngày (limit 500), sort mới nhất trước

| Cột | Ý nghĩa |
|---|---|
| Project / MR / Author / Title | Định danh MR |
| State | opened / merged / closed |
| CI | PASS / FAIL (đã filter chỉ FAIL) |
| CI Status | Raw GitLab CI status (failed / canceled / skipped) |
| Coverage % | Test coverage tại thời điểm fail |
| Score | Compliance score |
| Branch | Source branch (giúp pattern recognition: feature/bug/hotfix) |
| Created | Ngày tạo |

**Cách đọc:**
- **Click vào MR # trong B7** -> drill xuống để xem cụ thể MR nào fail trong project đó
- **Coverage % thấp + CI fail** -> có thể test fail vì coverage threshold gate
- **Cùng author lặp lại nhiều lần** -> developer cần support về CI/testing
- **Cùng branch pattern (vd hotfix/*)** -> branch type đang skip pre-merge validation

**Use case:** B7 cho thấy project nào có CI pass rate giảm -> B7b cho biết MR cụ thể nào fail để intervene.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B8] Cycle Time — Avg / P50 / P90 (12 weeks)

- **Loại:** Line chart (3 series: avg, p50, p90)
- **View:** `v_cycle_time_stats`
- **Hiển thị:** Thời gian từ tạo MR -> merge (giờ), tính cho merged MRs, 12 tuần

| Metric | Ý nghĩa |
|---|---|
| **Avg** | Trung bình chung (bị ảnh hưởng bởi outlier) |
| **P50 (Median)** | 50% MR merge nhanh hơn giá trị này -> "trải nghiệm điển hình" |
| **P90** | 90% MR merge trong thời gian này -> "worst case bình thường" |
| **< 24h %** | Tỷ lệ same-day delivery |
| **> 72h %** | Tỷ lệ MR bị block > 3 ngày |

**Cách đọc:**
- **P90 > 72h liên tục** -> bottleneck review process, reviewer quá tải
- **P50 thấp nhưng P90 rất cao** -> đa số MR nhanh, nhưng một số bị block lâu (outlier)
- **Avg tăng nhưng P50 ổn định** -> chỉ vài MR outlier kéo trung bình lên
- **< 24h % giảm** -> team merge chậm hơn, kiểm tra reviewer workload

**Filter:** `date_from/to` (chỉ tính nhánh non-protected)

---

### [B9] Test Coverage Trend by Project (12 weeks)

- **Loại:** Bar chart (stacked)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Phân bổ coverage health theo tuần, top 10 project

| Zone | Coverage | Nghĩa |
|---|---|---|
| Green | >= 80% | Healthy |
| Yellow | 60 - 79% | Cần cải thiện |
| Red | < 60% | Rủi ro cao |
| No Data | null | Không có CI hoặc coverage chưa config |

**Cách đọc:**
- **Red slice tăng** -> technical debt đang tích lũy
- **No Data slice lớn** -> nhiều project chưa config coverage -> cần setup coverage reporting trong CI
- **Yellow chiếm đa số** -> team "gần tốt", push thêm 1 chút

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B9b] Coverage Detail per MR (drill-down from B9)

- **Loại:** Table (drill-down từ B9)
- **View:** `v_mr_compliance` JOIN `dim_user`
- **Hiển thị:** MR detail trong 30 ngày, sort coverage tăng dần (thấp nhất trên cùng), limit 500

| Cột | Ý nghĩa |
|---|---|
| Project / MR / Author / Title | Định danh MR |
| State | opened / merged / closed |
| Coverage % | Test coverage tại MR |
| Coverage Delta % | Chênh lệch so với base branch (+ = tăng, - = giảm) |
| Coverage Zone | Green (>=80) / Yellow (60-79) / Red (>0, <60) / No Data |
| LOC | MR size (additions + deletions) |
| Score | Compliance score |
| CI | PASS / FAIL |
| Created | Ngày tạo |

**Cách đọc:**
- **Click vào Zone trong B9** -> drill xuống xem MR cụ thể trong zone đó
- **Coverage Delta âm** -> MR này LÀM GIẢM coverage tổng -> nên reject hoặc require thêm test
- **Coverage Zone = Red + LOC lớn** -> nguy hiểm: thay đổi lớn không có test
- **No Data trên nhiều MR** -> project chưa config coverage report trong CI

**Use case:** B9 cho thấy slice Red/Yellow đang tăng -> B9b cho biết MR nào đang kéo zone đó xuống.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B10] Review Activity Summary (30d)

- **Loại:** Table
- **View:** `v_review_quality` JOIN `dim_user`
- **Hiển thị:** Review health theo project

| Cột | Ý nghĩa |
|---|---|
| Review Rate % | % MR được review (có comment từ người khác) |
| Avg Time to Review (h) | Trung bình bao lâu có comment đầu tiên |
| Avg Comments | Trung bình số comment mỗi MR |
| Avg Resolution % | % discussion được resolve |

**Cách đọc:**
- **Review Rate < 50%** -> MR merge mà không review, rủi ro cao
- **Time to Review > 24h** -> reviewer quá tải hoặc MR quá lớn khó review
- **Avg Comments = 0** -> approval rubber-stamp, không có feedback thực sự
- **Resolution % < 50%** -> discussion mở mà không resolve, thiếu follow-through

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B11] Review Detail per MR (drill-down from B10)

- **Loại:** Table (drill-down từ B10)
- **View:** `v_review_quality` JOIN `dim_user`
- **Hiển thị:** Review detail per MR trong 30 ngày (limit 500), sort mới nhất trước

| Cột | Ý nghĩa |
|---|---|
| Project / MR / Author / Title | Định danh MR |
| State | opened / merged / closed |
| Reviewed? | Yes / No (có comment từ người khác không) |
| Approved? | Yes / No (có approval không) |
| Comments | Tổng human comment |
| Review Threads | Số discussion thread |
| Reviewers | Số reviewer unique |
| Self-comments | Comment của chính author (loại khỏi review count) |
| 1st Review (h) | Giờ đến comment đầu tiên |
| Time to Approve (h) | Giờ đến approval |
| Review Duration (h) | Tổng thời gian review |
| Resolved | resolved/total resolvable threads |
| Resolved % | % discussion đã resolve |
| Created | Ngày tạo |

**Cách đọc:**
- **Click vào project trong B10** -> drill xuống xem từng MR
- **Reviewed=No + Approved=Yes** -> rubber-stamp approval, không review thực sự
- **Self-comments cao + Comments thấp** -> author "tự nói chuyện", không có feedback ngoài
- **1st Review > 24h** -> reviewer slow response, possible bottleneck
- **Resolved % thấp** -> discussion bỏ ngỏ, merge bypass

**Filter (extra):** `review_status` ('reviewed' / 'not_reviewed') để tách 2 nhóm so sánh.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`, `review_status`

---

### [B12] Week-over-Week Compliance Delta

- **Loại:** Table
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** So sánh compliance tuần này vs tuần trước

| Cột | Ý nghĩa |
|---|---|
| Score Delta | Chênh lệch avg score so với tuần trước (+ = cải thiện, - = xấu đi) |
| Trend | IMPROVING (delta > 5) / DECLINING (delta < -5) / STABLE |
| Violation Rate % | % MR có ít nhất 1 vi phạm |
| Pass Rate % | % MR đạt score >= 80 |

**Cách đọc:**
- **DECLINING 2+ tuần liên tiếp** -> xu hướng xấu, cần can thiệp ngay
- **Score Delta > +10** -> cải thiện mạnh, celebrate team
- **Violation Rate tăng nhưng Avg Score ổn** -> nhiều vi phạm nhẹ (INFO), không nghiêm trọng

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B13] Author Compliance Trend (30 days)

- **Loại:** Table (top 30 author, có >= 3 MR)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Per-author trend bucket trong 30 ngày, sort theo `Declining %` giảm dần (xấu nhất trên cùng)

| Cột | Ý nghĩa |
|---|---|
| Author | GitLab username |
| Total MRs | Tổng MR trong 30 ngày (chỉ tính author có >= 3 MR) |
| Improving | Số MR có trend = improving (score > 4-week prior avg + 5) |
| Stable | Số MR có trend = stable (|delta| <= 5) |
| Declining | Số MR có trend = declining (score < 4-week prior avg - 5) |
| Declining % | % MR thuộc nhóm declining |
| Avg Score | Trung bình compliance score 30d |
| Author 4w Avg | Trung bình rolling 4 tuần trước MỖI MR (baseline để so sánh) |

**Trend logic (column `compliance_grade_trend_4w` trên view):**
- `improving`: `compliance_score - author_4w_avg_prior > 5`
- `declining`: `compliance_score - author_4w_avg_prior < -5`
- `stable`: trong khoảng `+-5`
- `first_mr`: chưa có prior history (loại khỏi bảng này)

**Cách đọc:**
- **Declining % = 100% + Total MRs >= 3** -> author đang regress đều đặn, cần 1:1 ngay
- **Declining cao trên top author (MRs nhiều)** -> impact tổng team lớn, ưu tiên hỗ trợ
- **Improving cao + Author 4w Avg thấp** -> author đang phục hồi từ vùng kém, encourage signal
- **Mix cao Improving + Declining** -> không stable, công việc không đồng đều (rush week vs calm week)

**Tại sao quan trọng:** B2 cho trend toàn org, B12 cho trend tuần, B13 cho trend per-author — connect số tổng với người cụ thể. Đây là input cho coaching action.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B14] Screenshot Adoption — UI MRs (8 weeks) `[Phase A v1.6 advisory]`

- **Loại:** Line chart
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Tỷ lệ MR UI-related có attach screenshot, theo tuần, 8 tuần gần nhất
- **Rule:** `R-MR-005-SCREENSHOTS-UI` (advisory — không trừ điểm)

| Cột | Ý nghĩa |
|---|---|
| Week | Tuần |
| UI MRs | Số MR có `is_ui_related = true` (chạm UI/component) |
| UI w/ Screenshots | Số UI MR có `has_screenshots = true` |
| Screenshot % | Tỷ lệ adoption |

**Cách đọc:**
- **Screenshot % > 70%** → team đã build thói quen tốt cho UI review
- **Screenshot % < 30%** → reviewer khó verify UI change → suggest workshop + MR template có section screenshot
- **Số UI MRs = 0 dài hạn** → backend-heavy team, advisory này low-priority

**Tại sao quan trọng:** UI MRs không có screenshot khiến reviewer phải checkout local hoặc đoán visual impact → review chậm + miss regression visual.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [B15] Rebase Compliance Rate (8 weeks) `[Phase A v1.6 advisory]`

- **Loại:** Line chart
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** Tỷ lệ MR đã rebase trên base branch (`diverged_commits_count = 0`), theo tuần, 8 tuần gần nhất
- **Rule:** `R-MR-006-REBASED` (advisory — không trừ điểm)

| Cột | Ý nghĩa |
|---|---|
| Week | Tuần |
| MRs w/ Known Diverged | MR có giá trị `diverged_commits_count` (loại bỏ NULL) |
| Rebased MRs | MR có `diverged_commits_count = 0` |
| Rebase % | Tỷ lệ rebase |

**Cách đọc:**
- **Rebase % > 60%** → team có thói quen rebase, history linear, dễ revert
- **Rebase % < 30%** → nhiều merge commit, history nhiều branch → khó bisect bug + revert phức tạp
- **Drop đột ngột 1 tuần** → có thể team đang chạy feature lớn, nhiều fork song song; theo dõi tuần kế

**Tại sao quan trọng:** Rebase trước MR giảm conflict ở giai đoạn merge + giúp reviewer focus diff thực sự thay vì merge noise.

**Note edge case:** Cards loại bỏ MR có `diverged_commits_count = NULL` (data chưa có) khỏi denominator để tránh skew.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

## 5. Collection C — ENGINEERING MGMT

**Dashboard: "MGMT: Team Performance & AI Adoption"**

> Mục đích: Quản lý performance developer, theo dõi AI adoption, chất lượng commit.
> Xem: Hàng tuần (team review) và hàng tháng (performance review).

### [C1] Team Leaderboard — Current Month

- **Loại:** Table
- **View:** `v_team_leaderboard` JOIN `dim_user`
- **Hiển thị:** Bảng xếp hạng developer theo compliance, tháng hiện tại

| Cột | Ý nghĩa |
|---|---|
| Active Weeks | Số tuần có hoạt động trong tháng |
| MRs | Tổng MR tạo trong tháng |
| Avg Score | Điểm compliance trung bình |
| Violation Rate % | % MR có vi phạm |
| AI Commit % | % commit có AI-assist |
| Bad Commit Msgs | Số commit không theo Conventional Commits |
| Trend | IMPROVING / DECLINING / STABLE / NEW (so với tháng trước) |
| Score Delta | Chênh lệch điểm so với tháng trước |
| Grade | PASS / WARNING / FAIL |

**Cách đọc:**
- **Sort theo Avg Score DESC** -> top = role model, bottom = cần support
- **DECLINING + Score Delta < -10** -> sụt giảm mạnh, cần 1:1 ngay
- **NEW** -> developer mới join, theo dõi sát tháng đầu
- **High MRs + Low Score** -> Speed Demon, productive nhưng rủi ro

**Filter:** `department`, `date_from/to`, `author_username`

---

### [C1b] Developer MR Detail (drill-down from C1)

- **Loại:** Table (drill-down từ C1)
- **View:** `v_compliance_mgmt` JOIN `dim_user`
- **Hiển thị:** MR detail của 1 developer trong 60 ngày (limit 500), sort mới nhất trước

| Cột | Ý nghĩa |
|---|---|
| Project / MR / Author / Title | Định danh MR |
| State | opened / merged / closed |
| Score / Grade | Compliance score + grade |
| Size | XS / S / M / L / XL label |
| LOC | Tổng additions + deletions |
| CI | PASS / FAIL |
| Coverage % | Test coverage |
| Cycle (h) | Cycle time (giờ) |
| Violations | Comma-separated list các violation code |
| Created | Ngày tạo |

**Cách đọc:**
- **Click vào developer trong C1** -> drill xuống xem MR cụ thể của họ trong 60 ngày
- **Violations cột chứa cùng 1 code lặp đi lặp lại** -> root cause: 1 thói quen kém, dễ training (vd luôn miss AI_DISCLOSURE)
- **Trend score giảm dần** -> match với "DECLINING" ở C1, có context cụ thể để 1:1
- **Cycle time tăng dần** -> developer đang gặp block trong review process

**Use case:** C1 cho biết developer nào DECLINING/FAIL -> C1b cho biết câu chuyện cụ thể đằng sau số đó.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [C2] AI Adoption — Commit % by Project (12 weeks)

- **Loại:** Line chart (multi-series, top 10 project)
- **View:** `v_ai_adoption`
- **Hiển thị:** % commit AI-assist theo tuần cho mỗi project, goal line 30%

**Cách phát hiện commit AI:** Commit message có prefix `[AI]` (do developer khai báo).

**Cách đọc:**

| Mức AI% | Đánh giá | Hành động |
|---|---|---|
| 0% | Không dùng AI hoặc không khai báo | Kiểm tra: team có dùng Copilot/Claude? |
| 10 - 30% | Đang tiến tới target | Encourage, chia sẻ best practice |
| **30%+** | **Đạt target** | Celebrate, theo dõi quality |
| > 70% | Phụ thuộc quá mức | Kiểm tra coverage, review quality |

**Tín hiệu cần điều tra:**
- AI% tăng nhưng coverage giảm -> AI generate code mà thiếu test
- AI% đột ngột = 0 sau nhiều tuần > 0 -> team gặp friction với tooling
- Project có AI% = 0% suốt -> chưa được training, cần workshop

**Filter:** `date_from/to`, `project_name`

---

### [C4] Weekly Commit Quality — Good vs AI vs Bad

- **Loại:** Bar chart (stacked)
- **View:** `v_weekly_kpi` JOIN `dim_user`
- **Hiển thị:** Thành phần commit mỗi tuần, 8 tuần

| Segment | Nghĩa |
|---|---|
| **AI Commits** | Commit có `[AI]` prefix |
| **Clean Commits** | Không AI, đúng Conventional Commits |
| **Bad Message** | Không theo Conventional Commits format |
| **Long Message (>500ch)** | Commit message quá dài (thường chứa nội dung nên ở MR description) |

**Cách đọc:**
- **Bad Message slice lớn** -> team chưa nắm Conventional Commits -> training + git hook
- **Long Message slice tăng** -> developer paste nội dung vào commit thay vì MR description
- **Clean + AI chiếm > 80%** -> commit quality tốt

**Filter:** `department`, `date_from/to`, `author_username`

---

### [C6] Long Commit Messages (>500 chars) — Last 30 days

- **Loại:** Table
- **View:** `v_long_commit_violations`
- **Hiển thị:** Developer nào viết commit message > 500 ký tự, ở project nào, bao nhiêu lần

**Tại sao quan trọng:** Commit message > 500 ký tự thường chứa:
- Nội dung thuộc về MR description (context, reasoning)
- Output AI paste nguyên vào commit
- List changes thay vì tóm tắt

**Hành động:** Training developer: "commit message = what & why ngắn gọn, chi tiết đặt trong MR description"

**Filter:** `date_from/to`, `project_name`, `author_name`

---

### [C9] Compliance Improvement Roadmap — Fix Priority

- **Loại:** Table
- **View:** `v_compliance_violation_detail` JOIN `dim_user`
- **Hiển thị:** ROI-sorted list: fix violation nào trước sẽ cải thiện điểm nhiều nhất

| Cột | Ý nghĩa |
|---|---|
| Violation | Loại vi phạm |
| Severity | BLOCKER / REQUIRED / INFO |
| Points at Stake | Điểm tối đa bị mất |
| Affected MRs | Số MR bị ảnh hưởng |
| Fail Rate % | % MR fail tiêu chí này |
| Avg Points Lost/MR | Trung bình điểm mất mỗi MR |
| Recommended Action | Gợi ý hành động |

**Cách đọc:** Dòng đầu tiên = violation có **impact lớn nhất**. Ưu tiên fix từ trên xuống.

**Ví dụ thực tế:**
- `CI_FAILED` ở đầu bảng, Affected MRs = 150 -> fix CI infra trước, cải thiện điểm nhanh nhất
- `NO_DESCRIPTION` nhiều nhưng severity = REQUIRED -> setup MR template sẽ giải quyết hàng loạt

**Filter:** `department`, `date_from/to`, `project_name`

---

## 6. Collection D — DEEP DIVE

**Dashboard: "DRILL: Investigation & Deep Analysis"**

> Mục đích: Điều tra chi tiết khi phát hiện anomaly từ Collection A/B/C. Không cần xem hàng ngày.
> Xem: Khi cần drill-down vào vấn đề cụ thể.

### [D3] Violation Category Deep Dive (30 days)

- **Loại:** Table (500 dòng)
- **View:** `v_compliance_violation_detail` JOIN `dim_user`
- **Hiển thị:** Chi tiết từng MR + từng violation (1 MR có thể nhiều dòng nếu nhiều vi phạm)

| Cột | Ý nghĩa |
|---|---|
| Type | Mã violation (dùng để filter) |
| Violation | Tên đầy đủ tiếng Việt |
| Score | Điểm compliance tổng của MR |
| Protected Branch | MR target vào nhánh protected? |

**Khi nào dùng:** Sau khi thấy violation type tăng ở B4/A5, drill-down vào đây xem cụ thể MR nào, ai, project nào.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`, **`violation_type`** (filter quan trọng nhất)

---

### [D5] AI Disclosure Tracker — Undisclosed Summary

- **Loại:** Table
- **View:** `v_ai_disclosure_tracker` JOIN `dim_user`
- **Hiển thị:** Per-developer: bao nhiêu MR có commit AI mà KHÔNG khai báo

| Cột | Ý nghĩa |
|---|---|
| Total MRs | MR có commit AI trong window |
| Disclosed | Đã khai báo AI trong MR description |
| Undisclosed | **Dùng AI nhưng KHÔNG khai báo** |
| False Positive | Khai báo AI nhưng không tìm thấy commit AI |
| Disclosure Rate % | Tỷ lệ khai báo đúng |

**Cách phát hiện:** System so sánh: MR có commit `[AI]` prefix TRONG khoảng thời gian MR tồn tại (created -> merged/now) với checkbox `has_ai_disclosure` trong MR description.

**Hành động:**
- Undisclosed > 0 -> nhắc developer bổ sung AI disclosure
- False Positive -> developer khai báo AI nhưng thực tế không có commit AI (có thể dùng AI ở ngoài commit)
- Disclosure Rate < 70% -> team chưa nắm quy trình

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

### [D6a] Pipeline Failures — Current Streaks

- **Loại:** Table
- **View:** `v_pipeline_failures`
- **Hiển thị:** Branch nào đang fail liên tiếp ngay lúc này

| Cột | Ý nghĩa |
|---|---|
| Consecutive Failures | Số lần fail liên tiếp |
| Severity | LOW (1) / MEDIUM (2) / HIGH (3-4) / CRITICAL (5+) |
| Protected | Có phải nhánh protected? (main/develop) |
| Hours Broken | Bao lâu kể từ lần fail đầu tiên trong streak |
| Trigger | Nguồn trigger pipeline (push, schedule, web...) |

**Ưu tiên xử lý:**
1. **CRITICAL + Protected = true** -> nhánh chính chết, block cả team
2. **HIGH + Protected = true** -> sắp critical, fix ngay
3. **MEDIUM trên nhánh feature** -> developer cần fix trước merge

---

### [D6b] Pipeline Failure Trend (7 days)

- **Loại:** Bar chart (stacked, top 15 project)
- **View:** `v_pipeline_failures`
- **Hiển thị:** Số lần fail pipeline mỗi ngày, phân tách theo project

**Cách đọc:** Project nào chiếm slice lớn nhất = project gây ra nhiều CI failure nhất -> ưu tiên fix.

---

### [D7] Outlier MRs — XL Size (>700 LOC)

- **Loại:** Table
- **View:** `v_mr_compliance` JOIN `dim_user`
- **Hiển thị:** Danh sách MR quá lớn (> 700 LOC) trong 30 ngày

| Cột | Ý nghĩa |
|---|---|
| LOC | Tổng lines changed (additions + deletions) |
| + Lines / - Lines | Phân tách thêm / xóa |
| Cycle Time (h) | Thời gian từ tạo -> merge (giờ) |

**Tại sao track riêng:** MR XL:
- Review quality giảm (reviewer mệt, skip chi tiết)
- Cycle time dài hơn (khó hiểu, nhiều round review)
- Rủi ro regression cao hơn

**Hành động:** Nếu developer lặp lại XL -> training vertical slicing. Nếu do migration/refactor -> ghi nhận exception.

---

### [D8] Webhook DLQ Monitor

- **Loại:** Table
- **View:** `v_dlq_monitor`
- **Hiển thị:** Dead-letter queue health cho webhook events

| Cột | Ý nghĩa |
|---|---|
| Unresolved | Events fail hết retry, chưa replay |
| Last Hour / Last 24h | Số failure gần đây |
| Resolution Rate % | % events đã được replay thành công |
| Most Common Error | Lỗi phổ biến nhất |

**Cách đọc:** Bảng trống hoặc toàn "HEALTHY" -> tốt. Có dòng CRITICAL -> webhook đang mất events, cần kiểm tra.

---

### [D9] Reviewer Workload Analysis

- **Loại:** Table
- **View:** `v_reviewer_workload`
- **Hiển thị:** Workload reviewer theo tuần, 4 tuần gần nhất

| Cột | Ý nghĩa |
|---|---|
| MRs Reviewed | Số MR reviewer đã review |
| Comments | Tổng comment |
| Avg Response (h) | Trung bình thời gian phản hồi |
| Self Reviews | Reviewer = author (rủi ro quality) |

**Cách đọc:**
- **1 reviewer MRs > 20/tuần** -> quá tải, cần phân bổ lại
- **Self Reviews > 0** -> developer tự approve MR mình, flag ngay
- **Avg Response > 24h** -> reviewer chậm, team bị block

**Filter:** `date_from/to`

---

### [D10] Recurring Violator Alert — 3+ Weeks Same Violation

- **Loại:** Table
- **View:** `v_compliance_violation_detail` JOIN `dim_user`
- **Hiển thị:** Developer có cùng loại vi phạm lặp lại >= 3 tuần liên tiếp (trong 8 tuần)

| Weeks Affected | Action Required |
|---|---|
| 6+ tuần | **CRITICAL** — Cần meeting 1:1 |
| 4-5 tuần | **HIGH** — Training needed |
| 3 tuần | **MEDIUM** — Monitor |

**Tại sao quan trọng:** Vi phạm lặp lại cho thấy developer không nhận ra hoặc không biết cách fix. Training 1 lần không đủ, cần coaching cá nhân.

**Filter:** `department`, `date_from/to`, `project_name`, `author_username`

---

## 7. Collection E — FORMULA TRANSPARENCY

**Dashboard: "FORMULA: Compliance Scoring Transparency"**

> Mục đích: Giải thích minh bạch cách tính điểm, cho phép audit và debug từng MR.
> Xem: Khi developer hỏi "tại sao điểm tôi thấp?", khi cần verify formula hoạt động đúng.

### [E1] Compliance Criterion Weight Table (30d)

- **Loại:** Table
- **View:** `v_compliance_criterion_stats`
- **Hiển thị:** Performance tổng hợp cho mỗi tiêu chí scoring, 30 ngày

| Cột | Ý nghĩa |
|---|---|
| Tiêu chí | Tên tiêu chí (VD: "CI Pipeline pass") |
| Hạng mục | Quality Gate / MR Size / Documentation / AI / Naming |
| Mức độ | BLOCKER / REQUIRED / INFO |
| Điểm tối đa | Max points cho tiêu chí |
| Điểm TB đạt | Trung bình điểm thực tế đạt được |
| Pass rate (%) | % MR đạt tiêu chí này |
| Fail rate (%) | % MR fail tiêu chí này |
| Điểm TB mất | Trung bình điểm bị trừ |

**Cách đọc:** Sắp xếp theo Fail rate DESC -> tiêu chí nào team fail nhiều nhất cần ưu tiên cải thiện.

**Filter:** `date_from/to`, `project_name`

---

### [E3] Score Decomposition by Category — Weekly Trend (12w)

- **Loại:** Bar chart (stacked)
- **View:** `v_compliance_criterion_stats`
- **Hiển thị:** Điểm trung bình đạt được theo hạng mục (5 category), theo tuần

**5 hạng mục:**
1. **Quality Gate** (CI + Coverage + Coverage Delta = 40 điểm max)
2. **MR Size** (15 điểm max)
3. **Documentation** (Description + Template + Ticket = 25 điểm max)
4. **AI Compliance** (5 điểm max)
5. **Naming Convention** (Branch + Title = 15 điểm max)

**Cách đọc:** Hạng mục nào chiếm slice nhỏ nhất = hạng mục kéo điểm xuống nhiều nhất.

**Filter:** `date_from/to`, `project_name`

---

### [E5] Criterion x Project Heatmap — Pass Rate (30d)

- **Loại:** Table (pivot)
- **View:** `v_compliance_criterion_stats`
- **Hiển thị:** Ma trận Project vs Tiêu chí, mỗi ô = pass rate %

**Cách đọc:**
- Ô < 50% = đỏ -> project đó fail tiêu chí đó ở mức nghiêm trọng
- Cột toàn < 50% -> tiêu chí đó khó đạt cho toàn team -> xem xét tooling/process
- Hàng toàn < 50% -> project đó có vấn đề toàn diện

**Ví dụ:** Project A có CI = 90% nhưng AI = 0% -> chỉ cần training AI disclosure. Project B có CI = 30%, Description = 20% -> vấn đề process nghiêm trọng.

**Filter:** `date_from/to`, `project_name`

---

### [E6] Individual MR Score Breakdown

- **Loại:** Table
- **View:** `v_mr_score_breakdown`
- **Hiển thị:** Breakdown điểm từng tiêu chí cho 1 MR cụ thể

| Cột | Ý nghĩa |
|---|---|
| Tiêu chí | 10 dòng, 1 cho mỗi tiêu chí |
| Điểm tối đa | Max points |
| Điểm đạt | Điểm thực tế |
| Điểm mất | Max - đạt |
| Kết quả | PASS / PARTIAL / FAIL |
| % score | % đạt được so với max của tiêu chí |

**Khi nào dùng:** Developer hỏi "tại sao MR !123 của tôi chỉ được 55 điểm?" -> filter theo iid + project_name -> thấy chính xác tiêu chí nào fail.

**Filter:** `iid` (MR number), `project_name`

---

### [E8] Formula Source & Detection Reference (v1.6)

- **Loại:** Table (static reference)
- **Source:** Hardcoded VALUES (không query view)
- **Hiển thị:** Documentation kỹ thuật: mỗi tiêu chí lấy data từ đâu, logic phát hiện thế nào, công thức tính điểm

| Cột | Ý nghĩa |
|---|---|
| Tầng nguồn | L1 (API), L2 (ETL), L3 (DB) |
| Bảng/View nguồn | Table hoặc view chứa data gốc |
| Cột nguồn | Column name trong DB |
| Logic phát hiện | Code Python hoặc SQL dùng để compute |
| Công thức điểm | CASE WHEN expression |

**Khi nào dùng:** Audit formula, verify data đúng, hoặc onboard engineer mới vào hệ thống.

---

### [E9] Detection Flag Distribution — Sanity Check (30d)

- **Loại:** Table
- **View:** `v_mr_compliance` (direct query)
- **Hiển thị:** Kiểm tra sanity cho các boolean flag và numeric fields trong v_mr_compliance

| Cột | Ý nghĩa |
|---|---|
| TRUE / Có dữ liệu | Số MR có flag = true |
| FALSE / Không có | Số MR có flag = false |
| NULL | Số MR bị null (data quality issue) |
| TRUE % | % TRUE -> so sánh với khoảng bình thường |
| Khoảng bình thường | Expected range cho flag đó |
| Cảnh báo | Warning nếu ngoài khoảng bình thường |

**Cách đọc:**
- `ci_passed TRUE% = 0%` -> **CI detection broken**, mọi MR bị tính không có CI
- `has_description NULL > 30%` -> join bị lỗi, thiếu data
- `test_coverage = 0% có giá trị` -> coverage reporting chưa config

**Khi nào dùng:** Khi nghi ngờ điểm tính sai, hoặc sau khi thay đổi extraction logic.

**Filter:** `date_from/to`, `project_name`

---

### [E10] Raw Input Trace — Formula Debug per MR

- **Loại:** Table
- **View:** `v_mr_score_breakdown` JOIN `v_mr_compliance`
- **Hiển thị:** Debug chi tiết nhất: từng tiêu chí + giá trị raw từ DB cho từng MR

| Cột | Ý nghĩa |
|---|---|
| Giá trị thực tế từ DB | VD: "ci_passed=true [ci_status=success]", "test_coverage=73%", "mr_size=850 LOC [size_label=XL]" |

**Khi nào dùng:** Debug formula khi:
- Developer claim "MR có CI pass mà vẫn bị trừ điểm"
- Cần verify detection logic hoạt động đúng
- Onboard engineer hiểu luồng data từ raw -> score

**Filter:** `date_from/to`, `project_name`, `author_username`

---

### [E11] Commit Convention per MR

- **Loại:** Table
- **View:** `v_mr_commit_convention`
- **Hiển thị:** Compliance Conventional Commits cho từng MR

| Cột | Ý nghĩa |
|---|---|
| Total Commits | Tổng commit trong MR |
| Conv. Commits | Số commit đúng Conventional format |
| Conv. Rate (%) | Tỷ lệ conventional |
| Convention Health | FULL (100%) / PARTIAL (>=50%) / LOW (<50%) / NO_DATA |
| MR Title OK | Title MR có đúng format? |
| AI Disclosed | Có khai báo AI? |

**Cách đọc:**
- FULL = developer tuân thủ 100%, role model
- LOW = chưa nắm convention, cần training
- Convention Health LOW + MR Title OK -> developer biết format title nhưng quên khi commit -> suggest git hook

**Filter:** `project_name`, `author`, `convention_health`

---

### [E12] Score Simulator — Impact of Fixing Top Violations

- **Loại:** Table
- **View:** `v_compliance_mgmt` + `v_compliance_violation_detail`
- **Hiển thị:** Mô phỏng "what if": nếu fix violation X, điểm sẽ tăng bao nhiêu?

| Cột | Ý nghĩa |
|---|---|
| Points per Fix | Điểm gained khi fix 1 MR |
| Affected MRs | Số MR sẽ được cải thiện |
| Avg Score Gain if Fixed | Trung bình score tăng nếu fix violation này |
| Projected Avg Score | Score dự kiến sau khi fix |
| Impact Level | "Reaches PASS!" / "Reaches WARNING" / "Still below 60" |

**Cách đọc:** Sắp xếp theo Avg Score Gain DESC. Dòng đầu = violation fix có ROI cao nhất.

**Ví dụ:** "CI_FAILED: fix sẽ tăng avg score từ 62 -> 78, 120 MRs affected, Impact: Reaches PASS!" -> ưu tiên fix CI trước mọi thứ khác.

**Filter:** `date_from/to`, `project_name`

---

## 8. Collection F — KPI CONTROL PANEL

**Dashboard: "KPI: Compliance Insight & Control Panel"**

> Mục đích: Dashboard tổng hợp cho leadership, hỗ trợ quyết định ở mức organization.
> Xem: Weekly team review, monthly performance review, quarterly planning.
> Tất cả cards share 6 filters: `department`, `role_label`, `date_from`, `date_to`, `project_name`, `author_username`

### [F9] Executive KPI Tiles

- **Loại:** Scalar (4 con số)
- **View:** `v_kpi_control_panel`
- **Hiển thị:** 4 KPI top-level

| Tile | Ý nghĩa | Ngưỡng |
|---|---|---|
| **Total MRs** | Tổng MR trong filter | Reflect team output |
| **Avg Score** | Điểm compliance trung bình | >= 80 Green, 60-79 Yellow, < 60 Red |
| **Pass Rate %** | % MR đạt score >= 80 | >= 80% Green, 60-79% Yellow, < 60% Red |
| **Violation Rate %** | % MR có ít nhất 1 vi phạm | < 20% Green, 20-50% Yellow, > 50% Red |

**Xem card này đầu tiên** khi mở Collection F -> nắm tổng thể trước khi drill-down.

---

### [F1] Developer Compliance Scorecard

- **Loại:** Table
- **View:** `v_kpi_control_panel` JOIN `v_weekly_kpi`
- **Hiển thị:** Scorecard toàn diện nhất cho từng developer

| Cột | Ý nghĩa | Ngưỡng |
|---|---|---|
| MR Count | Số MR | >= 3/tháng = active |
| Commits | Tổng commit | Context cho productivity |
| LOC Changed | Tổng lines changed | Scope of impact |
| Avg Score | Điểm compliance TB | >= 80 = PASS |
| Pass Rate % | % MR đạt chuẩn | >= 80% = good |
| Violation Rate % | % MR vi phạm | < 20% = good |
| Avg MR Size | TB kích thước MR | < 400 = healthy |
| Avg Cycle (h) | TB thời gian merge | < 24h = fast |
| Avg Coverage % | TB test coverage | >= 80% = good |

**Cách dùng trong performance review:** So sánh developer cùng team/role, nhìn xu hướng qua nhiều tháng.

---

### [F2] So sanh giua cac Phong (Department Comparison)

- **Loại:** Bar chart
- **View:** `v_kpi_control_panel`
- **Hiển thị:** So sánh compliance giữa các phòng ban

**Cách đọc:**
- Phòng nào có Avg Score thấp nhất = cần hỗ trợ nhiều nhất
- Violation Rate cao + Active Devs nhiều = impact lớn, ưu tiên
- Avg Cycle cao = review bottleneck ở phòng đó

**Khi nào dùng:** Quarterly planning, resource allocation, training priority.

---

### [F3] Developer Timeline — Score Trend

- **Loại:** Line chart (multi-series, top 15 developer)
- **View:** `v_kpi_control_panel`
- **Hiển thị:** Compliance score theo tuần cho mỗi developer, 12 tuần

**Cách đọc:**
- **Đường đi lên** -> developer đang cải thiện, celebrate
- **Đường đi xuống** -> cần can thiệp, tìm root cause ở D3/D10
- **Đường flat < 60** -> chronic issue, cần coaching plan
- **Đường biến động mạnh** -> inconsistent, developer biết cách nhưng không luôn làm

---

### [F4] Project Health Matrix (Compliance + DORA)

- **Loại:** Table
- **View:** `v_kpi_control_panel` + `v_dora_metrics` + `v_project_health_scorecard`
- **Hiển thị:** View toàn diện nhất cho mỗi project, kết hợp Compliance + DORA 4 + AI Adoption

| Cột | Ý nghĩa | Giải thích |
|---|---|---|
| Score | Avg compliance score | Chất lượng MR |
| Pass % | % MR đạt chuẩn | Consistency |
| CI % | CI pass rate | Build stability |
| Coverage % | Test coverage TB | Test quality |
| Cycle (h) | Avg cycle time | Delivery speed |
| AI % | AI commit percentage | AI adoption |
| AI Grade | ON_TARGET / PROGRESSING / BELOW_TARGET | So với target 30% |
| **Deploy/wk** | Deployment frequency | DORA #1: delivery throughput |
| **Lead Time (h)** | Avg lead time for changes | DORA #2: first commit -> merge |
| **MTTR (h)** | Mean time to restore | DORA #3: failure -> recovery |
| **CFR %** | Change failure rate | DORA #4: % deployments gây failure |
| **Health** | GREEN / YELLOW / RED | Tổng hợp composite grade |

**DORA 4 Metrics giải thích:**

| Metric | Elite | High | Low |
|---|---|---|---|
| Deploy/week | >= 7 (daily) | >= 1 | < 1 |
| Lead Time | < 24h | < 168h (1 week) | >= 168h |
| MTTR | < 1h | < 24h | >= 24h |
| CFR | < 15% | < 30% | >= 30% |

**Health composite:**
- **GREEN:** Score >= 70 AND CI >= 70% AND Coverage >= 50%
- **RED:** Score < 50 OR CI < 50% OR Coverage < 30%
- **YELLOW:** Còn lại

**Cách đọc:**
- RED project = cần intervention ngay
- High Deploy + High CFR = team ship nhanh nhưng hay gãy -> cần slow down, add tests
- Low MTTR + Low CFR = team stable, reliable
- AI Grade = BELOW_TARGET mà team khác ON_TARGET -> cần workshop AI

---

### [F5] Role-based Analysis

- **Loại:** Bar chart
- **View:** `v_kpi_control_panel`
- **Hiển thị:** So sánh compliance theo GitLab role (Developer, Maintainer, Owner...)

**Insight thường thấy:**
- Maintainer score > Developer -> có kinh nghiệm hơn, quen process
- Owner score thấp -> có thể ít code, MR lẻ tẻ
- Guest/Reporter có MR -> external contributor, cần monitor

---

### [F6] KPI Summary — All Metrics

- **Loại:** Table (raw data, limit 500)
- **View:** `v_kpi_control_panel`
- **Hiển thị:** Dữ liệu thô MR-level với tất cả dimension

**Khi nào dùng:** Export ra Excel/CSV để báo cáo, hoặc khi cần filter phức tạp mà các card khác không hỗ trợ.

---

### [F7] Monthly Compliance Trend by Department

- **Loại:** Line chart (multi-series by department)
- **View:** `v_kpi_control_panel`
- **Hiển thị:** Avg Score + Pass Rate % theo tháng, chia theo phòng ban

**Cách đọc:**
- Đường phòng nào đi lên -> initiative compliance đang hiệu quả
- Đường phòng nào flat -> chưa có tác động, cần thay đổi approach
- 2 phòng diverge (1 lên, 1 xuống) -> so sánh practice giữa 2 phòng

---

### [F8] Developer Segmentation — Compliance x Output

- **Loại:** Table
- **View:** `v_kpi_control_panel`
- **Hiển thị:** Phân nhóm developer theo ma trận 2x2: compliance vs output

```
           HIGH compliance (>= 75)
                ▲
   Careful      |      Champion
   (encourage)  |      (role model)
                |
────────────────┼──────────────────► HIGH output (>= 3 MRs)
                |
   At-Risk      |      Speed Demon
   (intervene)  |      (coaching)
                |
           LOW compliance (< 60)
```

| Segment | Compliance | Output | Hành động cụ thể |
|---|---|---|---|
| **Champion** | >= 75 | >= 3 MRs | Celebrate, nhờ mentor người khác, share practice |
| **Speed Demon** | < 60 | >= 3 MRs | Productive nhưng rủi ro: coaching về process |
| **Careful** | >= 75 | < 3 MRs | Tuân thủ tốt, encourage tăng output |
| **At-Risk** | < 60 | < 3 MRs | **Can thiệp ngay:** tìm hiểu blockers, pair programming |

**Tín hiệu escalate:**
- **> 30% At-Risk trong 1 tháng** -> vấn đề systemic (process/deadline), không phải cá nhân
- **Speed Demon có CI_FAILED nhiều** -> merge mà không test -> rủi ro production
- **Toàn Careful, ít Champion** -> team thiếu velocity, cần xem xét task breakdown

---

## 9. Lịch kiểm tra & Checklist

### Checklist hàng ngày (< 10 phút, 8:30 sáng)

```
[ ] 1. Collection A: Kiểm tra A1 (Pipeline Health)
      -> BLOCKED? -> Báo ops ngay, STOP — data không đáng tin
      -> HEALTHY? -> Tiếp tục

[ ] 2. Collection A: Kiểm tra A2 (Data Freshness)
      -> Lag > 24h? -> Trigger extraction thủ công
      -> OK? -> Tiếp tục

[ ] 3. Collection A: Mở A4 (Active Violations Feed)
      -> Score < 40? -> Block merge, yêu cầu fix ngay
      -> Age > 48h? -> Escalate lên team lead
      -> Ghi nhận số MR vi phạm mới

[ ] 4. Collection B: Nhìn B12 (Week-over-Week Delta)
      -> DECLINING? -> Xem A5 (Violations by Project) tìm nguyên nhân
```

### Checklist hàng tuần (< 30 phút, Thứ Hai)

```
[ ] 1. Collection F: Mở F9 (Executive Tiles)
      -> Pass Rate so với tuần trước?
      -> Violation Rate tăng hay giảm?

[ ] 2. Collection F: Xem F8 (Developer Segmentation)
      -> Ai đang At-Risk? -> lên kế hoạch coaching
      -> > 30% At-Risk? -> Báo Eng Manager ngay

[ ] 3. Collection B: Xem B2 (Grade Trend)
      -> PASS% đang tăng hay giảm?
      -> Viết 3 dòng tóm tắt cho team

[ ] 4. Collection C: Xem C1 (Team Leaderboard)
      -> Ai DECLINING? -> chuẩn bị 1:1
      -> Ai Champion? -> recognize trong team meeting

[ ] 5. Collection C: Xem C9 (Improvement Roadmap)
      -> Fix priority #1 là gì? -> action item cho sprint tới
```

### Checklist hàng tháng (< 60 phút, đầu tháng)

```
[ ] 1. Collection F: F4 (Project Health Matrix)
      -> Bao nhiêu project RED? Trend so với tháng trước?

[ ] 2. Collection F: F7 (Monthly Trend by Department)
      -> Phòng nào cải thiện? Phòng nào stagnant?

[ ] 3. Collection C: C2 (AI Adoption Trend)
      -> Đạt target 30% chưa? Trend đang đi đâu?

[ ] 4. Collection D: D10 (Recurring Violators)
      -> Ai vi phạm lặp lại >= 3 tuần? -> 1:1 plan

[ ] 5. Tổng hợp báo cáo:
      -> Executive summary: Pass Rate, Avg Score, Top 3 violations
      -> Action items cho tháng tới
      -> Celebrate improvements
```

---

## 10. Câu hỏi thường gặp

### Q: Pass rate giảm đột ngột, tìm nguyên nhân ở đâu?

1. **B12** (Week-over-Week Delta): xem tuần nào giảm
2. **A5** (Violations by Project): violation type nào tăng?
3. Nếu `CI_FAILED` tăng -> **D6** (Pipeline Failures): infra issue hay code issue?
4. Nếu `NO_DESCRIPTION` tăng -> có dev mới join? Check **C1** (Leaderboard) filter NEW
5. Nhiều violation type tăng cùng lúc -> kiểm tra deadline sprint: pressure -> dev skip checklist

### Q: Developer hỏi "tại sao MR của tôi chỉ được XX điểm?"

1. **E6** (Individual Score Breakdown): filter theo iid + project_name -> thấy từng tiêu chí
2. **E10** (Raw Input Trace): thấy giá trị raw từ DB -> verify detection đúng
3. Nếu developer claim "CI pass mà vẫn bị trừ" -> **E9** (Sanity Check): kiểm tra `ci_passed` flag

### Q: Data trên dashboard có real-time không?

Không. Data sync theo lịch (mặc định hàng ngày). Kiểm tra **A2** (Data Freshness) để biết lần sync cuối. Nếu cần data fresh hơn, chạy extraction thủ công:
```
python -m src.extraction.pipeline
```

### Q: MR đã merge rồi mà score thấp, có cần xử lý không?

Có — MR đã merge vẫn tính vào KPI:
1. Ghi nhận để tính báo cáo sprint
2. Nếu `CI_FAILED` mà vẫn merge -> hỏi ai approved và tại sao
3. Nếu `NO_REVIEWER` / `NOT_APPROVED` -> kiểm tra merge permission

### Q: Làm sao biết formula v1.6 đang tính đúng?

1. **E9** (Detection Flag Sanity Check): kiểm tra tỷ lệ TRUE/FALSE/NULL cho mỗi flag
2. **E8** (Formula Reference): xem logic detection từng tiêu chí
3. **E10** (Raw Input Trace): debug từng MR cụ thể, so sánh raw value vs score

### Q: AI Disclosure = 0% có nghĩa gì?

Có 2 khả năng:
1. Team thực sự chưa dùng AI -> kiểm tra **C2** (AI Adoption): ai_commit_pct cũng = 0%?
2. Team dùng AI nhưng không khai báo -> **D5** (AI Disclosure Tracker): xem Undisclosed count

### Q: Project RED trong F4, tôi bắt đầu từ đâu?

1. **E5** (Criterion x Project Heatmap): xem tiêu chí nào fail nhiều nhất cho project đó
2. **E12** (Score Simulator): fix violation nào có ROI cao nhất?
3. **C9** (Improvement Roadmap): hành động cụ thể cho mỗi violation
4. **D3** (Violation Deep Dive): filter project -> xem từng MR vi phạm

### Q: Muốn so sánh 2 phòng ban, xem ở đâu?

1. **F2** (Department Comparison): bar chart so sánh trực tiếp
2. **F7** (Monthly Trend by Department): xu hướng qua nhiều tháng
3. **F1** (Developer Scorecard): filter từng department để xem chi tiết

---

## Phụ lục: Glossary

| Thuật ngữ | Giải thích |
|---|---|
| **Compliance Score** | Điểm 0-100 đánh giá mức tuân thủ quy trình của MR |
| **PASS / WARNING / FAIL** | Grade dựa trên score: >= 80 / 60-79 / < 60 |
| **Violation** | Vi phạm cụ thể (VD: CI_FAILED, NO_DESCRIPTION) |
| **Pass Rate** | % MR đạt score >= 80 |
| **Violation Rate** | % MR có ít nhất 1 violation |
| **Cycle Time** | Thời gian từ tạo MR -> merge (giờ) |
| **MR Size / LOC** | Lines of Code = additions + deletions |
| **Size Label** | XS (<= 50) / S (51-200) / M (201-400) / L (401-700) / XL (> 700) |
| **DORA** | DevOps Research & Assessment — 4 metrics đo hiệu suất delivery |
| **Deploy Frequency** | DORA #1: số lần deploy thành công / tuần |
| **Lead Time** | DORA #2: thời gian từ first commit -> merge |
| **MTTR** | DORA #3: Mean Time to Restore — thời gian phục hồi sau failure |
| **CFR** | DORA #4: Change Failure Rate — % deploy gây failure |
| **AI Commit** | Commit có prefix `[AI]` trong message |
| **Conventional Commits** | Format: `type: description` (feat:, fix:, chore:...) |
| **Protected Branch** | Nhánh chính: main, master, develop, staging |
| **DLQ** | Dead-Letter Queue — webhook events fail hết retry |

---

*Xem thêm:*
- *[dashboard_catalog.md](./dashboard_catalog.md) — Inventory toàn bộ 55 cards*
- *[../reference/architecture_etl.md](../reference/architecture_etl.md) — Kiến trúc data pipeline*
- *[../ops/ops_runbook.md](../ops/ops_runbook.md) — Xử lý khi pipeline lỗi*
- *[../ops/compliance_updater_runbook.md](../ops/compliance_updater_runbook.md) — Thêm/sửa tiêu chí compliance*
- *`docs/ai/internal_rules/01_MR_Compliance.md` — Rule definitions (source of truth)*
- *`docs/mr-compliance/compliance_spec.yaml` — Machine-readable spec v1.6*
