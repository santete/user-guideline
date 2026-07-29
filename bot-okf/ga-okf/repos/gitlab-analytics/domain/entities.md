---
type: Database Entity
title: Database Schemas & Data Entities
description: Mô tả các thực thể dữ liệu và sơ đồ CSDL của dự án gitlab-analytics.
tags:
- database
- schema
- entities
timestamp: '2026-07-28T16:17:46.828614+00:00'
---

# Database Schemas
Tổng số thực thể/bảng dữ liệu phát hiện: **12**.

| Entity Name | Source Schema File | Type |
|-------------|--------------------|------|
| `webhook_dlq` | `src/infra/db/migrations/002_webhook_dlq.sql` | Database Table |
| `pipeline_state` | `src/infra/db/migrations/003_pipeline_state.sql` | Database Table |
| `pipeline_jobs_new` | `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | Database Table |
| `pipeline_jobs_overflow_old` | `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | Database Table |
| `pipeline_jobs_overflow_future` | `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | Database Table |
| `pipeline_jobs_overflow_pre` | `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | Database Table |
| `pipelines_new` | `src/infra/db/migrations/012_pipelines_partition.sql` | Database Table |
| `pipelines_overflow_pre` | `src/infra/db/migrations/012_pipelines_partition.sql` | Database Table |
| `pipelines_overflow_future` | `src/infra/db/migrations/012_pipelines_partition.sql` | Database Table |
| `commits_new` | `src/infra/db/migrations/013_commits_partition.sql` | Database Table |
| `commits_overflow_pre` | `src/infra/db/migrations/013_commits_partition.sql` | Database Table |
| `commits_overflow_future` | `src/infra/db/migrations/013_commits_partition.sql` | Database Table |

# Data Flow & Business Rules
Xem chi tiết luồng nghiệp vụ tại [Tổng quan Nghiệp vụ](../domain/business_overview.md).
