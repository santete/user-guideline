---
title: gitlab_raw — Field-level Schema Reference
snapshot_date: 2026-05-20
schema: gitlab_raw
db: gitlab_analytics (PostgreSQL 16.13)
purpose: Detailed column inventory per table — name, type, PK, default, nullable, description, example
generator: scripts/gen_db_fields_doc.py
---

# `gitlab_raw` — Field-level Schema Reference

**Snapshot**: 2026-05-20 — 10 tables, 152 columns total.

**Primary key note**: Only `pipeline_jobs`, `test_reports`, `pipeline_state`, `webhook_dlq` have formal PostgreSQL `PRIMARY KEY` constraints. The other dlt-extracted tables (`merge_requests`, `commits`, `pipelines`, `mr_commits`, `mr_notes`, `group_members`) declare `primary_key=` in their `@dlt.resource(...)` decorator — dlt enforces dedup via merge strategy but does NOT create a PG `PRIMARY KEY` constraint. Both are marked **PK** in the tables below (with `dlt` annotation where applicable). See `src/extraction/sources/*.py`.

**Example values**: drawn from `SELECT * FROM <table> LIMIT 1;` — truncated at 60 chars. Some samples reflect the first physical row, not necessarily a "typical" record.

---

## `gitlab_raw.merge_requests`

**Rows**: 27,131 • **Size**: 11 MB • **PK**: `id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | bigint | PK (dlt) | — | NO | GitLab global MR ID (unique across GitLab instance) | `705338` |
| 2 | `iid` | bigint |  | — | YES | Internal MR ID (per-project numbering, e.g. !42) | `1991` |
| 3 | `project_id` | bigint |  | — | YES | GitLab project ID owning the MR | `5419` |
| 4 | `author_username` | character varying |  | — | YES | Author username (LDAP/email prefix) | `trungna5` |
| 5 | `author_name` | character varying |  | — | YES | Author display name | `Trung Nguyen Anh` |
| 6 | `title` | character varying |  | — | YES | MR title (subject line) | `refactor (consumer kafka): split Kafka result consumer flow` |
| 7 | `state` | character varying |  | — | YES | MR state: opened, closed, merged, locked | `merged` |
| 8 | `source_branch` | character varying |  | — | YES | Branch being merged from | `staging` |
| 9 | `target_branch` | character varying |  | — | YES | Branch being merged into (e.g. main, master) | `main` |
| 10 | `created_at` | timestamp with time zone |  | — | YES | When MR was first opened | `2026-03-27 14:55:20.990000+00:00` |
| 11 | `updated_at` | timestamp with time zone |  | — | YES | Last modification timestamp (drives incremental cursor) | `2026-03-27 14:55:26.019000+00:00` |
| 12 | `merged_at` | timestamp with time zone |  | — | YES | Merge timestamp — can be NULL even when state=merged (race condition) | `2026-03-27 14:55:26.068000+00:00` |
| 13 | `additions` | bigint |  | — | YES | Lines added (computed from /changes endpoint diff) | `0` |
| 14 | `deletions` | bigint |  | — | YES | Lines deleted (computed from /changes endpoint diff) | `0` |
| 15 | `mr_size` | bigint |  | — | YES | Lines changed = additions + deletions (used for size scoring per criterion 4) | `0` |
| 16 | `changes_count` | character varying |  | — | YES | File count from /changes endpoint | `9` |
| 17 | `has_description` | boolean |  | — | YES | Boolean — description body > 50 chars (R-MR-001-DESCRIPTION) | `True` |
| 18 | `has_ticket_ref` | boolean |  | — | YES | Boolean — description/title contains ticket reference (e.g. #123, JIRA-456) — R-MR-002 | `False` |
| 19 | `has_ai_disclosure` | boolean |  | — | YES | Boolean — description has AI Disclosure checkbox ticked — R-MR-003-AI-DISCLOSURE | `False` |
| 20 | `has_ai_prefix` | boolean |  | — | YES | Boolean — commit title prefixed with [AI] (R-COMMIT-002-AI complement) | `False` |
| 21 | `ci_passed` | boolean |  | — | YES | Boolean — head_pipeline.status == success (Quality Gate criterion 1) | `False` |
| 22 | `discussion_count` | bigint |  | — | YES | Total non-system note count (R-MR review depth signal) | `0` |
| 23 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1774854570.4235818` |
| 24 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `H8NnKoh/AYeVRw` |
| 25 | `closed_at` | timestamp with time zone |  | — | YES | Close timestamp (non-merge close) | _NULL_ |
| 26 | `has_valid_branch_name` | boolean |  | — | YES | Boolean — source_branch matches convention regex (R-BRANCH-001) | `False` |
| 27 | `has_conventional_title` | boolean |  | — | YES | Boolean — title matches Conventional Commits regex (R-MR-CONVENTIONAL-TITLE) | `False` |
| 28 | `ci_status` | character varying |  | — | YES | head_pipeline.status — can be NULL if no pipeline | _NULL_ |
| 29 | `has_description_template` | boolean |  | `false` | YES | Boolean — description matches MR template | `False` |
| 30 | `has_ai_disclosure_section` | boolean |  | `false` | YES | Boolean — description has explicit AI Disclosure section (more detailed than checkbox) | `False` |
| 31 | `diff_overflow` | boolean |  | `false` | YES | Boolean — true if GitLab truncated /changes diff response | `False` |
| 32 | `project_name` | character varying |  | — | YES | Project path-with-namespace (denormalized for KPI joins without project lookup) | _NULL_ |
| 35 | `merge_username` | text |  | — | YES | Username of person who clicked Merge (may differ from author) | _NULL_ |
| 36 | `is_draft` | boolean |  | `false` | YES | Boolean — MR marked as Draft (excluded from scoring per R-MR-006-DRAFT-SKIP) | `False` |
| 38 | `reviewer_usernames` | text |  | — | YES | Comma-separated reviewer usernames (TEXT, NOT array — migration 007/008) | _NULL_ |
| 39 | `approved_by_usernames` | text |  | — | YES | Comma-separated approver usernames (TEXT, NOT array) | _NULL_ |
| 40 | `label_names` | text |  | — | YES | Comma-separated label names (TEXT, NOT array — migration 008) | _NULL_ |
| 41 | `has_screenshots` | boolean |  | `false` | YES | Boolean — description contains image markdown (R-MR-005 v1.6 advisory) | `False` |
| 42 | `diverged_commits_count` | integer |  | — | YES | Commits source branch is behind target (NULL=unknown, 0=rebased, >0=behind) — R-MR-006 v1.6 | _NULL_ |

