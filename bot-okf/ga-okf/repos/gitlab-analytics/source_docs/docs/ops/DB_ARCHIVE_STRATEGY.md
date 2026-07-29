# DB Sizing & Archive Strategy — GitLab Analytics

> ENG-ANA-001 | v1.0 | 2026-05-15
> Đối tượng: DevOps/SRE + Engineering Manager — quyết định retention policy & capacity plan trước khi deploy prod.
> Cơ sở: snapshot live DB tại 2026-05-15 (group ~5,838 projects, ~617 active devs).

---

## 1. Tóm tắt điều hành

| Hạng mục | Số liệu |
|---|---|
| DB size hiện tại | **382 MB** (gitlab_raw 245 MB + gitlab_kpi 87 MB + gitlab_raw_staging 39 MB) |
| Tăng trưởng dự phóng | **~86 MB / tháng ≈ 1.0 GB / năm** |
| Disk runway @ 100 GB SSD | ~100 năm raw — **không phải bottleneck dung lượng** |
| Bottleneck thực sự | **Query latency** trên `pipeline_jobs` (183k rows, +43k/tháng) và **dbt rebuild** của `v_mr_score_breakdown` (78 MB, scaling theo MR count) |
| Đề xuất | 4-phase archive plan (P1 retention → P4 cold export), bắt đầu ở **D+30** sau deploy |

---

## 2. Hiện trạng dữ liệu (live snapshot 2026-05-15)

### 2.1 Bảng raw — top by row count

| Bảng | Rows | Size | Bytes/row | Đặc tính |
|---|---:|---:|---:|---|
| `pipelines` | 197,098 | 52 MB | ~277 | Hot, high volume, mostly CI runs |
| `pipeline_jobs` | **183,110** | 58 MB | ~333 | **Highest volume**, value giảm nhanh sau 30d |
| `commits` | 104,834 | 60 MB | ~600 | Fat rows (title + message + diff stats) |
| `mr_commits` | 85,219 | 46 MB | ~566 | MR↔commit bridge |
| `test_reports` | 42,160 | 10 MB | ~257 | Per-pipeline test summary |
| `merge_requests` | 26,453 | 11 MB | ~439 | **KPI core** — full retention required |
| `mr_notes` | 18,684 | 8.5 MB | ~478 | Review-flow chỉ; body truncated 500 char |
| `group_members` | 617 | 400 kB | — | Static dimension |

### 2.2 KPI materialized tables (dbt)

| Object | Type | Size | Note |
|---|---|---:|---|
| `v_mr_score_breakdown` | **table** | **78 MB** | Per-MR-criterion breakdown; scaling ~3 KB/MR |
| `v_compliance_criterion_stats` | table | 8.7 MB | Aggregate per criterion |
| `v_dora_metrics` | table | 1.4 MB | Trend table |
| Other 22 views | view | 0 B | Computed on-query |

`v_mr_score_breakdown` chiếm **89%** của `gitlab_kpi` schema; rebuild full-refresh sẽ chậm dần (hiện ~30s, dự phóng >2 phút sau 12 tháng).

### 2.3 Tăng trưởng tuần (rolling avg 12 tuần gần nhất)

| Source | Avg/tuần | Min | Max | Avg/tháng (×4.33) |
|---|---:|---:|---:|---:|
| MRs | 1,400 | 523 | 1,781 | ~6,000 |
| Pipelines | 10,800 | 3,841 | 12,358 | ~46,500 |
| Commits | 5,500 | 1,896 | 6,737 | ~24,000 |
| (derived) mr_commits | ~4,400 | — | — | ~19,000 |
| (derived) pipeline_jobs | ~10,000 | — | — | ~43,000 |
| (derived) mr_notes | ~970 | — | — | ~4,200 |
| (derived) test_reports | ~2,150 | — | — | ~9,300 |

Tuần 2026-04-27 (523 MRs) là **anomaly** — public holiday Việt Nam (30/4–1/5).

---

## 3. Dự phóng 12 tháng

### 3.1 Storage growth model

