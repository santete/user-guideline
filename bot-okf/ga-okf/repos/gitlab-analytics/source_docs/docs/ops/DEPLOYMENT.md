# Deployment Plan — GitLab Analytics Pipeline

> ENG-ANA-001 | v1.1 | 2026-05-26
> Đối tượng: DevOps / SRE / Engineering Manager triển khai từ zero lên prod.
>
> **v1.1 — ETL moved from GitLab CI scheduled jobs to k8s CronJob** (DevOps
> concern: GitLab Runners are build/test compute, not production workloads).
> Affected sections: §1, §2.1, §2.3, §3 Phase 5, §6.1. See `deploy/k8s/` for
> manifests + `.gitlab-ci.yml :: build:etl-image / deploy:k8s-*` for CI side.

---

## 1. Tóm tắt kiến trúc deploy

```
┌────────────────────────────────────────────────────────────────────────┐
│  GitLab EE v18 (self-hosted)                                           │
│   ├─ REST API v4    ────────────► etl-daily-pipeline (k8s CronJob)     │
│   └─ Webhook POST   ────────────► webhook container (port 8080)        │
└────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                          PostgreSQL 16 (port 5432)
                          ├─ gitlab_raw  (dlt-managed)
                          └─ gitlab_kpi  (dbt views)
                                       │
                       ┌───────────────┼───────────────┐
                       ▼               ▼               ▼
                 Metabase OSS    Slack Webhook    Ad-hoc psql
                 (port 3000)    (compliance)     (analytics_ro)
```

**3 deploy unit độc lập:**

| Unit | Where | Mode |
|------|-------|------|
| ETL (extract + dbt + alert + retention + monthly full-refresh) | k8s CronJobs in namespace `gitlab-analytics` (manifests in `deploy/k8s/`) | Stateless, cron-driven |
| Webhook receiver (optional) | Docker container | Long-running, port 8080 |
| Postgres + Metabase | Docker Compose trên VM | Stateful, restart unless-stopped |

**ETL workloads** (3 separate CronJobs, single shared image):

| CronJob | Cron | TZ | Purpose |
|---|---|---|---|
| `etl-daily-pipeline` | `0 2 * * *` | Asia/Bangkok | extract → dbt → alert (sequential, fail-fast) |
| `etl-retention` | `0 3 * * 0` | Asia/Bangkok | mig 009 + VACUUM (weekly Sun) |
| `etl-dbt-full-refresh` | `0 4 1 * *` | Asia/Bangkok | monthly safety-net rebuild of `v_mr_score_breakdown` |

---

## 2. Prerequisites

### 2.1 Hạ tầng
- [ ] **VM** Linux (Ubuntu 22.04+ / RHEL 9+), tối thiểu **4 vCPU / 8GB RAM / 100GB SSD** — chỉ chứa Postgres + Metabase (+ webhook nếu có)
  - Postgres data growth: ~50MB/100 projects/tháng — scale theo group size
- [ ] **Docker** 24+ và **docker-compose** v2 (trên VM)
- [ ] **k8s cluster** cho ETL CronJobs:
  - k8s ≥ 1.27 recommended (native `CronJob.spec.timeZone` field, KEP-3140). Cluster <1.25 → fall back to UTC schedules (TODO comments trong manifests)
  - Nodes có thể reach Postgres VM trên port 5432 (firewall + NetworkPolicy nếu enabled)
  - Cluster có thể pull image từ GitLab Container Registry — cần `imagePullSecrets` nếu registry yêu cầu auth
  - Cluster có log aggregation (Fluent Bit/Loki/ELK) để xem job stdout (job stdout = pipeline log, identical to old CI job log)
- [ ] **Network**:
  - Pods phải reach được `GITLAB_URL` (HTTPS 443) + `hooks.slack.com` (HTTPS 443) + Postgres VM (TCP 5432)
  - VM phải reach được Metabase + ad-hoc psql clients (port 5432 cho `analytics_ro`)
- [ ] **Webhook (optional)**: public ingress / reverse proxy với TLS để GitLab POST vào port 8080
- [ ] **DNS**: `metabase.<domain>` cho Metabase UI, `webhook.<domain>` cho webhook endpoint
- [ ] **Backup**: cron `pg_dump` daily → S3/MinIO; retention ≥ 30 ngày

### 2.2 Tài khoản & token
- [ ] **GitLab Group Access Token** scope `read_api` (cho extraction) + `api` (cho webhook registration)
- [ ] **Slack Incoming Webhook URL** (channel `#qa-compliance`)
- [ ] **Metabase admin email/password** (sẽ set qua first-time UI)
- [ ] **Postgres passwords**: `analytics` (DB owner) + `analytics_ro` (Metabase readonly)

