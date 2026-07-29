# DB Services × Schemas Matrix — DBA Handover

> **Mục đích**: liệt kê tất cả service kết nối DB `gitlab_analytics` và schema chạm vào.
> Dùng cho DBA cấp account + grant theo principle of least privilege.
> Companion file: `db_accounts.md` (proposal 3-4 functional accounts).
> **Snapshot**: 2026-06-09 — verified against actual codebase (branch `main`).

---

## 1. Tổng quan

| # | Service | Connection lib | Runtime | Schema(s) | Mode |
|---|---|---|---|---|---|
| 1 | **dlt extraction pipeline** | psycopg2 (via dlt) | CronJob `etl-daily-pipeline` (02:00 daily) | `gitlab_raw`, `gitlab_raw_staging` | RW + CREATE TABLE |
| 2 | **Checkpoint store** | psycopg2 | Embedded trong dlt pipeline + ops jobs | `gitlab_raw.pipeline_state` | RW |
| 3 | **dbt transformation** | psycopg2 (via dbt-postgres adapter) | CronJob `etl-daily-pipeline` step 2 + `etl-dbt-full-refresh` (monthly) | `gitlab_raw` (R), `gitlab_kpi_staging` (RW+CREATE), `gitlab_kpi` (RW+CREATE) | mixed |
| 4 | **Webhook FastAPI** | asyncpg | Standalone k8s Deployment (`webhook-dev` pod) | `gitlab_raw` (W), `gitlab_kpi` (R) | mixed |
| 5 | **Compliance alert** | psycopg2 | CronJob `etl-daily-pipeline` step 3 | `gitlab_kpi.v_violations` | R |
| 6 | **Freshness alert** | psycopg2 | CronJob `etl-freshness-alert` (02:30 daily) | `gitlab_kpi.v_ops_pipeline_health`, `v_data_freshness` | R |
| 7 | **Daily insight reporting** | psycopg2 | CronJob hoặc on-demand | `gitlab_kpi.*` (multiple views) | R |
| 8 | **Metabase server** (external) | JDBC (Metabase native) | Long-running container, port 3000 | `gitlab_kpi.*` (chính) + optionally `gitlab_raw` (vài card explore) | R |
| 9 | **Metabase setup script** | HTTP API (Metabase) + reads schema validation | Ops CronJob `etl-ops-setup-metabase` (manual) | `gitlab_kpi.*`, `gitlab_raw.*` (validate table names) | R (metadata only) |
| 10 | **Ops scripts** (via `etl_entrypoint.sh`) | psycopg2 inline | Ops CronJobs (10 jobs suspended, trigger thủ công) | `gitlab_raw` (chính) + `gitlab_kpi` (verify p4-cutover) | mixed |

---

## 2. Chi tiết từng service

### 2.1 dlt extraction pipeline

- **File**: `src/extraction/pipeline.py` + `src/extraction/sources/*.py` (8 resources)
- **Connection**: 1 pool dlt-managed. Đọc `DATABASE_URL` rồi bridge sang `DESTINATION__POSTGRES__CREDENTIALS` (xem `pipeline.py:46-54`). Refactor: đổi sang `ETL_DATABASE_URL` rồi bridge tương tự.
- **Operations**:
  - INSERT batch vào `gitlab_raw_staging.<table>` (transient)
  - MERGE từ staging sang `gitlab_raw.<table>` (primary key)
  - CREATE TABLE khi GitLab API thêm resource mới
- **Schemas chạm**: `gitlab_raw`, `gitlab_raw_staging`
- **Cần grant**: USAGE + CREATE + INSERT/UPDATE/DELETE/SELECT trên cả 2 schema
- **KHÔNG cần**: bất kỳ quyền nào trên `gitlab_kpi*`

### 2.2 Checkpoint store

- **File**: `src/extraction/checkpoint.py`
- **Connection**: psycopg2 connection mượn từ pipeline scope (cùng `DATABASE_URL` với dlt)
- **Operations**: SELECT + INSERT ON CONFLICT UPDATE trên `gitlab_raw.pipeline_state` (9 keys: cursors, run_count, last_failure)
- **Schemas chạm**: chỉ `gitlab_raw`
- **Cần grant**: thừa kế từ dlt (`app_etl`)

### 2.3 dbt transformation

- **File**: `src/transform/profiles.yml` + 33 models trong `src/transform/models/`
- **Connection**: 1 pool dbt-postgres. ⚠️ **Profile dùng 5 env vars rời rạc, KHÔNG dùng `DATABASE_URL`**: `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` (xem `profiles.yml:6-21`). Refactor sang `app_transform` cần rename 5 vars hoặc parse `DBT_DATABASE_URL` qua Jinja.
- **Operations**:
  - SELECT từ `source('gitlab_raw', ...)` — tạo `gitlab_kpi_staging.stg_*` views
  - CREATE/INSERT/REFRESH vào `gitlab_kpi.v_*` (21 views + 3 tables + 1 seed)
  - DROP/CREATE/INSERT vào `gitlab_kpi.v_mr_score_breakdown` (incremental table)
