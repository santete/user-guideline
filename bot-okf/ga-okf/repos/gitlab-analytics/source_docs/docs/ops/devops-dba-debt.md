# Danh sách nợ hạ tầng — Handoff DevOps & DBA

**Ngày lập:** 2026-07-28
**Người lập:** QA Team (SangTT) — tổng hợp cùng AI agent
**Hệ thống:** `web-dashboard-compliance` (gitlab-analytics) — namespace `gitlab-analytics` / `isc-internal-standard`, cluster `hni-dev-k8s1`
**Mục đích:** Chốt toàn bộ vấn đề gốc rễ cần DevOps/DBA xử lý, tổng hợp từ các đợt debug 14/07–28/07.

> Nguồn: `docs/RCA-metabase-dev-2026-07-21.md`, `docs/ops/devops_questions.md`, known_gotchas trong `.claude/memory/project_state.yaml`, và session fix chart A4/A6 (28/07).

---

## TL;DR — 4 việc gốc rễ nếu chỉ làm được ít

1. **[DevOps] Sửa 502 edge + endpoint stale** — đang chặn 9 QA manager login Metabase (cấp bách nhất).
2. **[DevOps] Đưa resources + probes + env Metabase vào GitOps** — không thì ArgoCD revert = crash-loop tái diễn.
3. **[DevOps] Pull secret Harbor thật + chiến lược tag image + annotation Vault cho CronJob** — chặn mọi deploy code (gồm fix A4/A6).
4. **[DBA] Cấp DB PG ≥ 14 làm app-db Metabase** — gỡ workaround postgres in-cluster đang dính 1 node, không backup.

---

## Bảng tổng hợp nhanh

| # | Việc | Team | Ưu tiên | Trạng thái |
|---|------|------|---------|-----------|
| D1 | Sửa Istio ingress 502 + endpoint stale | DevOps | 🔴 Cấp bách | Chưa xử lý |
| D2 | Cấp DNS thật cho domain dev | DevOps/DNS | 🔴 Cao | Chưa xử lý |
| D3 | Resources + probes + env Metabase vào GitOps | DevOps | 🟠 Cao (bắt buộc) | Workaround tạm |
| D4 | StorageClass cho cluster dev | DevOps | 🟠 Trung bình | Chưa xử lý |
| D5 | `MB_DB_PASS` plaintext → Vault | DevOps | 🟠 Trung bình | Chưa xử lý |
| D6 | Xác nhận Harbor + egress policy | DevOps | 🟡 Cao | Chưa xử lý |
| D7 | Pull secret Harbor thật + chiến lược tag image | DevOps | 🟡 Cao | Placeholder `regcred-local` |
| D8 | Annotation `agent-pre-populate-only` vào chart helm-cronjobs | DevOps | 🟡 Cao | Patch tay (sẽ bị đè) |
| D9 | Nới RBAC k8s account QA (`u-6oypjftaj5`) | DevOps | 🟡 Trung bình | Chưa xử lý |
| A1 | Cấp DB app-db PG ≥ 14 cho Metabase | DBA | 🟠 Cao | Chờ — workaround in-cluster |

---

# PHẦN A — DevOps

## 🔴 Nhóm 1: Đang chặn trực tiếp việc dùng dashboard

### D1. Istio ingress trả 502 ở edge (`isc-compliance-dev.fpt.net`)
- **Triệu chứng:** domain trả **502 ổn định**, nhưng Metabase **khỏe hoàn toàn nội bộ** — service `metabase-dev` → endpoint `10.233.93.123:3000`, pod 1/1, `/api/health=200` khi exec từ pod webhook gọi `http://metabase-dev`.
- **Gốc:** 502 nằm ở **Istio ingress gateway / VirtualService** phía edge. Nghi **endpoint stale** sau khi pod restart 5 lần đổi IP. Không pod nào có istio sidecar → **không phải** mTLS. Config KHÔNG bị ArgoCD revert (HOST=metabase-appdb, RES 2/2). Selector Service khớp label pod.
- **Chặn:** (1) 9 QA manager không login được; (2) không apply được RBAC (`setup_dashboards --rbac-only` chạy local đi qua domain 502).
- **Action DevOps:** refresh/sửa VirtualService + gateway endpoint để trỏ đúng pod hiện tại. QA **không tự xử được** — account `u-6oypjftaj5` bị **Forbidden** khi list resource cluster-scope (xem D9).

