# DevOps Questions — ETL k8s Migration Cutover

> **Status:** Q1-Q5 confirmed · Q3 fully resolved 2026-06-08 (Vault Agent Injector sidecar, path simplified) · Q4+Q5 sub-questions still pending · Q7 (observability) awaiting DevOps
> **Created:** 2026-05-27
> **Last update:** 2026-06-08 — Q3 path simplified to `/vault/secrets/configuration.<env-lower>.json` per DevOps directive (was `/vault/secret/app-secret/<service>-<env>.json`)

---

## ✅ Confirmed (analytics đã code theo)

### Q1. Cluster + namespace — CONFIRMED 2026-05-27
- Namespace: **`gitlab-analytics`** (hyphen, k8s convention — k8s không cho underscore)
- k8s version: **≥1.27** → giữ `CronJob.timeZone: Asia/Bangkok` native, không cần UTC fallback

### Q2. Postgres prod — CONFIRMED 2026-05-27
- Location: **on-prem VM** (DevOps quản host + access)
- Local dev: giữ Docker Compose Postgres container (không ảnh hưởng prod)
- **Pending:** prod host/port/credential — DevOps cấp khi rollout cluster (sẽ inject qua Vault)

### Q3. Secret inject — ✅ RESOLVED 2026-06-08: Vault Agent Injector (sidecar pattern)
- **Production:** **Vault Agent Injector** (sidecar) render secrets vào file JSON trong pod
  - **Rendered file path on pod:** `/vault/secrets/configuration.<env-lowercase>.json`
    - Ví dụ Development: `/vault/secrets/configuration.development.json`
    - DevOps directive 2026-06-08: dùng path đơn giản này (KHÔNG dùng `/vault/secret/app-secret/<service>-<env>.json` như sample .NET tham khảo trước đó — đã simplify cho tất cả service Python)
    - **Không có version segment trong filename** — Vault KV v2 versions là dynamic (mỗi update tạo version mới), Vault Agent render latest version mặc định nên pod luôn đọc bản mới nhất mà không cần redeploy manifest
  - **Vault server source** (DevOps quản backend mapping):
    - URL backend tham khảo: `https://isc-secret.fpt.net/ui/vault/secrets/kv/show/isc-project/isc-internal-standard/app-secret/<env-lower>/web-dashboard-compliance`
    - Env segment server-side: lowercase (`development` | `staging` | `production`)
    - Analytics KHÔNG truy cập trực tiếp Vault API — chỉ đọc file rendered
  - **Env var driving file selection:** `PYTHON_ENVIRONMENT` ∈ {`Development`, `Staging`, `Production`} (PascalCase, cluster ConfigMap-injected; bootstrap `.lower()` khi build filename)
  - **JSON shape:** flat SCREAMING_SNAKE_CASE keys mirror `.env`, ví dụ `{"GITLAB_TOKEN": "...", "DATABASE_URL": "...", ...}` — KHÔNG có wrapper `AppSettings` như .NET sample (.NET dùng `IConfiguration.GetSection`, Python không cần)
- **Local:** HashiCorp Vault dev container đã setup (`docker-compose.yml :: vault` service, port 8200, root token `dev-only-root-token`, seed script `src/infra/vault/init.sh`) — dùng cho dev playground, prod đi qua Vault Agent. Bootstrap fallback `.env` khi file vắng.
- **Analytics-side adaptation** (commit `feat(config): bootstrap from /vault/secret/app-secret/...`):
  - `src/config/bootstrap.py` đọc JSON → `os.environ.setdefault()` (CronJob spec.env wins)
  - Fallback `.env` khi `PYTHON_ENVIRONMENT` unset hoặc file vắng (local dev path)
  - Entry points đã wire: `extraction/pipeline.py`, `webhook/app.py`, `alerting/{compliance,freshness}_alert.py`, `reporting/daily_insight.py`, `metabase/setup_dashboards.py`, `infra/register_webhook.py`
  - `etl_entrypoint.sh` log warning nếu file vắng — defense-in-depth

