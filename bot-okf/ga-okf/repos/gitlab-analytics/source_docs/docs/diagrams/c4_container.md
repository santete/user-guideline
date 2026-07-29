---
title: C4 Container Diagram — gitlab-analytics
sdd_section: "2.2"
level: 2 (Container)
snapshot_date: 2026-05-20
source: SDD §2.2 + §8.1 + CLAUDE.md §Layer map
---

# C4 Container — Level 2

> Zoom 1 cấp vào "GitLab Compliance Analytics Platform". Mỗi container = đơn vị
> deploy độc lập (K8s CronJob, Deployment, hoặc external service). Tech stack
> + protocol + ownership được note inline.

## Diagram

```mermaid
flowchart TB
    %% ========== ACTORS (collapsed from L1) ==========
    consumers["👤 Consumers<br/>Dev / Eng Mgr / QA / DevOps"]

    %% ========== EXTERNAL SYSTEMS ==========
    gitlab[("🔗 GitLab EE v18<br/>REST API v4<br/>+ Webhook events (P2)")]
    slack[("🔗 Slack Webhook<br/>(Incoming)")]
    pg_ext[("🗄️ PostgreSQL 16.13<br/>DBA-managed cluster<br/><i>EXTERNAL to K8s namespace</i>")]

    %% ========== SYSTEM BOUNDARY ==========
    subgraph K8S["☸️  K8s Namespace: gitlab-analytics &nbsp;&nbsp;(CSOC managed)"]
        direction TB

        subgraph EXTRACT["📦 Extractor &nbsp;(K8s CronJob, 0 19 * * * UTC = 02:00 SEAST)"]
            extractor["dlt Pipeline (Python 3.11)<br/>src/extraction/<br/><i>polling, incremental cursor<br/>write_disposition=merge</i>"]
            healer["Healer<br/>src/healer/ + ops:triage CI job<br/><i>read pipeline_state<br/>max 3 retries → escalate</i>"]
        end

        subgraph WEBHOOK["📦 Webhook Receiver &nbsp;(K8s Deployment, 2 replicas HA — Phase 2)"]
            webhook["FastAPI 0.115+ (Python)<br/>src/webhook/<br/><i>HMAC validate event_uuid<br/>idempotency 24h TTL</i>"]
        end

        subgraph TRANSFORM["📦 Transformer &nbsp;(dbt run after extract, same CronJob)"]
            dbt["dbt Core 1.8+<br/>src/transform/models/<br/><i>staging → marts<br/>v_mr_score_breakdown<br/>incremental delete+insert</i>"]
        end

        subgraph ALERT["📦 Alerter &nbsp;(CronJob: post-transform + daily 09:00)"]
            alerter["compliance_alert.py<br/>src/alerting/<br/><i>SELECT v_violations<br/>POST Slack, dedupe alerted_mr_ids</i>"]
            updater["Compliance updater<br/>src/compliance_updater/<br/><i>regen SQL from compliance_spec.yaml</i>"]
        end

        subgraph VIZ["📦 Metabase &nbsp;(K8s Deployment, 1 replica, PVC 5GB)"]
            metabase["Metabase OSS v0.59.4.2<br/>+ setup_dashboards.py<br/>src/metabase/<br/><i>53 cards, 5 RBAC groups</i>"]
        end
    end

    %% ========== DATABASE SCHEMAS (logical within Postgres) ==========
    subgraph PGSCH["🗄️ Postgres schemas (inside pg_ext)"]
        direction LR
        sch_raw[("gitlab_raw<br/>13 tables, 278 MB")]
        sch_kpi_stg[("gitlab_kpi_staging<br/>9 stg_* views, 0 B<br/><i>dbt staging layer</i>")]
        sch_kpi[("gitlab_kpi<br/>21 views + 4 tables/seed, 93 MB")]
        sch_raw_stg[("gitlab_raw_staging<br/>dlt transient, 22 MB")]
        sch_state[("pipeline_state<br/>cursors + consecutive_failures")]
    end

    %% ========== FLOWS ==========
    %% Extract path
    gitlab -- "HTTPS GET<br/>Private-Token, page=N&per_page=100" --> extractor
    extractor -- "dlt merge<br/>psycopg2 + TLS :5432" --> sch_raw
    extractor -- "atomic UPDATE cursors" --> sch_state
    extractor -- "stages new rows" --> sch_raw_stg
    sch_raw_stg -- "dlt copy" --> sch_raw
    healer -- "SELECT consecutive_failures" --> sch_state
    healer -- "POST escalation" --> slack

    %% Event path (Phase 2)
    gitlab -. "HTTPS POST<br/>X-Gitlab-Event + HMAC" .-> webhook
    webhook -. "INSERT raw event<br/>jsonb payload" .-> sch_raw

    %% Transform path (raw → stg → marts)
    dbt -- "SELECT FROM gitlab_raw.*" --> sch_raw
    dbt -- "CREATE OR REPLACE VIEW<br/>(9 stg_* views, materialized=view)" --> sch_kpi_stg
    sch_kpi_stg -- "ref('stg_*')<br/>every mart depends on staging" --> sch_kpi
    dbt -- "CREATE/INSERT marts<br/>(21 views + 1 incremental + 2 table + 1 seed)" --> sch_kpi

    %% Alert path
    alerter -- "SELECT v_violations,<br/>v_compliance_mgmt" --> sch_kpi
    alerter -- "POST {text, blocks}" --> slack
    updater -- "regen src/transform/models/marts/<br/>v_compliance_violation_detail.sql" --> dbt

    %% Viz path
    metabase -- "SELECT (role: metabase_reader)" --> sch_kpi
    consumers -- "browse cards" --> metabase
    consumers -- "kubectl logs, psql" --> EXTRACT

    %% Schema connection to external pg
    sch_raw     --> pg_ext
    sch_kpi     --> pg_ext
    sch_kpi_stg --> pg_ext
    sch_raw_stg --> pg_ext
    sch_state   --> pg_ext

    %% ========== STYLING ==========
    classDef container fill:#1168bd,stroke:#0b4884,color:#fff
    classDef external fill:#999,stroke:#666,color:#fff
    classDef store fill:#438dd5,stroke:#2e6295,color:#fff
    classDef actor fill:#08427b,stroke:#073b6f,color:#fff
    class extractor,healer,webhook,dbt,alerter,updater,metabase container
    class gitlab,slack,pg_ext external
    class sch_raw,sch_kpi,sch_kpi_stg,sch_raw_stg,sch_state store
    class consumers actor
```

