---
title: Database Inventory — gitlab_analytics
snapshot_date: 2026-05-20
db_name: gitlab_analytics
db_version: PostgreSQL 16.13 (Alpine)
generated_by: Manual psycopg2 query against live DB
purpose: Reference snapshot of schema/table sizing, rows, and downstream usage status
---

# Database Inventory — gitlab_analytics

**Snapshot**: 2026-05-20 (live DB connection via `DATABASE_URL`)
**Total size**: 393 MB across 4 schemas + dlt internal
**Last successful extraction**: 2026-05-18 20:31 UTC (`run_count = 36`, `consecutive_failures = 0`)

## Schema totals

| Schema | Size | Tables | Views | Role |
|---|--:|--:|--:|---|
| `gitlab_raw` | 278 MB | 13 | 0 | dlt extraction sink — source of truth for raw GitLab API data |
| `gitlab_kpi` | 93 MB | 4 | 21 | dbt marts (1 incremental + 2 table + 1 seed + 21 views) |
| `gitlab_kpi_staging` | 0 bytes | 0 | 9 | **dbt staging layer** — 9 `stg_*` views, `ref()`-d by every mart. View-only (0 disk). |
| `gitlab_raw_staging` | 22 MB | 12 | 0 | dlt transient staging (auto-managed) — NOT consumed by mart layer |
| **TOTAL** | **393 MB** | **29** | **30** | dbt model files: 33 (9 staging + 24 marts source `.sql`) |

Growth: ~86 MB/month based on historical samples (see `docs/ops/DB_ARCHIVE_STRATEGY.md`).

---

## `gitlab_raw` — Extraction sink (ACTIVE)

10 tables. All except `pipeline_state` + `webhook_dlq` are populated by dlt resources in `src/extraction/sources/`.

| Table | Rows | Size | Watermark (max) | Used by dbt / consumers |
|---|--:|--:|---|---|
| `pipeline_jobs` | 234,465 | 81 MB | 2026-05-18 17:46 UTC | `v_data_freshness` (direct source ref). **`stg_pipeline_jobs` is orphan — 0 downstream marts** |
| `commits` | 106,826 | 60 MB | 2026-05-18 17:57 UTC | `stg_commits`, `v_compliance_mgmt`, `v_violations`, `v_data_freshness`, `v_ingestion_volume_daily`, `v_project_health_scorecard` |
| `pipelines` | 201,843 | 55 MB | 2026-05-18 17:46 UTC | `stg_pipelines`, `stg_merge_requests` (head_pipeline join), `v_data_freshness`, `v_ingestion_volume_daily` |
| `mr_commits` | 90,954 | 46 MB | 2026-05-18 17:46 UTC | `stg_mr_commits`, `v_data_freshness`, `v_ingestion_volume_daily` |
| `test_reports` | 54,095 | 15 MB | 2026-05-18 20:31 UTC | `stg_test_reports`, `v_data_freshness` |
| `mr_notes` | 23,412 | 11 MB | 2026-05-18 17:29 UTC | `stg_mr_notes`, `v_data_freshness` |
| `merge_requests` | 27,131 | 11 MB | 2026-05-18 17:49 UTC | `stg_merge_requests` (core), `v_data_freshness`, `v_ingestion_volume_daily` |
| `group_members` | 617 | 408 kB | — | `stg_group_members` → `dim_user` |
| `pipeline_state` | 9 | 64 kB | — | `v_ops_pipeline_health`, healer triage queries |
| `webhook_dlq` | 0 | 40 kB | — | `v_dlq_monitor` (currently 0 because webhook không deploy prod) |

**Project coverage**:
- 351 projects có MR data
- ~similar projects có commits / pipelines
- Group 756 có ~5,872 projects total → ~6% active

---

## `gitlab_kpi` — dbt mart layer (33 models)

### Materialized as TABLE (3 + 1 seed)

| Object | Rows | Size | Strategy | Note |
|---|--:|--:|---|---|
| `v_mr_score_breakdown` | 171,238 | 81 MB | **incremental** (composite UK `[id, criterion_name]`, delete+insert, 90d post_hook eviction) | P4 ship 2026-05-16. Fan-out 10–12 criteria/MR via cross-join lateral. Weekly `--full-refresh` cron `0 4 1 * *` for orphan cleanup. |
| `v_compliance_criterion_stats` | 48,612 | 11 MB | **table** | Per-criterion aggregate over rolling window. |
| `v_dora_metrics` | 8,808 | 1.4 MB | **table** | DORA daily series per project. |
| `seed_department_mapping` | 35 | 16 kB | **seed (CSV)** | Department mapping for `dim_user` join. Source: `src/transform/seeds/department_mapping.csv`. |

### VIEWs (22 — lazy, 0 disk)