#### Q3 sub-questions resolution:
- ~~a. Vault address~~ — N/A (analytics không gọi Vault API trực tiếp; Vault Agent sidecar lo)
- ~~b. Auth method~~ — N/A (DevOps cấu hình Vault Agent annotation trên Pod template)
- ~~c. Secret path convention~~ — đã confirm path = `/vault/secrets/configuration.<env-lower>.json` (per DevOps directive 2026-06-08); analytics chỉ đọc file
- ~~d. ExternalSecrets Operator~~ — **không dùng**, thay bằng Vault Agent Injector (sidecar đơn giản hơn)
- ~~e. Refresh interval~~ — Vault Agent default (sidecar tự re-render khi lease expire); analytics CronJob short-lived nên không quan tâm

---

### Q4. Container registry — CONFIRMED 2026-05-27: Harbor
- Registry: **Harbor** (DevOps quản host + project)
- **imagePullSecret:** DevOps tạo trong namespace `gitlab-analytics`, analytics chỉ reference name trong manifest

#### Q4 sub-questions còn chờ DevOps (analytics block build + manifest):

   a. **Harbor URL** + project path đầy đủ? (ví dụ: `harbor.company.com/gitlab-analytics/etl`)

   b. **imagePullSecret name** trong namespace `gitlab-analytics` (để uncomment trong 3 cronjob manifests)?

   c. **Harbor robot account** cho CI push: DevOps cấp credential qua CI Variables (`HARBOR_USER`, `HARBOR_PASSWORD`) hay analytics đăng ký?

   d. **Tag policy:** giữ `$CI_COMMIT_SHA` + `:latest`, hay Harbor có retention rule riêng?

### Q5. Deploy mechanism — CONFIRMED 2026-05-27: Argo CD
- **Argo CD** (analytics bỏ `deploy:k8s-secrets` + `deploy:k8s-manifests` jobs khỏi `.gitlab-ci.yml`)
- DevOps tạo Argo CD Application point vào repo path `deploy/k8s/`

#### Q5 sub-questions còn chờ DevOps (analytics block manifest layout):

   a. **App repo path** Argo CD watch: `deploy/k8s/` root, hay cần `overlays/prod/` (Kustomize) — analytics có kustomization.yaml hiện tại?

   b. **Image tag update flow:** Argo CD Image Updater auto-detect tag mới trên Harbor, hay analytics push commit cập nhật manifest image tag sau mỗi build?

   c. **Sync policy:** auto-sync + prune, hay manual sync?

   d. **Secret manifest:** `deploy:k8s-secrets` job bị remove → ExternalSecret CR cũng do Argo CD apply luôn từ `deploy/k8s/` chứ?

---

## Default analytics tự quyết (DevOps reject thì nói, đổi 1-2 line):

- concurrencyPolicy `Forbid` · backoffLimit 2
- Resources: daily 500m-2CPU/1-4Gi · retention 200m-1CPU/512Mi-2Gi · full-refresh 500m-2CPU/1-4Gi
- activeDeadlineSeconds: daily 14400s · retention 1800s · full-refresh 3600s
- Image tag: `$CI_COMMIT_SHA` + `:latest`
- Cutover: chờ 7d k8s daily xanh consecutive → disable old GitLab CI Schedules
- ~~Manual approval gate trên `deploy:k8s-*` jobs~~ — **N/A** sau Q5 (Argo CD, jobs sẽ bị remove)

## Deploy thử, fail thì xin sau:
- Egress whitelist (GitLab + Slack + Postgres on-prem VM)
- Resource quota
- Node selector / taint

## Defer Phase 2:
- Prometheus ServiceMonitor
- Log aggregator (Loki/Datadog)
- Security scan gate (Trivy/Snyk)

---

### Q7. Observability stack (Layer 2 cluster-native monitoring) — NEW 2026-05-29

