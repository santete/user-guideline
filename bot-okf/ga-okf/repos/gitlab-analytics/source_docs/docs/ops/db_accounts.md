# DB Accounts Proposal — DBA Review

> **Mục đích**: thống nhất với DBA về model account/schema cho `gitlab_analytics` DB.
> **Constraint từ DBA**: phân quyền chặt theo schema, mục tiêu **chống join giữa các schema**.
> **Status**: DRAFT — chờ DBA confirm.
> **Snapshot**: 2026-06-09 — verified against actual codebase (branch `main`).
> Companion file: `db_services_matrix.md` (10 services × 4 schemas).

---

## 1. Context — kiến trúc data 3 layer

```
GitLab API
    │
    ▼ (dlt — Python ETL)
┌─────────────────────────────────────────────┐
│ gitlab_raw_staging  (dlt transient)         │
│ gitlab_raw          (raw API data)          │
└────────────────────┬────────────────────────┘
                     │ dbt source()
                     ▼
┌─────────────────────────────────────────────┐
│ gitlab_kpi_staging  (stg_* views, cleansed) │
└────────────────────┬────────────────────────┘
                     │ dbt ref()
                     ▼
┌─────────────────────────────────────────────┐
│ gitlab_kpi          (v_* views, KPI marts)  │
└────────────────────┬────────────────────────┘
                     │ SELECT
                     ▼
              Metabase / Alert scripts
```

→ **4 schemas, 3 layer**.

---

## 2. Điểm cần thống nhất với DBA về "chống join giữa các schema"

DBA muốn cấm cross-schema JOIN. Nhưng cách dbt + dlt hoạt động có 2 dạng "cross-schema access" mà cần phân biệt:

| Loại | Ví dụ | Có phải "join" theo nghĩa DBA muốn cấm không? |
|---|---|---|
| **Hard JOIN ad-hoc** | `SELECT * FROM gitlab_raw.x JOIN gitlab_kpi.y` viết trực tiếp trong query Metabase | ✅ Có — đáng cấm |
| **View chain (layer pipeline)** | `gitlab_kpi.v_mart` query `gitlab_kpi_staging.stg_*` (qua dbt ref) | ❌ Không — đây là pipeline có kiểm soát, code-reviewed trong dbt repo |
| **dlt staging→raw MERGE** | dlt `MERGE INTO gitlab_raw.x USING gitlab_raw_staging.x` trong 1 transaction | ❌ Không — đây là ETL internal, bắt buộc bởi dlt design |

**Đề xuất**: cấm loại 1, cho phép loại 2 + 3 (vì code-controlled, không phải ad-hoc).

→ Hệ quả: cần 3 functional accounts, mỗi cái scope chặt theo NHÓM SCHEMA + ROLE chứ không phải 1:1 với schema.

---

## 3. Proposal — 3 accounts

### 3.1 `app_etl` — dlt ETL pipeline

| Attribute | Value |
|---|---|
| **Scope** | `gitlab_raw`, `gitlab_raw_staging` |
| **Cấm chạm** | `gitlab_kpi`, `gitlab_kpi_staging` |
| **Quyền** | USAGE + CREATE + DML (INSERT/UPDATE/DELETE) |
| **Lý do CREATE** | dlt tự tạo bảng mới khi GitLab API thêm resource (vd `discussions`, `releases`) |
| **Dùng bởi** | `src/extraction/pipeline.py`, ops jobs (`extract`, `extract-backfill`, `migration-*`, `retention`, `reset-cursors`, `reset-failures`, `triage`) |

```sql
CREATE ROLE app_etl LOGIN PASSWORD '<vault>';
GRANT USAGE, CREATE ON SCHEMA gitlab_raw, gitlab_raw_staging TO app_etl;
GRANT INSERT, UPDATE, DELETE, SELECT ON ALL TABLES IN SCHEMA gitlab_raw, gitlab_raw_staging TO app_etl;
ALTER DEFAULT PRIVILEGES IN SCHEMA gitlab_raw, gitlab_raw_staging
  GRANT INSERT, UPDATE, DELETE, SELECT ON TABLES TO app_etl;
-- KHÔNG GRANT gì trên gitlab_kpi*
```

