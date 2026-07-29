---
type: Business Rule
title: Business Rules & Domain Overview
description: Tổng quan nghiệp vụ và quy tắc kinh doanh của hệ thống gitlab-analytics.
tags:
- business
- domain
- rules
timestamp: '2026-07-28T16:17:46.828614+00:00'
---

# Business Intent & Domain Overview
Dự án `gitlab-analytics` chứa **322** code modules va **63** tai lieu Product Spec co san. (Mode: AI Synthesis)

## AI-Reconciled Business Domain Analysis
Dưới đây là báo cáo phân tích và tổng hợp toàn bộ hệ thống **`gitlab-analytics`** đứng trên góc độ **Senior Business Analyst & Software Architect**. Báo cáo dựa trên việc đối chiếu giữa toàn bộ Tài liệu Thiết kế/Specs/Guides và Mã nguồn thực tế của dự án.

---

# I. Quy tắc Nghiệp vụ Cốt lõi (Core Business Rules & Logic)

Mục tiêu cốt lõi của hệ thống là **tự động hóa giám sát tuân thủ (compliance) quy trình Git/MR cho 100+ lập trình viên** với nguồn lực QA hạn chế (<10 người), đồng thời theo dõi các chỉ số hiệu suất phát triển phần mềm **DORA metrics**.

### 1. Thuật toán Tính điểm Tuân thủ MR (MR Compliance Scoring v1.6 / v1.4)
Mỗi Merge Request (MR) khi tạo ra và merge sẽ được chấm trên thang điểm **100 điểm** dựa trên 4 nhóm tiêu chí (10 tiêu chí scoring) + 2 tiêu chí khuyến nghị (Advisory):

*   **Group 1: Quality Gate (Tối đa 35 điểm)**
    *   `CI_STATUS` (25đ): Pipeline CI trên nhánh mặc định hoặc head pipeline của MR phải `passed`.
    *   `COVERAGE_ABS` (10đ): Code coverage tuyệt đối ≥ 80% đạt 10đ; 50–79% đạt 5đ; < 50% đạt 0đ.
    *   `COVERAGE_DELTA` (5đ): Độ biến động coverage không bị giảm (delta ≥ 0% đạt 5đ; < 0% đạt 0đ).
*   **Group 2: Kích thước MR / MR Size (Tối đa 15 điểm)**
    *   `MR_SIZE` (15đ): Tổng LOC thay đổi (additions + deletions) ≤ 400 lines (XS/S) đạt 15đ; ≤ 700 lines (M) đạt 8đ; > 700 lines (L/XL) đạt 0đ (vi phạm `MR_TOO_LARGE`).
*   **Group 3: Mô tả & Ngữ cảnh / Description & Context (Tối đa 25 điểm)**
    *   `DESCRIPTION_LENGTH` (10đ): Mô tả MR không được để trống (độ dài ≥ 30 ký tự hoặc đúng template).
    *   `TICKET_REF` (10đ): Phải chứa tham chiếu Ticket/Issue (vd: `[#JIRA-123]`, `#123`).
    *   `AI_DISCLOSURE` (5đ): Khai báo sử dụng AI nếu có commit chứa AI (tag `[AI]` trong commit message hoặc tích chọn AI Disclosure).
*   **Group 4: Quy chuẩn Git & Commit / Git Hygiene (Tối đa 25 điểm)**
    *   `BRANCH_NAME` (10đ): Tên nhánh phải tuân thủ convention (`feature/*`, `bugfix/*`, `hotfix/*`, `refactor/*`, `chore/*`).
    *   `CONVENTIONAL_TITLE` (10đ): Tiêu đề MR tuân thủ Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, ...).
    *   `COMMIT_HYGIENE` (5đ): Số lượng commit hợp lý (≤ 5 commits/MR hoặc commit message tuân thủ chuẩn).
*   **Advisory Criteria (0 điểm trừ, dùng cảnh báo/giám sát):**
    *   `NO_SCREENSHOTS_UI` (R-MR-005): MR đụng chạm UI/Frontend bắt buộc có screenshot/GIF.
    *   `NOT_REBASED` (R-MR-006): MR phải được rebase với nhánh đích trước khi merge.

**Phân loại Grade:**
*   **PASS**: Score ≥ 80
*   **WARNING**: Score từ 60 đến 79
*   **FAIL**: Score < 60 (Tự động kích hoạt cảnh báo tới Slack)

