---
title: Sequence Diagram — Daily ETL (cron 02:00 SEAST)
sdd_section: "5.1"
flow_id: F1
sla: "end-to-end ≤ 2h"
snapshot_date: 2026-05-20
source: SDD §5.1 + .gitlab-ci.yml + src/extraction/pipeline.py
---

# Sequence — Flow 1: Daily ETL Extraction

> Critical path. Cron `0 19 * * * UTC` (= 02:00 SEAST) → resync incremental MRs /
> commits / pipelines from GitLab vào Postgres, run dbt, alert Slack. SLA: 2h
> end-to-end. Liên quan SDD §5.1, §5.2 (dbt incremental), §7.2 (retry policy).

## Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Cron as ⏰ K8s CronJob<br/>(02:00 SEAST)
    participant Run as run.py / pipeline.py
    participant CP as checkpoint.py
    participant State as gitlab_raw.pipeline_state
    participant GL as 🔗 GitLab API v4
    participant Val as Pydantic validator
    participant DLT as dlt pipeline
    participant Raw as gitlab_raw.*
    participant DBT as dbt run
    participant Stg as gitlab_kpi_staging.*<br/>(9 stg_* views)
    participant KPI as gitlab_kpi.*<br/>(marts)
    participant Alert as alerter
    participant Slack as 🔗 Slack webhook

    Cron->>Run: trigger main(--since-days=7)
    Note over Run: ENV: GITLAB_URL, GITLAB_TOKEN,<br/>DATABASE_URL, SLACK_WEBHOOK_URL

    Run->>CP: get_last_cursor(per resource)
    CP->>State: SELECT cursor_value<br/>WHERE resource = $1
    State-->>CP: last_mr_updated_at,<br/>last_commit_date, ...
    CP-->>Run: cursors dict

    Note over Run,DLT: Build dlt pipeline (postgres dest)<br/>+ register 8 @resource

    loop For each of 8 resources<br/>(MR, commits, pipelines,<br/>mr_commits, mr_notes,<br/>pipeline_jobs, test_reports, members)
        Run->>GL: GET endpoint(updated_after=cursor,<br/>page=N, per_page=100)
        GL-->>Run: JSON rows
        loop For each row yielded
            Run->>Val: schema_validator.validate(row)
            alt Pydantic OK
                Val-->>Run: typed model
                Run->>DLT: yield row
            else ValidationError
                Val-->>Run: ❌ drop + log warning
            end
        end
        DLT->>Raw: dlt merge(<br/>primary_key=PK,<br/>write_disposition='merge')
        Note over Raw: stages in gitlab_raw_staging<br/>→ MERGE into gitlab_raw
        Run->>CP: write_checkpoint(resource, max_cursor)
        CP->>State: UPSERT cursor + last_run_ts<br/>(atomic, after dlt commits)
    end

    alt All resources succeeded
        Run->>State: consecutive_failures = 0
    else Any resource fails after 3 retries
        Run->>State: consecutive_failures++
        Note over Run,State: CLAUDE.md constraint #6:<br/>max 3 → healer escalates
    end

    Run->>DBT: dbt run --threads 1<br/>(avoid parallel DROP VIEW deadlock)

    Note over DBT,KPI: dbt builds in topological order:<br/>raw → staging → marts
    DBT->>Raw: SELECT FROM gitlab_raw.*<br/>(staging model bodies)
    DBT->>Stg: CREATE OR REPLACE VIEW<br/>9 stg_* views (materialized=view)<br/>schema = profile.gitlab_kpi + "_staging"
    Note over Stg: cleans NULL, casts type,<br/>derives is_rebased / is_ui_related etc.<br/>0 disk (view-only)

    DBT->>Stg: SELECT FROM gitlab_kpi_staging.stg_*<br/>(every mart ref()s here, not raw)
    DBT->>KPI: CREATE/INSERT marts<br/>21 views + delete+insert v_mr_score_breakdown<br/>(incremental, composite UK [id, criterion_name])<br/>+ 2 tables + 1 seed
    Note over DBT,KPI: SDD §5.2:<br/>post_hook DELETE WHERE created_at<br/>< now() - 90d (rolling eviction)
    DBT-->>Run: 33/33 models PASS<br/>(9 staging + 24 marts source files)

    Run->>Alert: invoke compliance_alert.py
    Alert->>KPI: SELECT * FROM v_compliance_violation_detail<br/>WHERE severity = 'BLOCKER'<br/>AND mr_id NOT IN (alerted_mr_ids)
    KPI-->>Alert: new BLOCKER rows
    alt Found new BLOCKERs
        Alert->>Slack: POST {text, blocks}<br/>HTTPS hooks.slack.com
        Slack-->>Alert: 200 OK
        Alert->>KPI: INSERT INTO alerted_mr_ids<br/>(TTL 24h dedup)
    else No new BLOCKERs
        Note over Alert: skip (idempotent)
    end

    Run-->>Cron: exit 0 (success)<br/>OR exit 1 + Slack escalation

    Note over Cron,Slack: 09:00 SEAST daily digest<br/>(separate cron, not shown):<br/>POST aggregated KPI to Eng Mgr + QA