| Bảng | Rows/tháng | Bytes/row | MB/tháng |
|---|---:|---:|---:|
| pipelines | 46,500 | 277 | 13 |
| pipeline_jobs | 43,000 | 333 | 14 |
| commits | 24,000 | 600 | 14 |
| mr_commits | 19,000 | 566 | 11 |
| test_reports | 9,300 | 257 | 2.4 |
| merge_requests | 6,000 | 439 | 2.6 |
| mr_notes | 4,200 | 478 | 2.0 |
| **Raw subtotal** | | | **~59 MB/tháng** |
| gitlab_kpi materialized (scale theo MR) | | | ~18 MB/tháng |
| gitlab_raw_staging (dlt mirror) | | | ~9 MB/tháng |
| **Tổng cộng** | | | **~86 MB/tháng** |

### 3.2 Projections

| Mốc | Tổng DB size | Lưu ý |
|---|---:|---|
| D-day (today) | 382 MB | — |
| +6 tháng | ~900 MB | Query trên pipeline_jobs bắt đầu chậm (>500k rows) |
| +12 tháng | ~1.4 GB | Cần áp dụng P1+P2 trước mốc này |
| +24 tháng | ~2.5 GB | Nếu chưa archive: dbt full-refresh chậm gấp 3x |
| +60 tháng | ~5.5 GB | Vẫn dưới 10% của 100GB SSD — đĩa không bao giờ là vấn đề |

### 3.3 Bottleneck thực sự (NOT disk)

1. **`pipeline_jobs` query latency** — joins với `pipelines` cho stage-level analytics; sequential scan cost tăng tuyến tính
2. **`v_mr_score_breakdown` rebuild time** — dbt full-refresh quét toàn bộ merge_requests; cần convert sang `incremental` materialization
3. **dlt cache size** — `~/.dlt/pipelines/gitlab_kpi/schemas/*.json` tích lũy historical schema versions; cần periodic clean

---

## 4. Chiến lược archive — 3 tiers

### Tier 1 — Hot (gitlab_raw, full retention, fully indexed)

| Bảng | Retention | Lý do |
|---|---|---|
| `merge_requests` | **Forever** | Compliance trend lookback (4-week + quarterly + yearly leaderboard) |
| `group_members` | Forever | Static dimension, 400 kB |
| `pipeline_state`, `webhook_dlq` | Forever | Ops state, small |

### Tier 2 — Warm (gitlab_raw, **range-partitioned by month**)

PostgreSQL native partitioning trên cột thời gian → `ALTER TABLE ... DETACH PARTITION` chạy trong O(1), không lock.

| Bảng | Partition column | Window | Drop sau |
|---|---|---|---|
| `pipeline_jobs` | `created_at` | monthly | **6 months** → archive |
| `pipelines` | `created_at` | monthly | 12 months → archive |
| `test_reports` | `extracted_at` | monthly | 6 months → archive |
| `commits` | `committed_date` | monthly | 12 months → archive |
| `mr_commits` | `authored_date` | monthly | 12 months → archive |
| `mr_notes` | `created_at` | monthly | 12 months → archive |

### Tier 3 — Cold (archive schema hoặc external)

**Option A — `gitlab_archive` schema cùng DB** (recommended cho năm 1):
- `DETACH PARTITION` từ Tier 2 → `ATTACH` vào `gitlab_archive.<table>`
- dbt model dùng macro `{{ ref_with_archive('pipelines') }}` để UNION ALL khi cần lookback dài (DORA quarterly)
- Lợi: vẫn query được; zero ETL change; rollback trivial

**Option B — Parquet export → S3/MinIO** (revisit Year 2):
- `pg_dump --table=gitlab_archive.* --format=custom` hoặc `COPY ... TO PROGRAM 'pq_write'`
- Lợi: zero ongoing DB cost; archival forever
- Hại: mất khả năng query trực tiếp; cần Athena/DuckDB nếu cần khôi phục

---

## 5. Roadmap triển khai

