# Yêu cầu hỗ trợ DBA — Dev DB `172.27.62.107 / gitlab_analytics`

**Ngày:** 2026-07-09
**Từ:** Dev (gitlab-analytics)
**Tới:** DBA
**Bối cảnh:** Pipeline gitlab-analytics (dlt → PostgreSQL → dbt → Metabase) chưa deploy được lên dev DB vì account ứng dụng chưa có quyền. DBA đã tạo DB + schema + 5 account nhưng chưa grant cho account app, và thiếu 2 schema staging mà dlt/dbt cần.

---

## A. Hiện trạng đã verify (2026-07-09, connect thật)

- **5 account tồn tại:** `gitlabanalyticsread`, `gitlabanalyticswrite`, `gitlabanalyticsservice`, `gitlabanalyticsrawservice`, `gitlabanalyticskpiservice`.
- **2 schema tồn tại:** `gitlab_raw` (owner `gitlabanalyticsrawservice`), `gitlab_kpi` (owner `gitlabanalyticskpiservice`).
- **Vấn đề 1 — không có quyền:** `gitlabanalyticswrite` và `gitlabanalyticsread` đều `USAGE=False` trên mọi schema; `write` cũng không có CREATE ở db-level → pipeline fail 100%.
- **Vấn đề 2 — thiếu 2 schema staging:** `gitlab_raw_staging` (dlt tự dùng cho `write_disposition=merge`; `dataset_name="gitlab_raw"`) và `gitlab_kpi_staging` (dbt `+schema: staging`). `write` không CREATE SCHEMA được nên DBA phải tạo sẵn.

Ghi chú: app chỉ dùng **1 connection string** cho cả dlt (ghi `gitlab_raw`) lẫn dbt (tạo view `gitlab_kpi`) → gom về **1 account ghi + 1 account đọc**.

---

## B. Cần DBA XÁC NHẬN trước (1 quyết định)

**Account nào là account ghi của app?** Dev dự kiến dùng **`gitlabanalyticswrite`**. Nếu DBA muốn dùng `gitlabanalyticsservice`, báo lại để Dev đổi Vault/`DATABASE_URL` cho khớp. SQL bên dưới đang giả định `gitlabanalyticswrite`.

---

## C. Cần DBA THỰC HIỆN (grant + tạo staging schema)

```sql
-- 1) Tạo 2 staging schema còn thiếu, owner = account ghi của app
CREATE SCHEMA IF NOT EXISTS gitlab_raw_staging AUTHORIZATION gitlabanalyticswrite;
CREATE SCHEMA IF NOT EXISTS gitlab_kpi_staging AUTHORIZATION gitlabanalyticswrite;

-- 2) Account ghi: CONNECT + USAGE + CREATE trên 2 schema đã tồn tại
--    (2 staging schema ở bước 1 đã do write sở hữu nên không cần grant thêm)
GRANT CONNECT ON DATABASE gitlab_analytics TO gitlabanalyticswrite;
GRANT USAGE, CREATE ON SCHEMA gitlab_raw TO gitlabanalyticswrite;
GRANT USAGE, CREATE ON SCHEMA gitlab_kpi TO gitlabanalyticswrite;

-- 3) Account đọc (Metabase + alert script): CONNECT + USAGE + SELECT trên gitlab_kpi
GRANT CONNECT ON DATABASE gitlab_analytics TO gitlabanalyticsread;
GRANT USAGE ON SCHEMA gitlab_kpi TO gitlabanalyticsread;
GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_kpi TO gitlabanalyticsread;

-- 4) Auto-grant SELECT cho read trên các view dbt tạo TRONG TƯƠNG LAI.
--    Bắt buộc FOR ROLE gitlabanalyticswrite, vì view sẽ do write tạo (không phải owner cũ).
ALTER DEFAULT PRIVILEGES FOR ROLE gitlabanalyticswrite IN SCHEMA gitlab_kpi
    GRANT SELECT ON TABLES TO gitlabanalyticsread;
```