## Container catalog

| # | Container | Tech | Deploy | Owner agent | Source |
|---|---|---|---|---|---|
| 1 | **Extractor** | Python 3.11 + dlt 1.4+ | K8s CronJob (`0 19 * * * UTC`) | `extractor` (Pattern B) | `src/extraction/` |
| 2 | **Healer** | Python + psycopg2 | Same CronJob + `ops:triage` (.gitlab-ci.yml) | `healer` | `src/healer/` |
| 3 | **Webhook Receiver** *(Phase 2)* | FastAPI 0.115+ + Pydantic | K8s Deployment, 2 replicas, HPA on CPU>70% | `extractor` | `src/webhook/` |
| 4 | **Transformer (dbt)** | dbt Core 1.8+ | Run inline after extractor | `transformer` | `src/transform/models/` |
| 5 | **Alerter** | Python + Slack SDK | CronJob (post-transform + daily 09:00) | `alerter` | `src/alerting/compliance_alert.py` |
| 6 | **Compliance updater** | Python codegen | On-demand `python -m src.compliance_updater apply` | `transformer` | `src/compliance_updater/` |
| 7 | **Metabase** | Metabase OSS v0.59 | K8s Deployment, 1 replica, PVC 5GB H2 metadata | `transformer` (dashboards) | `src/metabase/setup_dashboards.py` |
| 8 | **PostgreSQL** | PG 16.13 (Alpine) | **EXTERNAL** — DBA cluster | — (consumed) | `src/infra/db/migrations/` |

## Data store catalog (logical, all inside one PG cluster)

| Schema | Purpose | Owner role | Size (2026-05-20) |
|---|---|---|---|
| `gitlab_raw` | dlt landing zone — 13 tables (MR, commits, pipelines, ...) | `dlt_writer` | 278 MB |
| `gitlab_kpi_staging` | **dbt staging layer** — 9 `stg_*` views, every mart `ref()`-s here. Materialized=view → 0 disk. | `dlt_writer` (write); internal only | 0 B |
| `gitlab_kpi` | dbt marts — 21 views + 1 incremental table (`v_mr_score_breakdown`) + 2 tables + 1 seed | `dlt_writer` (write), `metabase_reader` (read) | 93 MB |
| `gitlab_raw_staging` | dlt transient staging during merge (NOT consumed by marts) | `dlt_writer` | 22 MB |
| `gitlab_raw.pipeline_state` | extraction cursors + consecutive_failures | `dlt_writer` | <1 MB |

> **Naming gotcha**: cùng có chữ "staging" nhưng `gitlab_kpi_staging` (dbt-managed views) và `gitlab_raw_staging` (dlt transient tables) là **2 schema khác hoàn toàn**. dbt suffix `_staging` từ `dbt_project.yml: staging.+schema: staging` ghép với profile target `gitlab_kpi`. dlt suffix `_staging` là default convention của dlt destination.

## Deployment notes (SDD §8.1)

- **Replicas**: webhook 2 (HA), Metabase 1 (OSS limit, H2 metadata), Extractor 1 (cron-driven, no HPA).
- **Resource quota**: 2 vCPU / 4 GB RAM / 5 GB PVC (Metabase + webhook only). Extractor uses ephemeral CronJob pod.
- **Auto-scaling**: HPA only on webhook (CPU > 70%). Extractor stays at 1 (avoid GitLab rate limit).
- **Network**: outbound to `git.fpt.net:443`, `hooks.slack.com:443`, DBA cluster `:5432`. No inbound (Phase 2 will open ingress for `/v1/webhook`).

## Trust boundaries

```
┌──────────────────────── INTERNET ────────────────────────┐
│   (none — system is fully on-prem / internal network)    │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────── FPT internal network ────────────────┐
│  git.fpt.net  ←─── HTTPS + Private-Token ─── extractor    │
│  hooks.slack.com ← HTTPS POST ──────────────── alerter    │
│                                                           │
│  ┌─────── K8s namespace (CSOC) ──────────┐                │
│  │  extractor, webhook, dbt, alerter,    │                │
│  │  metabase   (all containers above)    │                │
│  └────────────────┬──────────────────────┘                │
│                   │ pg wire :5432 + TLS                   │
│  ┌────────────────▼────────────────────┐                  │
│  │  Postgres cluster (DBA-managed,      │                  │
│  │  EXTERNAL to K8s namespace)          │                  │
│  └─────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```