| Phase | Action | When | Effort | Impact |
|---|---|---|---|---|
| **P1 — Retention DELETE** | Migration 009: xóa `pipeline_jobs` rows > 90d, schedule cron weekly | **D+30** | 2h spec + 1h apply | Giảm ngay ~30 MB, baseline cho P2 |
| **P2 — Partition convert** | First wave: convert `pipeline_jobs` sang RANGE partition theo tháng (§7). | **D+60** | 0.5 ngày apply + 7d observation | Query speedup 5–10x; foundation cho P3 |
| **P2b — Partition convert (rest)** | Second wave: `pipelines` + `commits` reuse the validated playbook (migrations 012 + 013); functional indexes on `pipelines` propagated via parent. | **D+75** | 0.5 ngày apply + 7d observation | Closes partition coverage on all hot tables |
| **P3 — Archive cron** | Quarterly job: DETACH partition cũ → ATTACH `gitlab_archive`; update dbt macro | **D+90** | 1 ngày | Long-term sustainability |
| **P4 — Mat table → incremental** | Convert `v_mr_score_breakdown` sang dbt `materialized='incremental'` (unique_key=mr.id, only rebuild last 7d) | **D+90** | 4h | Cắt rebuild time từ 30s → 3s |
| **P5 — Parquet export** | Khi `gitlab_archive` > 10 GB, export quý cũ ra S3/MinIO | **Year 2** | 2 ngày | Zero ongoing DB cost cho cold tier |

**Critical path**: P1 must ship trước **D+90** để query latency không degrade trước khi P2 kịp triển khai.

---

## 6. Implementation details — Phase 1 (deploy ngay D+30)

### 6.1 Migration 009 — Pipeline jobs retention

File: `src/infra/db/migrations/009_pipeline_jobs_retention.sql`

```sql
-- Xóa pipeline_jobs older than 90 days
-- Idempotent; safe to re-run; CASCADE không cần (no FK referencing)
DELETE FROM gitlab_raw.pipeline_jobs
WHERE created_at < NOW() - INTERVAL '90 days';
VACUUM ANALYZE gitlab_raw.pipeline_jobs;
```

### 6.2 Scheduled retention job

Lựa chọn:
- **A. GitLab scheduled CI** (recommended): job `ops:retention` trong `.gitlab-ci.yml`, lịch weekly `0 3 * * 0` (03:00 Chủ Nhật)
- **B. Cron VM**: `0 3 * * 0 psql $DATABASE_URL -f /opt/gitlab-analytics/src/infra/db/migrations/009_pipeline_jobs_retention.sql`

Cả 2 đều idempotent. Recommend **A** để có log + alert centralized.

### 6.3 Smoke test sau apply
```sql
SELECT
    MIN(created_at) AS oldest,
    MAX(created_at) AS newest,
    COUNT(*) AS row_count,
    pg_size_pretty(pg_total_relation_size('gitlab_raw.pipeline_jobs')) AS size
FROM gitlab_raw.pipeline_jobs;
-- Expect: oldest ≥ NOW() - 90d; row_count giảm ~30%; size giảm ~30%
```

### 6.4 Rollback
- **Không cần rollback dữ liệu** — pipeline_jobs có thể tái extract từ GitLab API bằng `python -m src.extraction.pipeline --source pipeline_jobs --backfill --since-days 365`
- Disable cron: GitLab UI → CI/CD → Schedules → pause `ops:retention`

---

## 7. Implementation details — Phase 2 (partition convert, target D+60)

> Status: design + staging test PASS on 2026-05-15. Migrations 010 + 011 written. Production cutover pending Eng Manager sign-off (§10 Q4).

### 7.1 Scope (Phase 2 + 2b)

Three tables convert to range-partitioned-by-month:

| Wave | Table | Partition key | Target | Migration |
|---|---|---|---|---|
| P2  | `pipeline_jobs` | `created_at` (cast TEXT → timestamptz first) | D+60 | 010 + 011 |
| P2b | `pipelines`     | `created_at` (already timestamptz)           | D+75 | 012       |
| P2b | `commits`       | `committed_date` (already timestamptz)       | D+75 | 013       |

P2 ships alone first to validate the playbook on the highest-volume table; P2b is two more cutovers using the same procedure once the observation window for P2 closes cleanly.

### 7.2 The dlt compatibility constraint