### 2.3 GitLab CI/CD (cho build + deploy)
Project mirror/import vào GitLab để CI chạy **3 việc**: (a) unit-tests trên push/MR, (b) build & push ETL image to GitLab Container Registry, (c) deploy k8s manifests + Secret. Cần set CI/CD Variables (Settings → CI/CD → Variables, **Protected + Masked** tất cả):

| Variable | Type | Used by |
|---|---|---|
| `KUBECONFIG_B64` | masked, protected | deploy:k8s-* — base64 of `~/.kube/config` pointing to ETL cluster |
| `KPI_GITLAB_TOKEN` | masked, protected | deploy:k8s-secrets → Secret.GITLAB_TOKEN |
| `KPI_DATABASE_URL` | masked, protected | deploy:k8s-secrets → Secret.DATABASE_URL |
| `KPI_DB_PASSWORD` | masked, protected | deploy:k8s-secrets → Secret.DB_PASSWORD |
| `KPI_SLACK_WEBHOOK_URL` | masked, protected | deploy:k8s-secrets → Secret.SLACK_WEBHOOK_URL |
| `KPI_METABASE_URL` / `KPI_METABASE_USER` / `KPI_METABASE_PASSWORD` | masked, protected | manual `ops:setup-metabase` only |

Non-secret config (`GITLAB_URL`, `GITLAB_GROUP_ID`, `DB_HOST`, etc.) moved to ConfigMap `gitlab-analytics-config` (`deploy/k8s/configmap.yaml`) — edit values there, not in CI vars.

### 2.4 k8s namespace bootstrap (one-time, before first deploy)

DevOps trên cluster:
```bash
# 1. Namespace + ServiceAccount + ConfigMap (Kustomize applies in deploy stage,
#    but namespace must exist BEFORE the secret-create step in deploy:k8s-secrets)
kubectl apply -f deploy/k8s/namespace.yaml

# 2. Registry pull secret (skip if cluster has cluster-wide credential)
kubectl -n gitlab-analytics create secret docker-registry gitlab-registry \
  --docker-server="$CI_REGISTRY" \
  --docker-username="$CI_REGISTRY_USER" \
  --docker-password="$CI_REGISTRY_PASSWORD"
# Then uncomment imagePullSecrets block in each cronjob-*.yaml manifest.

# 3. Verify ConfigMap values match prod (edit configmap.yaml + apply if not)
kubectl -n gitlab-analytics get configmap gitlab-analytics-config -o yaml
```

---

## 3. Phased rollout

### **Phase 0 — Pre-flight (D-3)**

1. Tag release branch: `git tag v1.0.0-deploy && git push origin v1.0.0-deploy`
2. Smoke run trên staging VM (cùng spec với prod, group nhỏ <100 projects):
   - Full extract `--since-days 30 --backfill`
   - dbt run + test → 33/33 PASS
   - Setup dashboards → 6 collections visible
   - Slack test alert
3. Restore test: `pg_restore` từ backup → verify schemas tồn tại
4. **Exit criteria**: tất cả bước trên green, không có WARN trong dbt test.

### **Phase 1 — Infrastructure (D-1, ~30 phút)**

```bash
# Trên VM prod
git clone <repo> /opt/gitlab-analytics
cd /opt/gitlab-analytics
cp .env.example .env
# Fill: DB_PASSWORD, ANALYTICS_RO_PASSWORD, GITLAB_WEBHOOK_SECRET
vi .env

# Bootstrap Postgres + Metabase — chạy TỪ repo root, dùng --env-file để
# docker compose pickup .env (mặc định nó tìm .env cạnh compose file).
docker compose -f src/infra/docker-compose.yml --env-file .env up -d postgres
docker compose -f src/infra/docker-compose.yml --env-file .env up -d metabase
# Webhook chưa start vội — sẽ start ở Phase 4

# Verify
docker compose -f src/infra/docker-compose.yml ps
docker compose -f src/infra/docker-compose.yml logs postgres | grep "ready to accept connections"
```

**Apply migrations (idempotent runner `src/infra/db/migrate.py`):**

Ordering matters: dlt creates the raw tables on first extraction, and migrations
`004+` only `ALTER` them — so the runner is split into `pre` (before extraction)
and `post` (after extraction). Identifiers that vary per environment are env-driven
(defaults preserve local docker):