- **Schemas chạm**: `gitlab_raw` (chỉ READ), `gitlab_kpi_staging` (RW+CREATE), `gitlab_kpi` (RW+CREATE)
- **Cần grant**: SELECT trên `gitlab_raw`; USAGE + CREATE + DML trên 2 kpi schemas
- **KHÔNG cần**: write trên `gitlab_raw`, bất kỳ quyền nào trên `gitlab_raw_staging`

### 2.4 Webhook FastAPI ⚠️ DUAL-ROLE

- **File**: `src/webhook/app.py` + `src/webhook/handlers.py`
- **Connection**: 1 asyncpg pool (env `DATABASE_URL`, min_size=2 max_size=10 — xem `app.py:21-31`)
- **Operations**:
  - **WRITE**: `INSERT INTO gitlab_raw.merge_requests / pipelines / webhook_dlq` (handlers.py)
  - **READ**: `SELECT FROM gitlab_kpi.v_data_freshness / v_violations / gitlab_raw.pipeline_state / gitlab_raw.merge_requests / commits / pipelines` (app.py health endpoint)
- **Schemas chạm**: `gitlab_raw` (W) + `gitlab_kpi` (R)
- **Cần grant**: phức tạp — đây là service duy nhất cross 2 schema groups

**Option A**: cấp `app_etl` (chỉ raw) → mất health endpoint kpi
**Option B**: cấp `app_etl` + thêm SELECT trên `gitlab_kpi.v_*` → mở rộng scope
**Option C**: tách webhook thành 2 pool (`app_etl` cho write raw, `analytics_ro` cho read kpi) → đúng nhất, refactor ~2h

→ **Đề xuất Option C** để giữ separation chặt.

### 2.5 Compliance alert

- **File**: `src/alerting/compliance_alert.py`
- **Connection**: psycopg2 short-lived
- **Operations**: SELECT từ `gitlab_kpi.v_violations` → POST Slack
- **Schemas chạm**: chỉ `gitlab_kpi`
- **Cần grant**: `analytics_ro`

### 2.6 Freshness alert

- **File**: `src/alerting/freshness_alert.py`
- **Connection**: psycopg2 short-lived
- **Operations**: SELECT từ `gitlab_kpi.v_ops_pipeline_health` + `v_data_freshness` → POST Slack
- **Schemas chạm**: chỉ `gitlab_kpi`
- **Cần grant**: `analytics_ro`

### 2.7 Daily insight reporting

- **File**: `src/reporting/daily_insight.py`
- **Connection**: psycopg2 short-lived
- **Operations**: SELECT từ nhiều views `gitlab_kpi.*` → format report
- **Schemas chạm**: chỉ `gitlab_kpi`
- **Cần grant**: `analytics_ro`

### 2.8 Metabase server (external)

- **Runtime**: standalone container, port 3000, **không phải code repo này**
- **Connection**: native JDBC, env `MB_DB_*` của Metabase
- **Operations**: SELECT trên các view `gitlab_kpi.v_*` để render dashboard. Một vài card explore raw (`gitlab_raw.*`) nếu QA dùng custom SQL.
- **Schemas chạm**: `gitlab_kpi` (chính) + optionally `gitlab_raw`
- **Cần grant**:
  - Nếu muốn ép Metabase **không JOIN raw**: cấp `metabase_ro` chỉ trên `gitlab_kpi` (đề xuất trong `db_accounts.md` §5)
  - Nếu chấp nhận Metabase có thể query raw: cấp `analytics_ro`

### 2.9 Metabase setup script

- **File**: `src/metabase/setup_dashboards.py` (~2000 LOC, định nghĩa 5 collections, ~100 cards)
- **Operations**: Hầu hết là gọi Metabase HTTP API. Chỉ chạm DB để validate table names có tồn tại không.
- **Schemas chạm**: `gitlab_kpi.*` + `gitlab_raw.*` (read-only metadata)
- **Cần grant**: `analytics_ro` (READ cả 2 — dùng để validate)

### 2.10 Ops scripts (etl_entrypoint.sh)

10 ops jobs, **dùng chung connection string** theo env hiện tại:

| Job | Schema chạm | Account cần |
|---|---|---|
| `triage` | `gitlab_raw.pipeline_state` + `gitlab_raw.merge_requests/commits/pipelines` (count) | `app_etl` |
| `reset-failures` | UPDATE `gitlab_raw.pipeline_state` | `app_etl` |
| `reset-cursors` | UPDATE `gitlab_raw.pipeline_state` | `app_etl` |
| `migration-004` | ALTER `gitlab_raw.pipelines` | `app_etl` (cần CREATE/ALTER) |
| `migration-005` | ALTER `gitlab_raw.merge_requests` | `app_etl` |
| `retention` | DELETE + VACUUM `gitlab_raw.pipeline_jobs` | `app_etl` |
| `extract` | giống dlt pipeline | `app_etl` |
| `extract-backfill` | giống dlt pipeline | `app_etl` |
| `dbt-run` | giống dbt | `app_transform` |
| `p4-cutover` | dbt run + verify `gitlab_kpi.v_mr_score_breakdown` | `app_transform` |
| `setup-metabase` | Metabase HTTP API (không chạm DB nhiều) | `analytics_ro` |

