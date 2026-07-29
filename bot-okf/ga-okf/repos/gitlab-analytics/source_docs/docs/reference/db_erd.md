---
title: ERD — gitlab_raw Schema
snapshot_date: 2026-05-20
db_name: gitlab_analytics
schema: gitlab_raw
purpose: Entity-relationship diagram for raw GitLab extraction tables
notation: Mermaid erDiagram (renders natively in GitHub/GitLab/Metabase)
---

# ERD — `gitlab_raw` Schema

**Snapshot**: 2026-05-20 • **10 tables** • **278 MB** • **~739k rows**

> ⚠️ **No physical foreign keys.** dlt does NOT create `FOREIGN KEY` constraints. All relationships below are **logical** (enforced at the dbt staging layer via JOINs). PG-level integrity = none — extraction must guarantee referential validity.

---

## Diagram

```mermaid
erDiagram
    merge_requests ||--o{ mr_commits   : "1 MR → N commits"
    merge_requests ||--o{ mr_notes     : "1 MR → N notes"
    commits        ||--o{ mr_commits   : "commit linked via SHA"
    pipelines      ||--o{ pipeline_jobs : "1 pipeline → N jobs"
    pipelines      ||--o| test_reports  : "1 pipeline → 0..1 report"
    merge_requests }o--|| pipelines    : "head_pipeline_id (logical)"

    merge_requests {
        bigint        id                       PK "global MR id"
        bigint        iid                      "per-project number"
        bigint        project_id               "→ project (implicit)"
        varchar       author_username
        varchar       state                    "opened|merged|closed"
        varchar       source_branch
        varchar       target_branch
        timestamptz   created_at
        timestamptz   updated_at               "cursor field"
        timestamptz   merged_at                "nullable even if merged"
        timestamptz   closed_at
        bigint        additions
        bigint        deletions
        bigint        mr_size                  "derived"
        boolean       has_description
        boolean       has_ticket_ref
        boolean       has_ai_disclosure
        boolean       has_ai_prefix
        boolean       ci_passed
        varchar       ci_status
        boolean       has_valid_branch_name
        boolean       has_conventional_title
        bigint        discussion_count
        text          reviewer_usernames       "csv, not array"
        text          approved_by_usernames    "csv"
        text          label_names              "csv"
        varchar       project_name             "denorm"
        text          merge_username
        integer       diverged_commits_count   "R-MR-006 v1.6"
    }

    commits {
        varchar       id                       PK "SHA40"
        varchar       short_id
        bigint        project_id
        varchar       project_name             "denorm"
        varchar       author_name              "git-level"
        varchar       author_email
        varchar       message
        timestamptz   authored_date
        timestamptz   committed_date
        bigint        additions
        bigint        deletions
        bigint        total_loc                "derived"
        boolean       is_ai
        boolean       is_conventional
        bigint        msg_length
        boolean       msg_over_500
    }

    pipelines {
        bigint        id                       PK
        bigint        project_id
        varchar       project_name             "denorm"
        varchar       ref                      "branch/tag"
        varchar       status                   "success|failed|running|..."
        varchar       source                   "push|mr_event|schedule|..."
        timestamptz   created_at
        timestamptz   updated_at
        timestamptz   finished_at              "null if running"
        integer       duration
        double        coverage                 "nullable"
    }

    pipeline_jobs {
        bigint        id                       PK
        bigint        pipeline_id              FK "→ pipelines.id"
        bigint        project_id
        text          project_name             "denorm"
        text          stage
        text          name
        text          status
        double        duration
        text          ref
        text          created_at               "text — migration 010"
        text          started_at
        text          finished_at
        text          extracted_at
    }

    test_reports {
        bigint        pipeline_id              PK,FK "→ pipelines.id (1:1)"
        bigint        project_id
        text          project_name             "denorm"
        text          ref                      "denorm from pipeline"
        double        total_time
        integer       total_count
        integer       success_count
        integer       failed_count
        integer       skipped_count
        integer       error_count
        integer       suite_count
        text          extracted_at
    }

    mr_commits {
        bigint        mr_id                    PK,FK "→ merge_requests.id"
        varchar       commit_id                PK,FK "→ commits.id (SHA)"
        bigint        mr_iid
        bigint        project_id
        varchar       project_name             "denorm"
        timestamptz   mr_created_at            "denorm from MR"
        varchar       short_id
        varchar       title
        varchar       message
        varchar       author_name
        timestamptz   authored_date
        boolean       is_ai
        boolean       is_conventional
        boolean       is_breaking
        bigint        msg_length
        timestamptz   extracted_at
    }

    mr_notes {
        bigint        mr_id                    PK,FK "→ merge_requests.id"
        bigint        note_id                  PK    "composite part 2"
        bigint        mr_iid
        bigint        project_id
        varchar       author_username
        varchar       body                     "markdown"
        timestamptz   created_at
        boolean       system                   "true=auto event"
        boolean       resolvable
        boolean       resolved
        timestamptz   extracted_at
    }

    group_members {
        bigint        id                       PK "GitLab user id"
        varchar       username
        varchar       name                     "display"
        varchar       state                    "active|blocked|deactivated"
        bigint        access_level             "10|20|30|40|50"
        varchar       email
        varchar       avatar_url
    }

    pipeline_state {
        text          key                      PK "KV cursor store"
        text          value                    "parsed by checkpoint.py"
        timestamptz   updated_at
    }

    webhook_dlq {
        bigserial     id                       PK
        text          event_type               "merge_request|push|pipeline"
        jsonb         payload                  "raw webhook body"
        text          error_message
        timestamptz   failed_at
        boolean       replayed
        timestamptz   replayed_at
        bigint        project_id
        text          project_name
    }
```