```

## Error handling per phase

Reference: SDD §5.1 "Error handling cho flow này" + CLAUDE.md Loop Logic table.

| Phase / actor | Failure mode | Action | Max retry |
|---|---|---|---|
| Cursor read (CP↔State) | PG down | retry psycopg2 connect 3× | 3 |
| GitLab GET (Run→GL) | 5xx / timeout | exponential backoff 1s, 2s, 4s | 3 |
| GitLab GET (Run→GL) | 429 rate limit | sleep `Retry-After` then resume | unlimited (1 worker per resource) |
| GitLab GET (Run→GL) | 403 on specific project (e.g. 4618) | log warn + skip project, continue iteration | n/a |
| Pydantic (Run→Val) | ValidationError | drop row + log; if **all** rows of a resource invalid → fail resource | n/a |
| dlt merge (DLT→Raw) | schema cache stale | manual scrub `~/.dlt/.../schema.json` + `bump_version_if_modified` | 1 |
| dlt merge (DLT→Raw) | cursor advanced but rows not loaded | manual reset cursor to `MAX(<watermark>)` then retry | 1 |
| dbt run (DBT→Stg or DBT→KPI) | model fails | retry once; if still fails → escalate (data may be partial). Staging fail blocks marts (topological dep) | 1 |
| Slack POST (Alert→Slack) | webhook 4xx/5xx | retry 3× backoff; if still fails → log + continue (alert is best-effort) | 3 |
| Any (3 retries exhausted) | — | `consecutive_failures++`; healer POSTs #ops-alert at ≥3, STOP | hard cap 3 |

## Timing budget (target)

> Step numbers are illustrative — `autonumber` re-counts on every edit. Treat phases as labels, not hardcoded step IDs.

| Phase | Target wall-clock | Notes |
|---|---|---|
| Cursor read (Run ↔ State) | < 1s | Single UPSERT batch |
| GitLab extract (Run ↔ GL loop) | 30–90 min | 8 resources × ~500 pages; 1 worker each (avoid rate limit) |
| dbt build staging (DBT → Stg) | ~30s | 9 view DDL — cheap, no data move |
| dbt build marts (DBT → KPI) | 5–10 min | 24 marts + incremental `v_mr_score_breakdown` (delete+insert), `--threads 1` |
| Alerter (Alert ↔ Slack) | < 1 min | 1 SELECT + 0–N Slack POSTs |
| **Total** | **≤ 2h** | SLA per SDD §5.1 |

## Cross-references

- Sequence of dbt incremental compute (per-MR scoring) → SDD §5.2 (no separate diagram — covered by `DBT → Stg → KPI` block here).
- Webhook event flow (Phase 2) → SDD §5.3 (not deployed yet).
- Component-level zoom of extractor → [c4_component_extractor.md](./c4_component_extractor.md).
- Schema layering raw → stg → marts → [`docs/reference/db_inventory.md`](../reference/db_inventory.md).
- ERD of `gitlab_raw.*` tables → [`docs/reference/db_erd.md`](../reference/db_erd.md).