### 2. Tiêu chí DORA Metrics (DORA 4 Key Metrics)
Tự động tính toán theo tuần và dự án (`v_dora_metrics.sql`):
1.  **Deployment Frequency (DF)**: Số lượng pipeline chạy thành công trên nhánh mặc định (`main`/`master`) theo tuần.
2.  **Lead Time for Changes (LTC)**: Thời gian từ commit đầu tiên đến khi MR được merge thành công (truy xuất qua cầu nối `stg_mr_commits`).
3.  **Change Failure Rate (CFR)**: Tỷ lệ pipeline thất bại so với tổng số pipeline triển khai.
4.  **Time to Restore Service (MTTR)**: Thời gian trung bình khắc phục sự cố (tính từ pipeline lỗi đến pipeline thành công tiếp theo).

### 3. Quy tắc Vận hành Data Pipeline & Alerting
*   **Thứ tự ETL Incremental**: Chạy cào dữ liệu qua `dlt` (write disposition = `merge`) → Cập nhật watermark/cursor vào `gitlab_raw.pipeline_state` → Chạy `dbt run` biến đổi sang schema `gitlab_kpi` → Chạy `compliance_alert.py` để gửi thông báo.
*   **Deduplication Alert**: Cảnh báo vi phạm Slack được khử trùng lặp (chỉ gửi 1 lần cho từng MR ID vi phạm) nhờ lưu trạng thái gửi vào bảng DB / file checkpoint.
*   **System Freshness SLA**: Nếu dữ liệu cào muộn quá 24h hoặc ETL lỗi liên tiếp ≥ 3 lần (`consecutive_failures >= 3`), hệ thống tự động bắn cảnh báo **Freshness Alert** (`freshness_alert.py`) lên kênh Slack vận hành.

---

# II. Đối chiếu giữa Spec (Tài liệu) và Codebase (Mã nguồn thực tế)

Sau khi đọc và so sánh toàn bộ file tài liệu và mã nguồn, dưới đây là bảng tổng hợp mức độ khớp (Alignment Gap Analysis):

### 1. Điểm Khớp Hoàn Hảo (100% Implemented)
*   **Kiến trúc Data 3 Layers**:
    *   `gitlab_raw` (dlt extraction) → `gitlab_kpi_staging` (dbt `stg_*` views) → `gitlab_kpi` (dbt marts `v_*`). Khớp hoàn toàn giữa SDD, DB ERD và mã nguồn trong `src/transform/models/`.
*   **Cơ chế Chuyển đổi Spec thành Code (`compliance_updater`)**:
    *   Mã nguồn `src/compliance_updater/` đọc trực tiếp file cấu hình `docs/mr-compliance/compliance_spec.yaml` (v1.6) để tự động sinh mã SQL trong `v_mr_compliance.sql`, `v_compliance_violation_detail.sql` và sinh hằng số Python `src/alerting/thresholds.py`. Spec tài liệu và code triển khai đồng bộ hoàn toàn thông qua cơ chế code-generation này.
*   **Metabase Auto-Provisioning (Dashboard Collections A–F)**:
    *   File script `src/metabase/setup_dashboards.py` tự động định nghĩa và khởi tạo đúng **53–55 dashboard cards** qua REST API trên 6 collections (A: Ops Health, B: QA Compliance, C: Eng Management, D: Deep Dive, E: Formula Transparency, F: KPI Control Panel) đúng như mô tả trong `docs/guides/dashboard_catalog.md` và `docs/dashboard_queries/`.
*   **Partitioning Data Strategy (DB Archive Strategy Phase 2)**:
    *   Các migration SQL `010_pipeline_jobs_created_at_timestamptz.sql`, `011_pipeline_jobs_partition.sql`, `012_pipelines_partition.sql`, `013_commits_partition.sql` triển khai chính xác chiến lược Range Partitioning theo tháng đúng như đề xuất trong `docs/ops/DB_ARCHIVE_STRATEGY.md`.

### 2. Điểm Khác biệt & Gap giữa Spec và Thực tế Codebase