PostgreSQL native partitioning requires the partition key to be part of every UNIQUE/PRIMARY KEY on the partitioned table. `gitlab_raw.pipeline_jobs` currently has:

- PRIMARY KEY `(id)`
- UNIQUE `(_dlt_id)` — dlt-managed, hint-driven

Naive promotion to composite `(_dlt_id, created_at)` UNIQUE breaks dlt: its merge SQL emits `DELETE FROM <t> WHERE _dlt_id IN (...)` assuming `_dlt_id` alone is unique. INSERT staging deduplicates by user `primary_key` (here `id`), not `_dlt_id` — so if a re-load produces two `_staging` rows with the same `_dlt_id` across different `created_at` months, the composite UK lets both land. Result: silent duplicate rows.

**Resolution**:

- PRIMARY KEY moves to `(id, created_at)` — composite, includes partition key. Pre-check confirmed all 183,110 ids are distinct, so the composite holds.
- `_dlt_id` UNIQUE constraint is **dropped** and replaced with a **non-unique B-tree INDEX**. dlt's `DELETE ... WHERE _dlt_id IN (...)` still uses the index for lookup; nothing in dlt's emitted SQL requires `_dlt_id` to be globally unique (verified by reading `dlt/destinations/sql_jobs.py` — `SqlMergeFollowupJob`).

### 7.3 Migration files

