# Project Map — GitLab Analytics Pipeline

> "Bản đồ" để AI agent hiểu nhanh kiến trúc project. Đọc file này TRƯỚC khi
> đoán file ở đâu. Cập nhật khi cấu trúc thay đổi đáng kể.

Project: **gitlab-analytics** v1.0.0 — Automated compliance monitoring cho 100+ devs (companion to ENG-STD-MR-002 v1.2).

---

## Tech Stack

- **Language**: Python 3.11 (`requires-python = ">=3.11"` in `pyproject.toml`)
- **ETL framework**: `dlt[postgres]>=0.4.0` (incremental load, `write_disposition="merge"`)
- **Web framework**: FastAPI ≥0.109 (webhook receiver) + Uvicorn
- **DB**: PostgreSQL — `psycopg2-binary` (sync) + `asyncpg` (webhook async)
- **Transform**: dbt Core (`dbt-postgres>=1.7.0`, dev dep) — models in `src/transform/`
- **Validation**: Pydantic ≥2.5
- **Logging**: structlog ≥24
- **Test**: pytest ≥7.4 + pytest-asyncio + httpx
- **Lint / Format**: ruff (line-length 100, target py311)
- **Typecheck**: mypy ≥1.8
- **Package manager**: pip + pyproject.toml (no lockfile committed; uv-compatible)
- **Source GitLab**: GitLab EE v18 self-hosted, REST API v4, auth via `PRIVATE-TOKEN`
- **Viz**: Metabase OSS (port 3000) — read-only PG user `analytics_ro`
- **Alert**: Slack Incoming Webhook (HTTPS POST JSON)

---

## Build / Test / Lint Commands

| Task | Command |
|------|---------|
| Install (runtime)    | `pip install -e .` |
| Install (dev)        | `pip install -e ".[dev]"` |
| Run extraction       | `python -m src.extraction.pipeline --since-days 7` |
| Run extraction (backfill) | `python -m src.extraction.pipeline --since-days 30 --backfill` |
| Run dbt              | `cd src/transform && dbt run` |
| Run dbt tests        | `cd src/transform && dbt test` |
| Run webhook          | `uvicorn src.webhook.app:app --host 0.0.0.0 --port 8080` |
| Send compliance alert| `python -m src.alerting.compliance_alert` |
| Setup dashboards     | `python -m src.metabase.setup_dashboards` |
| Run ops CLI          | `python ops.py` (entry-point: health checks, manual ops) |
| Lint                 | `ruff check src tests` |
| Lint (auto-fix)      | `ruff check --fix src tests` |
| Format               | `ruff format src tests` |
| Typecheck            | `mypy src` |
| Unit tests           | `pytest tests/` |
| Single test          | `pytest tests/test_<name>.py::<test_func> -v` |
| Coverage             | `pytest --cov=src tests/` |

> ⚠️ CI commands: see `.gitlab-ci.yml` for scheduled run definitions (daily + weekly).

---

## Folder Structure

