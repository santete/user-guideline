# RCA — Metabase dev crash-loop nhiều tuần trên K8s (isc-internal-standard)

**Ngày lập:** 21/07/2026
**Người điều tra:** QA Team (SangTT) — hỗ trợ bởi AI agent
**Hệ thống:** Deployment `metabase-dev`, namespace `isc-internal-standard`, cluster `hni-dev-k8s1`
**Hiện trạng:** ĐÃ CHẠY (workaround tạm) — `Metabase Initialization COMPLETE in 1.7 mins`, 21/07/2026 14:42 UTC. Cần 2 team hoàn thiện phần việc bên dưới để đưa về cấu hình chuẩn.

---

## 1. Tóm tắt sự cố

Pod `metabase-dev` crash-loop liên tục nhiều tuần (restartCount 76–84+ / ngày), log lặp lại lỗi:

```
com.mchange.v2.resourcepool.TimeoutException: A client timed out while waiting
to acquire a resource from BasicResourcePool -- timeout at awaitAvailable()
```

Lỗi c3p0 này là **triệu chứng, không phải nguyên nhân**. Điều tra 20–21/07 xác định **2 nguyên nhân gốc độc lập**, che lẫn nhau nên khó chẩn đoán.

---

## 2. Nguyên nhân gốc #1 — Resource limits quá thấp (trách nhiệm: DevOps)

**Cấu hình đang chạy** (deployment `metabase-dev`, chart `isc-project-v1.0.0`, ArgoCD apply):

```yaml
resources:
  requests: { cpu: 10m,  memory: 64Mi }
  limits:   { cpu: 100m, memory: 512Mi }
```

**Bằng chứng:**
- Log pod 15/07: `Maximum memory available to JVM: 123.8 MB` (= 25% của 512Mi theo JVM ergonomics). Metabase là ứng dụng JVM, yêu cầu tối thiểu 1–2 GB heap.
- 2 dòng log khởi động liên tiếp cách nhau 2 phút 20 giây (CPU throttle ở 0.1 core); container sống 17 phút mới chạy tới câu query DB đầu tiên rồi chết vì pool timeout — thread cấp phát connection của c3p0 bị bỏ đói CPU.
- Sau khi nâng resources (20/07): heap 1.5GB, boot còn ~2 phút.

**Cơ chế gây lỗi:** CPU 0.1 core + heap 124MB → JVM boot cực chậm + GC thrash → c3p0 không kịp acquire connection trong timeout → `ExceptionInInitializerError` → exit 1 → CrashLoopBackOff vô hạn.

**Yếu tố khiến sự cố kéo dài:** deployment KHÔNG có readiness/liveness/startup probe → Kubernetes báo pod `1/1 Ready` ngay khi container start → Rancher hiển thị xanh trong khi Metabase chết bên trong ("xanh giả").

### ➜ Yêu cầu DevOps (bắt buộc)

1. Cập nhật **vào GitOps repo / Helm values** của ArgoCD app `metabase-dev` (KHÔNG sửa tay trên cluster — ArgoCD sẽ revert):
   ```yaml
   resources:
     requests: { cpu: 500m, memory: 1Gi }
     limits:   { cpu: "2",  memory: 2Gi }
   env:
     JAVA_OPTS: "-Xmx1536m"
     MB_ANON_TRACKING_ENABLED: "false"
     MB_CHECK_FOR_UPDATES: "false"
   startupProbe:  { httpGet: {path: /api/health, port: 3000}, periodSeconds: 10, failureThreshold: 180 }
   readinessProbe: { httpGet: {path: /api/health, port: 3000}, periodSeconds: 15, failureThreshold: 3 }
   livenessProbe:  { httpGet: {path: /api/health, port: 3000}, periodSeconds: 30, failureThreshold: 4 }
   ```
   (Toàn bộ đã chạy thực tế OK — tham chiếu manifest `deploy/metabase/metabase-dev-with-appdb.yaml` trong repo QA.)
2. Bổ sung **StorageClass** cho cluster dev (đề xuất: `local-path-provisioner` của Rancher — hiện cluster KHÔNG có bất kỳ StorageClass nào, PVC không thể bind). Cần cho mục 3.
3. Chuyển `MB_DB_PASS` từ plaintext env sang Secret/Vault (đồng bộ cách làm với webhook-dev đang dùng Vault Agent Injector).

