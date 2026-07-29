# Product Requirements Document — Feature Specification

## Hệ thống Quản trị KPI Dev (DORA) & Kiểm soát Tuân thủ QA trên dữ liệu GitLab

> **Tài liệu này mô tả YÊU CẦU TÍNH NĂNG.** Không đề cập kiến trúc, công nghệ, schema hay implementation.
> **Phạm vi:** dữ liệu thực tế cào được từ GitLab (REST API + Webhook). Mọi metric trong tài liệu này phải tính toán được từ dữ liệu này — không có metric "ảo tưởng".
>
> **Phiên bản:** 1.0 — 2026-04-30
> **Tác giả:** Product Owner
> **Reviewer:** QA Lead, Engineering Manager, Dev Lead

---

## 1. Bối cảnh & Mục tiêu

### 1.1 Vấn đề kinh doanh

Tổ chức có **100+ developers** phân bổ trên nhiều project GitLab, với chỉ **<10 QA Engineers**. Hai vấn đề cốt lõi:

1. **Không đo được hiệu suất kỹ thuật chuẩn hóa.** Engineering Manager không biết team triển khai nhanh hay chậm so với chuẩn ngành. Lead time, deploy frequency, recovery time đang là cảm tính.
2. **QA không scale được việc kiểm tra tuân thủ thủ công.** Mỗi sprint hàng trăm MR được merge, QA không thể đọc từng MR để check description, ticket reference, branch naming, AI disclosure...

### 1.2 Mục tiêu sản phẩm

Cung cấp một hệ thống dashboard tự động, đọc dữ liệu trực tiếp từ GitLab, để:

- **Module 1 (DORA Metrics):** đo lường năng lực delivery của team theo 4 chỉ số chuẩn DORA (Google), giúp Engineering Manager ra quyết định đầu tư cải tiến process.
- **Module 2 (QA Compliance):** tự động phát hiện MR vi phạm chuẩn nội bộ ENG-STD-MR-002, chấm điểm và báo động real-time, giúp QA tập trung vào việc coaching thay vì check thủ công.

### 1.3 Nguyên tắc thiết kế (PO-mandated)

| Nguyên tắc | Diễn giải |
|---|---|
| **Data-driven only** | Mỗi tính năng phải dựa trên field cụ thể từ GitLab API. Không có "fake" metric. |
| **Action-oriented** | Mỗi chart phải trả lời "nhìn xong tôi làm gì". Không có vanity number. |
| **Transparency** | Mọi điểm số đều phải traceable về công thức + data nguồn. Dev có thể tự audit. |
| **Coaching, not punishment** | Hệ thống phục vụ tối ưu process, không phải đánh giá cá nhân. |
| **Adoption-aware** | Tính năng phụ thuộc data có thể chưa được team adopt (review, approval) phải được flag là *advisory*, không tính điểm. |

---

## 2. Người dùng & Vai trò

| Persona | Trách nhiệm | Tần suất sử dụng |
|---|---|---|
| **QA Engineer** | Triage MR vi phạm hằng ngày, prep coaching | Hàng ngày |
| **QA Manager / Lead** | Báo cáo compliance định kỳ, phát hiện trend xấu | Tuần / Tháng |
| **Engineering Manager** | Theo dõi DORA, ra quyết định đầu tư process | Tuần / Tháng / Quý |
| **Team Lead / Dev Lead** | Chuẩn bị 1:1, coaching team mình | Tuần |
| **Developer** | Self-service: hiểu vì sao MR mình bị trừ điểm | On-demand |
| **Product Owner** | Theo dõi delivery health, alignment giữa output và outcome | Tháng / Quý |

---

## 3. Phạm vi tính năng (In Scope)

### 3.1 Module 1 — Quản trị KPI Dev theo DORA Framework

Bốn chỉ số DORA gốc của Google + các metric phụ trợ giúp diễn giải DORA.

### 3.2 Module 2 — Kiểm soát Tuân thủ QA

Hệ thống chấm điểm 0-100 dựa trên 10 tiêu chí chuẩn nội bộ + 2 chỉ số *advisory* về review process.

### 3.3 Module ngang (Cross-cutting)

- Bộ lọc đa chiều (project / team / department / role / developer / time range)
- Dim user mapping (username → name → role → team → department → manager)
- Data freshness monitor (đảm bảo dashboard không hiển thị data cũ)
- Real-time alert qua Slack

---

## 4. Phạm vi LOẠI TRỪ (Out of Scope)

Để tránh ảo tưởng tính năng, các điều sau **KHÔNG** thuộc phạm vi sản phẩm này:

| Loại trừ | Lý do |
|---|---|
| Static code analysis / SAST | GitLab API không cung cấp; cần tool riêng |
| Bug count / defect density | Không có nguồn dữ liệu issue tracker được liên kết |
| Code complexity (cyclomatic, etc.) | Không tính được từ MR diff |
| Performance benchmarks (latency, throughput) | Không có data APM |
| Cross-repo dependency analysis | GitLab API list endpoint không trả relationship graph |
| AI prediction / anomaly detection ML | Phase sau, không phải MVP |
| Feature flag / experimentation tracking | Không nằm trong nguồn data hiện tại |
| Customer-facing incident severity (SEV1/2/3) | Tổ chức chưa có incident management tool tích hợp |

