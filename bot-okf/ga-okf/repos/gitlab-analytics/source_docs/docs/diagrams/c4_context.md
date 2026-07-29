---
title: C4 Context Diagram — GitLab Compliance Analytics Platform
sdd_section: "2.1"
level: 1 (Context)
snapshot_date: 2026-05-20
source: SDD §2.1 + CLAUDE.md §Architecture
---

# C4 Context — Level 1

> Zoom out nhất. Hệ thống `gitlab-analytics` đứng giữa các actor (con người sử dụng
> sản phẩm) và 4 external system (GitLab, Postgres DBA cluster, Slack, Metabase).
> Không có chi tiết internal container — đó là Level 2 ([c4_container.md](./c4_container.md)).

## Diagram

```mermaid
flowchart TB
    %% ========== ACTORS ==========
    dev["👤 Developer<br/>(100+ devs across FPT)<br/><i>push code, open MR</i>"]
    em["👤 Eng Manager<br/>(team leads)<br/><i>read compliance dashboard</i>"]
    qa["👤 QA Manager<br/><i>audit MR compliance,<br/>trigger investigations</i>"]
    devops["👤 DevOps / Healer<br/>(&lt;3 ops headcount)<br/><i>operate pipeline,<br/>triage incidents</i>"]
    csoc["👤 CSOC<br/><i>rotate tokens annually,<br/>review security</i>"]

    %% ========== SYSTEM IN SCOPE ==========
    subgraph SYS["🎯 GitLab Compliance Analytics Platform &nbsp; (ENG-ANA-001, Pattern B)"]
        direction TB
        sys_core["Extract MRs/commits/pipelines<br/>→ score against MR Compliance Guide v1.6<br/>→ surface violations + KPI dashboards<br/>→ alert Slack on BLOCKER"]
    end

    %% ========== EXTERNAL SYSTEMS ==========
    gitlab[("🔗 GitLab EE v18<br/>git.fpt.net<br/><i>REST API v4 + Webhook (Phase 2)</i>")]
    pg[("🔗 PostgreSQL 16.13<br/>DBA-managed cluster<br/><i>schemas: gitlab_raw, gitlab_kpi_staging,<br/>gitlab_kpi, gitlab_raw_staging</i>")]
    slack[("🔗 Slack workspace FPT<br/><i>Incoming Webhook<br/>#ops-alert, daily digest</i>")]
    metabase[("🔗 Metabase OSS v0.59<br/><i>53 cards across<br/>collections A-F</i>")]

    %% ========== EDGES — actors → system ==========
    dev -- "push code, open MR (event source, indirect)" --> gitlab
    em -- "view A/B/C/D dashboards" --> metabase
    qa -- "audit violations, V_compliance_*" --> metabase
    devops -- "kubectl logs, psql, ops:triage CI job" --> SYS
    csoc -- "rotate GITLAB_TOKEN<br/>(K8s Secret, 1y lifetime)" --> SYS

    %% ========== EDGES — system → external ==========
    SYS -- "GET /api/v4/projects/:id/merge_requests<br/>HTTPS + Private-Token" --> gitlab
    SYS -- "INSERT/SELECT via psycopg2<br/>pg wire protocol :5432 + TLS" --> pg
    SYS -- "POST JSON {text, blocks}<br/>HTTPS webhook" --> slack
    metabase -- "SELECT v_* read-only<br/>role: metabase_reader" --> pg

    %% ========== STYLING ==========
    classDef actor fill:#08427b,stroke:#073b6f,color:#fff
    classDef system fill:#1168bd,stroke:#0b4884,color:#fff
    classDef external fill:#999,stroke:#666,color:#fff
    class dev,em,qa,devops,csoc actor
    class SYS,sys_core system
    class gitlab,pg,slack,metabase external
```

## Legend

| Shape | Meaning |
|---|---|
| Person box `👤` | Human actor (Developer, Manager, Ops) |
| Solid box `🎯` | System in scope of this design |
| Database cylinder `🔗 (..)` | External system (out of scope — black box) |
| Arrow | Synchronous interaction; label = protocol + intent |

## Key decisions reflected here

- **Single tenant** — 1 GitLab group (id=756, see `.claude/memory/known_projects.yaml`), no multi-tenancy.
- **Postgres is EXTERNAL**, DBA-managed (SDD §8.2) — not deployed in our K8s namespace.
- **Metabase read-only** to Postgres (separate role `metabase_reader`, SDD §7.3) — never writes back.
- **Slack outbound only** — we POST, never receive. (Webhook receiver for GitLab events is Phase 2, distinct flow.)
- **CSOC owns token lifecycle** — yearly GAT rotation (SDD §4.2).

## What's NOT in this diagram

- Container-level decomposition → see [c4_container.md](./c4_container.md)
- Sequence of operations → see [seq_daily_etl.md](./seq_daily_etl.md)
- DB schema → see [`docs/reference/db_erd.md`](../reference/db_erd.md)