```bash
# Env for a non-local target (dev shown; omit to use local docker defaults):
export MIGRATE_KPI_SCHEMA=gitlab_kpi
export MIGRATE_READ_ROLE=gitlabanalyticsread     # local default: analytics_ro
export MIGRATE_WRITE_ROLE=gitlabanalyticswrite   # local default: analytics
# DATABASE_URL must point at the write account (creates schema_migrations + DDL).

# 1) PRE — manual tables (webhook_dlq, pipeline_state) BEFORE first extraction:
python -m src.infra.db.migrate --phase pre

#    ... run extraction here (dlt creates gitlab_raw.* tables) ...

# 2) POST — ALTERs on the dlt raw tables + KPI read grant, AFTER extraction:
python -m src.infra.db.migrate --phase post

# Inspect state / plan without touching the DB:
python -m src.infra.db.migrate --status
python -m src.infra.db.migrate --phase post --dry-run
```

Skipped by default (apply explicitly with `--include N` only after sign-off):
`001` (schema/role creation — DBA territory), `009` (retention — `ops:retention`
job owns cadence), `010`–`013` (partition cutover — maintenance window + Eng Mgr).
Applied migrations are tracked in `gitlab_raw.schema_migrations` (checksum-verified:
editing an applied migration is a hard error — add a new one instead).

**Exit criteria**: `\dt gitlab_raw.*` show ≥ 3 tables (pipeline_state, webhook_dlq, merge_requests skeleton sau khi dlt boot).

### **Phase 2 — Initial backfill (D-Day, ~2–4 giờ tùy group size)**

Backfill chạy 1 lần để load 30 ngày lịch sử. **Chạy thủ công từ VM, không qua CI** (CI có timeout 1h):

```bash
# Trên VM, trong /opt/gitlab-analytics
export $(grep -v '^#' .env | xargs)
python -m src.extraction.pipeline --backfill --since-days 30 2>&1 | tee logs/backfill_$(date +%F).log
```

**Monitor**:
- Log line cuối phải có `[pipeline] DONE`, exit code 0
- Verify: `SELECT COUNT(*) FROM gitlab_raw.merge_requests` ≥ kỳ vọng
- Cursor được persist: `SELECT * FROM gitlab_raw.pipeline_state`

**Nếu fail giữa chừng**: cursor đã được checkpoint từng page → re-run cùng lệnh sẽ resume.

### **Phase 3 — Transform + dashboards (D-Day, ~10 phút)**

```bash
cd src/transform
dbt deps --profiles-dir .
dbt run --profiles-dir . --target prod
dbt test --profiles-dir . --target prod
# Expect: PASS=33 WARN=0 ERROR=0

cd ../..
python -m src.metabase.setup_dashboards
```

**Verify**: mở `https://metabase.<domain>` → 6 collections (A Ops Health, B QA Compliance, ...) xuất hiện, charts có data (không phải "No results").

### **Phase 4 — Webhook + Slack (D-Day, ~20 phút)**

**4.1 Webhook container** (chỉ deploy nếu cần real-time updates):
```bash
docker compose -f src/infra/docker-compose.yml --env-file .env --profile realtime up -d webhook
docker compose -f src/infra/docker-compose.yml logs -f webhook  # check "Uvicorn running on http://0.0.0.0:8080"
```

Expose qua reverse proxy (nginx/Caddy) với TLS → `https://webhook.<domain>/webhook`.

**4.2 Register webhook với GitLab:**
```bash
export GITLAB_WEBHOOK_URL=https://webhook.<domain>/webhook
python -m src.infra.register_webhook
# Verify: GitLab → Group → Settings → Webhooks → thấy entry mới
```

**4.3 Slack alert test:**
```bash
# compliance_alert.py KHÔNG có --dry-run; nhưng idempotent qua dedup table
# gitlab_raw.alerted_mr_ids (xem src/extraction/checkpoint.py:get_alerted_mr_ids).
# Bước 1 — verify webhook reachable bằng test payload:
curl -X POST -H 'Content-Type: application/json' \
  -d '{"text":"[deploy] compliance-alert smoke test"}' "$SLACK_WEBHOOK_URL"
# Bước 2 — chạy script thật, an toàn re-run nhờ dedup:
python -m src.alerting.compliance_alert
# Verify #qa-compliance: thấy msg ở bước 1 + nếu có vi phạm 24h gần nhất sẽ thấy ở bước 2
```

### **Phase 5 — Deploy k8s CronJobs (D+1)**