---

# 5. MODULE 1 — DORA METRICS DASHBOARD

## 5.1 Tổng quan module

Module này phục vụ **Engineering Manager** và **Dev Lead** với câu hỏi trung tâm:

> *"Team tôi đang triển khai nhanh hay chậm? Quality of delivery có ổn định không?"*

Toàn bộ DORA được tính **per project per week**, có thể aggregate lên team / department / org level.

### 5.1.1 Định nghĩa "Deployment" trong sản phẩm này

GitLab API không có khái niệm "deployment event" tách biệt với pipeline. Sản phẩm dùng **proxy**:

> **Deployment ≡ pipeline thành công trên default branch (`main`, `master`, `develop`, `dev`, `staging`).**

Đây là proxy chuẩn ngành khi không có CD platform tách biệt. Tính năng phải hiển thị rõ định nghĩa này trong tooltip để user không hiểu nhầm.

### 5.1.2 Định nghĩa "Incident" / "Failure"

Tương tự, GitLab API không có incident tracker. Sản phẩm dùng:

> **Failure ≡ pipeline failed trên default branch.**
> **Recovery ≡ pipeline thành công kế tiếp trên cùng branch + project.**

---

## 5.2 Tính năng F-DORA-01 — Deployment Frequency

### Mô tả
Đếm số lần "deployment" (pipeline success trên default branch) theo tuần, theo project, theo team.

### User stories

- **EM:** *Là Engineering Manager, tôi muốn biết tần suất deploy hằng tuần của từng project, để phát hiện project đang stagnant (>1 tuần không có deploy) và can thiệp.*
- **Dev Lead:** *Là Dev Lead, tôi muốn so sánh frequency tuần này với 4 tuần trước, để biết team đang tăng tốc hay chậm lại.*

### Acceptance criteria

- [ ] Hiển thị `successful_deploys / week` per project, line chart 12 tuần gần nhất
- [ ] Có aggregate level: org / team / project (drill-up & drill-down)
- [ ] Phân loại maturity tự động:
  - **Elite:** ≥ 7 deploy/tuần (≥ 1/ngày)
  - **High:** 1–6 deploy/tuần (≥ 1/tuần)
  - **Low:** < 1 deploy/tuần
- [ ] Hiển thị tỷ lệ `successful_deploys / total_pipelines` để phân biệt với pipeline bị fail
- [ ] Tooltip giải thích "deployment = pipeline success on default branch"

### Dữ liệu sử dụng (thực tế)

- `pipelines.status = 'success'` (hoặc các status thành công khác)
- `pipelines.ref IN ('main', 'master', 'develop', 'dev', 'staging')`
- `pipelines.created_at` cho trục tuần

---

## 5.3 Tính năng F-DORA-02 — Lead Time for Changes

### Mô tả
Đo thời gian trung bình từ commit đầu tiên trong MR đến lúc MR được merge.

### User stories

- **EM:** *Là EM, tôi muốn biết Lead Time trung bình của team theo tuần, để đánh giá process review có đang là bottleneck không.*
- **Dev Lead:** *Là Dev Lead, tôi muốn xem outlier (MR có lead time > P90), để follow-up MR đang stuck.*

### Acceptance criteria

- [ ] Hiển thị `avg(merged_at - first_commit_at)` per project per week, đơn vị giờ
- [ ] Có hiển thị P50 và P90 (không chỉ avg) để tránh bias bởi outlier
- [ ] Phân loại maturity:
  - **Elite:** < 24h
  - **High:** 24h – 168h (1 tuần)
  - **Low:** > 168h
- [ ] Drill-down: click vào tuần → list MR đóng góp vào con số đó (kèm lead_time mỗi MR)
- [ ] Loại trừ MR `state != 'merged'` khỏi tính toán
- [ ] Loại trừ MR có `merged_at IS NULL` (race condition GitLab API)

### Dữ liệu sử dụng

- `merge_requests.merged_at`, `merge_requests.state = 'merged'`
- `mr_commits.authored_date` (timestamp commit đầu tiên trong MR)

### Ràng buộc

> ⚠️ Lead time trong sản phẩm này là **commit-to-merge**, KHÔNG phải **commit-to-deploy**.
> Lý do: không thể join chính xác MR ↔ pipeline deploy thực sự đưa code đó lên prod (nhiều MR có thể được gộp vào 1 deploy, hoặc 1 MR có thể trigger nhiều deploy). Tooltip phải ghi rõ.

---

## 5.4 Tính năng F-DORA-03 — Change Failure Rate

### Mô tả
Tỷ lệ phần trăm pipeline trên default branch bị fail.

### User stories

- **EM:** *Là EM, tôi muốn biết % pipeline fail trên default branch, để đánh giá quality gate có hoạt động hiệu quả không.*