| File | Purpose |
|---|---|
| `src/infra/db/migrations/010_pipeline_jobs_created_at_timestamptz.sql` | Cast `pipeline_jobs.created_at` TEXT → timestamptz (P2 prereq) |
| `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | Partition `pipeline_jobs` by month |
| `src/infra/db/migrations/012_pipelines_partition.sql` | Partition `pipelines` by `created_at`, recreate functional indexes on parent |
| `src/infra/db/migrations/013_commits_partition.sql` | Partition `commits` by `committed_date` (composite PK on varchar `id`) |
| `scripts/p2_partition_staging_test.py` | Scratch-schema soak test; parametrized over all 3 tables (`--table NAME`) |

### 7.4 Production cutover playbook

> Run during maintenance window. ETL must be paused (`gitlab-ci.yml: extract:*` jobs) for the duration. Expected total runtime ~3 minutes for 183k rows; scale linearly.

1. **Backup** (mandatory):
   ```bash
   pg_dump -t gitlab_raw.pipeline_jobs $DATABASE_URL > pipeline_jobs_pre_p2.dump
   ```
2. **Pause ETL**: GitLab UI → CI/CD → Schedules → pause `extract:pipeline-jobs` and any compounding schedule.
3. **Apply migration 010**:
   ```bash
   psql -1 $DATABASE_URL -f src/infra/db/migrations/010_pipeline_jobs_created_at_timestamptz.sql
   ```
4. **Scrub dlt schema cache** (out-of-repo state). Run on the VM that hosts dlt:
   ```bash
   python - <<'EOF'
   import json, pathlib
   from dlt.common.schema.utils import bump_version_if_modified
   p = pathlib.Path.home() / ".dlt/pipelines/gitlab_kpi/schemas/gitlab_kpi.schema.json"
   s = json.loads(p.read_text())
   col = s["tables"]["pipeline_jobs"]["columns"].get("created_at")
   if col and col.get("data_type") == "text":
       col["data_type"] = "timestamp"
       bump_version_if_modified(s)
       p.write_text(json.dumps(s, indent=2))
       print("dlt cache updated")
   EOF
   ```
5. **Apply migration 011**:
   ```bash
   psql -1 $DATABASE_URL -f src/infra/db/migrations/011_pipeline_jobs_partition.sql
   ```
6. **Smoke test**:
   ```sql
   -- partitioned?
   SELECT relname FROM pg_partitioned_table pt JOIN pg_class c ON c.oid = pt.partrelid
   WHERE relname = 'pipeline_jobs';
   -- partition count + per-partition row counts
   SELECT i.inhrelid::regclass AS partition, (SELECT count(*) FROM ONLY ...) FROM pg_inherits i
   WHERE inhparent = 'gitlab_raw.pipeline_jobs'::regclass;
   -- legacy vs new totals match
   SELECT count(*) FROM gitlab_raw.pipeline_jobs;            -- new
   SELECT count(*) FROM gitlab_raw.pipeline_jobs_legacy;     -- legacy snapshot
   ```
7. **Resume ETL**: unpause schedules. First extract round MUST log `LOAD COMPLETED` without `InStorageSchemaModified` — if it fails, re-run step 4 with verbose output and check `data_type` was truly updated in the JSON.
8. **dbt run**: `dbt run --select stg_pipeline_jobs+ v_data_freshness`. Confirm both succeed.
9. **Observation window (7 days)**: monitor partition-level row counts daily. New rows must land in the partition matching their `created_at` month — verify by `SELECT count(*), tableoid::regclass FROM gitlab_raw.pipeline_jobs GROUP BY 2;`.
10. **Cleanup** (after observation window):
    ```sql
    DROP TABLE gitlab_raw.pipeline_jobs_legacy;
    ```

#### P2b cutover (pipelines + commits, target D+75)

Same steps 1–10 above, with these differences:

- Skip migration 010 and the dlt cache scrub (step 4) — both tables already have timestamptz partition keys.
- Apply migrations 012 then 013 in the same maintenance window. They are independent transactions.
- The functional indexes on `pipelines` (`idx_pipelines_project_ref_updated`, `idx_pipelines_success_coverage`) are recreated by migration 012 on the partitioned parent. PG propagates them to all current and future partitions automatically.
- Smoke test command for `commits`:
  ```sql
  SELECT tableoid::regclass AS partition, count(*)
    FROM gitlab_raw.commits GROUP BY 1 ORDER BY 1;
  ```
- 7-day observation window: monitor that new commits land in the partition matching their `committed_date` month; alert if anything routes to `commits_overflow_future`.

### 7.5 Rollback

If any step from 5 onward fails or surfaces data corruption:

```sql
-- Reverse the rename in 011 (legacy is byte-identical to pre-migration state)
BEGIN;
ALTER TABLE gitlab_raw.pipeline_jobs RENAME TO pipeline_jobs_partitioned;
ALTER TABLE gitlab_raw.pipeline_jobs_legacy RENAME TO pipeline_jobs;
COMMIT;
DROP TABLE gitlab_raw.pipeline_jobs_partitioned CASCADE;
-- Restore created_at type if needed (migration 010 rollback in its header)
```

ETL resumes immediately against the restored legacy table. No data loss possible because the legacy copy never participated in the post-cutover write path.

### 7.6 Future-month partition creation (preparation for P3)

The migration creates monthly partitions for the current data window plus two overflow partitions (pre / future). A monthly cron job extends the window forward:

```sql
-- ops:ensure_partition (to be added in D+75 alongside P3 design)
CREATE TABLE IF NOT EXISTS gitlab_raw.pipeline_jobs_<YYYY_MM>
    PARTITION OF gitlab_raw.pipeline_jobs
    FOR VALUES FROM ('<YYYY_MM_01>') TO ('<YYYY_NEXT_MM_01>');