### 3.2 `app_transform` — dbt transformation

| Attribute | Value |
|---|---|
| **Scope** | `gitlab_kpi`, `gitlab_kpi_staging` (RW) + `gitlab_raw` (READ-ONLY) |
| **Cấm chạm** | `gitlab_raw_staging` (dlt-only), KHÔNG ghi `gitlab_raw` |
| **Quyền** | RW trên 2 kpi schemas; SELECT trên `gitlab_raw` |
| **Lý do cần SELECT raw** | dbt staging models (`stg_*`) phải đọc `source('gitlab_raw', ...)` |
| **Dùng bởi** | `src/transform/` (dbt run/test), ops jobs (`dbt-run`, `dbt-full-refresh`, `p4-cutover`) |

```sql
CREATE ROLE app_transform LOGIN PASSWORD '<vault>';
GRANT USAGE ON SCHEMA gitlab_raw TO app_transform;
GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_raw TO app_transform;
ALTER DEFAULT PRIVILEGES IN SCHEMA gitlab_raw GRANT SELECT ON TABLES TO app_transform;

GRANT USAGE, CREATE ON SCHEMA gitlab_kpi, gitlab_kpi_staging TO app_transform;
GRANT INSERT, UPDATE, DELETE, SELECT ON ALL TABLES IN SCHEMA gitlab_kpi, gitlab_kpi_staging TO app_transform;
ALTER DEFAULT PRIVILEGES IN SCHEMA gitlab_kpi, gitlab_kpi_staging
  GRANT INSERT, UPDATE, DELETE, SELECT ON TABLES TO app_transform;
-- KHÔNG GRANT gì trên gitlab_raw_staging
```

### 3.3 `analytics_ro` — Metabase + Alert scripts

| Attribute | Value |
|---|---|
| **Scope** | `gitlab_raw`, `gitlab_kpi` (READ-ONLY) |
| **Cấm chạm** | `gitlab_raw_staging`, `gitlab_kpi_staging` (internal layers) |
| **Quyền** | SELECT only |
| **Dùng bởi** | Metabase connection, `src/alerting/*.py`, `src/reporting/*.py` |

```sql
CREATE ROLE analytics_ro LOGIN PASSWORD '<vault>';
GRANT USAGE ON SCHEMA gitlab_raw, gitlab_kpi TO analytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_raw, gitlab_kpi TO analytics_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA gitlab_raw, gitlab_kpi
  GRANT SELECT ON TABLES TO analytics_ro;
-- KHÔNG GRANT trên staging schemas (internal layers, ẩn khỏi consumer)
```

---

## 4. Matrix tổng quan

| Schema → \ Account ↓ | `gitlab_raw` | `gitlab_raw_staging` | `gitlab_kpi_staging` | `gitlab_kpi` |
|---|:---:|:---:|:---:|:---:|
| `app_etl` (dlt) | RW + CREATE | RW + CREATE | ❌ | ❌ |
| `app_transform` (dbt) | R | ❌ | RW + CREATE | RW + CREATE |
| `analytics_ro` (Metabase) | R | ❌ | ❌ | R |

→ Mỗi account scope rõ ràng, không có account nào "all-access". Không account nào có quyền JOIN ad-hoc giữa raw và kpi (chỉ `analytics_ro` read được cả 2, nhưng đó là consumer cần)..

---

## 5. Có ngăn được "JOIN giữa schemas" không?