### D2. Domain dev chưa có DNS thật
- **Gốc:** mọi domain dev (cả Metabase lẫn webhook) **chỉ resolve qua hosts file** máy QA — chưa có public/corp DNS.
- **Chặn:** (1) webhook cần GitLab server (`git.fpt.net`) phân giải được hostname → hosts file cá nhân vô dụng; (2) QA phải sửa hosts tay mới vào được dashboard.
- **Action DevOps/DNS:** cấp bản ghi DNS thật cho domain dev.

---

## 🟠 Nhóm 2: Gốc rễ crash-loop Metabase (RCA 21/07 — workaround tạm đang chạy)

### D3. Resources Metabase quá thấp → crash-loop nhiều tuần **(bắt buộc)**
- **Gốc:** deployment ArgoCD set `cpu 100m / mem 512Mi` → JVM chỉ ~124MB heap → boot chậm + GC thrash → c3p0 pool timeout → CrashLoopBackOff (restart 76–84 lần/ngày). Thêm: **không có readiness/liveness/startup probe** → K8s báo "1/1 Ready" giả trong khi Metabase chết bên trong.
- **Action DevOps:** đưa cấu hình sau vào **GitOps repo / Helm values** app `metabase-dev` (KHÔNG sửa tay — ArgoCD revert):
  ```yaml
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits:   { cpu: "2",  memory: 2Gi }
  env:
    JAVA_OPTS: "-Xmx1536m"
    MB_ANON_TRACKING_ENABLED: "false"
    MB_CHECK_FOR_UPDATES: "false"
  startupProbe:   { httpGet: {path: /api/health, port: 3000}, periodSeconds: 10, failureThreshold: 180 }
  readinessProbe: { httpGet: {path: /api/health, port: 3000}, periodSeconds: 15, failureThreshold: 3 }
  livenessProbe:  { httpGet: {path: /api/health, port: 3000}, periodSeconds: 30, failureThreshold: 4 }
  ```
  Manifest đã test OK: `deploy/metabase/metabase-dev-with-appdb.yaml`.

### D4. Cluster dev không có StorageClass nào
- **Gốc:** cluster KHÔNG có bất kỳ StorageClass → PVC không bind. Workaround app-db hiện dùng `hostPath` dính node **worker-05**, **không có backup managed**.
- **Action DevOps:** cài StorageClass (đề xuất `local-path-provisioner` của Rancher).

### D5. `MB_DB_PASS` còn plaintext env
- **Action DevOps:** chuyển sang Secret/Vault, đồng bộ cách webhook-dev đang dùng Vault Agent Injector.

---

## 🟡 Nhóm 3: Chặn deploy code (gồm fix A4/A6 push 28/07)

### D6. Cluster không có internet egress
- **Gốc:** cluster **không pull nổi image ngoài** (`kubectl run --image=curlimages/curl` timeout). Mọi image phải qua **Harbor nội bộ**.
- **Action DevOps:** xác nhận đường Harbor + egress policy.

### D7. `imagePullSecrets: regcred-local` là placeholder + tag `latest` + `IfNotPresent`
- **Gốc:** cronjob (`deploy/k8s/cronjob-ops-setup-metabase.yaml:43`) ghi rõ `TODO (DevOps): replace with prod Harbor pull secret`. Cộng thêm tag `latest` + `imagePullPolicy: IfNotPresent` → **node chạy image cache cũ dù CI đã build code mới**.
- **Chặn:** fix A4/A6 (commit `1cb00f3`, branch `bugfix/dashboard-a4-a6-sql-errors`) sẽ **không vào cluster** cho tới khi có secret Harbor đúng + ép re-pull (bump tag hoặc xoá pod cache).
- **Action DevOps:** (1) đặt tên pull secret Harbor thật; (2) chốt chiến lược tag (immutable tag thay vì `latest`).