---

## 3. Nguyên nhân gốc #2 — PostgreSQL server 13.6 không đủ điều kiện làm application database (trách nhiệm: DBA)

**Bằng chứng** (log Metabase v0.61.8 chạy từ máy văn phòng, 21/07, connect thẳng server DBA cấp):

```
Metabase postgres DB version not supported (found 13.6.0 (13.6), required 14.0.0).
Please upgrade your database to a supported version and try again.
```

- Server `172.27.62.107` (database `gitlab_analytics`) đang chạy **PostgreSQL 13.6**.
- Metabase từ v0.61 trở lên (image cluster đang dùng: `metabase:v0.62.0.x`) **từ chối** PG < 14 làm application database (nơi lưu user/dashboard/config).
- Lưu ý: PG 13.6 **vẫn dùng được làm data source** (Metabase đọc schema `gitlab_kpi` để vẽ dashboard) — chỉ không đạt chuẩn làm app-db.
- Hệ quả: kể cả DevOps fix xong nguyên nhân #1, pod vẫn sẽ chết ở đúng lỗi version này nếu app-db tiếp tục trỏ vào server 13.6.

### ➜ Yêu cầu DBA (chọn 1 trong 2)

- **Phương án A (khuyến nghị):** cấp 1 database mới trên server **PostgreSQL ≥ 14** (14/15/16 đều được) làm app-db cho Metabase:
  - Database: `metabase_appdb` (hoặc tên theo naming convention DBA)
  - 1 account owner database đó (Metabase tự tạo ~200 bảng qua Liquibase migration)
  - Thông số tải: rất nhẹ — pool 15 connection, dung lượng < 2GB/năm
- **Phương án B:** upgrade server `172.27.62.107` lên PG ≥ 14 (ảnh hưởng nhiều service khác đang dùng chung server — cần DBA tự đánh giá; PG 13 cũng đã EOL 11/2025 theo lịch PostgreSQL).

---

## 4. Các nghi vấn đã điều tra và LOẠI TRỪ (không cần team nào xử lý)

| Nghi vấn | Kết quả kiểm chứng |
|---|---|
| DevOps viết sai YAML/config | **Loại** — host/port/dbname/user/pass đều đúng; connect thật bằng chính creds đó từ máy văn phòng OK (0.02s), account đủ quyền USAGE+CREATE |
| Network pod → DB bị chặn | **Loại** — test từ trong pod metabase: `/dev/tcp/172.27.62.107/5432` → **OK** (21/07). Namespace không có NetworkPolicy |
| PostgreSQL hết connection | **Loại** — `max_connections=200`, đang dùng ~110 |
| DB treo/chậm | **Loại** — query round-trip 0.02s |

## 5. Workaround đang chạy (tạm, do QA tự dựng 21/07)

- App-db: `postgres:16-alpine` chạy in-cluster (deployment `metabase-appdb`), data lưu hostPath `/opt/metabase-appdb-data` trên node worker-05 (vì cluster chưa có StorageClass).
- Metabase dev đã COMPLETE, hoạt động bình thường.
- Rủi ro tồn đọng của workaround: app-db dính node worker-05, chưa có backup managed → cần mục 2.2 (StorageClass) từ DevOps hoặc Phương án A từ DBA để chuẩn hóa.
- Khi DBA cấp DB PG ≥ 14: chuyển `MB_DB_HOST` về DB đó, migrate bằng pg_dump/restore (~15 phút), gỡ postgres in-cluster.

## 6. Bảng phân việc

| # | Việc | Team | Ưu tiên |
|---|---|---|---|
| 1 | Đưa resources + probes + env vào GitOps repo (mục 2.1) | DevOps | **Cao — nếu không làm, ArgoCD revert là sự cố tái diễn nguyên trạng** |
| 2 | Cấp DB app-db trên server PG ≥ 14 (mục 3.A) | DBA | Cao |
| 3 | StorageClass cho cluster dev (mục 2.2) | DevOps | Trung bình |
| 4 | MB_DB_PASS sang Vault (mục 2.3) | DevOps | Trung bình |
| 5 | Sau khi có #2: chuyển app-db, gỡ postgres in-cluster | QA + DevOps | Sau #2 |