**5.1 First deploy** — trigger via GitLab UI:

```
CI/CD → Pipelines → Run pipeline (branch main) → Play ▶ on:
  1. build:etl-image     (builds image, pushes ${CI_REGISTRY_IMAGE}/etl:${SHA})
  2. deploy:k8s-secrets  (kubectl create/update Secret from masked CI vars)
  3. deploy:k8s-manifests (kustomize edit set image + kubectl apply -k)
```

Both `deploy:*` jobs are `when: manual` — operator confirms before each prod apply.

**5.2 Verify CronJobs registered:**
```bash
kubectl -n gitlab-analytics get cronjobs
# NAME                    SCHEDULE      TIMEZONE         SUSPEND   ACTIVE   LAST SCHEDULE
# etl-daily-pipeline      0 2 * * *     Asia/Bangkok     False     0        <none>
# etl-retention           0 3 * * 0     Asia/Bangkok     False     0        <none>
# etl-dbt-full-refresh    0 4 1 * *     Asia/Bangkok     False     0        <none>
```

**5.3 First run smoke test** — trigger daily-pipeline manually without waiting for 02:00:
```bash
kubectl -n gitlab-analytics create job smoke-$(date +%s) \
  --from=cronjob/etl-daily-pipeline

# Watch logs
kubectl -n gitlab-analytics get jobs -w
kubectl -n gitlab-analytics logs -f job/smoke-<ts> -c etl
```

Expected log signature (in order):
- `[ts] starting JOB_NAME=daily-pipeline`
- `[ts] step 1/3 — extract` → `[pipeline] DONE` (or per-resource cursor logs)
- `[ts] step 2/3 — dbt transform + test` → `PASS=N WARN=0 ERROR=0`
- `[ts] step 3/3 — compliance alert` → posted to Slack
- `[ts] DONE JOB_NAME=daily-pipeline`

**5.4 Cleanup smoke job after verify:**
```bash
kubectl -n gitlab-analytics delete job smoke-<ts>
```

### **Phase 6 — Monitoring & handover (D+2 → D+7)**

- [ ] Cài liveness check: GitLab scheduled pipeline (every 30min) trigger job `ops:triage` (đã định nghĩa ở `.gitlab-ci.yml:103`); hoặc cron VM dùng psql query (xem §6.1 dưới đây). `ops.py` là **interactive menu**, KHÔNG nhận CLI arg — chỉ dùng manual từ shell.
- [ ] Document Metabase admin credentials trong vault
- [ ] Handover runbook: `docs/ops/ops_runbook.md` + `docs/ops/TROUBLESHOOTING.md`
- [ ] Train QA Manager + Engineering Manager sử dụng dashboards (1h session)

---

## 4. Rollback procedure

### 4.1 Rollback ETL changes (code-only, không đụng data)

**Option A — revert commit + redeploy** (clean history):
```bash
git revert <bad-commit>
git push origin main
# CI rebuilds image at new SHA, then operator Plays deploy:k8s-manifests.
```

**Option B — point CronJobs back to a previous good image SHA** (fast):
```bash
# Find prior good SHA in registry
kubectl -n gitlab-analytics get cronjob etl-daily-pipeline -o jsonpath='{.spec.jobTemplate.spec.template.spec.containers[0].image}'

# Patch each CronJob — re-runs at next scheduled tick will pick up
for cj in etl-daily-pipeline etl-retention etl-dbt-full-refresh; do
  kubectl -n gitlab-analytics set image cronjob/$cj \
    etl=${CI_REGISTRY_IMAGE}/etl:<previous-good-sha>
done
```
Option B does not modify git — remember to revert the commit afterwards or the next push-to-main will redeploy the bad image.

### 4.2 Rollback dbt model (data shape thay đổi)
```bash
git checkout <previous-good-tag> -- src/transform/
cd src/transform && dbt run --profiles-dir . --target prod --full-refresh
```

### 4.3 Rollback migration (DESTRUCTIVE — chỉ làm khi có decision)
- **NEVER** auto-rollback prod DB. Hard stop, hỏi user.
- Restore từ `pg_dump` snapshot trước migration.
- Workflow: `docker compose down` → `pg_restore` → `docker compose up` → re-run dbt.

### 4.4 Rollback webhook
```bash
docker compose -f src/infra/docker-compose.yml --profile realtime stop webhook
# Polling extraction vẫn chạy → no data loss, chỉ mất real-time
```

---

## 5. Smoke tests sau deploy