### Acceptance criteria

- [ ] Hiển thị `failed_pipelines / total_pipelines * 100` per project per week
- [ ] Phân loại maturity:
  - **Elite:** ≤ 5%
  - **High:** 5% – 15%
  - **Low:** > 15%
- [ ] Reference line ở 15% (target tổ chức)
- [ ] Drill-down: click vào tuần có failure_rate cao → list pipeline failed cụ thể (project, branch, ai trigger)

### Dữ liệu sử dụng

- `pipelines.status = 'failed'`
- `pipelines.ref` (default branches only)

### Ràng buộc

> Sản phẩm KHÔNG phân biệt được "failure tại stage build" vs "failure tại stage deploy" trừ khi có pipeline_jobs data. Khi pipeline_jobs có sẵn (đã extract), feature mở rộng có thể breakdown theo stage.

---

## 5.5 Tính năng F-DORA-04 — Mean Time to Restore (MTTR)

### Mô tả
Thời gian trung bình từ pipeline fail đến pipeline success kế tiếp trên cùng branch.

### User stories

- **EM:** *Là EM, tôi muốn biết khi CI/CD bị break, team mất bao lâu để fix. Nếu MTTR tăng dần, đó là dấu hiệu technical debt.*

### Acceptance criteria

- [ ] Hiển thị `avg(next_success.created_at - failure.created_at)` per project per week, đơn vị giờ
- [ ] Phân loại maturity:
  - **Elite:** < 1 giờ
  - **High:** 1h – 24h
  - **Low:** > 24h
- [ ] Drill-down: list các incident (failure → recovery) cụ thể với khoảng thời gian
- [ ] Khi 1 failure không có recovery (pipeline fail mãi không success) → đếm là "ongoing incident", hiển thị riêng

### Dữ liệu sử dụng

- `pipelines.status` ('failed' và 'success')
- `pipelines.ref`, `pipelines.project_id` (để pair failure với recovery cùng branch)
- `pipelines.created_at`

---

## 5.6 Tính năng F-DORA-05 — DORA Maturity Scorecard

### Mô tả
Tổng hợp 4 DORA metrics thành 1 bảng "1 trang" với rating Elite / High / Low cho từng project.

### User stories

- **EM:** *Là EM, tôi muốn nhìn 1 bảng để biết project nào đang Elite, project nào đang Low, không cần xem từng chart.*

### Acceptance criteria

- [ ] Bảng N rows × 4 cột (1 cột cho mỗi DORA metric)
- [ ] Mỗi ô hiển thị giá trị + rating (Elite/High/Low) với màu sắc
- [ ] Có cột "composite_grade" tổng hợp (4 Elite = Elite, có 1 Low = cần attention)
- [ ] Sort theo composite_grade, project tệ nhất ở trên đầu
- [ ] Filter time range: 4 tuần / 12 tuần / 52 tuần

---

## 5.7 Tính năng F-DORA-06 — Cycle Time Breakdown (Phụ trợ DORA)

### Mô tả
Phân rã chi tiết hơn Lead Time: từ created → first review → approved → merged.

### User stories

- **Dev Lead:** *Là Dev Lead, tôi muốn biết MR đang stuck ở giai đoạn nào (chờ review? chờ approval? đã approve nhưng chưa merge?), để intervene đúng chỗ.*

### Acceptance criteria

- [ ] Hiển thị 4 mốc thời gian per MR: `created → first_review → first_approval → merged`
- [ ] Tính `time_to_first_review_hours`, `time_to_approval_hours`, `review_duration_hours`, `merge_delay_hours`
- [ ] Aggregate trên team: avg, P50, P90 cho mỗi mốc
- [ ] Phát hiện MR "stuck" (created > 7 ngày, chưa có first_review)
- [ ] Trend line 12 tuần để thấy bottleneck đang dịch chuyển (review → approval → merge)

### Dữ liệu sử dụng

- `merge_requests.created_at`, `merged_at`
- `mr_notes` (comment đầu tiên từ người KHÁC tác giả MR = first review)
- `mr_notes` system event "approved this merge request" = first approval

### Ràng buộc

> ⚠️ **Adoption gap:** Hiện chỉ ~5 projects dùng GitLab Approval workflow. Với các project còn lại, `time_to_approval` sẽ là NULL. Feature phải hiển thị "N/A" rõ ràng, không show 0 gây hiểu nhầm.

---

## 5.8 Tính năng F-DORA-07 — Reviewer Workload

### Mô tả
Đo tải reviewer: ai review nhiều nhất, ai review nhanh nhất, có ai bị overload không.

### User stories

- **Dev Lead:** *Là Dev Lead, tôi muốn biết reviewer nào đang gánh nhiều MR nhất, để rebalance trước khi họ burnout.*
- **EM:** *Là EM, tôi muốn phát hiện anti-pattern "self-review" (tác giả tự comment để qua mặt rule).*

### Acceptance criteria