**Tùy chọn — chỉ nếu Metabase có card đọc thẳng `gitlab_raw`:**
```sql
GRANT USAGE ON SCHEMA gitlab_raw TO gitlabanalyticsread;
GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_raw TO gitlabanalyticsread;
ALTER DEFAULT PRIVILEGES FOR ROLE gitlabanalyticswrite IN SCHEMA gitlab_raw
    GRANT SELECT ON TABLES TO gitlabanalyticsread;
```

**Tại sao `read` KHÔNG cần quyền trên 2 staging schema (`gitlab_raw_staging`, `gitlab_kpi_staging`):**
- `gitlab_raw_staging` là staging tạm của dlt cho merge — không ai đọc ở tầng dưới.
- `gitlab_kpi_staging` chứa view `stg_*`; nhưng Metabase đọc **mart `v_*`** (ở `gitlab_kpi`), không đọc `stg_*` trực tiếp.
- View trong PostgreSQL chạy bằng quyền của **owner view** (mặc định, không `security_invoker`). Cả chuỗi `v_* → stg_* → raw` đều owner = `gitlabanalyticswrite`, nên khi `read` query mart, truy cập staging/raw được check theo `write` — `read` chỉ cần `SELECT` trên mart ở `gitlab_kpi`.
- Ngoại lệ: nếu về sau có Metabase card đọc thẳng `gitlab_kpi_staging.stg_*` thì mới cần grant thêm (cùng loại với tùy chọn `gitlab_raw` ở trên).

**Lưu ý owner (nếu 2 schema đã lỡ có object cũ):** nếu `gitlab_raw`/`gitlab_kpi` đã có bảng/view do `*service` tạo từ lần thử trước, cần `REASSIGN OWNED ... TO gitlabanalyticswrite` hoặc drop, để dlt/dbt (chạy bằng `write`) có thể ALTER/DROP-recreate. Nếu 2 schema đang rỗng thì bỏ qua.

---

## D. Cần DBA CUNG CẤP thông tin

1. **Postgres version + extension list** — dlt cần PG ≥ 13.
2. **Password của `gitlabanalyticswrite` + `gitlabanalyticsread`** giao qua kênh nào → phối hợp DevOps đẩy vào Vault (`/vault/secrets/configuration.development.json`). Dev không nhận password qua chat/commit.
3. **Network reachability** — môi trường chạy pipeline (VM/K8s namespace dev) đã whitelist tới `172.27.62.107:5432` chưa?
4. **Backup + maintenance window** — để Dev/DevOps lên lịch ETL tránh.

---

## E. DBA KHÔNG cần làm (tránh nhầm phạm vi)

- Không cần tự chạy migration `004`–`014`: runner `migrate.py` (chạy bằng account `write`) sẽ tự `ALTER` các bảng raw sau khi dlt tạo. DBA chỉ cần tạo 2 staging schema + grant ở mục C.
- Migration `006` hiện có bug tên role/schema — đây là code Dev sẽ tự fix, không phải việc DBA.

---

## F. Tiêu chí verify (DBA chạy sau grant; Dev connect lại kiểm tra thật)

```sql
-- Quyền account ghi
SELECT has_schema_privilege('gitlabanalyticswrite','gitlab_raw','USAGE')          AS raw_usage,
       has_schema_privilege('gitlabanalyticswrite','gitlab_raw','CREATE')         AS raw_create,
       has_schema_privilege('gitlabanalyticswrite','gitlab_raw_staging','CREATE') AS raw_stg_create,
       has_schema_privilege('gitlabanalyticswrite','gitlab_kpi','CREATE')         AS kpi_create,
       has_schema_privilege('gitlabanalyticswrite','gitlab_kpi_staging','CREATE') AS kpi_stg_create;
-- Kỳ vọng: tất cả = true

-- Quyền account đọc
SELECT has_schema_privilege('gitlabanalyticsread','gitlab_kpi','USAGE') AS kpi_usage;
-- Kỳ vọng: true
```

**Định nghĩa "done":** 5 cột write = `true`, `kpi_usage` read = `true`, `\dn` liệt kê đủ 4 schema (`gitlab_raw`, `gitlab_raw_staging`, `gitlab_kpi`, `gitlab_kpi_staging`).