---

## `gitlab_raw.commits`

**Rows**: 106,826 • **Size**: 60 MB • **PK**: `id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | character varying | PK (dlt) | — | NO | Full commit SHA (40 hex chars) — primary key | `974c7f81d99b1feed0434acc22e98a97e78b5f4d` |
| 2 | `short_id` | character varying |  | — | YES | Short SHA (8 chars) | `974c7f81` |
| 3 | `project_id` | bigint |  | — | YES | GitLab project ID | `13608` |
| 4 | `project_name` | character varying |  | — | YES | Project path-with-namespace, denormalized for KPI joins without project lookup | `meeting-agent-application-set` |
| 5 | `author_name` | character varying |  | — | YES | Git author.name (display) — git-level NOT GitLab username | `CI_SYS_GROUP_ACCESS_TOKEN` |
| 6 | `author_email` | character varying |  | — | YES | Git author.email | `CI_SYS_GROUP_ACCESS_TOKEN@fpt.com` |
| 7 | `message` | character varying |  | — | YES | Full commit message | [ci-auto-config] appversion:main-build.e693bc38--base.wor... |
| 8 | `committed_date` | timestamp with time zone |  | — | YES | When commit was committed (may differ from authored) | `2026-01-20 03:12:21+00:00` |
| 9 | `authored_date` | timestamp with time zone |  | — | YES | When commit was authored (original) | `2026-01-20 03:12:21+00:00` |
| 10 | `additions` | bigint |  | — | YES | Lines added (requires with_stats=true) | `1` |
| 11 | `deletions` | bigint |  | — | YES | Lines deleted (requires with_stats=true) | `1` |
| 12 | `total_loc` | bigint |  | — | YES | Lines changed = additions + deletions | `2` |
| 13 | `is_ai` | boolean |  | — | YES | Boolean — message contains AI marker ([AI] prefix or AI Disclosure tag) | `False` |
| 14 | `is_conventional` | boolean |  | — | YES | Boolean — message matches Conventional Commits format (R-COMMIT-001) | `False` |
| 15 | `msg_length` | bigint |  | — | YES | Character count of commit message | `98` |
| 16 | `msg_over_500` | boolean |  | — | YES | Boolean — message exceeds 500 chars (long-commit violation flag) | `False` |
| 17 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1777302944.490903` |
| 18 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `AH4j1tz0qBT7jg` |
| 19 | `is_breaking` | boolean |  | `false` | YES | Boolean — message contains BREAKING CHANGE marker | `False` |