| Hạng mục Spec | Trạng thái trong Tài liệu / Spec | Thực tế trong Codebase | Đánh giá / Nguyên nhân (Gap Analysis) |
| :--- | :--- | :--- | :--- |
| **P2 Phase A v1.6 (Screenshots & Rebase)** | Đã đưa vào `compliance_spec.yaml` v1.6 & Migration `014` | Migration 014 đã thêm column `has_screenshots`, `diverged_commits_count`, `is_ui_related` vào `merge_requests`. Nhưng dữ liệu cào chưa có backfill | **In-Progress / Data Gap**: Dữ liệu lịch sử bị `NULL` hoặc `false` do API cũ chưa cào param `include_diverged_commits_count=true`. Đang chờ re-extract (`v1.6_ci_quality_gate_plan.md`). |
| **Real-time Webhook Engine** | SDD & PRD nêu Webhook nhận event thời gian thực song song với Batch ETL | Đã viết codebase `src/webhook/` (FastAPI + Asyncpg + `webhook_dlq`), nhưng deploy k8s hiện tại ghi nhận là P2 (optional) | **Partial Implementation**: Codebase đã hoàn thành 100% bao gồm cả Dead Letter Queue (DLQ), nhưng chưa được bật chính thức trên môi trường Production do DevOps ưu tiên K8s CronJob. |
| **Reviewer & Approval Compliance** | PRD yêu cầu đo lường chất lượng Reviewer và tính thời gian duyệt MR | Đã cào dữ liệu qua DIP Phase 1 & 2 (`stg_mr_notes.sql`, `v_review_quality.sql`). Nhưng báo cáo ghi nhận ~0% MRs dùng reviewer | **Spec vs Operational Reality**: Code đã hỗ trợ đầy đủ, nhưng thực tế các team Dev chưa subscribe quy trình Assign Reviewer trên GitLab UI (`dip_phase1_done.md`). System chuyển sang fallback tự động. |
| **Metabase Dev Infrastructure** | Spec yêu cầu Metabase phục vụ QA/Management 24/7 | Báo cáo RCA (`RCA-metabase-dev-2026-07-21.md`) chỉ ra Metabase dev bị crash-loop do c3p0 pool timeout & resource limits | **Infrastructure Debt**: Đã có kế hoạch khắc phục tạm thời (workaround), cần DevOps/DBA cấu hình chuẩn lại K8s limits và DB connection string. |

---

# III. Các Miền Chức năng Chính (Domain Subsystems)

Hệ thống được chia làm **7 miền chức năng chính (Subsystems)** với ranh giới trách nhiệm (bounded context) và luồng dữ liệu minh bạch:

```
[GitLab API / Webhook]
       │
       ├──► 1. Extractor / Ingestion Subsystem (dlt + API Client)
       │         │ (validate payload)
       │         ▼
       │    2. Data Validation Subsystem (Pydantic + Schema Checks)
       │         │ (write raw)
       │         ▼
       │    [PostgreSQL: gitlab_raw]
       │         │
       │         ▼
       │    3. Transformation Subsystem (dbt Core: staging -> marts)
       │         ▲
       │         │ (sync SQL / rules)
       │    4. Compliance Updater Subsystem (compliance_spec.yaml Engine)
       │         │
       │         ▼
       │    [PostgreSQL: gitlab_kpi]
       │         │
       ├─────────┼───────────────────────┐
       │         ▼                       ▼
       │    5. Alerter Subsystem    6. Visualization Subsystem
       │    (Slack Notifications)   (Metabase REST / Dashboards)
       │
       └──► 7. Webhook Real-time Subsystem (FastAPI Receiver)
```

### 1. Extraction / Ingestion Subsystem (`src/extraction/`)
*   **Thành phần chính**: `GitLabClient` (`client.py`), `pipeline.py`, các dlt resource (`merge_requests.py`, `commits.py`, `pipelines.py`, `mr_commits.py`, `mr_notes.py`, `group_members.py`, `pipeline_jobs.py`, `test_reports.py`), `checkpoint.py`.
*   **Trách nhiệm**:
    *   Gọi REST API v4 của GitLab, xử lý phân trang (`per_page=100`), Rate Limiting và Exponential Backoff Retry.
    *   Sử dụng framework `dlt` để đẩy dữ liệu thô vào schema `gitlab_raw` theo chế độ `write_disposition="merge"`.
    *   Lưu giữ điểm dừng (cursor/watermark) vào bảng `gitlab_raw.pipeline_state` để phục vụ cào tăng tiến (incremental sync).

### 2. Data Validation & Quality Subsystem (`src/validation/`)
*   **Thành phần chính**: `schema_validator.py` (Pydantic Models), `data_quality.py`, `idempotency.py`.
*   **Trách nhiệm**:
    *   Kiểm tra cấu trúc dữ liệu API trả về so với `schema_snapshot.yaml` trước khi ghi xuống DB (đóng vai trò Anti-Hallucination / Quality Gate phòng ngừa API drift).
    *   Phát hiện các bất thường về dữ liệu (như số dòng thêm `additions < 0` hoặc timestamp không hợp lệ).