---

## Relationships explained

### Strong (referential — extraction guarantees)

| From → To | Cardinality | Join key | Enforced where |
|---|---|---|---|
| `merge_requests` → `mr_commits` | 1:N | `mr_id = merge_requests.id` | `src/extraction/sources/merge_requests.py` populates both atomically |
| `merge_requests` → `mr_notes` | 1:N | `mr_id = merge_requests.id` | Same extraction pass |
| `pipelines` → `pipeline_jobs` | 1:N | `pipeline_id = pipelines.id` | `src/extraction/sources/pipelines.py` |
| `pipelines` → `test_reports` | 1:0..1 | `pipeline_id = pipelines.id` | At most one report per pipeline |

### Logical (cross-resource, eventual consistency)

| From → To | Cardinality | Join key | Caveat |
|---|---|---|---|
| `commits` → `mr_commits` | 1:N | `id = commit_id` (SHA) | Same commit can appear in N MRs (cherry-pick, multi-target). May lag — commit extraction is per-project, MR extraction is per-group. |
| `merge_requests` → `pipelines` | N:1 (head_pipeline) | `head_pipeline_id` (not stored as column — joined via `merge_requests_raw.head_pipeline` JSON in stg layer) | NULL when MR has no CI. `stg_merge_requests` resolves this. |
| `group_members` → all author fields | dimension | `username = author_username` | Used by `dim_user` for department mapping. |

### Independent (no relationship)

- `pipeline_state` — KV cursor table, populated by `src/extraction/checkpoint.py`
- `webhook_dlq` — currently empty (webhook chưa deploy prod)

---

## Implicit dimensions

These IDs appear across all fact tables but no `projects` dimension table exists in `gitlab_raw`:

- `project_id` (bigint) + `project_name` (text, denormalized in every table)
- Project metadata = scraped from `gitlab_group_members` job list + GitLab API on-demand

**Why no project table**: 5,872 projects in group 756, only ~351 active. Building a full dim_project would add 5MB for 6% utility. dbt layer materializes `dim_project` from active project union if needed.

---

## dlt internal columns (excluded from ERD for clarity)

Every table also has these from dlt write:
- `_dlt_load_id` (varchar) — batch ID (epoch timestamp)
- `_dlt_id` (varchar) — internal row hash (NOT for joins)
- `_dlt_root_id` / `_dlt_parent_id` / `_dlt_list_idx` — only on child tables of JSONB unnested arrays (none in current schema after migration 008 array→text sweep)

---

## Downstream — how `gitlab_kpi` views consume this

```mermaid
graph LR
    subgraph gitlab_raw
        MR[merge_requests]
        C[commits]
        P[pipelines]
        PJ[pipeline_jobs]
        TR[test_reports]
        MC[mr_commits]
        MN[mr_notes]
        GM[group_members]
        PS[pipeline_state]
    end

    subgraph "gitlab_kpi (stg layer)"
        S_MR[stg_merge_requests]
        S_C[stg_commits]
        S_P[stg_pipelines]
        S_MC[stg_mr_commits]
        S_MN[stg_mr_notes]
        S_TR[stg_test_reports]
        S_GM[stg_group_members]
    end

    subgraph "gitlab_kpi (marts)"
        V_COMP[v_mr_compliance]
        V_SCORE[v_mr_score_breakdown<br/>incremental 81MB]
        V_DORA[v_dora_metrics]
        V_OPS[v_ops_pipeline_health]
        DIM_U[dim_user]
    end

    MR --> S_MR
    C --> S_C
    P --> S_P
    P --> S_MR
    MC --> S_MC
    MN --> S_MN
    TR --> S_TR
    GM --> S_GM
    PS --> V_OPS

    S_MR --> V_COMP
    S_MC --> V_COMP
    S_MN --> V_COMP
    S_GM --> DIM_U
    V_COMP --> V_SCORE
    S_P --> V_DORA
    S_C --> V_DORA
```

22 marts views + 3 tables + 1 seed total. See `docs/reference/db_inventory.md` §`gitlab_kpi` for full list.

---

## How to regenerate this ERD

ERD is **manually maintained** because:
1. dlt creates NO foreign keys → no auto-extraction tool (e.g. `pg_dump --schema-only` doesn't infer relationships)
2. Most relationships are denormalized (project_name, mr_iid in mr_commits) — not standard FK patterns

Update protocol when schema changes:
1. New table added → add Mermaid entity + relationship lines
2. New column added → update entity field list
3. Migration changes column type → update field type
4. Verify in GitLab/GitHub markdown preview (Mermaid native support)

Cross-ref:
- `docs/reference/db_fields_gitlab_raw.md` — column-level inventory (source of truth for fields)
- `docs/reference/db_inventory.md` — table-level sizing/usage
- `.claude/memory/schema_snapshot.yaml` — API field expectations
- `docs/reference/schema_reference.md` — full column-level schema spec