---

## `gitlab_raw.pipelines`

**Rows**: 201,843 • **Size**: 55 MB • **PK**: `id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | bigint | PK (dlt) | — | NO | GitLab pipeline ID (global) | `4283194` |
| 2 | `project_id` | bigint |  | — | YES | GitLab project ID | `8085` |
| 3 | `project_name` | character varying |  | — | YES | Project path-with-namespace, denormalized for KPI joins without project lookup | `service-request-application-set` |
| 4 | `ref` | character varying |  | — | YES | Branch or tag name pipeline ran on | `main` |
| 5 | `status` | character varying |  | — | YES | Pipeline status: success, failed, running, canceled, skipped, manual | `success` |
| 6 | `source` | character varying |  | — | YES | Trigger source: push, merge_request_event, schedule, api, web | `trigger` |
| 7 | `created_at` | timestamp with time zone |  | — | YES | When pipeline was created | `2026-04-20 09:04:44.279000+00:00` |
| 8 | `updated_at` | timestamp with time zone |  | — | YES | Last status change | `2026-04-20 09:04:54.932000+00:00` |
| 9 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1777297611.4813924` |
| 10 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `AGjX03orcu7iFg` |
| 11 | `finished_at` | timestamp with time zone |  | — | YES | When pipeline finished (NULL if running) | _NULL_ |
| 12 | `duration` | integer |  | — | YES | Total runtime in seconds | _NULL_ |
| 13 | `coverage` | double precision |  | — | YES | Test coverage % — can be NULL | _NULL_ |

---

## `gitlab_raw.pipeline_jobs`