> **Context:** Analytics đã ship Layer 1 observability ngày 2026-05-29:
> (a) Metabase dashboard `OPS: Pipeline & Data Health` (Collection A) — đọc `gitlab_kpi.v_ops_pipeline_health` + `v_data_freshness`
> (b) `src/alerting/freshness_alert.py` — daily cron, Slack POST nếu `hours_since_last_run > 25h` hoặc `overall_freshness_status ∈ ('WARNING','CRITICAL','NEVER')`
>
> Layer 1 chỉ cover **pipeline state + raw freshness**. KHÔNG cover: k8s job-level signals (job failed, OOMKilled, deadline exceeded, schedule miss), pod logs ephemeral (`ttlSecondsAfterFinished`), no resource utilization trend. Layer 2 cần DevOps stack — chưa biết tồn tại hay chưa.

#### Q7 sub-questions (block Layer 2 design):

   a. **Prometheus + Alertmanager** đã có trong cluster chưa?
      - Nếu CÓ: namespace + service name (để analytics tạo ServiceMonitor / PrometheusRule CR đúng selector)
      - Nếu CHƯA: DevOps cài, hay analytics đề xuất kube-prometheus-stack helm chart?

   b. **kube-state-metrics (KSM)** đang scrape namespace `gitlab-analytics` chưa?
      - Cần KSM để có metrics `kube_job_status_failed`, `kube_cronjob_status_last_schedule_time`, `kube_pod_status_phase`
      - Nếu KSM có nhưng exclude namespace → cần whitelist
      - Scrape interval mặc định OK (30s/1m) hay cần tune?

   c. **Grafana** access cho analytics team?
      - URL + team/folder permission để analytics tự tạo dashboard ETL CronJob
      - Hay analytics export JSON, DevOps deploy qua GitOps?

   d. **Slack receiver routing.** Alert Layer 1 (analytics ship hôm nay) dùng env `SLACK_WEBHOOK_DATA_OPS_URL` (fallback `SLACK_WEBHOOK_URL`). Layer 2 (Alertmanager) muốn:
      - Channel riêng `#data-ops-alerts` (SRE-oriented) **TÁCH** khỏi `#compliance-violation` (QA-oriented) không?
      - Hay route tất cả `gitlab-analytics` alerts vào 1 channel chung?
      - Webhook URL secret — bỏ Vault path `secret/data/gitlab-analytics/slack_data_ops_webhook` được không?

   e. **Log aggregator + retention.** k8s CronJob pods xóa logs khi `ttlSecondsAfterFinished` hit. Cần:
      - Stack hiện tại: Loki / ELK / Datadog / EFK / none?
      - Retention period mặc định (7d / 30d / 90d)? Compliance/legal có require ≥X days không?
      - Log shipping mechanism: sidecar / DaemonSet (Fluent Bit/Promtail) / native k8s API?
      - Analytics namespace có included trong scrape config không?

#### Q7 default analytics tự quyết (DevOps reject thì đổi):

- 5 Alertmanager rules (chỉ apply nếu Q7a + Q7b yes):
  - `kube_job_failed{namespace='gitlab-analytics'} > 0 for 5m` → severity=warning
  - `time() - kube_cronjob_status_last_schedule_time{namespace='gitlab-analytics'} > 90000` → severity=critical (>25h chưa schedule)
  - `kube_pod_container_status_restarts_total{namespace='gitlab-analytics'} > 3 in 1h` → severity=warning
  - `kube_pod_status_reason{namespace='gitlab-analytics', reason='OOMKilled'} > 0` → severity=critical
  - `rate(kube_job_status_failed{namespace='gitlab-analytics'}[1h]) > 0` → severity=warning
- 3 Grafana panels: success rate 7d, duration vs `activeDeadlineSeconds`, last successful run age per CronJob
- Routing: tách `#data-ops-alerts` (default), keep `#compliance-violation` cho compliance alerts only

#### Q7 defer (Layer 3, sau khi Layer 2 stable ≥30d):

- OpenTelemetry tracing cho dlt resource spans (ROI thấp với batch ETL)
- Loki/ELK detailed search index nếu chỉ cần audit thì k8s native API có thể đủ
- Custom Grafana exporter cho dbt run history (dbt artifacts → metrics)