- [ ] Per reviewer per week:
  - `mrs_reviewed` (số MR có comment)
  - `total_comments`
  - `avg_response_time_hours` (từ MR created → comment đầu tiên của reviewer này)
  - `projects_reviewed`
- [ ] Phát hiện self-review: count MR mà reviewer_username = mr.author_username
- [ ] Top 10 reviewer theo volume + Top 10 theo response speed
- [ ] Drill-down: click reviewer → list MR họ đã review

### Dữ liệu sử dụng

- `mr_notes.author_username` (người comment)
- `mr_notes.created_at`
- `merge_requests.author_username` (để loại self-review)

### Ràng buộc

> ⚠️ Hiện tại review rate của tổ chức chỉ ~1.6% (5141 notes trên 320K+ commits). Phần lớn MR không có review note nào. Feature phải xử lý gracefully: "0 reviewer" không phải lỗi data, là realtime adoption.

---

## 5.9 Tính năng F-DORA-08 — AI Adoption Tracker (Phụ trợ)

### Mô tả
Theo dõi tỷ lệ commit / LOC được AI hỗ trợ — KPI chiến lược của tổ chức.

### User stories

- **EM:** *Là EM, tôi muốn biết team có đang tận dụng AI không. Target: 30% commit AI-assisted.*

### Acceptance criteria

- [ ] Hiển thị `ai_commit_pct` (% commit có flag is_ai) và `ai_loc_pct` (% LOC) per project per week
- [ ] Reference line tại 30% (target)
- [ ] So sánh dev: top adopter, bottom adopter
- [ ] Tooltip giải thích cách detect AI commit (signature trong commit message hoặc co-author = AI)

### Dữ liệu sử dụng

- `commits.is_ai` (đã được tính ở extraction từ commit message pattern)
- `commits.total_loc`

---

# 6. MODULE 2 — QA COMPLIANCE DASHBOARD

## 6.1 Tổng quan module

Module này phục vụ **QA Engineer** và **QA Manager** với câu hỏi trung tâm:

> *"MR nào đang vi phạm chuẩn? Team có đang tuân thủ tốt hơn tuần trước không?"*

### 6.1.1 Hệ thống chấm điểm

Mỗi MR được tự động chấm điểm **0–100** dựa trên 10 tiêu chí (trọng số khác nhau). Phân loại:

| Score | Grade | Ý nghĩa |
|---|---|---|
| 80 – 100 | **PASS** | Tuân thủ tốt |
| 60 – 79 | **WARNING** | Cần improve |
| 0 – 59 | **FAIL** | Vi phạm nghiêm trọng |

### 6.1.2 Phân loại severity

| Severity | Diễn giải | Hành động |
|---|---|---|
| **BLOCKER** | Vi phạm cốt lõi, không được merge | Slack alert ngay, escalate Lead |
| **REQUIRED** | Vi phạm cần fix, cho phép merge với warning | Báo trong daily digest |
| **ADVISORY** | Tracking only, không ảnh hưởng score | Hiển thị trên dashboard adoption |

---

## 6.2 Tính năng F-QA-01 — Compliance Scoring 10 tiêu chí

### Mô tả
Tự động chấm điểm mỗi MR theo công thức 10 tiêu chí.

### Bảng tiêu chí (đầy đủ — phải đồng bộ với chuẩn ENG-STD-MR-002 v1.4)

| # | Tiêu chí | Trọng số | Severity | Detection logic |
|---|---|---|---|---|
| 1 | **CI pass/fail** | 25 | BLOCKER | `ci_passed = true`? |
| 2 | **Coverage absolute** | 10 | REQUIRED | ≥ 80% → 10pt; 60–79% → 5pt; < 60% → 0pt + violation |
| 3 | **Coverage delta** | 5 | REQUIRED | (recent 2w avg) - (prior 2w avg) ≥ -5%? |
| 4 | **MR Size** | 15 | BLOCKER | ≤ 400 LOC → 15pt; ≤ 700 → 8pt; > 700 → 0pt + violation |
| 5 | **Description present** | 10 | BLOCKER | description.length > 50 chars? |
| 6 | **Description template** | 5 | REQUIRED | ≥ 3/5 sections theo template? |
| 7 | **Ticket reference** | 10 | REQUIRED | description match pattern `closes #\|refs #\|JIRA-\d+`? |
| 8 | **AI Disclosure** | 5 | REQUIRED | description có `[x]` AI Disclosure checkbox? |
| 9 | **Branch naming** | 10 | REQUIRED | source_branch match `<type>/<request-id>-<desc>`? |
| 10 | **MR title** | 5 | REQUIRED | title theo Conventional Commits format? |
| | **Tổng** | **100** | | |

### Acceptance criteria

- [ ] Hệ thống tự động chấm điểm mỗi MR ngay khi MR được sync về
- [ ] Score được tái tính lại khi MR được update (description, branch, CI status thay đổi)
- [ ] Mọi tiêu chí phải có detection logic deterministic (không AI/ML, không heuristic)
- [ ] Có khả năng đổi trọng số / thêm tiêu chí mới qua config file (không phải code change)