| Trường hợp JOIN | Ngăn được? | Cách |
|---|---|---|
| Metabase user JOIN `gitlab_raw.x` với `gitlab_kpi.y` trong cùng query | ❌ Không thể ngăn full | `analytics_ro` cần read cả 2 để serve dashboard. Có thể ngăn bằng cách CHỈ grant `gitlab_kpi` cho Metabase, force mọi join logic phải nằm trong dbt model — **đề xuất**. |
| dbt mart JOIN `gitlab_raw` với `gitlab_kpi` | ❌ Không thể (vì `app_transform` có cả 2) | Enforce qua **code review + invariant** trong `schema_reference.md` (Rule 2 đã có) |
| Ad-hoc psql user query JOIN | ✅ Ngăn được | Không cấp account nào có cả `gitlab_raw` + `gitlab_kpi` write |
| dlt cross schema | ❌ Không thể (cần MERGE) | Đây là internal, không phải user-driven JOIN |

**Đề xuất tighten thêm**: tạo account riêng `metabase_ro` CHỈ access `gitlab_kpi`, force mọi mọi join logic về raw phải qua dbt model. `analytics_ro` (cho alert script) vẫn cần `gitlab_raw` để đếm freshness/violation gốc.

```sql
CREATE ROLE metabase_ro LOGIN PASSWORD '<vault>';
GRANT USAGE ON SCHEMA gitlab_kpi TO metabase_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_kpi TO metabase_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA gitlab_kpi GRANT SELECT ON TABLES TO metabase_ro;
-- KHÔNG cấp gitlab_raw → Metabase không thể tự JOIN raw
```

→ Thành 4 accounts: `app_etl`, `app_transform`, `analytics_ro` (alert scripts only), `metabase_ro` (dashboard only).

---

## 6. Cross-schema access KHÔNG ngăn được (và lý do chấp nhận)

Có 2 chỗ view chain phải xuyên schema, **không cách nào khác**:

1. **dbt staging models** (`gitlab_kpi_staging.stg_*`) ref `gitlab_raw.*` qua `source()` macro. View owner là `app_transform` → khi `analytics_ro` SELECT `gitlab_kpi.v_*` → view chain chạy bằng `app_transform` → đọc raw qua quyền của `app_transform`. Đây là dbt 3-layer pattern, không tránh được.

2. **dlt MERGE** từ `gitlab_raw_staging` sang `gitlab_raw` trong cùng transaction. Đây là dlt internal.

→ Cả 2 đều là **code-controlled** (commit trong repo, code review), không phải ad-hoc user query. Argument với DBA: đây không phải JOIN nghĩa lỏng lẻo mà DBA muốn cấm.

---

## 7. Câu hỏi cho DBA

1. ✅ Confirm OK với model 3 (hoặc 4) functional accounts ở §3 + §5?
2. ✅ Confirm OK với 2 cross-schema chain ở §6 (dbt view + dlt MERGE)?
3. ❓ DBA có muốn `metabase_ro` riêng (chỉ `gitlab_kpi`) hay gộp với `analytics_ro` (cả raw + kpi)?
4. ❓ Password rotation policy cho 3-4 account này? (Vault auto-rotate hay manual?)
5. ❓ Ai own schema (`OWNER`)? DBA hay account dedicated? (đề xuất: DBA own schema, app_etl/app_transform chỉ có CREATE TABLE)

---

## 8. Sau khi DBA confirm

Analytics team sẽ:
- Refactor code: tách `DATABASE_URL` → 3-4 connection strings (`ETL_DATABASE_URL`, `DBT_DATABASE_URL`, `ANALYTICS_RO_URL`, `METABASE_RO_URL`)
- Cập nhật Vault JSON keys
- Cập nhật `src/transform/profiles.yml`
- Cập nhật `src/config/bootstrap.py` nếu cần
- Cập nhật `docs/ops/db_first_deploy.md` với SQL grants chính thức
- Estimate: ~1 ngày

---

## Cross-references

- `docs/reference/schema_reference.md` §"Cross-schema invariant" — code-side enforcement
- `docs/reference/db_inventory.md` — schema sizes + tables
- `src/infra/db/migrations/001_init_schemas.sql` — hiện đang tạo 1 role `analytics_ro` duy nhất, cần update theo proposal này