### D8. Annotation `agent-pre-populate-only: "true"` chưa vào chart helm-cronjobs
- **Gốc:** Vault Agent Injector với **CronJob/Job** mặc định chạy agent như **sidecar sống mãi** → pod Job **không bao giờ `Complete`** → treo. Set `vault.hashicorp.com/agent-pre-populate-only: "true"` → agent chỉ chạy init container render secret 1 lần rồi thoát, không giữ sidecar → Job complete bình thường.
- **Chặn:** ảnh hưởng **mọi CronJob dùng Vault** — gồm `etl-ops-setup-metabase` (job redeploy fix A4/A6). Nếu chart chưa có annotation, job có thể **treo không complete**.
- **Lưu ý:** hiện đang **patch tay** trên cluster → **lần delivery Helm chart sau sẽ ghi đè mất**. Phải đưa vào **chart `helm-cronjobs` gốc** (GitOps).
- **Action DevOps:** thêm annotation vào template CronJob trong chart `helm-cronjobs`.

### D9. RBAC k8s account QA (`u-6oypjftaj5`) quá hẹp
- **Gốc:** Forbidden khi list cluster-scope / VirtualService (`-A`) → QA không tự chẩn đoán được routing edge (D1).
- **Action DevOps:** cấp quyền read tối thiểu (VirtualService, Gateway) hoặc nhận việc chẩn đoán route.

---

# PHẦN B — DBA

### A1. Cấp DB PG ≥ 14 làm app-db Metabase
- **Gốc:** server `172.27.62.107` (`gitlab_analytics`) đang chạy **PostgreSQL 13.6**. Metabase v0.61+ (image cluster `metabase:v0.62.0.x`) **từ chối** PG < 14 làm application database. PG 13.6 **vẫn dùng được làm data source** (đọc `gitlab_kpi` vẽ dashboard) — chỉ không đạt chuẩn app-db.
- **Hệ quả:** kể cả DevOps fix xong D3, pod vẫn chết ở lỗi version nếu app-db trỏ server 13.6.
- **Action DBA (chọn 1):**
  - **A (khuyến nghị):** cấp 1 database mới trên server PG ≥ 14 làm app-db — tên `metabase_appdb` (hoặc theo naming DBA), 1 account owner, tải rất nhẹ (pool 15 connection, < 2GB/năm).
  - **B:** upgrade server `172.27.62.107` lên PG ≥ 14 (ảnh hưởng service khác dùng chung — DBA tự đánh giá; PG 13 đã EOL 11/2025).
- **Sau khi có DB:** chuyển `MB_DB_HOST`, migrate bằng pg_dump/restore (~15 phút), gỡ postgres in-cluster.

> **Đã xong (DBA, 10/07):** grant service account + tạo 2 staging schema (`gitlab_raw_staging`, `gitlab_kpi_staging`); view `gitlab_kpi.v_pipeline_state` cho card A6 (migration 015, apply 28/07). Không còn nợ ở nhánh này.

---

## Đã điều tra & LOẠI TRỪ (đừng đào lại)

| Nghi vấn | Kết quả kiểm chứng |
|---|---|
| DevOps viết sai YAML/config | **Loại** — host/port/dbname/user/pass đúng; connect thật từ máy văn phòng OK (0.02s), account đủ quyền USAGE+CREATE |
| Network pod → DB bị chặn | **Loại** — test từ pod metabase `/dev/tcp/172.27.62.107/5432` → OK (21/07). Namespace không có NetworkPolicy |
| PostgreSQL hết connection | **Loại** — `max_connections=200`, đang dùng ~110 |
| DB treo/chậm | **Loại** — query round-trip 0.02s |

---

## Tham chiếu

- `docs/RCA-metabase-dev-2026-07-21.md` — RCA đầy đủ crash-loop Metabase (nguồn D3/D4/D5/A1)
- `docs/ops/devops_questions.md` — Q&A cutover k8s (Q4/Q5/Q7 còn pending)
- `deploy/metabase/metabase-dev-with-appdb.yaml` — manifest resources+probes đã test OK
- `deploy/k8s/cronjob-ops-setup-metabase.yaml` — cronjob redeploy dashboard (TODO regcred dòng 43)
- `.claude/memory/project_state.yaml` — known_gotchas 24/07 (502, DNS, webhook, egress)
- Commit `1cb00f3` (branch `bugfix/dashboard-a4-a6-sql-errors`) — fix chart A4/A6 chờ deploy