Tất cả đều có Metabase card consumer.

| Object | Consumer collection | Description |
|---|---|---|
| `v_mr_compliance` | B (Compliance), E (Formula) | Per-MR scoring core, 10 criteria + 2 advisory |
| `v_compliance_mgmt` | B, D, F | Manager-facing rollup, +trend +violations jsonb +author_4w_avg_prior |
| `v_compliance_violation_detail` | B, E | Long-form per-violation row (autogen by `compliance_updater`) |
| `dim_user` | All (join) | User→department mapping via `seed_department_mapping` |
| `v_data_freshness` | A (Ops) | Lag from now() vs raw table max watermark |
| `v_ops_pipeline_health` | A | Extraction state + consecutive_failures triage |
| `v_pipeline_failures` | D | Last 7d failed pipelines + author drill-down |
| `v_dlq_monitor` | A | Webhook DLQ count (currently 0, webhook chưa prod) |
| `v_ingestion_volume_daily` | A | Daily row count per source — zero-ingestion detection |
| `v_violations` | B, F | Aggregate violation count per category |
| `v_ai_adoption` | C (AI) | AI Disclosure adoption rate by author/week |
| `v_ai_disclosure_tracker` | C | Per-MR AI Disclosure presence + tag |
| `v_kpi_control_panel` | F | Single-row KPI summary for executive view |
| `v_team_leaderboard` | D | Author-level compliance rank |
| `v_review_quality` | D | Review depth signals (notes count, reviewer overlap) |
| `v_reviewer_workload` | D | Reviewer assignment distribution |
| `v_long_commit_violations` | E | Commit message length violations |
| `v_mr_commit_convention` | E | Commit message convention compliance |
| `v_cycle_time_stats` | D | MR open→merge cycle time percentiles |
| `v_project_health_scorecard` | A, F | Per-project compliance + activity rollup |
| `v_weekly_kpi` | F | Weekly trend KPIs |
| (intentionally hidden from public list — dlt-managed `_dlt_*`) | — | dlt metadata |

### Cross-cuts

- **dbt run time**: ~170s với `--threads 1` (deadlock với threads≥4 trên parallel DROP VIEW — gotcha 2026-05-19)
- **Largest single object**: `v_mr_score_breakdown` (81 MB ≈ 87% schema)

---

## `gitlab_kpi_staging` — dbt staging layer (ACTIVE)

9 views, 0 disk (materialized=view). **Đây là layer bắt buộc giữa `gitlab_raw.*` và `gitlab_kpi.v_*`** — mart nào cũng `ref('stg_*')` chứ không đọc trực tiếp `gitlab_raw`.

> ⚠️ Đừng nhầm với `gitlab_raw_staging`. Cùng có chữ "staging" nhưng khác bản chất hoàn toàn:
> - `gitlab_kpi_staging` = **dbt managed**, views làm sạch (coalesce NULL, cast type, derive flags). Schema name do `dbt_project.yml: staging.+schema: staging` + profile target `gitlab_kpi` ghép thành `gitlab_kpi_staging`.
> - `gitlab_raw_staging` = **dlt managed**, residue physical tables. Không liên quan dbt.

| View | Source file | Cleans / derives |
|---|---|---|
| `stg_merge_requests` | `src/transform/models/staging/stg_merge_requests.sql` | coalesce booleans, parse `label_names`/`reviewer_usernames` via `string_to_array`, derive `is_rebased` 3-state, `is_ui_related` |
| `stg_commits` | `src/transform/models/staging/stg_commits.sql` | coalesce `additions/deletions`, cast `created_at::timestamptz` |
| `stg_pipelines` | `src/transform/models/staging/stg_pipelines.sql` | coalesce `coverage`, `duration`, normalize `status` |
| `stg_pipeline_jobs` | `src/transform/models/staging/stg_pipeline_jobs.sql` | ⚠️ **0 downstream consumers** — candidate for removal (per `known_gotchas` 2026-05-15) |
| `stg_mr_commits` | `src/transform/models/staging/stg_mr_commits.sql` | normalize SHA join surface |
| `stg_mr_notes` | `src/transform/models/staging/stg_mr_notes.sql` | filter system notes vs user comments |
| `stg_test_reports` | `src/transform/models/staging/stg_test_reports.sql` | flatten test_report payload |
| `stg_group_members` | `src/transform/models/staging/stg_group_members.sql` | feeds `dim_user` |
| `stg_department_mapping` | `src/transform/models/staging/stg_department_mapping.sql` | view over `seed_department_mapping` (CSV seed) |

**Cross-cuts**:
- **No physical FK** — joins logical only, enforced at staging.
- **Materialized=view** → 0 disk, recomputed on every downstream query. Cheap because raw tables indexed.
- **Internal-only** — `metabase_reader` role không cần grant trên schema này (per `schema_reference.md` line 529).

