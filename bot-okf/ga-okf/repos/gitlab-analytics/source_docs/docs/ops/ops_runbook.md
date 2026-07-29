# Ops Runbook — Pipeline Triage & Incident Response
> ENG-ANA-001 | v1.0 | Cập nhật: 2026-03-28
>
> Dành cho: người vận hành pipeline (DevOps / QA Lead / Engineering Manager)

---

## Mục lục
1. [Triage nhanh — pipeline đang ở trạng thái nào?](#1-triage-nhanh)
2. [Stage 1 — Extraction (GitLab → gitlab_raw)](#2-stage-1--extraction)
3. [Stage 2 — Transform (dbt → gitlab_kpi)](#3-stage-2--transform)
4. [Stage 3 — Alerting (gitlab_kpi → Slack)](#4-stage-3--alerting)
5. [Stage 4 — Webhook (real-time path)](#5-stage-4--webhook)
6. [Decision tree — có retry được không?](#6-decision-tree--retry)
7. [Lệnh vận hành nhanh](#7-lệnh-vận-hành-nhanh)
8. [Metabase RBAC — quản lý user & permission](#8-metabase-rbac)
   - 8.1 Groups + matrix · 8.2 Apply lần đầu · 8.3 Thêm user · 8.4 Đổi quyền
   - 8.5 Disable user · 8.6 Sửa matrix · 8.7 Verify · 8.8 Gotchas
   - 8.9 Cleanup · 8.10 Bảo mật

---

## 1. Triage nhanh

**Chạy lệnh này đầu tiên** — cho biết pipeline đang lành hay đang chết:

```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT
    key,
    value,
    updated_at::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh' AS updated_local
FROM gitlab_raw.pipeline_state
WHERE key IN (
    'last_successful_run',
    'consecutive_failures',
    'last_failure',
    'last_mr_updated_at',
    'last_commit_date',
    'last_pipeline_updated_at'
)
ORDER BY key;
"
```

**Đọc kết quả:**

| `consecutive_failures` | Trạng thái | Hành động |
|---|---|---|
| `0` | Lành | Kiểm tra `last_successful_run` có trong 24h không |
| `1–2` | Đang retry | Theo dõi, chờ run tiếp theo |
| `3+` | **BLOCKED** | Healer đã bỏ cuộc — cần can thiệp thủ công ngay |

**Kiểm tra data có fresh không:**

```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT * FROM gitlab_kpi.v_data_freshness;
"
```

Nếu `mr_lag_hours > 2` → extraction chưa chạy hoặc bị stuck.

---

## 2. Stage 1 — Extraction

### Luồng xử lý

```
[Checkpoint] → [Auth GitLab] → [List MRs page 1..N] → [Single MR detail]
                                                     → [Write checkpoint]
                             → [Commits page 1..N]   → [Write checkpoint]
                             → [Pipelines page 1..N] → [Write checkpoint]
                             → [dlt UPSERT → gitlab_raw]
```

### 2.1 Bước 1 — Auth fail

**Triệu chứng:**
```
ERROR Authentication failed: 401 Client Error: Unauthorized
sys.exit(1)
```

**Chẩn đoán:**
```bash
# Kiểm tra token có được set không
echo $GITLAB_TOKEN | head -c 10  # chỉ xem 10 ký tự đầu

# Test token trực tiếp
curl -s -o /dev/null -w "%{http_code}" \
  -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "$GITLAB_URL/api/v4/user"
# Expect: 200 | 401 = token sai | 403 = token hết scope
```

**Nguyên nhân & fix:**

| HTTP code | Nguyên nhân | Fix |
|---|---|---|
| `401` | Token sai hoặc revoked | Tạo lại Group Access Token, update env var |
| `403` | Token thiếu scope `read_api` | Tạo lại token với đúng scope |
| `000` | Không kết nối được GitLab server | Kiểm tra network, VPN, `$GITLAB_URL` đúng chưa |

**Retry được không:** Không tự retry — phải fix token trước, sau đó chạy lại thủ công:
```bash
python -m src.extraction.pipeline
```

---

### 2.2 Bước 2 — Rate limit (429)

**Triệu chứng:**
```
WARNING Rate limited — waiting 60s
```

**Hành vi tự động:** Client tự đọc `Retry-After` header và sleep. **Không cần can thiệp.**

**Nếu bị rate limit liên tục (>5 lần/run):**
```bash
# Tăng delay giữa các page (cần sửa client.py nếu muốn permanent fix)
# Tạm thời: chạy ít source hơn
python -m src.extraction.pipeline --source mr --since-days 3
```

---

### 2.3 Bước 3 — DB connection fail (dlt không write được)

**Triệu chứng:**
```
ERROR Pipeline failed: could not connect to server: Connection refused
```

**Chẩn đoán:**
```bash
# Kiểm tra container đang chạy không
docker ps | grep gitlab_analytics_db

# Kiểm tra DB có accept connections không
docker exec gitlab_analytics_db pg_isready -U analytics -d gitlab_analytics

# Kiểm tra DATABASE_URL đúng không
echo $DATABASE_URL  # phải có format: postgresql://user:pass@host:5432/dbname

# dlt dùng biến riêng — kiểm tra bridge env var
echo $DESTINATION__POSTGRES__CREDENTIALS
```

**Fix:**
```bash
# Nếu container chết
docker compose up -d postgres

# Đợi ready rồi chạy lại
docker exec gitlab_analytics_db pg_isready -U analytics -d gitlab_analytics
python -m src.extraction.pipeline
```

**Retry được không:** Có, sau khi DB sống lại.

---

### 2.4 Bước 4 — dlt schema inference miss (cột bị null)

**Triệu chứng:** Extraction thành công nhưng một số cột bị thiếu trong DB (ví dụ `coverage`, `finished_at`).

**Nguyên nhân:** dlt infer schema từ data lần đầu — nếu tất cả records có field đó = NULL, dlt không tạo cột.

**Chẩn đoán:**
```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "\d gitlab_raw.pipelines"
# Kiểm tra có đủ: finished_at, duration, coverage không
```

**Fix:** Chạy migration thủ công:
```bash
docker exec -i gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  < src/infra/db/migrations/004_pipelines_add_timing_coverage.sql
# Sau đó sync lại để fill data
python -m src.extraction.pipeline --source pipelines --since-days 7
```

**Retry được không:** Có, migration idempotent — chạy lại vô hại.

---

### 2.5 Bước 5 — Checkpoint bị corrupt / stale cursor

**Triệu chứng:** Pipeline luôn extract 0 rows dù GitLab có data mới.

**Chẩn đoán:**
```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT key, value FROM gitlab_raw.pipeline_state
WHERE key IN ('last_mr_updated_at','last_commit_date','last_pipeline_updated_at');
"
# Nếu cursor timestamp là tương lai → bị corrupt
```

**Fix — reset cursor về 7 ngày trước:**
```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
UPDATE gitlab_raw.pipeline_state
SET value = to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
    updated_at = NOW()
WHERE key IN ('last_mr_updated_at','last_commit_date','last_pipeline_updated_at');
"
# Hoặc dùng --backfill để bỏ qua checkpoint hoàn toàn
python -m src.extraction.pipeline --backfill --since-days 7
```

---

### 2.6 Bước 6 — Extraction partial fail (1 source die, 2 source sống)

**Triệu chứng:** `consecutive_failures = 1`, log thấy `commits` OK nhưng `pipelines` fail.

**Hành vi:** Pipeline toàn bộ fail nếu bất kỳ source nào exception. Checkpoint đã được ghi đến trang cuối thành công → run tiếp theo sẽ tiếp tục từ đó.

**Chạy lại chỉ source bị fail:**
```bash
python -m src.extraction.pipeline --source pipelines --since-days 7
```

---

## 3. Stage 2 — Transform

### Luồng xử lý

```
gitlab_raw.* → [dbt run] → staging.stg_* → [dbt run] → gitlab_kpi.v_*
```

### 3.1 dbt không chạy được

**Triệu chứng:**
```
dbt.exceptions.DbtRuntimeError: Could not find profile named 'gitlab_analytics'
```

**Chẩn đoán:**
```bash
# Kiểm tra profiles.yml tồn tại
cat ~/.dbt/profiles.yml

# Kiểm tra kết nối
cd src/transform && dbt debug
```

**Fix:**
```bash
# Tạo profiles.yml nếu chưa có (thay thế giá trị thật)
mkdir -p ~/.dbt && cat > ~/.dbt/profiles.yml << 'EOF'
gitlab_analytics:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: analytics
      password: <password>
      dbname: gitlab_analytics
      schema: staging
      threads: 4
EOF
cd src/transform && dbt debug
```

---

### 3.2 dbt model fail — SQL error

**Triệu chứng:**
```
Compilation Error in model v_mr_compliance
  relation "staging.stg_merge_requests" does not exist
```

**Chẩn đoán — xác định model nào fail:**
```bash
cd src/transform && dbt run 2>&1 | grep -E "ERROR|FAIL|error"
```

**Nguyên nhân phổ biến:**

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `relation does not exist` | Staging chưa được run trước mart | `dbt run --select staging` trước |
| `column does not exist` | Migration chưa chạy (ví dụ migration 004) | Chạy migration rồi re-run |
| `division by zero` | `NULLIF` bị thiếu trong SQL | Kiểm tra model SQL, dùng `NULLIF(col, 0)` |
| `permission denied` | User không có quyền | `GRANT SELECT ON ALL TABLES IN SCHEMA gitlab_raw TO analytics` |

**Fix theo thứ tự:**
```bash
cd src/transform

# Chạy staging trước, sau đó marts
dbt run --select staging
dbt run --select marts

# Hoặc chạy từng model để xác định model lỗi
dbt run --select v_mr_compliance
dbt run --select v_violations

# Kiểm tra test sau khi run
dbt test
```

**Retry được không:** Có, dbt run là idempotent (views được replace).

---

### 3.3a Migration có `CASCADE` → BẮT BUỘC full `dbt run`

**Triệu chứng:**

- Một số Metabase chart hiển thị "No results" / lỗi `relation "gitlab_kpi.v_xxx" does not exist`.
- `information_schema.tables` cho `gitlab_kpi` thiếu nhiều view so với expected (`33` models trong dbt project).
- Vừa apply migration có `DROP TABLE ... CASCADE` hoặc `ALTER ... CASCADE` trên bảng `gitlab_raw.*`.

**Nguyên nhân:**

`CASCADE` xoá luôn toàn bộ view phụ thuộc xuống đáy chuỗi. Nếu chỉ chạy `dbt run --select <model>` cho 1 nhánh, các view khác bị drop sẽ KHÔNG được tái tạo.

**Tiền lệ:** Migration `008_label_names_to_text.sql` đã CASCADE drop 14 view. Tới 2026-05-16 phát hiện collection A4/A5 trống vì `v_violations`, `v_compliance_violation_detail` chưa rebuild.

**Khôi phục:**

```bash
# Từ repo root (đảm bảo env vars DB_HOST/PORT/USER/PASSWORD/NAME đã export)
cd src/transform
dbt run --profiles-dir . --target prod    # đầy đủ 33 models, ~2-3 phút
dbt test --profiles-dir . --target prod   # verify sau khi rebuild
```

**Verify:**

```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT count(*) FROM information_schema.tables WHERE table_schema='gitlab_kpi';
"
# Expect: >= 25 (gitlab_kpi) — staging có thêm 8 view trong gitlab_kpi_staging
```

**Quy trình tránh tái diễn:**

1. Mọi migration có `CASCADE` → đặt note trong commit message + MR description: `requires full dbt run`.
2. Sau khi apply migration, BẮT BUỘC chạy `dbt run` không filter `--select`. Không skip dù chỉ "đụng 1 bảng" — `CASCADE` lan ra cả chuỗi.
3. CI job `dbt-transform` đã chạy full chain → nếu chỉ deploy migration mà chưa chờ CI tick lần kế, vẫn phải trigger thủ công.

---

### 3.3 dbt test fail — data quality

**Triệu chứng:**
```
FAIL 1 not_null_v_mr_compliance_id
FAIL 1 accepted_range_v_mr_compliance_compliance_score__0__100
```

**Chẩn đoán:**
```bash
cd src/transform && dbt test 2>&1 | grep FAIL

# Query trực tiếp để xem record nào bị lỗi
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT id, compliance_score, violations
FROM gitlab_kpi.v_mr_compliance
WHERE compliance_score IS NULL
   OR compliance_score < 0
   OR compliance_score > 100
LIMIT 10;
"
```

**Nguyên nhân phổ biến:** Raw data bị corrupt từ GitLab API (edge case). Không block dashboard nhưng cần investigate.

---

## 4. Stage 3 — Alerting

### Luồng xử lý

```
[Query v_violations 24h] → [Dedup vs alerted_mr_ids] → [POST Slack]
                                                      → [Write alerted_mr_ids checkpoint]
```

### 4.1 Slack không nhận được alert

**Chẩn đoán theo thứ tự:**

```bash
# 1. Kiểm tra env var có set không
echo $SLACK_WEBHOOK_URL | head -c 40  # 40 ký tự đầu

# 2. Test webhook trực tiếp
curl -s -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test từ runbook — có thể xoá"}'
# Expect: "ok"

# 3. Kiểm tra có violations nào trong 24h không
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT COUNT(*) FROM gitlab_kpi.v_violations
WHERE merged_at > NOW() - INTERVAL '24 hours'
   OR (merged_at IS NULL AND state = 'opened' AND created_at > NOW() - INTERVAL '24 hours');
"
# Nếu = 0 → không có gì để alert, bình thường
```

**4.2 Alert bị duplicate / không gửi dù có violations:**

```bash
# Xem danh sách MR đã alert
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'alerted_mr_ids';
"
# Nếu MR ID mày cần alert đã nằm trong list này → bị dedup

# Reset dedup list nếu cần alert lại
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
UPDATE gitlab_raw.pipeline_state SET value = '[]' WHERE key = 'alerted_mr_ids';
"
# Sau đó chạy lại alerter
python -m src.alerting.compliance_alert
```

---

## 5. Stage 4 — Webhook (real-time path)

### 5.1 Webhook không nhận events

**Chẩn đoán:**
```bash
# Kiểm tra FastAPI đang chạy không
docker ps | grep webhook  # hoặc xem process
curl -s http://localhost:8000/health  # endpoint health check nếu có

# Xem log webhook
docker logs <webhook_container> --tail 50
```

### 5.2 Events vào DLQ (dead-letter queue)

**Triệu chứng:** Data real-time bị delay hoặc thiếu.

```bash
# Đếm events đang nằm trong DLQ
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT event_type, COUNT(*), MAX(failed_at) AS latest_fail
FROM gitlab_raw.webhook_dlq
WHERE replayed = FALSE
GROUP BY event_type
ORDER BY COUNT(*) DESC;
"
```

**Xem lý do fail:**
```bash
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
SELECT event_type, error_message, retry_count, failed_at
FROM gitlab_raw.webhook_dlq
WHERE replayed = FALSE
ORDER BY failed_at DESC
LIMIT 10;
"
```

**Fix và replay:**
```bash
# Sau khi fix nguyên nhân (ví dụ DB down), đánh dấu để replay
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
UPDATE gitlab_raw.webhook_dlq
SET replayed = TRUE, replayed_at = NOW()
WHERE replayed = FALSE
  AND failed_at > NOW() - INTERVAL '1 hour';
-- Cẩn thận: đây chỉ mark là đã replay, không tự động re-process
-- Cần trigger lại webhook processor nếu có
"
```

---

## 6. Decision tree — Retry

```
Pipeline fail
│
├─► consecutive_failures = 1 hoặc 2
│     → Healer tự retry trong lần run tiếp theo
│     → Không cần làm gì, theo dõi thêm 1 run
│
├─► consecutive_failures >= 3 (BLOCKED)
│     → Healer đã bỏ cuộc, đã gửi Slack alert
│     → Phải can thiệp thủ công:
│       1. Đọc last_failure trong pipeline_state (xem nguyên nhân)
│       2. Fix nguyên nhân (xem section 2.x bên trên)
│       3. Reset failure count:
│          UPDATE gitlab_raw.pipeline_state
│          SET value = '0' WHERE key = 'consecutive_failures';
│       4. Chạy lại: python -m src.extraction.pipeline
│
├─► consecutive_failures = 0 nhưng data stale (lag > 24h)
│     → Pipeline chưa được schedule chạy (CI job bị tắt?)
│     → Chạy thủ công: python -m src.extraction.pipeline
│
└─► Row counts = 0 trong DB
      → Extract thành công nhưng GitLab không có data trong window
      → Thử mở rộng window:
         python -m src.extraction.pipeline --since-days 30
```

**Bảng quyết định retry nhanh:**

| Lỗi | Tự retry? | Retry thủ công? | Cần fix trước? |
|---|---|---|---|
| Rate limit 429 | Có (client tự sleep) | Không cần | Không |
| Network timeout | Có (urllib3 retry 3 lần) | Nếu vẫn fail | Kiểm tra network |
| Auth 401 | Không | Sau khi fix token | Tạo lại token |
| DB down | Không | Sau khi DB sống lại | `docker compose up -d postgres` |
| dlt schema miss | Không | Sau migration | Chạy migration |
| dbt SQL error | Không | Sau khi fix SQL | Fix model / migration |
| Checkpoint corrupt | Không | Sau khi reset cursor | Reset hoặc `--backfill` |
| Slack webhook fail | Không | Sau khi fix webhook URL | Kiểm tra Slack app |
| consecutive_failures >= 3 | Không | Sau khi fix nguyên nhân | Reset counter |

---

## 7. Lệnh vận hành nhanh

```bash
# ── TRIAGE ─────────────────────────────────────────────────────────────────
# Xem trạng thái pipeline
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "SELECT key, value, updated_at FROM gitlab_raw.pipeline_state ORDER BY key;"

# Xem data freshness
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "SELECT * FROM gitlab_kpi.v_data_freshness;"

# Đếm violations hiện tại
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "SELECT COUNT(*) FROM gitlab_kpi.v_violations;"

# ── EXTRACTION ──────────────────────────────────────────────────────────────
# Chạy full sync 7 ngày
python -m src.extraction.pipeline

# Chạy 1 source
python -m src.extraction.pipeline --source mr
python -m src.extraction.pipeline --source commits
python -m src.extraction.pipeline --source pipelines

# Backfill (bỏ qua checkpoint)
python -m src.extraction.pipeline --backfill --since-days 30

# Reset failure counter
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "UPDATE gitlab_raw.pipeline_state SET value='0' WHERE key='consecutive_failures';"

# Reset cursor về 7 ngày trước
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "
UPDATE gitlab_raw.pipeline_state
SET value = to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
WHERE key IN ('last_mr_updated_at','last_commit_date','last_pipeline_updated_at');"

# ── TRANSFORM ───────────────────────────────────────────────────────────────
cd src/transform
dbt run                          # chạy tất cả
dbt run --select staging         # chỉ staging
dbt run --select marts           # chỉ marts
dbt run --select v_mr_compliance # chỉ 1 model
dbt test                         # chạy data tests

# ── ALERTING ────────────────────────────────────────────────────────────────
python -m src.alerting.compliance_alert

# Reset dedup list (để alert lại)
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  -c "UPDATE gitlab_raw.pipeline_state SET value='[]' WHERE key='alerted_mr_ids';"

# ── MIGRATION ───────────────────────────────────────────────────────────────
# Chạy migration 004 (idempotent)
docker exec -i gitlab_analytics_db psql -U analytics -d gitlab_analytics \
  < src/infra/db/migrations/004_pipelines_add_timing_coverage.sql

# Verify toàn bộ
bash src/infra/db/scripts/verify_migration_004.sh

# ── DOCKER ──────────────────────────────────────────────────────────────────
docker compose up -d             # khởi động toàn bộ
docker compose up -d postgres    # chỉ DB
docker logs gitlab_analytics_db --tail 50
docker exec gitlab_analytics_db pg_isready -U analytics -d gitlab_analytics
```

---

## 8. Metabase RBAC

Hệ thống dùng **Metabase OSS native auth** (email + password) + **permission groups**.
Không có SSO/OIDC/SAML (cần Metabase Pro). Config nguồn: `src/metabase/rbac.yaml`
(gitignored — copy từ `rbac.example.yaml`).

### 8.1 Groups + permission matrix

| Collection | qa | engineering_manager | dev | ops_sre | leadership |
|---|---|---|---|---|---|
| A — OPS HEALTH | read | read | read | **write** | read |
| B — QA COMPLIANCE | **write** | read | read | none | read |
| C — ENGINEERING MGMT | read | **write** | read | none | read |
| D — DEEP DIVE | read | read | read | read | none |
| E — FORMULA TRANSPARENCY | read | read | none | none | none |
| F — KPI CONTROL PANEL | read | read | none | none | read |

`read` = xem dashboard, `write` = xem + edit card/dashboard, `none` = không thấy collection.

Data-permission: chỉ `gitlab_kpi` schema truy vấn được, `gitlab_raw` block hoàn toàn
(payload thô + PII, không expose qua Metabase).

### 8.2 Quy trình apply RBAC lần đầu

```bash
# 1. Tạo rbac.yaml từ template
cp src/metabase/rbac.example.yaml src/metabase/rbac.yaml

# 2. Điền email + first/last name thật vào rbac.yaml
$EDITOR src/metabase/rbac.yaml

# 3. (Tùy chọn) set init password chung cho tất cả user mới
export METABASE_INIT_PASSWORD='Welcome@2026'   # bỏ qua → script auto-gen random per user

# 4. Apply
python -m src.metabase.setup_dashboards --rbac-only
```

Script idempotent — chạy lại sẽ skip group/user đã tồn tại, chỉ update permission graph.

Log sẽ in temp password cho user mới (nếu `METABASE_INIT_PASSWORD` không set):
```
Created user: qa.manager@example.com id=12
  Temp password (forward to user): xK9vP3-aBcD2eF
```
Forward password riêng cho từng user qua kênh secure (1Password, Signal). User
đăng nhập lần đầu → đổi password ở Account Settings.

### 8.3 Thêm 1 user mới

```bash
# 1. Append vào rbac.yaml users:
#    - email: new.dev@fpt.com
#      first_name: New
#      last_name: Dev
#      groups: [dev]

# 2. Apply (idempotent — chỉ thêm user mới)
python -m src.metabase.setup_dashboards --rbac-only

# 3. Forward temp password cho user
```

### 8.4 Đổi quyền 1 user (group khác)

Edit `rbac.yaml`, đổi `groups: [dev]` → `groups: [engineering_manager]`, rerun.
Script reconcile membership tự động (add group mới, không remove group khác — cần
revoke thủ công qua UI nếu muốn).

### 8.5 Disable / remove user

Metabase **không xóa hẳn user** (giữ audit log). Vào Admin → People → user → **Deactivate**.
User sẽ không login được nhưng card/dashboard họ tạo vẫn còn.

### 8.6 Sửa permission matrix

Edit `collections:` block trong `rbac.yaml`, rerun `--rbac-only`. Hiệu lực ngay.

### 8.7 Verify

```bash
# Lấy session token (admin login)
SESSION=$(curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"username\":\"$METABASE_USER\",\"password\":\"$METABASE_PASSWORD\"}" \
  "$METABASE_URL/api/session" | jq -r '.id')

# List groups + member count (kỳ vọng: 5 custom + 2 built-in)
curl -s -H "X-Metabase-Session: $SESSION" "$METABASE_URL/api/permissions/group" | jq

# Xem collection permission graph (6 collection × 5 group = 30 cells)
curl -s -H "X-Metabase-Session: $SESSION" "$METABASE_URL/api/collection/graph" | jq '.groups'

# Verify membership 1 user cụ thể
curl -s -H "X-Metabase-Session: $SESSION" "$METABASE_URL/api/user/{user_id}" \
  | jq '.user_group_memberships'
# Kỳ vọng: [{"id":1}, {"id":<group_id>}] — luôn có id=1 (All Users)
```

Hoặc UI: **Admin → Permissions → Collections** — kiểm tra matrix.

### 8.8 Gotchas (kinh nghiệm thực tế)

- **Metabase v0.50+ bắt buộc `All Users` (id=1) trong `user_group_memberships`**
  khi gọi `POST /api/user`. Nếu thiếu → trả 400 với body
  `"Bạn không thể thêm hoặc xóa user vào/ra khỏi nhóm 'Tất cả người dùng'"`.
  Script đã auto-merge `{1}` vào membership — chỉ cần biết khi tự gọi API thủ công.
- **`GET /api/user` list endpoint KHÔNG trả memberships** — luôn `[]` trong list
  response. Phải gọi `GET /api/user/:id` (single) để xem groups thật của user.
  Đây là thiết kế của Metabase, không phải bug.
- **Data-permission graph schema khác nhau giữa versions** (v0.45 vs v0.50+).
  Code có try/except + log.warning fallback. Nếu PUT bị reject → vào Admin →
  Permissions → Data → set thủ công cho mỗi group.
- **Đã test smoke trên Metabase v0.59.4.2** với 5 group + 5 user `@example.com` —
  PASS. Permission matrix khớp 100% với design.

### 8.9 Cleanup test users / reset trạng thái

Sau khi smoke test (5 fake `@example.com` user) — muốn xoá để dọn UI:

```bash
SESSION=...  # admin token

# Deactivate (Metabase không xoá hẳn, giữ audit log)
for uid in 7 8 9 10 11; do
  curl -s -X DELETE -H "X-Metabase-Session: $SESSION" \
    "$METABASE_URL/api/user/$uid"
done

# Xoá group (chỉ làm nếu chắc chắn — kéo theo mất hết perm graph)
for gid in 5 6 7 8 9; do
  curl -s -X DELETE -H "X-Metabase-Session: $SESSION" \
    "$METABASE_URL/api/permissions/group/$gid"
done
```

Hoặc dùng UI: **Admin → People → user → Deactivate**.

### 8.10 Lưu ý bảo mật

- `rbac.yaml` chứa email + có thể chứa init password → KHÔNG commit (đã gitignore).
- Set `METABASE_INIT_PASSWORD` chỉ qua env, không hardcode trong file.
- Temp password trong log → clear log sau khi forward cho user.
- Default `password_complexity` trong Metabase yếu — bật **strong password** ở
  Admin → Settings → Authentication.
- Sau khi user login lần đầu, **bắt buộc đổi password** ở Account Settings.
- Block schema `gitlab_raw` (raw GitLab payload + reviewer email) — đã enforce
  trong `rbac.example.yaml.data_permissions.blocked_schemas`. Verify định kỳ.

---

## 9. k8s CronJob ops

> ETL runtime đã chuyển từ GitLab CI scheduled jobs sang k8s CronJobs
> (2026-05-26). Section này là runbook day-2 cho operator. Setup ban đầu
> xem `docs/ops/DEPLOYMENT.md` §2.4 + §3 Phase 5.

### 9.1 Xem trạng thái

```bash
# Tổng quan 3 CronJob
kubectl -n gitlab-analytics get cronjobs
# Expect: etl-daily-pipeline, etl-retention, etl-dbt-full-refresh

# Last + next schedule per CronJob
kubectl -n gitlab-analytics describe cronjob etl-daily-pipeline | grep -E '(Schedule|Last Schedule|Active|Suspend)'

# Job objects gần đây (success + fail giữ theo history limits)
kubectl -n gitlab-analytics get jobs --sort-by=.metadata.creationTimestamp
```

### 9.2 Xem log run cụ thể

```bash
# Tên job theo pattern <cronjob>-<unix-ts>
JOB=$(kubectl -n gitlab-analytics get jobs -l job=daily-pipeline \
  --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}')

# Log container etl trong pod của job
kubectl -n gitlab-analytics logs job/$JOB -c etl --tail=200

# Hoặc follow real-time nếu job đang chạy
kubectl -n gitlab-analytics logs -f job/$JOB -c etl
```

Log structure (mirror old CI job log + step markers từ `etl_entrypoint.sh`):
- `[ts] starting JOB_NAME=...`
- `[ts] step 1/3 — extract` (chỉ daily-pipeline)
- `[ts] step 2/3 — dbt transform + test`
- `[ts] step 3/3 — compliance alert`
- `[ts] DONE JOB_NAME=...`

### 9.3 Trigger ad-hoc run (giống `Play ▶` trong GitLab CI cũ)

```bash
# Daily pipeline — extract + dbt + alert ngay, không chờ 02:00
kubectl -n gitlab-analytics create job ad-hoc-$(date +%s) \
  --from=cronjob/etl-daily-pipeline

# Retention — không chờ Chủ nhật
kubectl -n gitlab-analytics create job retention-manual-$(date +%s) \
  --from=cronjob/etl-retention

# Monthly full-refresh — chạy mid-month
kubectl -n gitlab-analytics create job full-refresh-manual-$(date +%s) \
  --from=cronjob/etl-dbt-full-refresh
```

Job sau khi tạo sẽ kế thừa toàn bộ spec từ CronJob (image, env, resources, backoffLimit). Theo dõi log theo §9.2.

### 9.4 Pause CronJob (e.g. trong maintenance window)

```bash
# Suspend 1 CronJob
kubectl -n gitlab-analytics patch cronjob etl-daily-pipeline \
  -p '{"spec":{"suspend":true}}'

# Suspend cả 3
for cj in etl-daily-pipeline etl-retention etl-dbt-full-refresh; do
  kubectl -n gitlab-analytics patch cronjob $cj -p '{"spec":{"suspend":true}}'
done

# Resume
kubectl -n gitlab-analytics patch cronjob etl-daily-pipeline \
  -p '{"spec":{"suspend":false}}'
```

Khi suspend, scheduled run không trigger. Job đang chạy KHÔNG bị abort — `kubectl delete job <name>` để dừng.

### 9.5 Kill job đang chạy

```bash
# Liệt kê active
kubectl -n gitlab-analytics get jobs --field-selector status.successful!=1

# Delete — terminate ngay
kubectl -n gitlab-analytics delete job <job-name>
```

Sau delete: nếu source CronJob có `concurrencyPolicy: Forbid` (default in our setup), lần schedule tiếp theo sẽ chạy bình thường vì không còn active job nào.

### 9.6 Roll back image to previous SHA

Khi commit mới làm hỏng pipeline (vd. extract crash) — patch CronJob image về SHA trước đó **không cần redeploy CI**:

```bash
# Lấy SHA hiện tại
kubectl -n gitlab-analytics get cronjob etl-daily-pipeline \
  -o jsonpath='{.spec.jobTemplate.spec.template.spec.containers[0].image}'
# → registry.gitlab.com/.../etl:<current-sha>

# Patch về SHA cũ
for cj in etl-daily-pipeline etl-retention etl-dbt-full-refresh; do
  kubectl -n gitlab-analytics set image cronjob/$cj \
    etl=<registry>/etl:<previous-good-sha>
done

# Verify
kubectl -n gitlab-analytics get cronjobs -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.jobTemplate.spec.template.spec.containers[0].image}{"\n"}{end}'
```

⚠️ Patch này KHÔNG sync với git. Workflow đúng: revert commit + push → CI rebuild + redeploy → image quay về SHA của HEAD. Patch chỉ là quick mitigation. Xem `DEPLOYMENT.md` §4.1.

### 9.7 Update ConfigMap (vd. đổi `SINCE_DAYS`)

```bash
# Edit live
kubectl -n gitlab-analytics edit configmap gitlab-analytics-config

# Hoặc edit file + apply
vi deploy/k8s/configmap.yaml
kubectl apply -f deploy/k8s/configmap.yaml

# Lưu ý: pod đang chạy KHÔNG tự pickup — phải đợi job kế tiếp khởi pod mới.
# Để force, kill job hiện tại (9.5) + trigger ad-hoc (9.3).
```

Commit changes vào git để source-of-truth khớp cluster — đợt deploy kế tiếp `kubectl apply -k` sẽ idempotent.

### 9.8 Rotate Secret values

Secret `gitlab-analytics-secrets` materialized từ Vault qua ExternalSecret CR
(`deploy/k8s/externalsecret.yaml`) — DevOps Q3 confirm 2026-05-27.
Job `deploy:k8s-secrets` đã bị remove khỏi `.gitlab-ci.yml` (2026-05-28).

**Canonical rotate flow** (operator → Vault → ESO reconcile → Pod restart):

```bash
# 1. Update value trong Vault (operator hoặc Vault UI)
vault kv put secret/gitlab-analytics/gitlab_token value="$NEW_TOKEN"
vault kv put secret/gitlab-analytics/database_url value="$NEW_URL"
vault kv put secret/gitlab-analytics/db_password  value="$NEW_PW"
vault kv put secret/gitlab-analytics/slack_webhook_url value="$NEW_HOOK"

# 2. Force ESO reconcile ngay (mặc định mỗi 1h theo refreshInterval)
kubectl -n gitlab-analytics annotate externalsecret/gitlab-analytics-secrets \
  force-sync=$(date +%s) --overwrite

# 3. Verify Secret value mới đã land trong k8s
kubectl -n gitlab-analytics get secret gitlab-analytics-secrets \
  -o jsonpath='{.data.GITLAB_TOKEN}' | base64 -d

# 4. Pod kế tiếp pickup giá trị mới (Secret mount = read on container start).
#    Pod đang chạy KHÔNG tự pickup — đợi run kế tiếp hoặc force restart:
kubectl -n gitlab-analytics delete pod -l job-name=<active-job>   # nếu cần
```

**Local Vault stand-in** (development): `src/infra/argocd/eso/README.md`
mô tả ClusterSecretStore `vault-backend` + auth Token. Production swap = đổi
`auth.tokenSecretRef` hoặc upgrade lên `auth.kubernetes` (DevOps Q3 sub-Q b).

**Emergency fallback** (Vault down, cần unblock pod ngay):

```bash
# Tạm thời tạo Secret thủ công, ghi đè ExternalSecret-managed Secret.
# ESO sẽ overwrite lại ở vòng reconcile tiếp theo — đây CHỈ là patch tức thì.
kubectl -n gitlab-analytics create secret generic gitlab-analytics-secrets \
  --from-literal=GITLAB_TOKEN="$NEW_TOKEN" \
  --from-literal=DATABASE_URL="$NEW_URL" \
  --from-literal=DB_PASSWORD="$NEW_PW" \
  --from-literal=SLACK_WEBHOOK_URL="$NEW_HOOK" \
  --dry-run=client -o yaml | kubectl apply -f -
# Suspend ExternalSecret để tránh ESO overwrite trong lúc xử lý Vault:
kubectl -n gitlab-analytics patch externalsecret gitlab-analytics-secrets \
  --type=merge -p '{"spec":{"refreshInterval":"0"}}'
# Sau khi Vault recovery: revert refreshInterval về "1h" + annotate force-sync.
```

### 9.9 Triage decision tree

```
Job FAILED → kubectl logs <job>
├── Exit 1, traceback Python      → cùng cause như CI cũ — xem §1-§5 + §6
├── Exit 137 (OOMKilled)          → tăng `resources.limits.memory` trong manifest
├── Exit 143 (SIGTERM)            → activeDeadlineSeconds bị vượt, tăng cap
├── ImagePullBackOff               → registry auth (xem imagePullSecrets §2.4)
├── CrashLoopBackOff               → backoffLimit=2 đã hết retry → check entrypoint
└── Job stuck Active 24h+         → kubectl delete job + investigate
```

Slack alert tự động: `etl_entrypoint.sh` có ERR trap gửi message
`":rotating_light: ETL CronJob failed — job=X exit=N ..."` ngay khi script
exit non-zero. Cluster-side monitoring (Prometheus `kube_job_failed`) là
second-layer defence.

### 9.10 Đối chiếu với old CI

Tất cả manual ops job đã migrate khỏi `.gitlab-ci.yml` (2026-05-28). CI hiện
chỉ còn 2 job: `unit-tests` + `build:etl-image`. Mọi ops triggered ad-hoc
qua `kubectl create job --from=cronjob/...` — recipes trong §9.12.

| Old `.gitlab-ci.yml` job | New k8s artefact | Trigger |
|---|---|---|
| `extract-pipeline` (sched) | `etl-daily-pipeline` step 1/3 | cron `0 2 * * *` |
| `dbt-transform` (sched) | `etl-daily-pipeline` step 2/3 | cron `0 2 * * *` |
| `compliance-alert` (sched) | `etl-daily-pipeline` step 3/3 | cron `0 2 * * *` |
| `ops:retention` | `etl-retention` CronJob | cron `0 3 * * 0` |
| `ops:dbt-full-refresh` | `etl-dbt-full-refresh` CronJob | cron `0 4 1 * *` |
| `ops:triage` | `etl-ops-triage` CronJob (suspended) | manual (§9.12) |
| `ops:extract` | `etl-ops-extract` CronJob (suspended) | manual (§9.12) |
| `ops:extract-backfill` | `etl-ops-extract-backfill` CronJob (suspended) | manual (§9.12) |
| `ops:dbt-run` | `etl-ops-dbt-run` CronJob (suspended) | manual (§9.12) |
| `ops:reset-failures` | `etl-ops-reset-failures` CronJob (suspended) | manual (§9.12) |
| `ops:reset-cursors` | `etl-ops-reset-cursors` CronJob (suspended) | manual (§9.12) |
| `ops:migration-004` | `etl-ops-migration-004` CronJob (suspended) | manual (§9.12) |
| `ops:migration-005` | `etl-ops-migration-005` CronJob (suspended) | manual (§9.12) |
| `ops:p4-cutover` | `etl-ops-p4-cutover` CronJob (suspended) | manual (§9.12) |
| `ops:setup-metabase` | `etl-ops-setup-metabase` CronJob (suspended) | manual (§9.12) |
| `unit-tests` | unchanged — CI on push/MR | event-driven |
| `build:etl-image` | builds image used by ALL CronJobs | CI on push to main |
| ~~`deploy:k8s-secrets`~~ | **removed** — ExternalSecret CR + ESO + Vault (§9.8) | n/a |
| ~~`deploy:k8s-manifests`~~ | **removed** — Argo CD Application reconciles `deploy/k8s/` | n/a |

### 9.11 Local smoke test trên Docker Desktop

Mục đích: validate manifests + entrypoint chạy đúng trên máy DevOps trước khi đẩy lên cluster prod. KHÔNG dùng làm prod runtime.

**9.11.1 Prerequisites (one-time)**

```bash
# 1. Docker Desktop → Settings → Kubernetes → Enable Kubernetes (đợi green)
# 2. Verify context + version
kubectl config use-context docker-desktop
kubectl version --short
#   Expected Server: v1.27+   (cần cho timeZone field native trong CronJob spec)
#   Nếu < 1.27: update Docker Desktop, hoặc tạm xóa `timeZone:` trong 3 CronJob YAMLs

# 3. Verify kustomize installed (Docker Desktop bundle thường có sẵn)
kubectl kustomize --help >/dev/null && echo "kustomize OK"
```

**9.11.2 Build image local (no registry push)**

Docker Desktop share Docker daemon với k8s nên image build local k8s thấy ngay — không cần push registry.

```bash
docker build -t etl:dev -f src/infra/Dockerfile.etl .
docker images | grep etl
#   etl  dev  ...  ~400MB
```

**9.11.3 Bootstrap namespace + ServiceAccount + ConfigMap**

```bash
kubectl apply -f deploy/k8s/namespace.yaml
kubectl apply -f deploy/k8s/serviceaccount.yaml
```

Edit `deploy/k8s/configmap.yaml` (hoặc tạo overlay) — thay REPLACE_ME bằng giá trị local:

```yaml
data:
  GITLAB_URL: "https://git.fpt.net"        # hoặc gitlab thật
  GITLAB_GROUP_ID: "1234"                  # group ID test
  SINCE_DAYS: "1"                          # short window cho smoke
  DB_HOST: "host.docker.internal"          # ← KEY: trỏ về Postgres trên host
  DB_PORT: "5432"
  DB_USER: "gitlab_analytics"
  DB_NAME: "gitlab_analytics_dev"
```

```bash
kubectl apply -f deploy/k8s/configmap.yaml
```

**9.11.4 Tạo Secret thủ công (KHÔNG commit file đã fill)**

```bash
kubectl -n gitlab-analytics create secret generic gitlab-analytics-secrets \
  --from-literal=GITLAB_TOKEN="glpat-xxxxxxxxxxxx" \
  --from-literal=DATABASE_URL="postgresql://gitlab_analytics:DEVPW@host.docker.internal:5432/gitlab_analytics_dev" \
  --from-literal=DB_PASSWORD="DEVPW" \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../xxx"
```

Tip: nếu chưa muốn spam Slack thật, dùng webhook test endpoint hoặc `https://webhook.site/<random-uuid>` để xem payload.

**9.11.5 Apply manifests với image override local**

Đừng đổi `kustomization.yaml` checked-in. Override tạm thời:

```bash
cd deploy/k8s
# Override image về local tag, KHÔNG commit
kustomize edit set image etl=etl:dev
kustomize build . | kubectl apply -f -
cd ../..

# Revert ngay sau khi smoke xong (tránh leak vào commit):
cd deploy/k8s && git checkout kustomization.yaml && cd ../..
```

Verify:

```bash
kubectl get cronjobs -n gitlab-analytics
#   NAME                      SCHEDULE      SUSPEND   ACTIVE
#   etl-daily-pipeline        0 2 * * *     False     0
#   etl-retention             0 3 * * 0     False     0
#   etl-dbt-full-refresh      0 4 1 * *     False     0
```

**9.11.6 Trigger ad-hoc Job (không đợi cron)**

```bash
kubectl create job smoke-1 \
  --from=cronjob/etl-daily-pipeline \
  -n gitlab-analytics

# Tail logs (job tạo 1 pod — đợi pod scheduled ~5-15s)
kubectl wait --for=condition=Ready pod -l job-name=smoke-1 -n gitlab-analytics --timeout=60s
kubectl logs -f -l job-name=smoke-1 -n gitlab-analytics

# Hoặc chờ tới khi xong:
kubectl wait --for=condition=Complete job/smoke-1 -n gitlab-analytics --timeout=2h
kubectl logs job/smoke-1 -n gitlab-analytics --tail=200
```

**Pass criteria:**
- Job status = `Complete` (không phải `Failed`)
- Logs có 3 phase: `[extract]`, `[transform]`, `[alert]` chạy tuần tự, mỗi phase exit 0
- Postgres host (host.docker.internal) có data mới trong `gitlab_raw.merge_requests`
- (Nếu webhook.site) thấy Slack-format payload đến — không phải ERR trap notification

**9.11.7 Smoke test 2 CronJob còn lại**

```bash
# Retention (an toàn — chỉ delete rows > retention window)
kubectl create job smoke-retention --from=cronjob/etl-retention -n gitlab-analytics
kubectl wait --for=condition=Complete job/smoke-retention -n gitlab-analytics --timeout=30m

# Full-refresh (chạy lâu — tùy data size; có thể skip nếu chỉ test entrypoint dispatch)
kubectl create job smoke-fullref --from=cronjob/etl-dbt-full-refresh -n gitlab-analytics
kubectl logs -f -l job-name=smoke-fullref -n gitlab-analytics
```

**9.11.8 Cleanup**

```bash
# Xóa Job + Pod ad-hoc
kubectl delete job smoke-1 smoke-retention smoke-fullref -n gitlab-analytics --ignore-not-found

# Hoặc nuke toàn bộ namespace (về sạch trước khi đẩy prod thật)
kubectl delete namespace gitlab-analytics

# Xóa image local
docker rmi etl:dev
```

**9.11.9 Gotchas Docker Desktop**

| Triệu chứng | Cause / Fix |
|---|---|
| `ErrImagePull: etl:dev not found` | `imagePullPolicy` đã đổi thành `Always` ở manifest — set lại `IfNotPresent` hoặc `Never`. Hoặc build chưa xong / sai tag. |
| Pod ready nhưng exit 1 `connection refused 127.0.0.1:5432` | DB_HOST phải là `host.docker.internal`, không phải `localhost` (localhost = trong pod). |
| Job pending mãi `0/1 nodes available: insufficient cpu` | Docker Desktop default ~2 CPU. Giảm `resources.requests.cpu` trong CronJob hoặc tăng Docker Desktop resources (Settings → Resources). |
| `timeZone` field bị reject | k8s server < 1.27. Update Docker Desktop hoặc xóa tạm `timeZone:` (CronJob sẽ chạy theo UTC). |
| ERR trap không gửi Slack | `SLACK_WEBHOOK_URL` trong Secret sai / network blocked → check `kubectl exec -it <pod> -- curl -v $SLACK_WEBHOOK_URL`. |
| `kustomization.yaml` bị dirty sau smoke | Quên `git checkout kustomization.yaml` ở 9.11.5 → revert thủ công trước khi commit. |

**9.11.10 Smoke test KHÔNG cover (cần test trên cluster thật)**

- imagePullSecrets từ private registry
- RBAC giới hạn ServiceAccount (cluster-admin local ≠ prod scope)
- Network policy / egress firewall (Docker Desktop free-flow)
- Cloud workload identity (IRSA / GKE Workload Identity) — local dùng plain SA
- Multi-node scheduling + node taint/affinity
- `PriorityClass` + preemption behavior

→ Sau khi smoke local pass, mới move sang staging cluster để cover 6 mục trên.

### 9.12 Ad-hoc ops job triggers

10 manual ops job đã migrate sang **suspended k8s CronJobs**
(`deploy/k8s/cronjob-ops-*.yaml`). Tất cả dùng schedule placeholder
`0 0 31 2 *` (Feb-31 không tồn tại) + `suspend: true` — dual safety không bao
giờ auto-fire. Operator phải explicit trigger qua `kubectl create job`.

**Pattern chung:**

```bash
# Mỗi job tạo unique Job name (timestamp suffix) để không clash:
kubectl -n gitlab-analytics create job <name>-$(date +%s) \
  --from=cronjob/etl-ops-<name>

# Tail logs:
kubectl -n gitlab-analytics logs -f -l job-name=<name>-<timestamp>

# Đợi complete:
kubectl -n gitlab-analytics wait --for=condition=Complete \
  job/<name>-<timestamp> --timeout=<deadline+5min>

# Cleanup (CronJob tự GC sau 24h via ttlSecondsAfterFinished, hoặc xóa ngay):
kubectl -n gitlab-analytics delete job <name>-<timestamp>
```

> ⚠️ `kubectl create job --from=cronjob/...` **KHÔNG kế thừa
> `concurrencyPolicy`**. Nếu trigger 2 lần song song, 2 pod cùng chạy. Trước
> khi trigger lại, check: `kubectl -n gitlab-analytics get jobs -l job=ops-<name>`.

**Recipe per job:**

| Job | Trigger command | Deadline | Khi nào dùng |
|---|---|---|---|
| `triage` | `kubectl create job triage-$(date +%s) --from=cronjob/etl-ops-triage` | 10min | Inspect pipeline_state + last 7d raw row counts (read-only, an toàn nhất) |
| `extract` | `kubectl create job extract-$(date +%s) --from=cronjob/etl-ops-extract` | 4h | Manual incremental extract — default `SINCE_DAYS=7` (override qua patched env, xem ghi chú trong manifest) |
| `extract-backfill` | `kubectl create job extract-backfill-$(date +%s) --from=cronjob/etl-ops-extract-backfill` | 6h | Bypass checkpoint, scan `BACKFILL_DAYS` (default 30) |
| `dbt-run` | `kubectl create job dbt-run-$(date +%s) --from=cronjob/etl-ops-dbt-run` | 1h | dbt run + test prod target — chạy sau khi extract manual hoặc khi muốn refresh views |
| `reset-failures` | `kubectl create job reset-failures-$(date +%s) --from=cronjob/etl-ops-reset-failures` | 1min | Sau khi đã fix nguyên nhân fail — clear `consecutive_failures` về 0 để un-block healer |
| `reset-cursors` | `kubectl create job reset-cursors-$(date +%s) --from=cronjob/etl-ops-reset-cursors` | 1min | Rewind 3 cursors về NOW()-7d, force re-extract last week |
| `migration-004` | `kubectl create job migration-004-$(date +%s) --from=cronjob/etl-ops-migration-004` | 5min | Idempotent — ALTER pipelines ADD finished_at/duration/coverage |
| `migration-005` | `kubectl create job migration-005-$(date +%s) --from=cronjob/etl-ops-migration-005` | 5min | Idempotent — ALTER merge_requests ADD has_valid_branch_name/has_conventional_title |
| `p4-cutover` | `kubectl create job p4-cutover-$(date +%s) --from=cronjob/etl-ops-p4-cutover` | 2h | ONE-SHOT sau khi deploy incremental config cho v_mr_score_breakdown (DB_ARCHIVE_STRATEGY.md §8.4) |
| `setup-metabase` | `kubectl create job setup-metabase-$(date +%s) --from=cronjob/etl-ops-setup-metabase` | 30min | Provision/re-sync ~53 Metabase dashboards |

**Một-lần overrides (env hoặc args) khi trigger:**

`kubectl create job --from=cronjob` không có flag override env trực tiếp.
Workflow: render thành YAML, patch env, apply.

```bash
# Ví dụ: extract với SINCE_DAYS=14 thay vì default 7
kubectl -n gitlab-analytics create job extract-14d-$(date +%s) \
  --from=cronjob/etl-ops-extract --dry-run=client -o yaml \
  | yq '.spec.template.spec.containers[0].env += [{"name":"SINCE_DAYS","value":"14"}]' \
  | kubectl apply -f -
```

**Cách điều chỉnh `activeDeadlineSeconds`** (khi job chronic timeout):

1. **Git canonical** (recommended): sửa `deploy/k8s/cronjob-ops-<name>.yaml`,
   commit, Argo CD reconcile.
2. **Kubectl patch live** (hot-fix, sẽ drift với git):
   ```bash
   kubectl -n gitlab-analytics patch cronjob etl-ops-<name> \
     --type=merge -p '{"spec":{"jobTemplate":{"spec":{"activeDeadlineSeconds":NEW_VALUE}}}}'
   # ⚠️ Argo CD sẽ revert ở vòng reconcile tới — phải commit lại git trước.
   ```
3. **Per-trigger override** (không đụng CronJob spec):
   ```bash
   kubectl -n gitlab-analytics create job <name>-$(date +%s) \
     --from=cronjob/etl-ops-<name> --dry-run=client -o yaml \
     | yq '.spec.activeDeadlineSeconds = NEW_VALUE' \
     | kubectl apply -f -
   ```

**Mặc định concurrency / retry:**

- `concurrencyPolicy: Forbid` trong CronJob spec — nhưng `kubectl create job
  --from` KHÔNG kế thừa → check active job thủ công trước trigger.
- `backoffLimit: 0` — operator-triggered = fail-fast, không silent retry.
  Tách biệt với scheduled CronJobs (`backoffLimit: 2`).

---

*Xem sơ đồ ETL đầy đủ tại [architecture_etl.md](./architecture_etl.md)*