```
gitlab-analytics/
├── src/
│   ├── extraction/                    # L2 ETL: GitLab API → Postgres (dlt)
│   │   ├── client.py                  # GitLabClient (auth, retry, rate-limit)
│   │   ├── pipeline.py                # dlt pipeline entry — `python -m src.extraction.pipeline`
│   │   ├── checkpoint.py              # Cursor read/write (gitlab_raw.pipeline_state)
│   │   └── sources/                   # @dlt.resource per entity
│   │       ├── merge_requests.py      # MR + branch/title/AI-disclosure compliance
│   │       ├── commits.py             # ?with_stats=true required for additions/deletions
│   │       ├── mr_commits.py          # MR↔commit linkage
│   │       ├── mr_notes.py            # MR discussion notes
│   │       ├── pipelines.py           # CI pipeline status + coverage (nullable)
│   │       ├── pipeline_jobs.py       # Job-level status
│   │       ├── test_reports.py        # Pipeline test reports
│   │       └── group_members.py       # User → department mapping
│   ├── webhook/                       # L2 real-time: FastAPI POST /webhook
│   │   ├── app.py                     # FastAPI app + asyncpg pool
│   │   ├── handlers.py                # handle_mr_event / handle_push_event / handle_pipeline_event
│   │   └── validator.py               # HMAC token verification
│   ├── validation/                    # Anti-hallucination guards
│   │   ├── schema_validator.py        # Pydantic models for GitLab API responses
│   │   ├── data_quality.py            # Post-load DQ checks
│   │   └── idempotency.py             # Webhook dedup helpers
│   ├── transform/                     # L3 dbt — schema=gitlab_kpi
│   │   ├── dbt_project.yml            # profile: gitlab_analytics
│   │   ├── profiles.yml               # PG connection (uses DATABASE_URL env)
│   │   ├── packages.yml
│   │   └── models/
│   │       ├── staging/               # stg_* views (one per raw table)
│   │       └── marts/                 # v_* KPI views (compliance, DORA, AI adoption, etc.)
│   ├── alerting/                      # L4 Slack alerts
│   │   ├── compliance_alert.py        # Read v_violations → POST Slack
│   │   ├── slack_client.py            # Slack Incoming Webhook wrapper
│   │   └── thresholds.py              # Alert threshold config
│   ├── metabase/                      # Dashboard provisioner (REST API)
│   │   └── setup_dashboards.py
│   ├── compliance_updater/            # MR Compliance Guide → SQL view diff generator
│   │   ├── cli.py / __main__.py       # Entry: python -m src.compliance_updater
│   │   ├── parser.py / generator.py   # Parse MD spec → produce SQL
│   │   ├── diff.py / applier.py       # Apply diffs to dbt models
│   │   └── models.py
│   ├── reporting/
│   │   └── daily_insight.py           # Daily insight report generator
│   ├── infra/
│   │   ├── db/migrations/             # 001..007 SQL migrations
│   │   ├── docker-compose.yml         # Local PG + Metabase
│   │   ├── Dockerfile.webhook         # Webhook container image
│   │   ├── register_webhook.py        # Register webhook URL with GitLab
│   │   └── setup.sh                   # Bootstrap script
│   ├── logging_config.py              # structlog setup
│   └── __init__.py
├── tests/                             # pytest unit tests (real fixtures, not mocks-only)
│   ├── fixtures/
│   ├── test_extraction.py
│   ├── test_validation.py
│   ├── test_pipeline_run.py
│   ├── test_alerting.py
│   ├── test_checkpoint.py
│   ├── test_client.py
│   ├── test_mr_commits.py
│   ├── test_sources_generators.py
│   ├── test_metabase_client.py
│   └── test_webhook_checkpoint.py
├── docs/
│   ├── ai/                            # Rule cho AI agent (PROJECT_MAP, HALLUCINATION_RULES, internal_rules/, ...)
│   ├── convention/                    # Coding / API conventions (legacy mirror, source-of-truth ở docs/ai/internal_rules/)
│   ├── mr-compliance/                 # compliance_spec.yaml + detection_catalog + v1.6 plan
│   ├── dashboard_queries/             # SQL refs per Metabase collection (A–F)
│   ├── guides/                        # User/QA-facing how-to (dashboard guide, catalog, builder, KICKOFF)
│   │   ├── dashboard_catalog.md
│   │   ├── qa_dashboard_guide.md
│   │   ├── qa_metabase_dashboard_builder.md
│   │   └── KICKOFF.html
│   ├── ops/                           # Operational runbooks + deployment + DB strategy
│   │   ├── ops_runbook.md
│   │   ├── compliance_updater_runbook.md
│   │   ├── metabase_ops_panel.md
│   │   ├── DEPLOYMENT.md
│   │   ├── TROUBLESHOOTING.md
│   │   └── DB_ARCHIVE_STRATEGY.md
│   ├── reference/                     # Architecture + schema + metrics reference
│   │   ├── architecture_etl.md
│   │   ├── schema_reference.md
│   │   └── METRICS.md
│   └── planning/                      # Active improvement plans + retrospectives
│       ├── data_improvement_plan.md
│       └── improvement_report.md
├── product-spec/                      # PRD / KPI compliance / DORA specs
├── logs/                              # Runtime logs (gitignored)
├── .claude/                           # Claude Code agent config + memory
├── .gitlab-ci.yml                     # Scheduled CI pipeline (daily + weekly)
├── ops.py                             # Ops CLI entry (root level)
├── pyproject.toml
├── README.md
├── LOCAL_SETUP.md
└── CLAUDE.md                          # AI Agent Operating Pipeline + project constitution
```

---

## Key Modules / Domains

| Module               | Path                          | Responsibility                                                | Pattern B agent |
|----------------------|-------------------------------|----------------------------------------------------------------|------------------|
| extraction           | `src/extraction/`             | Pull GitLab API → `gitlab_raw.*` (dlt incremental merge)       | `extractor`      |
| webhook              | `src/webhook/`                | Real-time GitLab events → `gitlab_raw` + DLQ                   | `extractor`      |
| validation           | `src/validation/`             | Pydantic schemas + DQ + idempotency                            | `validator`      |
| transform            | `src/transform/`              | dbt staging + marts (`gitlab_kpi.v_*`)                         | `transformer`    |
| alerting             | `src/alerting/`               | Compliance violations → Slack                                  | `alerter`        |
| metabase             | `src/metabase/`               | Dashboard provisioning via Metabase REST                       | `transformer`    |
| compliance_updater   | `src/compliance_updater/`     | MR Compliance MD spec → SQL diff generator                     | `transformer`    |
| reporting            | `src/reporting/`              | Daily insight reports                                          | `alerter`        |
| infra                | `src/infra/`                  | Migrations, docker-compose, webhook registration               | `orchestrator`   |
| ops                  | `ops.py` (root)               | Ops CLI (manual health checks, replays)                        | `orchestrator`   |

