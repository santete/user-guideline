# Câu hỏi triển khai ETL lên dev — gửi DBA + DevOps

**Ngày:** 2026-07-10 · **Từ:** Dev (gitlab-analytics / web-dashboard-compliance)
**Bối cảnh:** Chuẩn bị deploy ETL CronJob lên dev (k8s `isc-internal-standard`). Đối chiếu pod webhook + metabase đang chạy phát hiện vài điểm cần chốt trước khi bật ETL. Runtime dùng account `gitlabanalyticsservice` + đọc Vault của DBA; `gitlabanalyticswrite` là account DBA cấp cho Dev tự verify/chạy migration tay.

---

## 🔴 A. DB runtime — NÚT THẮT CHÍNH (DBA)

1. Vault path `kv/data/isc-project/isc-internal-standard/database/development/web-dashboard-compliance` (webhook đang đọc) trỏ **host / port / user / dbname** gì? Đây là DB mà ETL runtime (`service`) thực sự connect.
2. DB đó có phải `172.27.62.107` không? Port **`5432` hay `5431`**? (Metabase metadata đang trỏ `:5431` — nghi có ≥2 instance/port.)
3. Account **`gitlabanalyticsservice`** trên DB runtime đã có quyền gì trên 4 schema (`gitlab_raw`, `gitlab_raw_staging`, `gitlab_kpi`, `gitlab_kpi_staging`)? — **hiện Dev kiểm tra trên `:5432` thấy service có USAGE=CREATE=False (0 quyền).**
4. DB Dev đang dùng để test tay (`172.27.62.107:5432`, account `gitlabanalyticswrite`, hiện write OWN cả 4 schema + toàn bộ bảng) và DB runtime của `service` là **CÙNG một instance hay KHÁC**?

## 🔴 B. Ownership model — xung đột cần chốt (DBA + Dev)

5. Trên DB runtime, **ai OWN** các object trong `gitlab_raw` / `gitlab_kpi`? Vấn đề: runtime `service` chạy dlt (ghi raw) + dbt (`create or replace` view kpi) → service phải tạo/drop/replace được. Nhưng migration + setup tay chạy bằng `write`. Nếu **write own view → service không replace được → dbt runtime FAIL**. Đề xuất chốt 1 trong 3:
   - (a) 1 **group role chung** (vd `gitlabanalyticsowner`), cả write + service là member, object own bởi group; hoặc
   - (b) runtime dbt cũng chạy bằng `write`; hoặc
   - (c) `service` own toàn bộ object app (migration cấp quyền + set owner sang service).
6. `migrate.py` (Dev chạy tay bằng `write`) áp lên **DB runtime** hay chỉ sandbox? Nếu áp runtime → `write` cần quyền trên DB runtime (hiện chỉ verify trên `:5432`).

## 🟠 C. Vault + secret (DevOps)

7. ETL CronJob inject Vault **giống hệt webhook** (role `hni-k8s1-dev-isc-internal-standard`, auth-path `auth/kubernetes/hni-k8s1-dev`, addr `isc-secret.fpt.net`, template merge `app-secret/...` + `database/...web-dashboard-compliance` → `/vault/secrets/configuration.development.json`) — đúng không?
8. Path `app-secret/.../web-dashboard-compliance` chứa **key gì** (GITLAB_TOKEN, SLACK_WEBHOOK_URL...) và `database/...` chứa **key gì** (database_url, db_password...)? Để chắc `bootstrap.py` map đúng tên biến.
9. **CronJob là batch** → cần annotation `vault.hashicorp.com/agent-pre-populate-only: "true"` (chỉ init container, KHÔNG sidecar) — nếu để sidecar long-running như webhook thì **Job không bao giờ Complete**. Helm chart `helm-cronjobs` đã set cái này cho các cronjob chưa?
10. **Entrypoint image ETL** có chạy Python bootstrap (load `/vault/secrets/*.json` → env) TRƯỚC khi gọi `dbt` không? dbt là binary riêng chỉ đọc env — nếu gọi dbt trực tiếp thì dbt không thấy `DB_PASSWORD` từ file Vault.

## 🟠 D. Deployment (DevOps)

11. ETL CronJob deploy qua **Helm `helm-cronjobs` (release `etl-dev`)** như webhook, đúng không? → repo `deploy/k8s/` kustomize của Dev chỉ là artifact local-kind. Nếu đúng, Dev cần cung cấp gì cho Helm values (danh sách job + schedule + command)?
12. Namespace `isc-internal-standard` egress tới DB runtime (host:port ở A.1) đã mở firewall chưa?

## 🟡 E. Metabase đang crash-loop (DevOps)

13. Pod `metabase-dev-*`: **restartCount 935, lastState exitCode 1 (Error)** — chết liên tục. `MB_DB_*` trỏ `172.27.62.107:5431/gitlab_analytics` user `gitlabanalyticsservice`. Nghi: (a) DB metadata của Metabase connect fail, hoặc (b) dùng nhầm DB data (`gitlab_analytics`) làm metadata store. Nhờ DevOps xem log Metabase + xác nhận DB metadata riêng cho Metabase.

---

**Ưu tiên:** A + B là blocker — không có host/port/user runtime + ownership model thì không deploy ETL đúng được. C/D/E xử song song.
