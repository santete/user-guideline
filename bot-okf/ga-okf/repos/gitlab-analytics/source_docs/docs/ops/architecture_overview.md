# Architecture Overview — DevOps + DBA single-page

> **Mục đích**: 1 trang để DevOps + DBA nắm cùng bức tranh: bao nhiêu workload phải deploy, mỗi workload connect xuống schema nào.
> **Snapshot**: 2026-06-09 — verified against actual code (`deploy/k8s/`, `src/infra/k8s/etl_entrypoint.sh`).
> **Companion files**: `db_accounts.md` (account proposal), `db_services_matrix.md` (10 services × 4 schemas), `k8s_cronjob_handover.md` (apply order + cron schedules).

---

## 1. Câu hỏi đầu tiên: bao nhiêu service phải deploy?

**Không phải 1 endpoint = 1 service**. Pattern hiện tại:

| Loại workload | Số instance k8s | Container image | Entry |
|---|---|---|---|
| **Long-running HTTP service** | 1 Deployment + 1 Service | `webhook:<sha>` | FastAPI `src/webhook/app.py` — `POST /webhook/gitlab` |
| **Batch jobs (CronJob)** | **14 CronJob** (4 scheduled + 10 ops suspended) | `etl:<sha>` *(1 image dùng chung)* | `etl_entrypoint.sh` dispatch theo `$JOB_NAME` |
| **3rd party** | (external pod, do team viz quản) | Metabase OSS | UI port `:3000` |

→ Repo này chịu trách nhiệm deploy **2 workload thật**:
- `webhook` Deployment (1 image, 1 Service) — **hiện DevOps tự deploy standalone**, manifests KHÔNG nằm trong `deploy/k8s/` repo này.
- `etl` image (1 build artifact, dùng cho 14 CronJob spec) — manifests trong `deploy/k8s/cronjob-*.yaml`.

Metabase là 3rd party OSS, không build từ repo.

---

## 2. Architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  GitLab EE (git.fpt.net)                                                      │
│   ├─ REST API v4  ◄─── HTTPS GET (poll, incremental updated_after)           │
│   └─ Webhook out  ───► HTTPS POST event JSON                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                │                                            │
                │ poll                                       │ push event
                ▼                                            ▼
┌─────────────────────────────────────┐    ┌──────────────────────────────────┐
│  k8s ns: gitlab-analytics           │    │  k8s ns: <devops-managed>        │
│  ┌───────────────────────────────┐  │    │  ┌────────────────────────────┐  │
│  │ CronJob × 14 (image `etl`)    │  │    │  │ Deployment: webhook (Fast  │  │
│  │  dispatcher: etl_entrypoint.sh│  │    │  │  API) — 1 Service ClusterIP│  │
│  │                               │  │    │  │  POST /webhook/gitlab      │  │
│  │ Scheduled (4):                │  │    │  │  asyncpg pool (single)     │  │
│  │  • daily-pipeline  02:00      │  │    │  └─────────┬──────────────────┘  │
│  │  • freshness-alert 02:30      │  │    │            │                     │
│  │  • retention Sun   03:00      │  │    └────────────┼─────────────────────┘
│  │  • dbt-full-refresh M1 04:00  │  │                 │
│  │                               │  │                 │ DATABASE_URL
│  │ Ops suspended (10) — kubectl  │  │                 │ (5432)
│  │  create job --from=cronjob/...│  │                 │
│  │  triage|extract|extract-back  │  │                 │
│  │  fill|dbt-run|reset-failures  │  │                 │
│  │  reset-cursors|mig-004|mig-005│  │                 │
│  │  p4-cutover|setup-metabase    │  │                 │
│  └─────────┬─────────────────────┘  │                 │
│            │                        │                 │
│  ┌─────────┴────────┐  ┌─────────┐  │                 │
│  │ ExternalSecret   │  │ Service │  │                 │
│  │  → Vault sync    │  │ Account │  │                 │
│  └──────────────────┘  └─────────┘  │                 │
└──────────────────────┬──────────────┘                 │
                       │ DATABASE_URL                   │
                       │ (5432)                         │
                       ▼                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (DBA managed)                                                     │
│                                                                               │
│  ┌────────────────────────┐  ┌────────────────────────┐                      │
│  │ gitlab_raw_staging     │  │ gitlab_raw             │                      │
│  │  (dlt transient)       │──▶ (raw API mirror)       │  ◄── ETL (dlt MERGE) │
│  │  ETL only              │  │  ETL: INSERT/UPDATE     │  ◄── Webhook write  │
│  │                        │  │  dbt: SELECT (source)   │                     │
│  └────────────────────────┘  └────────────┬───────────┘                      │
│                                           │ dbt source()                     │
│                                           ▼                                  │
│                              ┌────────────────────────┐                      │
│                              │ gitlab_kpi_staging     │                      │
│                              │  (dbt stg_* views)     │  ◄── dbt run         │
│                              └────────────┬───────────┘                      │
│                                           │ dbt ref()                        │
│                                           ▼                                  │
│                              ┌────────────────────────┐                      │
│                              │ gitlab_kpi             │                      │
│                              │  (dbt v_* marts/views) │  ◄── dbt run         │
│                              └────────────┬───────────┘                      │
│                                           │                                  │
│                                           ├────── SELECT ──┐                 │
│                                           │                │                 │
└───────────────────────────────────────────┼────────────────┼─────────────────┘
                                            │                │
                                            ▼                ▼
                                    ┌──────────────┐  ┌──────────────────┐
                                    │ Alert/Report │  │ Metabase OSS     │
                                    │ (chạy trong  │  │ (external pod,   │
                                    │  daily-pipe  │  │  port 3000)      │
                                    │  line CronJ) │  │                  │
                                    │ → Slack      │  │ → Browser/UI     │
                                    └──────────────┘  └──────────────────┘