---

## `gitlab_raw_staging` — dlt transient (KHÔNG cần care)

dlt staging area, populated mid-load → promoted to `gitlab_raw`. Snapshot rows = leftover từ last load batch.

| Table | Rows | Size | Note |
|---|--:|--:|---|
| `pipeline_jobs` | 51,347 | 12 MB | Last batch slice |
| `test_reports` | 11,938 | 2.7 MB | |
| `mr_commits` | 5,835 | 2.5 MB | |
| `mr_notes` | 5,062 | 2.1 MB | |
| `commits` | 3,489 | 1.5 MB | |
| `pipelines` | 2,833 | 632 kB | |
| `group_members` | 615 | 224 kB | |
| `merge_requests` | 360 | 184 kB | |
| `merge_requests__label_names` | 0 | 16 kB | **Residue** từ migration 008 (array→text sweep). DROP an toàn. |
| `merge_requests__approved_by_usernames` | 0 | 16 kB | Same residue, DROP an toàn |
| `merge_requests__reviewer_usernames` | 0 | 16 kB | Same residue, DROP an toàn |

KHÔNG có dbt model nào `ref()` schema `gitlab_raw_staging` này. (Lưu ý: `gitlab_kpi_staging` ở trên là schema **khác**, được mart `ref()` thường xuyên.)

---

## Pipeline state (`gitlab_raw.pipeline_state`)

Key-value cursors driving incremental extraction:

| Key | Value | Note |
|---|---|---|
| `last_successful_run` | 2026-05-18T20:31:53Z | Most recent successful pipeline run |
| `consecutive_failures` | 0 | Healer threshold 3 → escalate |
| `run_count` | 36 | Total runs since 2026-03-27 |
| `last_mr_updated_at` | 2026-05-19T00:49:11+07 | MR cursor (next run starts here) |
| `last_pipeline_updated_at` | 2026-05-18T21:20:37+07 | Pipeline cursor |
| `last_commit_date` | 2026-05-13T16:11:09+07 | Commit cursor (held — likely actual max) |
| `last_failure` | NULL | Last error message (empty = clean) |
| `schema_version` | v1.0 | pipeline_state schema (migration 003) |
| `alerted_mr_ids` | `[]` | Slack dedup tracking |

---

## Action items / housekeeping

Priority sorted (high → low):

1. **🟡 Data hơi cũ cho presentation** — last extraction 36h trước (2026-05-18 20:31 UTC). Chạy lại extraction sáng 2026-05-20 để dashboard hiển thị data tới tối qua.
2. **🟢 `stg_pipeline_jobs` orphan view** — 0 downstream consumer. DROP để giảm dbt run time (~5s/run × 100 runs/tuần = 500s/tuần saved). Tracked in `pending_tasks` (low priority).
3. **🟢 `gitlab_raw_staging.merge_requests__*` 3 residue tables** (mỗi cái 16 kB) — empty residue từ migration 008 array→text sweep. Idempotent `DROP TABLE IF EXISTS` an toàn.
4. **🟢 `webhook_dlq` empty** — không phải lành mạnh, mà vì webhook chưa deploy prod. Note disclaimer trên dashboard A trong presentation.
5. **🔵 `pipeline_jobs` 81 MB (29% schema)** — migration 009 retention 90d sẽ tự trim bắt đầu ~2026-06-08 (chờ data oldest crossing 90d). Không cần làm gì gấp.
6. **🔵 P2/P2b production cutover** — migrations 011-013 partition design ready trong repo, gated maintenance window + Eng Manager sign-off. Sẽ giúp query latency trên `pipeline_jobs` + `pipelines` + `commits` (xem `docs/ops/DB_ARCHIVE_STRATEGY.md` §7).

---

## Refresh procedure

Để regenerate snapshot này:

```bash
set -a && source .env && set +a
python << 'EOF'
import os, psycopg2
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()
# Per-schema totals + per-table size/rows queries
# (see snapshot generator at scripts/db_inventory.py if extracted)
EOF
```

Hoặc verify với `dbt run-operation` macro (chưa viết — backlog candidate nếu cần snapshot weekly).

---

## Cross-references

- `.claude/memory/schema_snapshot.yaml` — ground truth cho GitLab API field expectations
- `docs/ops/DB_ARCHIVE_STRATEGY.md` — 5-phase roadmap (P1 retention → P5 S3 export)
- `docs/reference/schema_reference.md` — full column-level schema spec
- `docs/reference/architecture_etl.md` — ETL layer map
- `src/transform/models/` — dbt model source (33 files)
- `src/extraction/sources/` — dlt resource definitions