**Rows**: 234,465 • **Size**: 81 MB • **PK**: `id` (PG constraint)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | bigint | PK | — | NO | Job ID (global) | `15656115` |
| 2 | `pipeline_id` | bigint |  | — | YES | Parent pipeline ID | `4130076` |
| 3 | `project_id` | bigint |  | — | YES | GitLab project ID | `5592` |
| 4 | `project_name` | text |  | — | YES | Project path-with-namespace, denormalized for KPI joins without project lookup | `maintenance-catalog-api` |
| 5 | `stage` | text |  | — | YES | CI stage name (build/test/deploy/...) | `setup` |
| 6 | `name` | text |  | — | YES | Job name from .gitlab-ci.yml | `init-sensitive-variables` |
| 7 | `status` | text |  | — | YES | Job status: success, failed, running, canceled, skipped, manual | `success` |
| 8 | `duration` | double precision |  | — | YES | Total job runtime in seconds | `11.972447` |
| 9 | `created_at` | text |  | — | YES | When job was created (timestamptz — migration 010 cast from TEXT) | `2026-03-10 03:39:17.463+00` |
| 10 | `started_at` | text |  | — | YES | When job started executing (NULL if not started) | `2026-03-10 03:39:19.863+00` |
| 11 | `finished_at` | text |  | — | YES | When job finished (NULL if running) | `2026-03-10 03:39:31.836+00` |
| 12 | `allow_failure` | boolean |  | `false` | YES | Boolean — job marked allow_failure: true | `True` |
| 13 | `ref` | text |  | — | YES | Branch/tag job ran on | `stable/v1.0.0` |
| 14 | `extracted_at` | text |  | — | YES | When dlt extracted this row | `2026-04-17 05:01:28.01147+00` |
| 15 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1776400364.694329` |
| 16 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `2xZmUTF9lpPf2g` |

---

## `gitlab_raw.mr_commits`

**Rows**: 90,954 • **Size**: 46 MB • **PK**: `mr_id, commit_id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `mr_id` | bigint | PK (dlt) | — | NO | Parent MR ID (composite PK part 1) | `664712` |
| 2 | `mr_iid` | bigint |  | — | YES | MR internal ID | `539` |
| 3 | `project_id` | bigint |  | — | YES | GitLab project ID | `4737` |
| 4 | `mr_created_at` | timestamp with time zone |  | — | YES | Parent MR creation timestamp (denormalized) | `2026-01-12 06:39:02.623000+00:00` |
| 5 | `commit_id` | character varying | PK (dlt) | — | NO | Commit SHA (composite PK part 2) | `64b02e83ad9e85f9d9a5e343a0767e381cf7f503` |
| 6 | `short_id` | character varying |  | — | YES | Short SHA | `64b02e83` |
| 7 | `title` | character varying |  | — | YES | Commit title | Merge remote-tracking branch 'origin/stable/v1.0' into de... |
| 8 | `message` | character varying |  | — | YES | Full commit message | Merge remote-tracking branch 'origin/stable/v1.0' into de... |
| 9 | `author_name` | character varying |  | — | YES | Git author.name (git-level) | `Duy Le Khanh` |
| 10 | `authored_date` | timestamp with time zone |  | — | YES | Original authored date | `2025-12-09 07:59:51+00:00` |
| 11 | `is_ai` | boolean |  | — | YES | Boolean — commit message contains AI marker ([AI] prefix or AI Disclosure tag) | `False` |
| 12 | `is_conventional` | boolean |  | — | YES | Boolean — commit message matches Conventional Commits format (R-COMMIT-001) | `False` |
| 13 | `is_breaking` | boolean |  | — | YES | Boolean — commit message contains BREAKING CHANGE marker | `False` |
| 14 | `msg_length` | bigint |  | — | YES | Total character count of commit message | `67` |
| 15 | `extracted_at` | timestamp with time zone |  | — | YES | When dlt extracted this row | `2026-04-06 05:52:54.283364+00:00` |
| 16 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1775454414.5693307` |
| 17 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `j2M02P+uGaXypw` |
| 18 | `project_name` | character varying |  | — | YES | Project path-with-namespace, denormalized for KPI joins without project lookup | _NULL_ |

---

## `gitlab_raw.mr_notes`

**Rows**: 23,412 • **Size**: 11 MB • **PK**: `mr_id, note_id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `body` | character varying |  | — | YES | Note text content (Markdown) | `mentioned in commit 923d5077aa04971499820204fa1cf370faa9cdef` |
| 2 | `note_id` | bigint | PK (dlt) | — | NO | Note ID (composite PK part 2) | `1281490` |
| 3 | `mr_id` | bigint | PK (dlt) | — | NO | Parent MR ID (composite PK part 1) | `632305` |
| 4 | `mr_iid` | bigint |  | — | YES | MR internal ID | `35` |
| 5 | `project_id` | bigint |  | — | YES | GitLab project ID | `12962` |
| 6 | `author_username` | character varying |  | — | YES | Note author username | `longtt46` |
| 7 | `created_at` | timestamp with time zone |  | — | YES | When note was posted | `2025-11-26 06:55:31.975000+00:00` |
| 8 | `system` | boolean |  | — | YES | Boolean — true if system-generated (state change, assignment) | `True` |
| 9 | `resolvable` | boolean |  | — | YES | Boolean — note is part of a resolvable discussion thread | `False` |
| 10 | `resolved` | boolean |  | — | YES | Boolean — manually resolved/replayed | `False` |
| 11 | `extracted_at` | timestamp with time zone |  | — | YES | When dlt extracted this row | `2026-04-27 15:01:17.780573+00:00` |
| 12 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1777302045.652586` |
| 13 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `FlE3XsLksHeONg` |

---

## `gitlab_raw.test_reports`

**Rows**: 54,095 • **Size**: 15 MB • **PK**: `pipeline_id` (PG constraint)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `pipeline_id` | bigint | PK | — | NO | Parent pipeline ID — primary key | `4130076` |
| 2 | `project_id` | bigint |  | — | YES | GitLab project ID | `5592` |
| 3 | `project_name` | text |  | — | YES | Project path-with-namespace, denormalized for KPI joins without project lookup | `maintenance-catalog-api` |
| 4 | `ref` | text |  | — | YES | Branch or tag the pipeline ran on (denormalized from parent pipeline) | `stable/v1.0.0` |
| 5 | `total_time` | double precision |  | `0` | YES | Total test execution time (seconds) | `0.0` |
| 6 | `total_count` | integer |  | `0` | YES | Total test count | `0` |
| 7 | `success_count` | integer |  | `0` | YES | Passed tests count | `0` |
| 8 | `failed_count` | integer |  | `0` | YES | Failed tests count | `0` |
| 9 | `skipped_count` | integer |  | `0` | YES | Skipped tests count | `0` |
| 10 | `error_count` | integer |  | `0` | YES | Errored tests count | `0` |
| 11 | `suite_count` | integer |  | `0` | YES | Number of test suites in this report | `0` |
| 12 | `extracted_at` | text |  | — | YES | When dlt extracted this row | `2026-04-17 09:09:30.894331+00` |
| 13 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1776415894.764835` |
| 14 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `LAYckRNZmwU9Ug` |