### Dữ liệu sử dụng

Tất cả từ `merge_requests` table (đã enrich): `ci_passed`, `coverage`, `mr_size`, `has_description`, `has_description_template`, `has_ticket_ref`, `has_ai_disclosure`, `has_valid_branch_name`, `has_conventional_title`.

---

## 6.3 Tính năng F-QA-02 — Violation Catalog & Detection

### Mô tả
Hệ thống phát hiện 10 loại vi phạm scored + 2 loại advisory.

### Danh mục violation

| Code | Mô tả | Category | Severity | Score weight |
|---|---|---|---|---|
| `CI_FAILED` | CI pipeline thất bại | Quality Gate | BLOCKER | 25 |
| `LOW_COVERAGE` | Test coverage < 60% | Quality Gate | REQUIRED | 10 |
| `COVERAGE_DROPPING` | Coverage giảm > 5% so với 2 tuần trước | Quality Gate | REQUIRED | 5 |
| `MR_TOO_LARGE` | MR > 700 LOC | MR Size | BLOCKER | 15 |
| `NO_DESCRIPTION` | MR không có description | Documentation | BLOCKER | 10 |
| `DESCRIPTION_MISSING_TEMPLATE` | Description thiếu sections theo template | Documentation | REQUIRED | 5 |
| `NO_TICKET_REF` | Không có ticket reference | Documentation | REQUIRED | 10 |
| `NO_AI_DISCLOSURE` | AI Disclosure checkbox chưa tick | AI Compliance | REQUIRED | 5 |
| `BRANCH_NAMING_VIOLATION` | Branch name không theo chuẩn | Naming Convention | REQUIRED | 10 |
| `MR_TITLE_VIOLATION` | MR title không theo Conventional Commits | Naming Convention | REQUIRED | 5 |
| **Advisory:** | | | | |
| `NO_REVIEWER` | MR chưa được assign reviewer | Review Process | ADVISORY | 0 |
| `NOT_APPROVED` | MR merged mà chưa approved | Review Process | ADVISORY | 0 |

### Acceptance criteria

- [ ] Mỗi violation có code, label tiếng Việt, category, severity, score_weight, detection rule
- [ ] Có thể bật/tắt từng violation qua config (không cần redeploy)
- [ ] Dashboard hiển thị `top violation types` theo count, theo dev affected, theo project
- [ ] Heatmap `developer × violation_type` để phát hiện coaching opportunity

### Ràng buộc Advisory

> ⚠️ **NO_REVIEWER và NOT_APPROVED hiện adoption ~0% và ~5 projects.** Vì vậy 2 violation này score_weight=0, chỉ tracking adoption progress. Khi adoption đạt > 80%, có thể bump lên có scoring.

---

## 6.4 Tính năng F-QA-03 — Active Violations Triage Queue

### Mô tả
Hàng đợi MR vi phạm cần xử lý ngay, sắp xếp theo độ nghiêm trọng.

### User stories

- **QA Engineer:** *Là QA Engineer, mỗi sáng tôi mở dashboard này để biết MR nào cần follow up trong ngày.*

### Acceptance criteria

- [ ] Bảng list MR có violation, sort by `compliance_score ASC` (tệ nhất trên đầu)
- [ ] Cột: MR iid, project, author, title, score, violations[], age_hours, link đến GitLab
- [ ] Filter mặc định: created < 48h
- [ ] Highlight đỏ nếu score < 40, vàng nếu 40-59
- [ ] Highlight cảnh báo nếu `age_hours > 24` (MR đã cũ mà vẫn vi phạm)
- [ ] Click MR → mở GitLab trong tab mới

---

## 6.5 Tính năng F-QA-04 — Compliance Trend Reporting

### Mô tả
Báo cáo trend tuần / tháng cho QA Manager.

### User stories

- **QA Manager:** *Là QA Manager, weekly report tôi cần show pass rate qua 8 tuần để chứng minh coaching đang work.*

### Acceptance criteria

- [ ] Line chart 3 series (pass_rate %, warn_rate %, fail_rate %) trên 8 tuần
- [ ] Reference line ở 80% (target pass rate)
- [ ] Histogram phân phối score (bucket 0-20, 20-40, 40-60, 60-80, 80-100)
- [ ] So sánh tuần này vs trung bình 4 tuần trước (delta %)
- [ ] Auto alert qua Slack nếu fail_rate > 25% bất kỳ tuần nào

---

## 6.6 Tính năng F-QA-05 — Developer Coaching Profile

### Mô tả
View chi tiết 1 dev: trend score 90 ngày, violation pattern, danh sách MR.

### User stories

- **Team Lead:** *Là Team Lead, trước 1:1 tôi cần hiểu dev này đang vướng tiêu chí nào, có improving không.*

### Acceptance criteria

- [ ] Parameter: chọn `developer_username`
- [ ] Panel 1: line chart score trung bình của dev này 12 tuần
- [ ] Panel 2: top violation types của dev này (so sánh với team avg)
- [ ] Panel 3: list 50 MR gần nhất với score, violations
- [ ] Trend label: IMPROVING / STABLE / DECLINING (so sánh tháng này vs tháng trước)

