# K8s CronJob Handover — for DevOps

> Source manifests: `deploy/k8s/`. Apply via `kubectl apply -k deploy/k8s/` (kustomize).
> Cluster requirement: k8s ≥ 1.27 (cho `timeZone` field, KEP-3140).

## 1. Apply order (kustomization.yaml)

```
1. namespace.yaml                  ← tạo namespace gitlab-analytics
2. serviceaccount.yaml             ← SA gitlab-analytics-etl
3. configmap.yaml                  ← non-secret env (GITLAB_URL, PYTHON_ENVIRONMENT, ...)
4. externalsecret.yaml             ← ExternalSecret CR → render Secret từ Vault
5. cronjob-*.yaml × 14             ← 4 scheduled + 10 suspended ops
```

## 2. Scheduled CronJobs (4 — auto-fire)

| Tên | Schedule (cron) | Giờ TZ Asia/Ho_Chi_Minh | concurrencyPolicy | Mục đích |
|---|---|---|---|---|
| `etl-daily-pipeline` | `0 2 * * *` | **02:00 hàng ngày** | Forbid | Extract GitLab → dbt run/test → compliance alert |
| `etl-freshness-alert` | `30 2 * * *` | **02:30 hàng ngày** | Forbid | Kiểm tra freshness data, alert Slack nếu stale |
| `etl-retention` | `0 3 * * 0` | **03:00 Chủ Nhật** | Forbid | DELETE + VACUUM pipeline_jobs cũ > 90d |
| `etl-dbt-full-refresh` | `0 4 1 * *` | **04:00 ngày 1 mỗi tháng** | Forbid | dbt --full-refresh v_mr_score_breakdown |

**Dependency chain** (deterministic theo giờ, không có `dependsOn` thật):
```
02:00 daily-pipeline (~20-30min)
   └── 02:30 freshness-alert (đọc state daily-pipeline vừa ghi)
03:00 retention (Sun only, sau khi daily đã xong)
04:00 dbt-full-refresh (ngày 1, sau retention)
```
→ Nếu DevOps đổi schedule daily-pipeline, **PHẢI dời freshness-alert tương ứng** (giữ gap ≥ 30 phút).

## 3. Ops CronJobs (10 — suspended, trigger thủ công)

Tất cả có `suspend: true` + schedule placeholder `0 0 31 2 *` (Feb 31 = không bao giờ match).

| Tên | Mục đích | Khi nào trigger |
|---|---|---|
| `etl-ops-triage` | Snapshot state (cursors, failures) | Khi pipeline báo đỏ |
| `etl-ops-extract` | Re-extract incremental (default 7d) | Patch missing data |
| `etl-ops-extract-backfill` | Bypass checkpoint, extract 30d | Sau outage dài |
| `etl-ops-dbt-run` | dbt run + test prod | Sau khi sửa model |
| `etl-ops-reset-failures` | `consecutive_failures = 0` | Sau khi fix root cause |
| `etl-ops-reset-cursors` | Rewind 3 cursors về NOW()-7d | Force re-extract tuần qua |
| `etl-ops-migration-004` | ALTER pipelines (timing/coverage) | First-deploy |
| `etl-ops-migration-005` | ALTER MR (branch/title fields) | First-deploy |
| `etl-ops-p4-cutover` | dbt full-refresh + verify UK | One-shot sau config deploy |
| `etl-ops-setup-metabase` | Provision Metabase dashboards | First-deploy hoặc reset |

**Lệnh trigger thủ công**:
```bash
kubectl -n gitlab-analytics create job <name>-$(date +%s) \
  --from=cronjob/etl-ops-<name>
```

## 4. First-deploy sequence (TODO list cho DevOps)

```
[ ] 1. DBA tạo 4 schemas + grant CREATE (xem docs/ops/db_first_deploy.md)
[ ] 2. Build & push image lên Harbor → cập nhật kustomize image tag
[ ] 3. kubectl apply -k deploy/k8s/
[ ] 4. Verify ExternalSecret render Secret OK:
       kubectl -n gitlab-analytics get secret gitlab-analytics-secrets
[ ] 5. Apply migration init (001+002+003) — xem db_first_deploy.md §3
[ ] 6. Trigger ops migration-004 + 005:
       kubectl -n gitlab-analytics create job mig-004-$(date +%s) --from=cronjob/etl-ops-migration-004
       kubectl -n gitlab-analytics create job mig-005-$(date +%s) --from=cronjob/etl-ops-migration-005
[ ] 7. Smoke test daily-pipeline:
       kubectl -n gitlab-analytics create job smoke-$(date +%s) --from=cronjob/etl-daily-pipeline
       kubectl -n gitlab-analytics logs -f job/smoke-<ts>
[ ] 8. Trigger setup-metabase một lần để provision dashboards
[ ] 9. Chờ 02:00 hôm sau → verify daily-pipeline tự fire
```

## 5. Common config (mọi CronJob)

- `serviceAccountName: gitlab-analytics-etl`
- `imagePullSecrets: [regcred-local]` ← **DevOps thay bằng Harbor pull secret thật**
- `envFrom`: ConfigMap `gitlab-analytics-config` + Secret `gitlab-analytics-secrets`
- `restartPolicy: Never`, `backoffLimit: 0`, `ttlSecondsAfterFinished: 86400`
- `concurrencyPolicy: Forbid` — không bao giờ chạy chồng

## 6. Image tag override (Argo CD / prod)

```bash
kustomize edit set image etl=<HARBOR_REGISTRY>/<HARBOR_PROJECT>/etl:<sha>
```

## 7. Liên hệ

- Owner code: Analytics team (gitlab-analytics repo)
- Owner cluster + Vault + Harbor + Argo CD: DevOps
- Issue → tag `@analytics` trong MR comment