| Test | Command | Expect |
|---|---|---|
| DB reachable | `psql $DATABASE_URL -c "\dn"` | List schemas `gitlab_raw`, `gitlab_kpi`, `public` |
| Pipeline state | `psql -c "SELECT * FROM gitlab_raw.pipeline_state"` | `consecutive_failures = 0` |
| Data freshness | `psql -c "SELECT * FROM gitlab_kpi.v_data_freshness"` | `mr_lag_hours < 24` |
| dbt | `cd src/transform && dbt test --profiles-dir .` | PASS=33 |
| Metabase | `curl https://metabase.<domain>/api/health` | `{"status":"ok"}` |
| Webhook | `curl -X POST https://webhook.<domain>/health` | `200 OK` |
| Slack webhook | `curl -X POST -H 'Content-Type: application/json' -d '{"text":"smoke"}' "$SLACK_WEBHOOK_URL"` | `ok` (HTTP 200) |

---

## 6. Monitoring & alerting (Day-2 ops)

### 6.1 Liveness checks
- **k8s CronJob status**: cluster monitoring (Prometheus + Alertmanager hoặc tương đương) bắt `kube_cronjob_status_last_schedule_time` stale > 24h, hoặc `kube_job_failed{namespace="gitlab-analytics"} > 0`. Backup defence-in-depth: `etl_entrypoint.sh` ERR trap gửi Slack ngay khi job fail (xem `src/infra/k8s/etl_entrypoint.sh:21-32`).
- **GitLab CI**: build/deploy job fail → email tới owner (built-in)
- **Pipeline state** (DB-level, agnostic of compute layer): cron `*/30 * * * *` query `gitlab_raw.pipeline_state` (psql + curl Slack), alert nếu:
  - `consecutive_failures ≥ 3`
  - `last_successful_run > 24h ago`

  Reference query (paste vào cron script):
  ```bash
  failures=$(psql "$DATABASE_URL" -tAc "SELECT value FROM gitlab_raw.pipeline_state WHERE key='consecutive_failures'")
  if [ "${failures:-0}" -ge 3 ]; then
    curl -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\":rotating_light: pipeline DEGRADED — consecutive_failures=$failures\"}" \
      "$SLACK_WEBHOOK_URL"
  fi
  ```
- **Postgres**: `pg_isready` mỗi 5 phút, alert nếu down 2 lần liên tiếp
- **Metabase**: `/api/health` mỗi 5 phút

### 6.2 Capacity
- Postgres disk usage > 70% → cảnh báo → review retention (truncate `gitlab_raw.pipeline_jobs` cũ > 90 ngày)
- Webhook 5xx rate > 1% → review `gitlab_raw.webhook_dlq`

### 6.3 Compliance alert (business)
- `compliance_alert` step inside `etl-daily-pipeline` CronJob → Slack `#qa-compliance` với top violations

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GitLab API rate limit | Medium | High | Client có retry + backoff; backfill chia nhỏ `--since-days` |
| Token revoked | Low | High | Triage cron phát hiện 401 → alert; có backup token rotation runbook |
| Migration phá views | Medium | Medium | `CASCADE` drop view (migration 008 pattern), dbt rebuild auto |
| dlt schema drift | Medium | High | `schema_snapshot.yaml` là source of truth; `/check-drift` chạy SessionStart |
| Webhook flood (push event spam) | Low | Medium | DLQ table; rate limit nginx |
| Postgres OOM | Low | Critical | `shared_buffers` tune theo RAM; backup test monthly |
| Slack webhook URL leak | Low | Medium | CI variable masked; rotate quarterly |

---

## 8. Sign-off

| Role | Name | Sign-off |
|---|---|---|
| Tech Lead | | __________ |
| DevOps | | __________ |
| QA Manager | | __________ |
| Eng Manager | | __________ |

---

## 9. Tham chiếu

- `docs/ops/ops_runbook.md` — triage chi tiết khi pipeline fail
- `docs/ops/TROUBLESHOOTING.md` — known issues + fix
- `docs/ai/PROJECT_MAP.md` — module map cho dev
- `LOCAL_SETUP.md` — dev environment (khác prod)
- `.gitlab-ci.yml` — unit tests + build/push ETL image + deploy k8s manifests
- `deploy/k8s/` — k8s manifests (3 CronJobs + ConfigMap + ServiceAccount + namespace)
- `src/infra/Dockerfile.etl` + `src/infra/k8s/etl_entrypoint.sh` — ETL image + workload dispatch script
- `src/infra/docker-compose.yml` — Postgres + Metabase + webhook (VM-side)