> Pattern B agent column maps domain → which scoped agent owns read/write for that path. Cross-domain access requires orchestrator dispatch.

---

## Data Layer Map

```
L1 GitLab EE v18 (REST API v4 + Webhooks)
     │
     ├─ HTTPS GET (polling, ?updated_after=cursor)  → src/extraction/sources/*.py
     └─ HTTPS POST webhook                          → src/webhook/handlers.py
     │
L2 ETL layer (Python)
     │
     ├─ dlt pipeline (write_disposition="merge", primary_key="id")
     └─ asyncpg pool (webhook DLQ on failure)
     │
L3 PostgreSQL
     ├─ schema: gitlab_raw       (dlt-managed tables: merge_requests, commits, pipelines, ...)
     ├─ schema: gitlab_raw       (manual tables: pipeline_state, webhook_dlq)
     └─ schema: gitlab_kpi       (dbt views: v_mr_compliance, v_weekly_kpi, v_dora_metrics, ...)
     │
L4 Consumers
     ├─ Metabase OSS (port 3000) — connects as analytics_ro (read-only)
     └─ src/alerting/compliance_alert.py → Slack Webhook
     │
L5 Stakeholders: QA Manager, Engineering Manager, Dev Team
```

---

## Environment Variables (required)

| Var                  | Required | Purpose |
|----------------------|----------|---------|
| `GITLAB_URL`         | Yes      | e.g. `https://gitlab.your-company.com` |
| `GITLAB_TOKEN`       | Yes      | Group Access Token, scope: `read_api` |
| `GITLAB_GROUP_ID`    | Yes      | Numeric group ID for extraction root |
| `DATABASE_URL`       | Yes      | `postgresql://user:pass@host:5432/gitlab_analytics` |
| `SLACK_WEBHOOK_URL`  | No       | Slack Incoming Webhook for compliance alerts |
| `SINCE_DAYS`         | No       | Default 7 — days back for incremental sync |
| `WEBHOOK_SECRET`     | No       | HMAC token for webhook validation |

---

## Deploy Target

- **ETL**: GitLab CI scheduled jobs (daily 07:00 Mon–Fri, weekly 08:00 Mon) — see `.gitlab-ci.yml`
- **Webhook**: Docker container (`src/infra/Dockerfile.webhook`), exposed on port 8080
- **Metabase**: Docker Compose (`src/infra/docker-compose.yml`), localhost:3000
- **Migrations**: Run automatically via `docker-entrypoint-initdb.d` on first PG start, or manually `psql -f src/infra/db/migrations/NNN_*.sql`

---

## Critical Gotchas (canonical — also in CLAUDE.md)

1. `additions`/`deletions` — only from single MR endpoint `/merge_requests/:iid`. List endpoint does NOT return these.
2. Commits — need `?with_stats=true`; default response has no `stats` field.
3. `coverage` from pipeline API can be `null` — always `.get("coverage")`.
4. `merged_at` can be `null` even when `state="merged"` (GitLab race condition).
5. `head_pipeline` can be `null` — always `.get("head_pipeline") or {}`.
6. dlt skips columns when first run has all-NULL values → migrations 004/005/007 backfill missing columns.
7. `reviewer_usernames` / `approved_by_usernames` stored as comma-separated `text` (NOT `text[]`) — dlt cannot map Python list → PG array reliably. dbt staging parses via `string_to_array()`.

---

## Pattern B Scope Notes

- **`extractor` agent** owns: `src/extraction/`, `src/webhook/`, `src/infra/db/migrations/`
- **`validator` agent** owns: `src/validation/`, `tests/test_validation.py`, schema_snapshot.yaml updates
- **`transformer` agent** owns: `src/transform/`, `src/metabase/`, `src/compliance_updater/`
- **`alerter` agent** owns: `src/alerting/`, `src/reporting/`
- **`orchestrator`** owns: `ops.py`, `src/infra/` (non-migrations), `.claude/memory/project_state.yaml`, dispatch logic
- **`healer`** (cross-cutting) reads logs in `logs/`, may trigger replay via `compliance_updater/` or `webhook/` DLQ

Cross-domain access = HARD STOP, escalate user.