### Lưu ý vận hành (PO mandate)

> 📌 **Hệ thống KHÔNG phải để đánh giá performance cá nhân.** Nó là công cụ coaching. UI phải có disclaimer rõ ràng: dữ liệu này không được dùng cho đánh giá cuối kỳ, KPI lương thưởng, hay PIP.

---

## 6.7 Tính năng F-QA-06 — Single MR Audit (Receipt)

### Mô tả
"Hóa đơn" giải thích vì sao MR X được điểm Y.

### User stories

- **Developer:** *Là dev, MR của tôi bị 63/100. Tôi cần biết bị trừ điểm ở tiêu chí nào để fix.*
- **QA Engineer:** *Là QA, khi dev tranh luận về điểm, tôi cần show breakdown để giải thích.*

### Acceptance criteria

- [ ] Parameter: chọn `project_name` + `mr_iid`
- [ ] Bảng 10 dòng (1 dòng / tiêu chí): tên tiêu chí, max_pts, earned_pts, status (PASS/PARTIAL/FAIL), giá trị thực tế từ DB, công thức
- [ ] Tổng dòng cuối: total_score / 100
- [ ] Link "View raw data" → modal show JSON gốc của MR

---

## 6.8 Tính năng F-QA-07 — Project Health Scorecard

### Mô tả
Bảng tổng hợp health của tất cả projects, ranked by priority.

### User stories

- **EM:** *Là EM, tôi muốn 1 bảng cho biết project nào cần attention ngay.*
- **QA Lead:** *Là QA Lead, tôi muốn biết project nào đang drag down team average.*

### Acceptance criteria

- [ ] Bảng N rows (mỗi project), cột:
  - Avg compliance_score (last 30d)
  - CI pass rate
  - Avg coverage
  - Avg cycle time (hours)
  - XL MR count
  - AI adoption %
  - `composite_grade` (RED / YELLOW / GREEN)
- [ ] Sort by composite_grade, RED ở trên đầu
- [ ] Color-coded mỗi ô theo threshold

---

## 6.9 Tính năng F-QA-08 — Real-time Violation Alert

### Mô tả
Gửi Slack alert ngay khi có MR vi phạm BLOCKER trên protected branch.

### User stories

- **QA Engineer:** *Là QA, tôi muốn được nhắc ngay khi có MR vi phạm trên main, không cần đợi đến hôm sau.*

### Acceptance criteria

- [ ] Trigger: MR mới merged hoặc updated với violation severity = BLOCKER
- [ ] Filter target_branch IN ('main', 'master', 'develop')
- [ ] Dedup: không alert lại cùng MR trong 24h
- [ ] Max 10 violations per Slack message (tránh spam)
- [ ] Message format: link đến MR, list violations, score, author tag
- [ ] Channel: `#engineering-quality`

---

## 6.10 Tính năng F-QA-09 — Formula Transparency

### Mô tả
Một collection chart giải thích "công thức compliance hoạt động thế nào".

### User stories

- **Developer:** *Là dev, tôi cần hiểu công thức để không cảm giác "hệ thống đối phó".*
- **QA:** *Là QA, khi audit, tôi cần traceability từ score → formula → source data.*

### Acceptance criteria

- [ ] Bảng "Formula Reference": 10 tiêu chí với label, max_pts, avg_pts_earned, pass_rate
- [ ] Horizontal bar chart "Pass Rate per Criterion" (worst-first)
- [ ] Horizontal bar chart "Points Lost per Criterion" (criterion nào kéo điểm xuống nhiều nhất)
- [ ] Heatmap `criterion × project` (pass rate %)
- [ ] Bảng "Source & Detection Reference" — static, document mapping criterion → bảng nguồn → cột → logic
- [ ] Bảng "Detection Flag Distribution" — % NULL, % TRUE, % FALSE cho mỗi flag → phát hiện extraction bug

---

## 6.11 Tính năng F-QA-10 — Long Commit Message Detection

### Mô tả
Phát hiện commit message > 500 ký tự (vi phạm Push Rules).

### User stories

- **QA:** *Là QA, tôi muốn biết dev nào đang viết commit message dài bất thường (signal AI dump).*

### Acceptance criteria

- [ ] Bảng list commit có message > 500 ký tự
- [ ] Aggregate: count theo dev, latest_occurrence
- [ ] Note: nếu xuất hiện rows → GitLab Push Rules chưa được enable cho project đó

### Dữ liệu sử dụng

- `commits.message` length
- `commits.author_name`, `committed_date`

---

# 7. CROSS-CUTTING FEATURES (Module ngang)

## 7.1 Tính năng F-CC-01 — Multi-dimensional Filter

Mọi dashboard phải hỗ trợ filter:

- **Time range:** custom date range, last 7/30/90/365 days, last week/month/quarter
- **Project:** multi-select
- **Department:** Engineering / Engineering Management / QA / Unassigned
- **Team:** dropdown
- **Role:** Guest / Reporter / Developer / Maintainer / Owner
- **Developer username:** type-ahead search

Acceptance: Filter state persistent qua session, có thể share URL với filter applied.

---

## 7.2 Tính năng F-CC-02 — User Dimension Management

### Mô tả
Mapping username → real name → role → team → department → manager.

### User stories

- **HR/QA Lead:** *Là QA Lead, tôi muốn maintain bảng mapping dev → team/department, để dashboard có thể group đúng.*

### Acceptance criteria

- [ ] Auto-import danh sách user từ GitLab Group Members API
- [ ] Cho phép QA/HR upload CSV mapping (department, team, manager)
- [ ] Users không có mapping → fallback "Unassigned"
- [ ] UI cho QA Lead edit mapping (không cần code)
- [ ] Preview matched count khi import

### Ràng buộc

> ⚠️ **GitLab email có thể là private (NULL).** Mapping qua email không phải lúc nào cũng work. Fallback strategy: match qua username, tên hiển thị, hoặc manual override.

---

## 7.3 Tính năng F-CC-03 — Data Freshness Monitor

### Mô tả
Hiển thị "data đang fresh hay stale".

### User stories

- **QA / EM:** *Trước khi tin số liệu, tôi cần biết data sync gần nhất là bao giờ.*

### Acceptance criteria

- [ ] Banner trên đầu mọi dashboard: "Data updated X minutes ago"
- [ ] Riêng cards cho mỗi nguồn: MR lag, Commit lag, Pipeline lag
- [ ] Color: green < 2h, amber 2-24h, red > 24h
- [ ] Alert Slack nếu lag > 24h (extraction bị stuck)

---

## 7.4 Tính năng F-CC-04 — Drill-down Navigation

Mọi aggregate chart phải drill-down được:

- Click 1 tuần trên line chart → mở table list MR đóng góp tuần đó
- Click 1 violation type → mở list MR có violation đó
- Click 1 project trên scorecard → mở project detail page
- Click 1 dev → mở developer profile

Acceptance: depth ≥ 2 levels, breadcrumb back-navigation.

---

# 8. DATA CONSTRAINTS — Ràng buộc về dữ liệu thực tế

> Phần này quan trọng để PO/Stakeholder hiểu *cái gì có thể tin*, *cái gì cần đối chiếu*.

| Constraint | Tác động | Cách xử lý |
|---|---|---|
| `merged_at` có thể NULL kể cả khi state='merged' (race condition GitLab API) | Lead time / Cycle time có thể thiếu rows | Filter `merged_at IS NOT NULL` khi tính avg |
| `coverage` có thể NULL | Score `coverage_absolute` = 0pt nhưng KHÔNG raise violation | Tooltip giải thích "no data, not penalised" |
| Reviewer adoption ~0%, approval workflow chỉ ~5 projects | NO_REVIEWER và NOT_APPROVED ~ 99% MR | Để 2 violation này là ADVISORY (score_weight=0) |
| `additions/deletions` chỉ có ở single MR endpoint, không có ở list endpoint | MR_TOO_LARGE phụ thuộc enrichment call | Phải đảm bảo extraction enrich đủ trước khi chấm score |
| Group member email có thể private (NULL) | Identity mapping không 100% chính xác | Fallback: username + name match (~72% coverage) |
| Pipeline `coverage` từ GitLab CI parser, không phải coverage tool ground truth | Có thể lệch với SonarQube/Codecov | Disclaimer rõ |
| Không có "deployment event" → dùng pipeline success on default branch | DORA Deployment Frequency là proxy | Tooltip rõ định nghĩa |
| Không có "incident tracker" → dùng pipeline failure → next success | DORA MTTR là proxy | Tooltip rõ định nghĩa |
| Commit `is_ai` detect bằng signature/co-author pattern | Có thể false negative (dev không khai báo) | Bổ sung bằng MR AI Disclosure checkbox |
| `mr_notes` extraction rate-limited (~0.1s/MR) | Notes data có thể chậm vài giờ | Data freshness monitor flag rõ |

---

# 9. ACCEPTANCE CRITERIA — Definition of Done cho toàn sản phẩm

Sản phẩm được coi là DONE khi:

### 9.1 Functional

- [ ] 4/4 DORA metrics tính được, hiển thị đúng cho ≥ 80% projects active
- [ ] 10/10 compliance criteria tự chấm điểm, ≥ 95% MR có score (5% còn lại do data gap, được flag rõ)
- [ ] Real-time alert hoạt động, dedup chính xác trong 24h window
- [ ] Drill-down 2 levels mọi chart
- [ ] Filter cross-dimensional (5 dimensions) hoạt động consistent

### 9.2 Quality

- [ ] Mỗi tính năng có acceptance test
- [ ] Mỗi metric có tooltip giải thích định nghĩa + nguồn data
- [ ] Mỗi violation có "human-readable" Vietnamese label
- [ ] Mỗi disclaimer (proxy, adoption gap) hiển thị rõ trên UI