---

## `gitlab_raw.group_members`

**Rows**: 617 • **Size**: 408 kB • **PK**: `id` (dlt merge dedup — not enforced by PG)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | bigint | PK (dlt) | — | NO | GitLab user ID (PK) | `15` |
| 2 | `username` | character varying |  | — | YES | User username | `datnt78` |
| 3 | `name` | character varying |  | — | YES | User display name | `Dat Nguyen Thanh (FTEL CSOC HN)` |
| 4 | `state` | character varying |  | — | YES | User state: active, blocked, deactivated | `deactivated` |
| 5 | `access_level` | bigint |  | — | YES | Group role: 10=Guest, 20=Reporter, 30=Developer, 40=Maintainer, 50=Owner | `10` |
| 6 | `avatar_url` | character varying |  | — | YES | URL to user avatar image | https://secure.gravatar.com/avatar/caf93e743fde168778fa93... |
| 7 | `_dlt_load_id` | character varying |  | — | NO | dlt load batch ID (epoch timestamp) | `1779125745.4362538` |
| 8 | `_dlt_id` | character varying |  | — | NO | dlt internal row hash (do not use as business PK) | `Xgwo6o50yAMYCA` |
| 9 | `email` | character varying |  | — | YES | User email (text — explicit column type per dlt resource decl) | _NULL_ |

---

## `gitlab_raw.pipeline_state`

**Rows**: 9 • **Size**: 64 kB • **PK**: `key` (PG constraint)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `key` | text | PK | — | NO | State key (primary key) — e.g. last_mr_updated_at, consecutive_failures | `alerted_mr_ids` |
| 2 | `value` | text |  | — | YES | State value as text (parsed by checkpoint.py) | `[]` |
| 3 | `updated_at` | timestamp with time zone |  | `now()` | NO | When this key was last written | `2026-03-27 11:54:25.491546+00:00` |

---

## `gitlab_raw.webhook_dlq`

**Rows**: 0 • **Size**: 40 kB • **PK**: `id` (PG constraint)