```

---

## 3. Mapping cho DBA — process nào connect schema nào

| Workload (process) | Account proposal | Schema scope | Mode |
|---|---|---|---|
| `etl` CronJob — `daily-pipeline / extract / extract-backfill` (dlt) | `app_etl` | `gitlab_raw_staging` + `gitlab_raw` | RW + CREATE TABLE |
| `etl` CronJob — `daily-pipeline / dbt-run / dbt-full-refresh / p4-cutover` (dbt) | `app_transform` | `gitlab_kpi_staging` + `gitlab_kpi` (RW + CREATE VIEW); `gitlab_raw` (R) | RW / R |
| `etl` CronJob — `daily-pipeline → compliance-alert` + `freshness-alert` | `analytics_ro` | `gitlab_kpi` + `gitlab_raw` (freshness count) | R |
| `etl` CronJob — `migration-004/005`, `retention`, `reset-*`, `triage` | `app_etl` (cùng pool) | `gitlab_raw.pipeline_state` + DDL | RW + ALTER |
| `etl` CronJob — `setup-metabase` | (Metabase API, không phải DB) | — | — |
| `webhook` Deployment (asyncpg) | `app_etl` (write) + `analytics_ro` (read v_*) — **2 pool** | `gitlab_raw` (W) + `gitlab_kpi` (R) | R/W mixed |
| **Metabase external** | `metabase_ro` (đề xuất riêng) | `gitlab_kpi` only | R |

→ Cross-schema invariant: KHÔNG có account nào có quyền write cả `gitlab_raw` + `gitlab_kpi`. Detail rule + grep self-check: `docs/reference/schema_reference.md §"Cross-schema invariant"`.

→ Detail SQL grant: `docs/ops/db_accounts.md §3`.

---

## 4. Mapping cho DevOps — workload count + config

**Build artifacts cần CI produce**:
- `etl:<sha>` — 1 image, dispatcher `etl_entrypoint.sh`, dùng cho 14 CronJob
- `webhook:<sha>` — 1 image, FastAPI, dùng cho Deployment (manifests DevOps tự quản)

**k8s objects trong `deploy/k8s/` (repo này)**:
- 1 Namespace (`gitlab-analytics`)
- 1 ServiceAccount
- 1 ConfigMap (env không nhạy cảm)
- 1 ExternalSecret → Vault sync ra k8s Secret `gitlab-analytics-secrets`
- 14 CronJob (4 scheduled + 10 suspended ops) — cùng image `etl`
- **0 Service / Ingress** (webhook standalone, không nằm repo này)

**Cron schedules** (4 scheduled — chi tiết `k8s_cronjob_handover.md §3`):
- `etl-daily-pipeline`     `0 2 * * *`   (02:00 UTC+7) — extract → dbt → alert
- `etl-freshness-alert`    `30 2 * * *`  (02:30 UTC+7) — Layer 1 observability
- `etl-retention`          `0 3 * * 0`   (Chủ nhật 03:00) — DELETE + VACUUM pipeline_jobs
- `etl-dbt-full-refresh`   `0 4 1 * *`   (mùng 1 04:00) — monthly drift catch-up

**Suspended ops** (10) — operator chạy tay:
```
kubectl create job --from=cronjob/etl-ops-<name> <name>-$(date +%s)
```
Trong đó `<name>` ∈ `triage | extract | extract-backfill | dbt-run | reset-failures | reset-cursors | migration-004 | migration-005 | p4-cutover | setup-metabase`.

**Secrets từ Vault** (qua ExternalSecret) — chi tiết `db_services_matrix.md §"Vault JSON keys"`:
- 3 URL: `GITLAB_TOKEN`, `DATABASE_URL`, `SLACK_WEBHOOK_URL`
- 5 dbt rời: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- 1 Metabase setup: `METABASE_USER` / `METABASE_PASSWORD`

→ DevOps chỉ cần config: 1 image registry path + 1 Vault SecretStore CR + 4 cron schedules. 10 ops jobs để suspended sẵn.

---

## 5. Gap hiện tại (chưa cover)

| Gap | Workaround tạm | Long-term |
|---|---|---|
| Migrations 001-003 (init schemas + init tables + seed) chưa có CronJob | DBA chạy tay 1 lần khi first-deploy — xem `db_accounts.md §3` | Thêm `cronjob-ops-migration-init.yaml` (suspended) |
| Webhook deploy ngoài repo | DevOps tự quản 1 Deployment + Service | Cân nhắc đưa về `deploy/k8s/` để versioned cùng code |
| Metabase deploy ngoài repo | Team viz tự quản | Giữ nguyên — không phải scope analytics team |

---

## Cross-references

- `docs/ops/db_accounts.md` — Account proposal (3-4 functional account) + SQL grants
- `docs/ops/db_services_matrix.md` — 10 services × 4 schemas chi tiết
- `docs/ops/k8s_cronjob_handover.md` — Apply order + cron schedule + first-deploy 9-step TODO
- `docs/reference/schema_reference.md §"Cross-schema invariant"` — Rule + grep self-check
- `docs/reference/db_inventory.md` — Schema sizes + table list
- `deploy/k8s/kustomization.yaml` — Apply order source of truth
- `src/infra/k8s/etl_entrypoint.sh` — Dispatcher source of truth