### 9.3 Adoption

- [ ] QA Engineer dùng triage queue hằng ngày (đo qua dashboard view count)
- [ ] EM dùng DORA scorecard ít nhất tuần 1 lần
- [ ] ≥ 90% MR có description (sau 1 quý sản phẩm live)
- [ ] Pass rate compliance tăng ≥ 10% sau 1 quý

### 9.4 Trust

- [ ] Mọi điểm số có "show formula" link
- [ ] Có audit log: "tại sao MR X có score Y vào ngày Z"
- [ ] Khi data lệch (vd: extraction bị bug), banner hiển thị rõ "data stale, score may be outdated"

---

# 10. ROADMAP đề xuất

| Phase | Tính năng | Outcome |
|---|---|---|
| **MVP (đã DONE)** | F-QA-01 → F-QA-09 (9/10 compliance features) + F-DORA-01 → 04 (4 DORA core) + F-CC-01 → 03 | QA và EM dùng được ngay |
| **Phase 2 (current)** | F-DORA-05 (Maturity Scorecard), F-DORA-06 (Cycle Time Breakdown), F-CC-02 (Dim user) | Decision support layer |
| **Phase 3** | F-DORA-07 (Reviewer Workload), F-DORA-08 (AI Adoption), F-QA-10 (Long commit) | Coaching layer |
| **Phase 4 (future)** | Push để adoption review/approval (NO_REVIEWER → scored) | Bump scoring weights khi adoption ≥ 80% |
| **Out of scope (Phase 5+)** | AI prediction, anomaly detection, code quality SAST integration | Cần data/tool mới |

---

# 11. Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Dev "game" hệ thống (tick fake AI Disclosure để qua check) | High | Medium | Multi-signal verification (cross-check commit `is_ai` flag) |
| Data extraction bị stuck → dashboard cũ → trust loss | Medium | High | F-CC-03 freshness monitor + Slack alert + Healer auto-retry |
| GitLab API change → field rename → score break | Low | High | Schema snapshot + validation layer flagged trước khi deploy |
| Reviewer adoption mãi không tăng → NO_REVIEWER không bao giờ scored | Medium | Low | Quarterly review threshold, không hard-deadline |
| Score inflation (mọi MR đều ≥ 80) → metric mất ý nghĩa | Low | Medium | Quarterly review threshold, tighten criteria nếu cần |
| Dev cảm thấy bị "đo lường để punish" | High | High | UI disclaimer, không dùng cho perf review, communication từ Eng leadership |

---

# 12. Open Questions

1. Có cần expose dashboard này cho Dev tự xem không, hay chỉ Lead/Manager?
   → **Đề xuất:** Self-service cho Dev xem MR của chính mình, không xem được MR người khác.
2. Threshold maturity DORA (Elite/High/Low) dùng standard Google hay custom theo industry tổ chức?
   → **Đề xuất:** Bắt đầu với standard Google, sau 6 tháng data thực tế thì calibrate.
3. NO_REVIEWER bao giờ thì bump lên scored?
   → **Đề xuất:** Khi adoption ≥ 80% (đo qua tỷ lệ MR có ≥ 1 reviewer được assign).
4. Có cần dashboard cho non-technical stakeholder (PM, BA, CEO)?
   → **Đề xuất:** Phase sau, dạng "executive summary" 1 trang.

---

# 13. Phụ lục — Glossary

| Term | Định nghĩa trong sản phẩm này |
|---|---|
| **MR** | Merge Request (đồng nghĩa GitHub PR) |
| **Compliance Score** | Điểm 0-100 chấm tự động theo 10 tiêu chí ENG-STD-MR-002 v1.4 |
| **Violation** | Một vi phạm cụ thể của 1 trong 10 tiêu chí |
| **DORA** | DevOps Research and Assessment — 4 metrics chuẩn của Google |
| **Deployment** *(trong sản phẩm)* | Pipeline thành công trên default branch (proxy) |
| **Failure** *(trong sản phẩm)* | Pipeline failed trên default branch |
| **Recovery** *(trong sản phẩm)* | Pipeline success kế tiếp sau failure trên cùng project + branch |
| **Lead Time** | Thời gian từ commit đầu tiên trong MR → merged_at |
| **MTTR** | Mean Time to Restore — thời gian failure → recovery |
| **Default Branch** | `main`, `master`, `develop`, `dev`, `staging` |
| **Protected Branch** | Branch được GitLab mark "protected" — thường = default branch |
| **Advisory Violation** | Vi phạm chỉ tracking, không tính vào score |
| **Coaching** | Hành động Lead/QA hướng dẫn dev, đối lập với "punishment" |
| **Self-review** | Anti-pattern: tác giả MR comment trên chính MR của mình |

---

*Tài liệu này là source of truth cho yêu cầu tính năng. Mọi sai lệch giữa implementation và tài liệu phải được raise tới Product Owner trước khi merge.*

*— PO, ENG-ANA-001, 2026-04-30*