### 3. Transformation Subsystem / dbt Engine (`src/transform/`)
*   **Thành phần chính**: Các dbt models bao gồm lớp **Staging** (`stg_*`) và lớp **Marts** (`v_mr_compliance`, `v_compliance_mgmt`, `v_weekly_kpi`, `v_team_leaderboard`, `v_dora_metrics`, `dim_user`, `v_kpi_control_panel`).
*   **Trách nhiệm**:
    *   Chuyển đổi, làm sạch dữ liệu từ `gitlab_raw` sang `gitlab_kpi_staging`.
    *   Chạy logic tính điểm tuân thủ phức tạp, tính toán chỉ số DORA, chuẩn hóa danh tính lập trình viên (`dim_user.sql`) và tổng hợp KPI theo tuần/tháng/dự án trong `gitlab_kpi`.

### 4. Compliance Specification & Updater Subsystem (`src/compliance_updater/`)
*   **Thành phần chính**: `compliance_spec.yaml`, `parser.py`, `generator.py`, `applier.py`, `cli.py`.
*   **Trách nhiệm**:
    *   Đóng vai trò Single Source of Truth cho toàn bộ quy tắc tuân thủ.
    *   Khi quy định QA thay đổi (vd nâng/hạ trọng số, thêm tiêu chí mới), CLI `compliance_updater` sẽ parse YAML và tự động inject lại đoạn SQL tương ứng vào dbt models (`v_mr_compliance.sql`, `v_compliance_violation_detail.sql`) và cập nhật file `thresholds.py`.

### 5. Alerting & Reporting Subsystem (`src/alerting/`, `src/reporting/`)
*   **Thành phần chính**: `compliance_alert.py`, `freshness_alert.py`, `slack_client.py`, `daily_insight.py`.
*   **Trách nhiệm**:
    *   Truy vấn view `gitlab_kpi.v_violations` sau mỗi lượt dbt transform để lọc các MR vi phạm.
    *   Format thông báo dưới dạng Slack Block Kit chuyên nghiệp và gửi tới các kênh Slack tương ứng.
    *   Thực hiện giám sát SLA độ tươi của dữ liệu (Data Freshness Monitoring) và gửi báo cáo Daily Insight.

### 6. Real-time Webhook Receiver Subsystem (`src/webhook/`)
*   **Thành phần chính**: `app.py` (FastAPI), `handlers.py` (Asyncpg pool), `validator.py`, bảng `gitlab_raw.webhook_dlq`.
*   **Trách nhiệm**:
    *   Lắng nghe các sự kiện POST từ GitLab Webhook (Push events, MR events, Pipeline events).
    *   Kiểm tra tính hợp lệ của Token (`X-Gitlab-Token`).
    *   Ghi dữ liệu ngay lập tức vào DB. Nếu có lỗi, đẩy event vào Dead Letter Queue (`webhook_dlq`) để phục vụ thủ tục replay tay.

### 7. Visualization & Ops Management Subsystem (`src/metabase/`)
*   **Thành phần chính**: `src/metabase/setup_dashboards.py`, bộ SQL queries trong `docs/dashboard_queries/`.
*   **Trách nhiệm**:
    *   Tự động khởi tạo, cấu hình và đồng bộ hệ thống Dashboard trên Metabase via REST API.
    *   Cung cấp giao diện trực quan hóa cho 4 đối tượng người dùng chính: Engineering Manager, QA Lead, Developer (self-service) và DevOps on-call.

---

# IV. Khuyến nghị Kỹ thuật từ Architect (Architectural Recommendations)

1.  **Dọn dẹp Infrastructure Debt**:
    *   Khẩn trương đưa các tham số cấu hình Metabase (`JAVA_OPTS`, C3P0 connection pool, K8s CPU/RAM limits) vào GitOps Repository (ArgoCD) để tránh việc ArgoCD sync đè làm tái diễn lỗi Crash-Loop.
2.  **Backfill dữ liệu Phase A v1.6**:
    *   Thực hiện re-extract cho 26,000+ MRs hiện tại với tham số `include_diverged_commits_count=true` để populate dữ liệu cho 2 card B14 & B15 đang bị trống trên Dashboard Collection B.
3.  **Kích hoạt Webhook Subsystem (Phase 2)**:
    *   Chuyển luồng Webhook Receiver từ trạng thái chờ (P2) sang hoạt động chính thức trên K8s để đạt mục tiêu phản hồi cảnh báo vi phạm MR theo thời gian thực (Real-time Alerting) thay vì phải đợi đợt CronJob Batch chạy lúc 02:00 AM hàng ngày.

Xem chi tiet danh sach tai lieu spec goc tai [Product Specs](../domain/existing_specs_summary.md).

# Associated Schemas
Cac thuc the CSDL lien quan duoc mo ta tai [Database Schemas](../domain/entities.md).