| No. | FIELD NAME | DATA TYPE | PRIMARY KEY | DEFAULT VALUES | NULLABLE | DESCRIPTION | EXAMPLE VALUE |
|---:|---|---|:---:|---|:---:|---|---|
| 1 | `id` | bigint | PK | nextval('gitlab_raw.webhook... | NO | DLQ entry ID (PK) | _NULL_ |
| 2 | `event_type` | text |  | — | NO | GitLab webhook event type (merge_request, push, pipeline) | _NULL_ |
| 3 | `payload` | jsonb |  | — | NO | Raw webhook JSON payload | _NULL_ |
| 4 | `error_message` | text |  | — | NO | Error message that triggered DLQ (alias of error) | _NULL_ |
| 5 | `failed_at` | timestamp with time zone |  | `now()` | NO | When entry failed and moved to DLQ | _NULL_ |
| 6 | `retry_count` | smallint |  | `0` | NO | Number of retries attempted before DLQ | _NULL_ |
| 7 | `replayed` | boolean |  | `false` | NO | Boolean — entry was replayed via ops script | _NULL_ |
| 8 | `replayed_at` | timestamp with time zone |  | — | YES | When entry was replayed (NULL if never) | _NULL_ |

---

## Notes

### Why some tables lack a PG PRIMARY KEY constraint
dlt's merge strategy uses the `primary_key` argument inside the `@dlt.resource(...)` decorator to dedup rows during MERGE INTO. dlt does NOT add a `PRIMARY KEY` constraint to the target PG table — it relies on its own internal `_dlt_id` hash for row identity at the SQL level. This means:
- Unique enforcement is at extraction-time, not DB-time
- Bulk-inserting raw rows via `psql` bypassing dlt could violate the logical PK without DB-level error

### dlt metadata columns
Every dlt-extracted table has `_dlt_load_id` (batch identifier) and `_dlt_id` (row hash). Some tables also have `_dlt_root_id` / `_dlt_parent_id` / `_dlt_list_idx` if they were ever nested children (e.g. migration 008 left these as orphan empty tables in `gitlab_raw_staging` after array→TEXT conversion). DO NOT use `_dlt_id` as a business join key.

### Schema drift tracking
Field expectations are documented in `.claude/memory/schema_snapshot.yaml` (Pattern B anti-hallucination guardrail). When GitLab API changes shape:
1. Update Pydantic model in `src/validation/schema_validator.py` first
2. Update `schema_snapshot.yaml`
3. Add migration in `src/infra/db/migrations/` to add new column with `IF NOT EXISTS` guard
4. dlt skips columns that are all-NULL on first observation — explicit ALTER required

### Type discrepancies vs GitLab API
| Field | API type | DB type | Reason |
|---|---|---|---|
| `merge_requests.reviewer_usernames` | array of string | TEXT (comma-sep) | dlt cannot reliably map list → text[] (migration 007) |
| `merge_requests.approved_by_usernames` | array of string | TEXT | Same (migration 007) |
| `merge_requests.label_names` | array of string | TEXT | Same (migration 008) |
| `pipeline_jobs.created_at` | ISO 8601 string | timestamptz (cast from TEXT in migration 010) | dlt stores raw datetime as TEXT; explicit cast for range queries |
| `merge_requests.coverage` | nullable float | nullable real | API can return NULL when no coverage report |
| `merge_requests.head_pipeline` | nullable object | flattened to `head_pipeline_status` + `head_pipeline_id` | Avoid nested table; safer for indexing |

### Cross-references
- `docs/reference/db_inventory.md` — high-level schema + sizing overview
- `docs/reference/schema_reference.md` — full schema spec (canonical)
- `.claude/memory/schema_snapshot.yaml` — anti-hallucination ground truth
- `src/extraction/sources/*.py` — dlt resource definitions (source of `primary_key`)
- `src/validation/schema_validator.py` — Pydantic models per endpoint
- `src/infra/db/migrations/*.sql` — historical schema evolution