→ **Etrypoint cần đọc các connection string khác nhau theo `JOB_NAME`**:

```bash
case "${JOB_NAME}" in
  daily-pipeline|extract*|retention|triage|reset-*|migration-*)
    export DATABASE_URL="${ETL_DATABASE_URL}"     # app_etl
    ;;
  dbt-run|dbt-full-refresh|p4-cutover)
    export DATABASE_URL="${DBT_DATABASE_URL}"     # app_transform
    ;;
  setup-metabase)
    export DATABASE_URL="${ANALYTICS_RO_URL}"     # analytics_ro
    ;;
esac
```

---

## 3. Matrix tổng kết cho DBA

| Service ↓ \ Schema → | `gitlab_raw` | `gitlab_raw_staging` | `gitlab_kpi_staging` | `gitlab_kpi` | Account |
|---|:---:|:---:|:---:|:---:|---|
| dlt extraction | RW+CREATE | RW+CREATE | — | — | `app_etl` |
| Checkpoint | RW | — | — | — | `app_etl` |
| dbt transform | R | — | RW+CREATE | RW+CREATE | `app_transform` |
| Webhook (write half) | W (INSERT) | — | — | — | `app_etl` |
| Webhook (read half) | — | — | — | R | `analytics_ro` |
| Compliance alert | — | — | — | R | `analytics_ro` |
| Freshness alert | — | — | — | R | `analytics_ro` |
| Daily insight | — | — | — | R | `analytics_ro` |
| Metabase server | R (optional) | — | — | R | `metabase_ro` (nếu muốn tighten) hoặc `analytics_ro` |
| Metabase setup | R (metadata) | — | — | R | `analytics_ro` |
| Ops: extract/retention/migration/triage/reset/checkpoint | RW (range) | RW | — | — | `app_etl` |
| Ops: dbt-run/full-refresh/p4-cutover | R | — | RW | RW | `app_transform` |
| Ops: setup-metabase | — | — | — | R | `analytics_ro` |

---

## 4. Số account tối thiểu cần DBA tạo

| Account | Mục đích | Service dùng |
|---|---|---|
| `app_etl` | ETL writer | dlt pipeline, webhook (write), checkpoint, 7 ops jobs |
| `app_transform` | dbt writer | dbt run, 2 ops jobs (dbt-run, p4-cutover) |
| `analytics_ro` | Internal consumer | 3 alert/report scripts, webhook (read), Metabase setup, 1 ops job |
| `metabase_ro` (optional) | Dashboard only | Metabase server JDBC (nếu DBA muốn tighten hơn `analytics_ro`) |

→ **3 accounts (tối thiểu)** hoặc **4 accounts (nếu tách Metabase JDBC)**.

---

## 5. Connection strings cần Vault expose

Vault path `/vault/secrets/configuration.<env>.json` cần thêm key. Lưu ý dbt **không nhận URL**, cần discrete vars:

```json
{
  "ETL_DATABASE_URL":   "postgresql://app_etl:***@host:5432/gitlab_analytics",
  "ANALYTICS_RO_URL":   "postgresql://analytics_ro:***@host:5432/gitlab_analytics",
  "METABASE_RO_URL":    "postgresql://metabase_ro:***@host:5432/gitlab_analytics",

  "DBT_DB_HOST":        "host",
  "DBT_DB_PORT":        "5432",
  "DBT_DB_USER":        "app_transform",
  "DBT_DB_PASSWORD":    "***",
  "DBT_DB_NAME":        "gitlab_analytics",

  "DATABASE_URL":       "(deprecated — sẽ xóa sau khi refactor xong)",
  "DB_HOST":            "(deprecated — dbt profile sẽ chuyển sang DBT_DB_*)",
  "DB_PORT":            "(deprecated)",
  "DB_USER":            "(deprecated)",
  "DB_PASSWORD":        "(deprecated)",
  "DB_NAME":            "(deprecated)"
}
```

Trong giai đoạn refactor, giữ cũ để backward-compat, deprecate dần.

---

## 6. Câu hỏi cho DBA sau khi review

1. ✅ Confirm 3 hay 4 accounts?
2. ❓ Webhook dual-role: chấp nhận Option C (2 pool) hay đề xuất khác?
3. ❓ Metabase JDBC: tách `metabase_ro` hay gộp với `analytics_ro`?
4. ❓ Ops jobs (`migration-004/005`) cần CREATE/ALTER trên `gitlab_raw` — chấp nhận cấp cho `app_etl` hay tách thêm account `dba_migrator`?

---

## Cross-references

- `docs/ops/db_accounts.md` — proposal account model chi tiết
- `docs/reference/schema_reference.md` §"Cross-schema invariant" — code enforcement
- `docs/ops/k8s_cronjob_handover.md` — runtime schedule cho từng CronJob
- `src/config/bootstrap.py` — Vault loader (hiện chỉ đọc `DATABASE_URL`, cần update)
