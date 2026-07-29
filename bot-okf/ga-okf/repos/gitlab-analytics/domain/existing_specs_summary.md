---
type: Product Spec
title: Existing Product Specifications & Documentation
description: Tổng hợp các tài liệu thiết kế và Product Specs có sẵn trong repo gitlab-analytics.
tags:
- product-spec
- documentation
- domain
timestamp: '2026-07-28T16:17:46.828614+00:00'
---

# Ingested Existing Documentation & Specs
Phát hiện và tổng hợp **63** tài liệu spec có sẵn trong repo:

> **Self-contained**: Tất cả tài liệu gốc đã được copy vào thư mục `source_docs/` trong bundle này.
> Bạn có thể đọc trực tiếp mà không cần truy cập repo gốc.

| Doc Title | Path | Folder Category | Summary |
|-----------|------|-----------------|---------| 
| **[RCA — Metabase dev crash-loop nhiều tuần trên K8s (isc-internal-standard)](source_docs/docs/RCA-metabase-dev-2026-07-21.md)** | `docs/RCA-metabase-dev-2026-07-21.md` | `docs` | **Ngày lập:** 21/07/2026 |
| **[API Rules](source_docs/docs/ai/API_RULES.md)** | `docs/ai/API_RULES.md` | `ai` | > Rule cho REST / GraphQL / RPC. Load khi đụng API contract. |
| **[Coding Rules](source_docs/docs/ai/CODING_RULES.md)** | `docs/ai/CODING_RULES.md` | `ai` | > Rule cho việc viết / sửa code. Load khi Phase 0 phân loại task là "code change". |
| **[Database Rules](source_docs/docs/ai/DB_RULES.md)** | `docs/ai/DB_RULES.md` | `ai` | > Rule cho schema, migration, query. Load khi đụng database. |
| **[Git Convention](source_docs/docs/ai/GIT_CONVENTION.md)** | `docs/ai/GIT_CONVENTION.md` | `ai` | > Rule cho commit, branch, PR. Load khi Phase 0 phân loại task là "git operation". |
| **[Hallucination Rules](source_docs/docs/ai/HALLUCINATION_RULES.md)** | `docs/ai/HALLUCINATION_RULES.md` | `ai` | > Rule chống hallucination cho AI agent. **Luôn load** ở Phase 0 cùng PROJECT_MAP. |
| **[Project Map — GitLab Analytics Pipeline](source_docs/docs/ai/PROJECT_MAP.md)** | `docs/ai/PROJECT_MAP.md` | `ai` | > "Bản đồ" để AI agent hiểu nhanh kiến trúc project. Đọc file này TRƯỚC khi |
| **[Security Rules](source_docs/docs/ai/SECURITY_RULES.md)** | `docs/ai/SECURITY_RULES.md` | `ai` | > Rule cho auth, input handling, secret. Load khi đụng security-related code. |
| **[Testing Rules](source_docs/docs/ai/TESTING_RULES.md)** | `docs/ai/TESTING_RULES.md` | `ai` | > Rule cho viết / sửa test. Load khi đụng test code. |
| **[Compliance Rules — Master Index cho AI Agent](source_docs/docs/ai/internal_rules/00_INDEX.md)** | `docs/ai/internal_rules/00_INDEX.md` | `internal_rules` | --- |
| **[Quy tắc tuân thủ MR — Tham chiếu cho AI Agent](source_docs/docs/ai/internal_rules/01_MR_Compliance.md)** | `docs/ai/internal_rules/01_MR_Compliance.md` | `internal_rules` | --- |
| **[Naming Convention — Tham chiếu cho AI Agent](source_docs/docs/ai/internal_rules/02_Naming_Microservice.md)** | `docs/ai/internal_rules/02_Naming_Microservice.md` | `internal_rules` | --- |
| **[API Naming Convention — Tham chiếu cho AI Agent](source_docs/docs/ai/internal_rules/03_API_Naming.md)** | `docs/ai/internal_rules/03_API_Naming.md` | `internal_rules` | --- |
| **[API Response & Error Code — Tham chiếu cho AI Agent](source_docs/docs/ai/internal_rules/04_API_Response_and_Error.md)** | `docs/ai/internal_rules/04_API_Response_and_Error.md` | `internal_rules` | --- |
| **[API Timeout Configuration — Tham chiếu cho AI Agent](source_docs/docs/ai/internal_rules/05_API_Timeout.md)** | `docs/ai/internal_rules/05_API_Timeout.md` | `internal_rules` | --- |
| **[✨ CODING_CONVENTIONS.md – Chuẩn viết code ISC (.NET ưu tiên)](source_docs/docs/ai/internal_rules/06_Coding_Convention.md)** | `docs/ai/internal_rules/06_Coding_Convention.md` | `internal_rules` | Tài liệu quy định chuẩn viết code cho toàn bộ thành viên trong team phát triển dự án ISC. |
| **[Collection A — OPS HEALTH Dashboard](source_docs/docs/dashboard_queries/collection_a_ops_health.md)** | `docs/dashboard_queries/collection_a_ops_health.md` | `dashboard_queries` | **Auto-refresh:** 15 phút \| **Primary user:** QA Engineer, DevOps on-call |
| **[Collection B — QA COMPLIANCE Dashboard](source_docs/docs/dashboard_queries/collection_b_qa_compliance.md)** | `docs/dashboard_queries/collection_b_qa_compliance.md` | `dashboard_queries` | **Refresh:** Daily (after dbt run) \| **Primary user:** QA Manager, Team Lead |
| **[Collection C — ENGINEERING MANAGEMENT Dashboard](source_docs/docs/dashboard_queries/collection_c_engineering_mgmt.md)** | `docs/dashboard_queries/collection_c_engineering_mgmt.md` | `dashboard_queries` | **Refresh:** Weekly (Monday after dbt run) \| **Primary user:** Engineering Manager, Team Lead |
| **[Collection D — DEEP DIVE Investigation Dashboard](source_docs/docs/dashboard_queries/collection_d_deep_dive.md)** | `docs/dashboard_queries/collection_d_deep_dive.md` | `dashboard_queries` | **Refresh:** On-demand \| **Primary user:** QA Engineer (incident investigation, 1:1 prep) |
| **[Collection E — Compliance Formula & Scoring Transparency](source_docs/docs/dashboard_queries/collection_e_formula_transparency.md)** | `docs/dashboard_queries/collection_e_formula_transparency.md` | `dashboard_queries` | **Refresh:** Daily (after dbt run) \| **Primary user:** QA Manager, Engineering Manager, Developer |
| **[Kế hoạch — Collection E: Compliance Formula & Scoring Transparency](source_docs/docs/dashboard_queries/collection_e_formula_transparency.plan.md)** | `docs/dashboard_queries/collection_e_formula_transparency.plan.md` | `dashboard_queries` | **Trạng thái:** PLANNING — chưa implement |
| **[C4 Component — Extractor (Level 3)](source_docs/docs/diagrams/c4_component_extractor.md)** | `docs/diagrams/c4_component_extractor.md` | `diagrams` | --- |
| **[C4 Container — Level 2](source_docs/docs/diagrams/c4_container.md)** | `docs/diagrams/c4_container.md` | `diagrams` | --- |
| **[C4 Context — Level 1](source_docs/docs/diagrams/c4_context.md)** | `docs/diagrams/c4_context.md` | `diagrams` | --- |
| **[Deploy topology — services → DB → quyền](source_docs/docs/diagrams/deploy_services_db.md)** | `docs/diagrams/deploy_services_db.md` | `diagrams` | 3 service deploy lên container, **1 DB duy nhất** `gitlab_analytics` (PostgreSQL external do DBA quản, không phải container). Metadata Metabase để CHUNG (schema `public`) — không tách. |
| **[Architecture Diagrams — `docs/diagrams/`](source_docs/docs/diagrams/README.md)** | `docs/diagrams/README.md` | `diagrams` | --- |
| **[Sequence — Flow 1: Daily ETL Extraction](source_docs/docs/diagrams/seq_daily_etl.md)** | `docs/diagrams/seq_daily_etl.md` | `diagrams` | --- |
| **[Dashboard Catalog — gitlab-analytics](source_docs/docs/guides/dashboard_catalog.md)** | `docs/guides/dashboard_catalog.md` | `guides` | **Version:** 2.0 \| **Cập nhật:** 2026-05-19 |
| **[QA Dashboard Guide — Hướng dẫn đọc hiểu Dashboard Metabase](source_docs/docs/guides/qa_dashboard_guide.md)** | `docs/guides/qa_dashboard_guide.md` | `guides` | > ENG-ANA-001 \| v2.1 \| Cập nhật: 2026-05-19 |
| **[Hướng dẫn QA tự tạo Dashboard Compliance trên Metabase](source_docs/docs/guides/qa_metabase_dashboard_builder.md)** | `docs/guides/qa_metabase_dashboard_builder.md` | `guides` | > Dành cho: QA Engineer / QA Lead (DIY workflow trên Metabase UI) |
| **[CHUẨN TUÂN THỦ MERGE REQUEST (MR)](source_docs/docs/mr-compliance/MR_Compliance_Guide_v1.4.md)** | `docs/mr-compliance/MR_Compliance_Guide_v1.4.md` | `mr-compliance` | **GitLab \| AI SDLC \| Áp dụng cho toàn bộ Developer** |
| **[Phase A v1.6 — Monitoring Gaps & CI Quality Gate Plan](source_docs/docs/mr-compliance/v1.6_ci_quality_gate_plan.md)** | `docs/mr-compliance/v1.6_ci_quality_gate_plan.md` | `mr-compliance` | **Spec ref:** `docs/mr-compliance/compliance_spec.yaml` v1.6 |
| **[Architecture Overview — DevOps + DBA single-page](source_docs/docs/ops/architecture_overview.md)** | `docs/ops/architecture_overview.md` | `ops` | > **Mục đích**: 1 trang để DevOps + DBA nắm cùng bức tranh: bao nhiêu workload phải deploy, mỗi workload connect xuống schema nào. |
| **[Compliance Updater — Runbook Vận Hành](source_docs/docs/ops/compliance_updater_runbook.md)** | `docs/ops/compliance_updater_runbook.md` | `ops` | **Module:** `src/compliance_updater` |
| **[Yêu cầu hỗ trợ DBA — Dev DB `172.27.62.107 / gitlab_analytics`](source_docs/docs/ops/dba-grant-request.md)** | `docs/ops/dba-grant-request.md` | `ops` | **Ngày:** 2026-07-09 |
| **[DB Accounts Proposal — DBA Review](source_docs/docs/ops/db_accounts.md)** | `docs/ops/db_accounts.md` | `ops` | > **Mục đích**: thống nhất với DBA về model account/schema cho `gitlab_analytics` DB. |
| **[DB Sizing & Archive Strategy — GitLab Analytics](source_docs/docs/ops/DB_ARCHIVE_STRATEGY.md)** | `docs/ops/DB_ARCHIVE_STRATEGY.md` | `ops` | > ENG-ANA-001 \| v1.0 \| 2026-05-15 |
| **[DB Services × Schemas Matrix — DBA Handover](source_docs/docs/ops/db_services_matrix.md)** | `docs/ops/db_services_matrix.md` | `ops` | > **Mục đích**: liệt kê tất cả service kết nối DB `gitlab_analytics` và schema chạm vào. |
| **[Deployment Plan — GitLab Analytics Pipeline](source_docs/docs/ops/DEPLOYMENT.md)** | `docs/ops/DEPLOYMENT.md` | `ops` | > ENG-ANA-001 \| v1.1 \| 2026-05-26 |
| **[Câu hỏi triển khai ETL lên dev — gửi DBA + DevOps](source_docs/docs/ops/dev-deploy-questions.md)** | `docs/ops/dev-deploy-questions.md` | `ops` | **Ngày:** 2026-07-10 · **Từ:** Dev (gitlab-analytics / web-dashboard-compliance) |
| **[Danh sách nợ hạ tầng — Handoff DevOps & DBA](source_docs/docs/ops/devops-dba-debt.md)** | `docs/ops/devops-dba-debt.md` | `ops` | **Ngày lập:** 2026-07-28 |
| **[DevOps Questions — ETL k8s Migration Cutover](source_docs/docs/ops/devops_questions.md)** | `docs/ops/devops_questions.md` | `ops` | > **Status:** Q1-Q5 confirmed · Q3 fully resolved 2026-06-08 (Vault Agent Injector sidecar, path simplified) · Q4+Q5 sub-questions still pending · Q7 (observability) awaiting DevOps |
| **[K8s CronJob Handover — for DevOps](source_docs/docs/ops/k8s_cronjob_handover.md)** | `docs/ops/k8s_cronjob_handover.md` | `ops` | > Source manifests: `deploy/k8s/`. Apply via `kubectl apply -k deploy/k8s/` (kustomize). |
| **[Metabase Ops Panel — Setup Guide](source_docs/docs/ops/metabase_ops_panel.md)** | `docs/ops/metabase_ops_panel.md` | `ops` | > Thêm các question này vào 1 dashboard tên "Pipeline Ops" trong Metabase |
| **[Ops Runbook — Pipeline Triage & Incident Response](source_docs/docs/ops/ops_runbook.md)** | `docs/ops/ops_runbook.md` | `ops` | > ENG-ANA-001 \| v1.0 \| Cập nhật: 2026-03-28 |
| **[Hướng dẫn phối hợp 3 bên — Dev / DBA / DevOps](source_docs/docs/ops/three-party-coordination.md)** | `docs/ops/three-party-coordination.md` | `ops` | --- |
| **[Troubleshooting — debug framework khi dev gặp vấn đề](source_docs/docs/ops/TROUBLESHOOTING.md)** | `docs/ops/TROUBLESHOOTING.md` | `ops` | > File này dành cho dev (hoặc người support dev) khi triển khai framework và gặp lỗi. |
| **[Kế hoạch Cải thiện Dữ liệu — Data Improvement Plan (DIP)](source_docs/docs/planning/data_improvement_plan.md)** | `docs/planning/data_improvement_plan.md` | `planning` | **Trạng thái tổng:** DONE |
| **[Báo cáo Cải tiến Toàn diện — GitLab Analytics Pipeline](source_docs/docs/planning/improvement_report.md)** | `docs/planning/improvement_report.md` | `planning` | --- |
| **[ETL Architecture — GitLab Analytics Pipeline](source_docs/docs/reference/architecture_etl.md)** | `docs/reference/architecture_etl.md` | `reference` | > ENG-ANA-001 \| v1.0 \| Cập nhật: 2026-03-28 |
| **[ERD — `gitlab_raw` Schema](source_docs/docs/reference/db_erd.md)** | `docs/reference/db_erd.md` | `reference` | --- |
| **[`gitlab_raw` — Field-level Schema Reference](source_docs/docs/reference/db_fields_gitlab_raw.md)** | `docs/reference/db_fields_gitlab_raw.md` | `reference` | --- |
| **[Database Inventory — gitlab_analytics](source_docs/docs/reference/db_inventory.md)** | `docs/reference/db_inventory.md` | `reference` | --- |
| **[Framework Metrics — Design](source_docs/docs/reference/METRICS.md)** | `docs/reference/METRICS.md` | `reference` | > **TL;DR**: append-only event log tại `.claude/metrics/events.jsonl` (gitignored). Hooks ghi event tự động (fail-open). `/metrics` slash command in summary 7d/30d. Local-only mặc định, team aggreg... |
| **[Schema Reference — GitLab Analytics Database](source_docs/docs/reference/schema_reference.md)** | `docs/reference/schema_reference.md` | `reference` | > Cập nhật: 2026-06-09 |
| **[Acceptance Criteria & Deliverables](source_docs/product-spec/Acceptance-Criteria-Deliverables.md)** | `product-spec/Acceptance-Criteria-Deliverables.md` | `product-spec` | > **Tài liệu kèm theo:** [PRD-Features-DORA-Compliance.md](./PRD-Features-DORA-Compliance.md) |
| **[📊 Product Requirement Document (PRD)](source_docs/product-spec/KPI-Compliance-Dev-PRD.md)** | `product-spec/KPI-Compliance-Dev-PRD.md` | `product-spec` | --- |
| **[Product Requirements Document — Feature Specification](source_docs/product-spec/PRD-Features-DORA-Compliance.md)** | `product-spec/PRD-Features-DORA-Compliance.md` | `product-spec` | > **Tài liệu này mô tả YÊU CẦU TÍNH NĂNG.** Không đề cập kiến trúc, công nghệ, schema hay implementation. |
| **[DOCUMENTING ARCHITECTURE DECISIONS](source_docs/src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0000-documenting-architecture-decisions.md)** | `src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0000-documenting-architecture-decisions.md` | `decisions` | Source: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions |
| **[FORMAT AND STRUCTURE OF DECISION RECORDS](source_docs/src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0001-decision-record-format.md)** | `src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0001-decision-record-format.md` | `decisions` | We previousy decicded to record any decisions made in this project using Nygard's architecture decision record (ADR) format. Should we continue with this format or adopt an alternative? |
| **[The future of `dbt_utils` - break it into more logical chunks](source_docs/src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0002-cross-database-utils.md)** | `src/transform/dbt_packages/dbt_utils/docs/decisions/adr-0002-cross-database-utils.md` | `decisions` | --- |
| **[Readme](source_docs/src/transform/dbt_packages/dbt_utils/docs/decisions/README.md)** | `src/transform/dbt_packages/dbt_utils/docs/decisions/README.md` | `decisions` | For any architectural/engineering decisions we make, we will create an [ADR (Architectural Decision Record)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) to keep track ... |

# Reconciled Business Logic
Nội dung các tài liệu spec trên đã được đối chiếu với mã nguồn tại [Tổng quan Nghiệp vụ](../domain/business_overview.md).