```

P3 archive cron (D+90) will be the same job, plus: DETACH the oldest partition past retention, ATTACH it to `gitlab_archive.pipeline_jobs`.

### 7.7 Staging test results

#### P2 — pipeline_jobs (2026-05-15)

| Check | Result |
|---|---|
| Clone 183,110 rows into scratch | OK |
| TEXT → timestamptz cast | 0.7s |
| Partition convert (backfill + swap) | 1.0s |
| Partition count (3 monthly + 2 overflow) | 5 |
| Partition pruning plan present | OK |
| Row count preserved post-swap | 183,110 = 183,110 |
| dlt merge UPDATE path (same id, new _dlt_id) | OK — 1 DELETE, 1 INSERT |
| dlt merge INSERT path (brand-new id) | OK — landed in correct partition |
| Idempotency (re-run same merge with rebuilt DELETE temp) | OK — no duplicates |

#### P2b — pipelines + commits (2026-05-16)

| Table | Rows | Backfill | Partitions | Merge sim | Idempotency |
|---|---:|---:|---:|---|---|
| `pipelines` | 197,098 | 0.85s | 9 (7 monthly + 2 overflow) | OK | OK |
| `commits`   | 104,834 | 0.87s | 9 (7 monthly + 2 overflow) | OK (varchar PK) | OK |

`commits.id` is varchar (Git SHA). Composite PK `(varchar, timestamptz)` performed identically to bigint PK in the soak test — no measurable INSERT slowdown.

GO verdict: production cutover design is sound for all three tables. Awaiting maintenance window + sign-off (§10 Q4).

---

## 8. Implementation details — Phase 4 (incremental matview, target D+90)

> Status: design + code landed 2026-05-16. Awaiting first prod cutover after P2 observation window closes (no hard dependency, but sequencing reduces blast radius if either causes a regression).

### 8.1 Scope

Single dbt model: `gitlab_kpi.v_mr_score_breakdown` (currently materialized as TABLE, 78 MB ≈ 89% of `gitlab_kpi` schema).

The model produces **10 rows per MR** (one per compliance criterion via `cross join lateral`), filtered to MRs created in the last 90 days.

### 8.2 Design decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | `unique_key=['id', 'criterion_name']` (composite) | Single-column `id` would overwrite 9/10 rows because the model fans out 10 per MR. Invariant enforced by `dbt_utils.unique_combination_of_columns` test in `sources.yml` |
| D2 | `incremental_strategy='delete+insert'` | When an MR is updated, all 10 of its criterion rows must be replaced atomically. `merge` strategy would require per-criterion row identification; `delete+insert` simply wipes the 10 rows by `id` and re-inserts |
| D3 | Watermark column: `updated_at` (NOT `created_at`) | MR `compliance_score` can recompute after later commits or CI re-runs. `created_at` would silently miss those updates |
| D4 | Watermark propagation through chain | `stg_merge_requests` → `v_mr_compliance` → `v_compliance_mgmt` → `v_mr_score_breakdown`. The two mart views in the middle previously did not select `updated_at` |
| D5 | `post_hook` DELETE rolling 90d on every refresh | PRIMARY eviction mechanism for rows that age out of the window. Runs in same dbt run as `delete+insert`, no Metabase visibility gap. Replaces the original weekly-full-refresh design |
| D6 | `on_schema_change='sync_all_columns'` | Handles both additive and removal column changes automatically. Safe because `v_compliance_mgmt` is a same-repo view under code review, not an external schema |
| D7 | One-shot `ops:p4-cutover` job for first deploy | Eliminates ambiguity around table→incremental materialization change. Explicit `--full-refresh` + dbt test + psql composite-UK smoke test |
| D8 | Monthly `ops:dbt-full-refresh` as safety-net | Defence-in-depth for orphaned rows / schema-change drift. Not the primary eviction (D5 is). Cron `0 4 1 * *` (1st of month) |

### 8.3 Files changed

| File | Change |
|---|---|
| `src/transform/models/marts/v_mr_score_breakdown.sql` | `{{ config }}` → incremental + composite UK + delete+insert + `sync_all_columns` + `post_hook` 90d DELETE; add `m.updated_at` to select; add `is_incremental()` watermark filter |
| `src/transform/models/marts/v_compliance_mgmt.sql` | Add `mr.updated_at` to final select |
| `src/transform/models/marts/v_mr_compliance.sql` | Add `mr.updated_at` to `scored` CTE |
| `src/transform/models/staging/sources.yml` | Add `v_mr_score_breakdown` block with `dbt_utils.unique_combination_of_columns` composite-UK test + `not_null` + `accepted_values` |
| `.gitlab-ci.yml` | New `ops:p4-cutover` (manual one-shot) + `ops:dbt-full-refresh` demoted to monthly safety-net |
| `CHANGELOG.md` | NEW — operational notes, verification checklist |

### 8.4 First deploy procedure (DEFINITIVE)

1. **Merge** the P4 branch.
2. **Trigger `ops:p4-cutover`** from GitLab UI: CI/CD → Pipelines → Run pipeline → Play ▶ on `ops:p4-cutover`. Job runs:
   - `dbt run --select v_mr_score_breakdown --full-refresh` (clean recreate)
   - `dbt test --select v_mr_score_breakdown` (composite UK + accepted_values)
   - `psql` composite-UK smoke test (defence-in-depth verification)
3. **Inspect job log**: expect `composite UK OK` line, all tests PASS.
4. **Schedule `ops:dbt-full-refresh`** in GitLab CI/CD → Schedules: cron `0 4 1 * *` (1st of month, 04:00). Monthly safety-net only.
5. **Day-2 incremental check**: next scheduled `dbt-transform` run will operate in incremental mode automatically — log shows small "X rows affected" only for MRs touched since last run.

### 8.5 Steady-state operation

Every `dbt-transform` scheduled run:
1. Incremental SELECT pulls only MRs where `updated_at > max(updated_at) in {{ this }}`.
2. `delete+insert` overwrites all 10 criterion rows for those MRs atomically.
3. `post_hook` `DELETE FROM {{ this }} WHERE created_at < now() - interval '90 days'` evicts rows whose source MR aged out of the window.
4. All three steps run in the same dbt run — Metabase visibility never drops.

### 8.6 Monitoring

- **Rebuild duration**: log `dbt-transform` job runtime over 2 weeks. Expect drop from ~30s (table) to ~3s (incremental + post_hook DELETE). Anomaly: > 10s suggests wide watermark window or accumulated `sync_all_columns` cost.
- **Composite UK test**: enforced on every `dbt test` run via `dbt_utils.unique_combination_of_columns`. CI failure = immediate alert.
- **Row count drift**: monthly full-refresh and prior-day incremental should diverge by < 1% (post_hook is now the primary eviction; full-refresh catches only orphans + drift, not stale rows).

### 8.7 Rollback

Single commit revert of the five files. Next `dbt run` will drop the incremental table on schema-config mismatch and rebuild as a regular table — no manual cleanup needed.

### 8.8 Out of scope (future work)

- `v_compliance_criterion_stats` (8.7 MB) — similar pattern could apply but smaller payoff. Defer to Year-2 review.
- `v_dora_metrics` (1.4 MB) — too small to be worth converting.

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| dbt model dùng pipeline_jobs > 90d → break sau migration 009 | Medium | High | Audit `grep -r pipeline_jobs src/transform` trước apply; KPI views hiện chỉ dùng last 30d (v_pipeline_failures) |
| Partition convert (P2) đụng dlt schema cache (giống migration 008) | High | Medium | Test trên staging trước; pattern scrub schema.json đã có sẵn ở `known_gotchas` |
| dlt merge slow trên partitioned table với PK = id | Medium | Medium | Test ETL throughput on staging; fallback: composite PK [id, created_at] |
| Archive job fail → partition tích lũy | Low | Low | Alert nếu partition count > 12 cho monthly tables |
| dbt full-refresh chậm trên `v_mr_score_breakdown` | High (đang xảy ra) | Medium | P4: convert sang incremental |

---

## 10. Quyết định cần Engineering Manager / DevOps

| # | Quyết định | Recommendation | Owner |
|---|---|---|---|
| Q1 | Retention window cho `pipeline_jobs` | **90 days** | DevOps |
| Q2 | Retention window cho `pipelines`/`commits` | 12 months (sau P2) | Eng Manager |
| Q3 | Archive tier 3 location | gitlab_archive schema năm 1, S3 năm 2 | DevOps |
| Q4 | Partition convert window — execute trong off-hours? | Yes, schedule Sat 02:00 UTC+7 | DevOps |
| Q5 | Có cần backup trước P1 không? | Yes — pg_dump snapshot ngay trước migration 009 | DevOps |

---

## 11. Tham chiếu

- `docs/ops/DEPLOYMENT.md` — deploy plan tổng (đã reference §6 monitoring)
- `src/infra/db/migrations/` — migration history
- `.claude/memory/schema_snapshot.yaml` — schema source of truth
- `src/transform/models/marts/v_pipeline_failures.sql` — sử dụng pipeline_jobs với lookback 7 days (KPI duy nhất cần check)
- Live DB snapshot script: `docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "..."` (xem §2.1)
