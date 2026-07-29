---
type: Codebase Map
title: Source Code Modules Map
description: Ban do cau truc cac module ma nguon cua gitlab-analytics.
tags:
- codebase
- modules
- map
timestamp: '2026-07-28T16:17:46.828614+00:00'
---

# Codebase Structure Map
He thong bao gom **322** tap tin ma nguon chinh.

| Module Name | Path | Classes | Functions |
|-------------|------|---------|-----------|
| `CHANGELOG` | `CHANGELOG.md` | `-` | `-` |
| `CLAUDE` | `CLAUDE.md` | `-` | `-` |
| `LOCAL_SETUP` | `LOCAL_SETUP.md` | `-` | `-` |
| `ops` | `ops.py` | `-` | `_db, _exec, _header, _hr, _lag (+18 more)` |
| `README` | `README.md` | `-` | `-` |
| `CLAUDE` | `.claude/CLAUDE.md` | `-` | `-` |
| `fix_progress` | `.claude/fix_progress.md` | `-` | `-` |
| `statusline` | `.claude/statusline.js` | `-` | `-` |
| `alerter` | `.claude/agents/alerter.md` | `-` | `-` |
| `extractor` | `.claude/agents/extractor.md` | `-` | `-` |
| `healer` | `.claude/agents/healer.md` | `-` | `-` |
| `orchestrator` | `.claude/agents/orchestrator.md` | `-` | `-` |
| `transformer` | `.claude/agents/transformer.md` | `-` | `-` |
| `validator` | `.claude/agents/validator.md` | `-` | `-` |
| `alerter` | `.claude/commands/alerter.md` | `-` | `-` |
| `check-drift` | `.claude/commands/check-drift.md` | `-` | `-` |
| `classify` | `.claude/commands/classify.md` | `-` | `-` |
| `commit` | `.claude/commands/commit.md` | `-` | `-` |
| `diagnose` | `.claude/commands/diagnose.md` | `-` | `-` |
| `extractor` | `.claude/commands/extractor.md` | `-` | `-` |
| `halluc-score` | `.claude/commands/halluc-score.md` | `-` | `-` |
| `healer` | `.claude/commands/healer.md` | `-` | `-` |
| `insight` | `.claude/commands/insight.md` | `ORDER` | `-` |
| `kpi-dashboard` | `.claude/commands/kpi-dashboard.md` | `-` | `-` |
| `metrics` | `.claude/commands/metrics.md` | `-` | `-` |
| `orchestrator` | `.claude/commands/orchestrator.md` | `-` | `-` |
| `overview` | `.claude/commands/overview.md` | `-` | `-` |
| `plan` | `.claude/commands/plan.md` | `-` | `-` |
| `rotate` | `.claude/commands/rotate.md` | `-` | `-` |
| `schema-check` | `.claude/commands/schema-check.md` | `-` | `-` |
| `snapshot` | `.claude/commands/snapshot.md` | `-` | `-` |
| `testcoverage` | `.claude/commands/testcoverage.md` | `-` | `-` |
| `transformer` | `.claude/commands/transformer.md` | `-` | `-` |
| `unitest` | `.claude/commands/unitest.md` | `-` | `-` |
| `validator` | `.claude/commands/validator.md` | `-` | `-` |
| `verify` | `.claude/commands/verify.md` | `-` | `-` |
| `README` | `.claude/hooks/README.md` | `-` | `-` |
| `block-dangerous` | `.claude/hooks/nodejs/block-dangerous.js` | `-` | `-` |
| `halluc-score` | `.claude/hooks/nodejs/halluc-score.js` | `-` | `appendHistory, colorFor, computeHrs, dominantSignal, findRoot (+11 more)` |
| `post-write-check` | `.claude/hooks/nodejs/post-write-check.js` | `-` | `-` |
| `post_write_check` | `.claude/hooks/nodejs/post_write_check.js` | `-` | `-` |
| `pre_commit_check` | `.claude/hooks/nodejs/pre_commit_check.js` | `-` | `-` |
| `pre_push_check` | `.claude/hooks/nodejs/pre_push_check.js` | `-` | `-` |
| `validate-commit` | `.claude/hooks/nodejs/validate-commit.js` | `-` | `-` |
| `block-dangerous` | `.claude/hooks/python/block-dangerous.py` | `-` | `block` |
| `drift_check` | `.claude/hooks/python/drift_check.py` | `-` | `_parse_name_status, _strip_inline_comment, commit_exists, filter_files, find_project_root (+12 more)` |
| `halluc-score` | `.claude/hooks/python/halluc-score.py` | `-` | `append_history, color_for, compute_hrs, dominant_signal, find_project_root (+12 more)` |
| `metrics-summary` | `.claude/hooks/python/metrics-summary.py` | `-` | `find_project_root, load_events, main, schema_age_days` |
| `metrics_writer` | `.claude/hooks/python/metrics_writer.py` | `-` | `_read_pattern, find_project_root, write_event` |
| `post-write-check` | `.claude/hooks/python/post-write-check.py` | `-` | `is_comment` |
| `post_write_check` | `.claude/hooks/python/post_write_check.py` | `-` | `-` |
| `pre_commit_check` | `.claude/hooks/python/pre_commit_check.py` | `-` | `-` |
| `pre_push_check` | `.claude/hooks/python/pre_push_check.py` | `-` | `-` |
| `session-end` | `.claude/hooks/python/session-end.py` | `-` | `-` |
| `validate-commit` | `.claude/hooks/python/validate-commit.py` | `-` | `-` |
| `collection_e_status` | `.claude/memory/collection_e_status.md` | `-` | `-` |
| `commits_table_gap_analysis` | `.claude/memory/commits_table_gap_analysis.md` | `-` | `-` |
| `compliance_formula_v14` | `.claude/memory/compliance_formula_v14.md` | `-` | `-` |
| `dashboard_debug_mr_commits` | `.claude/memory/dashboard_debug_mr_commits.md` | `-` | `-` |
| `dip_phase1_done` | `.claude/memory/dip_phase1_done.md` | `-` | `-` |
| `dip_phase2_done` | `.claude/memory/dip_phase2_done.md` | `-` | `-` |
| `dip_phase3_done` | `.claude/memory/dip_phase3_done.md` | `-` | `-` |
| `impl_dashboard_progress` | `.claude/memory/impl_dashboard_progress.md` | `-` | `-` |
| `MEMORY` | `.claude/memory/MEMORY.md` | `-` | `-` |
| `mr_commits_open_issues` | `.claude/memory/mr_commits_open_issues.md` | `-` | `-` |
| `session_20260514` | `.claude/memory/session_20260514.md` | `-` | `-` |
| `session_20260515` | `.claude/memory/session_20260515.md` | `-` | `-` |
| `session_20260516` | `.claude/memory/session_20260516.md` | `-` | `-` |
| `session_20260519` | `.claude/memory/session_20260519.md` | `-` | `-` |
| `session_20260520` | `.claude/memory/session_20260520.md` | `-` | `-` |
| `session_20260526` | `.claude/memory/session_20260526.md` | `-` | `-` |
| `session_20260527` | `.claude/memory/session_20260527.md` | `-` | `-` |
| `session_20260528` | `.claude/memory/session_20260528.md` | `-` | `-` |
| `session_20260529` | `.claude/memory/session_20260529.md` | `-` | `-` |
| `session_20260529_mr_drafts` | `.claude/memory/session_20260529_mr_drafts.md` | `-` | `-` |
| `session_20260605` | `.claude/memory/session_20260605.md` | `-` | `-` |
| `session_20260709` | `.claude/memory/session_20260709.md` | `-` | `-` |
| `data-engineer` | `.claude/skill/data-engineer.md` | `-` | `merge_requests` |
| `data-insight-analyst` | `.claude/skill/data-insight-analyst.md` | `-` | `-` |
| `devops-master` | `.claude/skill/devops-master.md` | `-` | `-` |
| `expert-python` | `.claude/skill/expert-python.md` | `Config, MergeRequestSingle` | `check, check_non_negative, handle_mr_event, lifespan, receive_webhook (+1 more)` |
| `solution-architect` | `.claude/skill/solution-architect.md` | `-` | `-` |
| `statusline` | `.claude/statusline/statusline.py` | `-` | `-` |
| `README` | `deploy/argocd/README.md` | `-` | `-` |
| `dba-provisioning-service-account` | `docs/dba-provisioning-service-account.sql` | `-` | `-` |
| `grant-spec-service-account` | `docs/grant-spec-service-account.sql` | `-` | `-` |
| `gen_brd_prd_sdd` | `scripts/gen_brd_prd_sdd.py` | `-` | `add_cover, build_brd, build_prd, build_sdd, bullet (+6 more)` |
| `gen_db_fields_doc` | `scripts/gen_db_fields_doc.py` | `AND` | `fmt_default, fmt_sample, fmt_type, get_desc, main` |
| `p2_partition_staging_test` | `scripts/p2_partition_staging_test.py` | `-` | `apply_partition, cast_partition_key, conn_cm, exec_sql, fail (+8 more)` |
| `read_docx_templates` | `scripts/read_docx_templates.py` | `-` | `extract, main` |
| `logging_config` | `src/logging_config.py` | `-` | `setup_logging` |
| `__init__` | `src/__init__.py` | `-` | `-` |
| `compliance_alert` | `src/alerting/compliance_alert.py` | `-` | `_fetch_violations, main, run` |
| `freshness_alert` | `src/alerting/freshness_alert.py` | `Slack` | `_build_blocks, _fetch_data_freshness, _fetch_pipeline_health, _post_blocks, _resolve_webhook_url (+4 more)` |
| `slack_client` | `src/alerting/slack_client.py` | `-` | `send_failure_alert, send_slack_alert` |
| `thresholds` | `src/alerting/thresholds.py` | `-` | `-` |
| `__init__` | `src/alerting/__init__.py` | `-` | `-` |
| `applier` | `src/compliance_updater/applier.py` | `MarkerError` | `_backup, _replace_section, apply_all, apply_thresholds, apply_to_file (+1 more)` |
| `cli` | `src/compliance_updater/cli.py` | `-` | `build_parser, cmd_apply, cmd_check, cmd_diff, main` |
| `diff` | `src/compliance_updater/diff.py` | `ChangeReport, ComponentChange, ViolationChange` | `_component_fields, _flat, diff_specs, summary` |
| `generator` | `src/compliance_updater/generator.py` | `WHEN` | `_default_for, _gen_boolean, _gen_component_block, _violation_case_block, gen_score_weight (+6 more)` |
| `models` | `src/compliance_updater/models.py` | `AIAdoptionThresholds, AlertThresholds, BooleanComponent, ComplianceScoreThresholds, ComplianceSpec (+8 more)` | `parse_components, parse_score_component, violations_by_code` |
| `parser` | `src/compliance_updater/parser.py` | `-` | `load_spec, save_spec` |
| `__init__` | `src/compliance_updater/__init__.py` | `-` | `-` |
| `__main__` | `src/compliance_updater/__main__.py` | `-` | `-` |
| `bootstrap` | `src/config/bootstrap.py` | `-` | `_load_from_json, _vault_file_for, init` |
| `__init__` | `src/config/__init__.py` | `-` | `-` |
| `checkpoint` | `src/extraction/checkpoint.py` | `-` | `_db_get, _db_set, _db_url, _default_state, _now (+9 more)` |
| `client` | `src/extraction/client.py` | `GitLabClient` | `__init__, _build_session, _parse_diff_stats, get, get_mr_approvals (+8 more)` |
| `pipeline` | `src/extraction/pipeline.py` | `-` | `run` |
| `__init__` | `src/extraction/__init__.py` | `-` | `-` |
| `commits` | `src/extraction/sources/commits.py` | `-` | `_build_commit_record, _cap_projects, _extract_project_commits, _filter_active_projects, commits` |
| `group_members` | `src/extraction/sources/group_members.py` | `-` | `group_members` |
| `merge_requests` | `src/extraction/sources/merge_requests.py` | `-` | `_build_mr_record, merge_requests` |
| `mr_commits` | `src/extraction/sources/mr_commits.py` | `-` | `mr_commits` |
| `mr_notes` | `src/extraction/sources/mr_notes.py` | `-` | `mr_notes` |
| `pipelines` | `src/extraction/sources/pipelines.py` | `-` | `pipelines` |
| `pipeline_jobs` | `src/extraction/sources/pipeline_jobs.py` | `-` | `pipeline_jobs` |
| `test_reports` | `src/extraction/sources/test_reports.py` | `-` | `test_reports` |
| `__init__` | `src/extraction/sources/__init__.py` | `-` | `-` |
| `register_webhook` | `src/infra/register_webhook.py` | `-` | `_delete, _get_existing_hooks, _register, run` |
| `__init__` | `src/infra/__init__.py` | `-` | `-` |
| `README` | `src/infra/argocd/README.md` | `-` | `-` |
| `README` | `src/infra/argocd/eso/README.md` | `-` | `-` |
| `migrate` | `src/infra/db/migrate.py` | `MigrationError` | `_check_manifest_complete, _connect, _select, applied_state, checksum (+9 more)` |
| `__init__` | `src/infra/db/__init__.py` | `-` | `-` |
| `001_init_schemas` | `src/infra/db/migrations/001_init_schemas.sql` | `-` | `-` |
| `002_webhook_dlq` | `src/infra/db/migrations/002_webhook_dlq.sql` | `TEXT` | `-` |
| `003_pipeline_state` | `src/infra/db/migrations/003_pipeline_state.sql` | `-` | `-` |
| `004_pipelines_add_timing_coverage` | `src/infra/db/migrations/004_pipelines_add_timing_coverage.sql` | `-` | `-` |
| `005_mr_branch_title_fields` | `src/infra/db/migrations/005_mr_branch_title_fields.sql` | `-` | `-` |
| `006_grant_analytics_ro_kpi_schema` | `src/infra/db/migrations/006_grant_analytics_ro_kpi_schema.sql` | `-` | `-` |
| `007_mr_review_fields` | `src/infra/db/migrations/007_mr_review_fields.sql` | `-` | `-` |
| `008_label_names_to_text` | `src/infra/db/migrations/008_label_names_to_text.sql` | `-` | `-` |
| `009_pipeline_jobs_retention` | `src/infra/db/migrations/009_pipeline_jobs_retention.sql` | `-` | `-` |
| `010_pipeline_jobs_created_at_timestamptz` | `src/infra/db/migrations/010_pipeline_jobs_created_at_timestamptz.sql` | `FROM, INTO` | `-` |
| `011_pipeline_jobs_partition` | `src/infra/db/migrations/011_pipeline_jobs_partition.sql` | `FROM, INTO` | `-` |
| `012_pipelines_partition` | `src/infra/db/migrations/012_pipelines_partition.sql` | `-` | `-` |
| `013_commits_partition` | `src/infra/db/migrations/013_commits_partition.sql` | `-` | `-` |
| `014_mr_screenshot_rebase_fields` | `src/infra/db/migrations/014_mr_screenshot_rebase_fields.sql` | `-` | `-` |
| `015_pipeline_state_view` | `src/infra/db/migrations/015_pipeline_state_view.sql` | `-` | `-` |
| `README` | `src/infra/registry/README.md` | `-` | `-` |
| `setup_dashboards` | `src/metabase/setup_dashboards.py` | `AS, HAVING, MetabaseClient` | `__init__, _default_size, _f_tags, _f_where, _headers (+34 more)` |
| `daily_insight` | `src/reporting/daily_insight.py` | `-` | `_conn, _hr, _pct_arrow, _q, build_report (+8 more)` |
| `__init__` | `src/reporting/__init__.py` | `-` | `-` |
| `__init__` | `src/transform/__init__.py` | `-` | `-` |
| `CHANGELOG` | `src/transform/dbt_packages/dbt_utils/CHANGELOG.md` | `-` | `-` |
| `CONTRIBUTING` | `src/transform/dbt_packages/dbt_utils/CONTRIBUTING.md` | `-` | `-` |
| `README` | `src/transform/dbt_packages/dbt_utils/README.md` | `-` | `-` |
| `RELEASE` | `src/transform/dbt_packages/dbt_utils/RELEASE.md` | `-` | `-` |
| `pull_request_template` | `src/transform/dbt_packages/dbt_utils/.github/pull_request_template.md` | `-` | `-` |
| `bug_report` | `src/transform/dbt_packages/dbt_utils/.github/ISSUE_TEMPLATE/bug_report.md` | `-` | `-` |
| `dbt_minor_release` | `src/transform/dbt_packages/dbt_utils/.github/ISSUE_TEMPLATE/dbt_minor_release.md` | `-` | `-` |
| `feature_request` | `src/transform/dbt_packages/dbt_utils/.github/ISSUE_TEMPLATE/feature_request.md` | `-` | `-` |
| `utils_minor_release` | `src/transform/dbt_packages/dbt_utils/.github/ISSUE_TEMPLATE/utils_minor_release.md` | `-` | `-` |
| `README` | `src/transform/dbt_packages/dbt_utils/integration_tests/README.md` | `-` | `-` |
| `assert_equal_values` | `src/transform/dbt_packages/dbt_utils/integration_tests/macros/assert_equal_values.sql` | `-` | `-` |
| `limit_zero` | `src/transform/dbt_packages/dbt_utils/integration_tests/macros/limit_zero.sql` | `-` | `-` |
| `tests` | `src/transform/dbt_packages/dbt_utils/integration_tests/macros/tests.sql` | `-` | `-` |
| `test_date_spine` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/datetime/test_date_spine.sql` | `-` | `-` |
| `equality_less_columns` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/equality_less_columns.sql` | `-` | `-` |
| `recency_time_excluded` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/recency_time_excluded.sql` | `-` | `-` |
| `recency_time_included` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/recency_time_included.sql` | `-` | `-` |
| `test_equal_column_subset` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/test_equal_column_subset.sql` | `-` | `-` |
| `test_equal_rowcount` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/test_equal_rowcount.sql` | `-` | `-` |
| `test_fewer_rows_than` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/generic_tests/test_fewer_rows_than.sql` | `-` | `-` |
| `test_haversine_distance_km` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/geo/test_haversine_distance_km.sql` | `-` | `-` |
| `test_haversine_distance_mi` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/geo/test_haversine_distance_mi.sql` | `-` | `-` |
| `test_deduplicate` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_deduplicate.sql` | `-` | `-` |
| `test_generate_series` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_generate_series.sql` | `-` | `-` |
| `test_generate_surrogate_key` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_generate_surrogate_key.sql` | `-` | `-` |
| `test_get_column_values` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_column_values.sql` | `-` | `-` |
| `test_get_column_values_where` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_column_values_where.sql` | `-` | `-` |
| `test_get_filtered_columns_in_relation` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_filtered_columns_in_relation.sql` | `-` | `-` |
| `test_get_relations_by_pattern` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_relations_by_pattern.sql` | `-` | `-` |
| `test_get_relations_by_prefix_and_union` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_relations_by_prefix_and_union.sql` | `-` | `-` |
| `test_get_single_value` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_single_value.sql` | `-` | `-` |
| `test_get_single_value_default` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_get_single_value_default.sql` | `-` | `-` |
| `test_groupby` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_groupby.sql` | `-` | `-` |
| `test_not_empty_string_failing` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_not_empty_string_failing.sql` | `-` | `-` |
| `test_not_empty_string_passing` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_not_empty_string_passing.sql` | `-` | `-` |
| `test_nullcheck_table` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_nullcheck_table.sql` | `-` | `-` |
| `test_pivot` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_pivot.sql` | `-` | `-` |
| `test_pivot_apostrophe` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_pivot_apostrophe.sql` | `-` | `-` |
| `test_safe_add` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_safe_add.sql` | `-` | `-` |
| `test_safe_divide` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_safe_divide.sql` | `-` | `-` |
| `test_safe_subtract` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_safe_subtract.sql` | `-` | `-` |
| `test_star` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star.sql` | `-` | `-` |
| `test_star_aggregate` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star_aggregate.sql` | `-` | `-` |
| `test_star_no_columns` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star_no_columns.sql` | `-` | `-` |
| `test_star_prefix_suffix` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star_prefix_suffix.sql` | `-` | `-` |
| `test_star_quote_identifiers` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star_quote_identifiers.sql` | `-` | `-` |
| `test_star_uppercase` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_star_uppercase.sql` | `-` | `-` |
| `test_union` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union.sql` | `-` | `-` |
| `test_union_base` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_base.sql` | `-` | `-` |
| `test_union_exclude_base_lowercase` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_exclude_base_lowercase.sql` | `-` | `-` |
| `test_union_exclude_base_uppercase` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_exclude_base_uppercase.sql` | `-` | `-` |
| `test_union_exclude_lowercase` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_exclude_lowercase.sql` | `-` | `-` |
| `test_union_exclude_uppercase` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_exclude_uppercase.sql` | `-` | `-` |
| `test_union_no_source_column` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_no_source_column.sql` | `-` | `-` |
| `test_union_where` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_where.sql` | `-` | `-` |
| `test_union_where_base` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_union_where_base.sql` | `-` | `-` |
| `test_unpivot` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_unpivot.sql` | `-` | `-` |
| `test_unpivot_bool` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_unpivot_bool.sql` | `-` | `-` |
| `test_unpivot_quote` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_unpivot_quote.sql` | `-` | `-` |
| `test_width_bucket` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/sql/test_width_bucket.sql` | `-` | `-` |
| `test_urls` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/web/test_urls.sql` | `-` | `-` |
| `test_url_host` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/web/test_url_host.sql` | `-` | `-` |
| `test_url_path` | `src/transform/dbt_packages/dbt_utils/integration_tests/models/web/test_url_path.sql` | `-` | `-` |
| `assert_get_query_results_as_dict_objects_equal` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/assert_get_query_results_as_dict_objects_equal.sql` | `-` | `-` |
| `expect_table_columns_to_match_set` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/generic/expect_table_columns_to_match_set.sql` | `-` | `-` |
| `assert_pretty_output_msg_is_string` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/jinja_helpers/assert_pretty_output_msg_is_string.sql` | `-` | `-` |
| `assert_pretty_time_is_string` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/jinja_helpers/assert_pretty_time_is_string.sql` | `-` | `-` |
| `test_slugify` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/jinja_helpers/test_slugify.sql` | `-` | `-` |
| `test_get_column_values_use_default` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/sql/test_get_column_values_use_default.sql` | `-` | `-` |
| `test_get_single_value_multiple_rows` | `src/transform/dbt_packages/dbt_utils/integration_tests/tests/sql/test_get_single_value_multiple_rows.sql` | `-` | `-` |
| `accepted_range` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/accepted_range.sql` | `-` | `-` |
| `at_least_one` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/at_least_one.sql` | `-` | `-` |
| `cardinality_equality` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/cardinality_equality.sql` | `-` | `-` |
| `equality` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/equality.sql` | `-` | `-` |
| `equal_rowcount` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/equal_rowcount.sql` | `-` | `-` |
| `expression_is_true` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/expression_is_true.sql` | `-` | `-` |
| `fewer_rows_than` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/fewer_rows_than.sql` | `-` | `-` |
| `mutually_exclusive_ranges` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/mutually_exclusive_ranges.sql` | `-` | `-` |
| `not_accepted_values` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/not_accepted_values.sql` | `-` | `-` |
| `not_constant` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/not_constant.sql` | `-` | `-` |
| `not_empty_string` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/not_empty_string.sql` | `-` | `-` |
| `not_null_proportion` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/not_null_proportion.sql` | `-` | `-` |
| `recency` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/recency.sql` | `-` | `-` |
| `relationships_where` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/relationships_where.sql` | `-` | `-` |
| `sequential_values` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/sequential_values.sql` | `-` | `-` |
| `unique_combination_of_columns` | `src/transform/dbt_packages/dbt_utils/macros/generic_tests/unique_combination_of_columns.sql` | `-` | `-` |
| `log_info` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/log_info.sql` | `-` | `-` |
| `pretty_log_format` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/pretty_log_format.sql` | `-` | `-` |
| `pretty_time` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/pretty_time.sql` | `-` | `-` |
| `slugify` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/slugify.sql` | `-` | `-` |
| `_is_ephemeral` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/_is_ephemeral.sql` | `-` | `-` |
| `_is_relation` | `src/transform/dbt_packages/dbt_utils/macros/jinja_helpers/_is_relation.sql` | `-` | `-` |
| `date_spine` | `src/transform/dbt_packages/dbt_utils/macros/sql/date_spine.sql` | `-` | `-` |
| `deduplicate` | `src/transform/dbt_packages/dbt_utils/macros/sql/deduplicate.sql` | `-` | `-` |
| `generate_series` | `src/transform/dbt_packages/dbt_utils/macros/sql/generate_series.sql` | `-` | `-` |
| `generate_surrogate_key` | `src/transform/dbt_packages/dbt_utils/macros/sql/generate_surrogate_key.sql` | `-` | `-` |
| `get_column_values` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_column_values.sql` | `-` | `-` |
| `get_filtered_columns_in_relation` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_filtered_columns_in_relation.sql` | `-` | `-` |
| `get_query_results_as_dict` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_query_results_as_dict.sql` | `-` | `-` |
| `get_relations_by_pattern` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_relations_by_pattern.sql` | `-` | `-` |
| `get_relations_by_prefix` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_relations_by_prefix.sql` | `-` | `-` |
| `get_single_value` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_single_value.sql` | `-` | `-` |
| `get_tables_by_pattern_sql` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_tables_by_pattern_sql.sql` | `-` | `-` |
| `get_tables_by_prefix_sql` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_tables_by_prefix_sql.sql` | `-` | `-` |
| `get_table_types_sql` | `src/transform/dbt_packages/dbt_utils/macros/sql/get_table_types_sql.sql` | `-` | `-` |
| `groupby` | `src/transform/dbt_packages/dbt_utils/macros/sql/groupby.sql` | `-` | `-` |
| `haversine_distance` | `src/transform/dbt_packages/dbt_utils/macros/sql/haversine_distance.sql` | `-` | `-` |
| `nullcheck` | `src/transform/dbt_packages/dbt_utils/macros/sql/nullcheck.sql` | `-` | `-` |
| `nullcheck_table` | `src/transform/dbt_packages/dbt_utils/macros/sql/nullcheck_table.sql` | `-` | `-` |
| `pivot` | `src/transform/dbt_packages/dbt_utils/macros/sql/pivot.sql` | `-` | `-` |
| `safe_add` | `src/transform/dbt_packages/dbt_utils/macros/sql/safe_add.sql` | `-` | `-` |
| `safe_divide` | `src/transform/dbt_packages/dbt_utils/macros/sql/safe_divide.sql` | `-` | `-` |
| `safe_subtract` | `src/transform/dbt_packages/dbt_utils/macros/sql/safe_subtract.sql` | `-` | `-` |
| `star` | `src/transform/dbt_packages/dbt_utils/macros/sql/star.sql` | `-` | `-` |
| `surrogate_key` | `src/transform/dbt_packages/dbt_utils/macros/sql/surrogate_key.sql` | `-` | `-` |
| `union` | `src/transform/dbt_packages/dbt_utils/macros/sql/union.sql` | `-` | `-` |
| `unpivot` | `src/transform/dbt_packages/dbt_utils/macros/sql/unpivot.sql` | `-` | `-` |
| `width_bucket` | `src/transform/dbt_packages/dbt_utils/macros/sql/width_bucket.sql` | `-` | `-` |
| `get_url_host` | `src/transform/dbt_packages/dbt_utils/macros/web/get_url_host.sql` | `-` | `-` |
| `get_url_parameter` | `src/transform/dbt_packages/dbt_utils/macros/web/get_url_parameter.sql` | `-` | `-` |
| `get_url_path` | `src/transform/dbt_packages/dbt_utils/macros/web/get_url_path.sql` | `-` | `-` |
| `dim_user` | `src/transform/models/marts/dim_user.sql` | `-` | `-` |
| `v_ai_adoption` | `src/transform/models/marts/v_ai_adoption.sql` | `-` | `-` |
| `v_ai_disclosure_tracker` | `src/transform/models/marts/v_ai_disclosure_tracker.sql` | `-` | `-` |
| `v_compliance_criterion_stats` | `src/transform/models/marts/v_compliance_criterion_stats.sql` | `-` | `-` |
| `v_compliance_mgmt` | `src/transform/models/marts/v_compliance_mgmt.sql` | `-` | `-` |
| `v_compliance_violation_detail` | `src/transform/models/marts/v_compliance_violation_detail.sql` | `-` | `-` |
| `v_cycle_time_stats` | `src/transform/models/marts/v_cycle_time_stats.sql` | `-` | `-` |
| `v_data_freshness` | `src/transform/models/marts/v_data_freshness.sql` | `-` | `-` |
| `v_dlq_monitor` | `src/transform/models/marts/v_dlq_monitor.sql` | `-` | `-` |
| `v_dora_metrics` | `src/transform/models/marts/v_dora_metrics.sql` | `-` | `-` |
| `v_ingestion_volume_daily` | `src/transform/models/marts/v_ingestion_volume_daily.sql` | `-` | `-` |
| `v_kpi_control_panel` | `src/transform/models/marts/v_kpi_control_panel.sql` | `-` | `-` |
| `v_long_commit_violations` | `src/transform/models/marts/v_long_commit_violations.sql` | `-` | `-` |
| `v_mr_commit_convention` | `src/transform/models/marts/v_mr_commit_convention.sql` | `-` | `-` |
| `v_mr_compliance` | `src/transform/models/marts/v_mr_compliance.sql` | `-` | `-` |
| `v_mr_score_breakdown` | `src/transform/models/marts/v_mr_score_breakdown.sql` | `-` | `-` |
| `v_ops_pipeline_health` | `src/transform/models/marts/v_ops_pipeline_health.sql` | `-` | `-` |
| `v_pipeline_failures` | `src/transform/models/marts/v_pipeline_failures.sql` | `-` | `-` |
| `v_project_health_scorecard` | `src/transform/models/marts/v_project_health_scorecard.sql` | `-` | `-` |
| `v_reviewer_workload` | `src/transform/models/marts/v_reviewer_workload.sql` | `-` | `-` |
| `v_review_quality` | `src/transform/models/marts/v_review_quality.sql` | `-` | `-` |
| `v_team_leaderboard` | `src/transform/models/marts/v_team_leaderboard.sql` | `-` | `-` |
| `v_violations` | `src/transform/models/marts/v_violations.sql` | `-` | `-` |
| `v_weekly_kpi` | `src/transform/models/marts/v_weekly_kpi.sql` | `-` | `-` |
| `stg_commits` | `src/transform/models/staging/stg_commits.sql` | `-` | `-` |
| `stg_department_mapping` | `src/transform/models/staging/stg_department_mapping.sql` | `-` | `-` |
| `stg_group_members` | `src/transform/models/staging/stg_group_members.sql` | `-` | `-` |
| `stg_merge_requests` | `src/transform/models/staging/stg_merge_requests.sql` | `-` | `-` |
| `stg_mr_commits` | `src/transform/models/staging/stg_mr_commits.sql` | `-` | `-` |
| `stg_mr_notes` | `src/transform/models/staging/stg_mr_notes.sql` | `-` | `-` |
| `stg_pipelines` | `src/transform/models/staging/stg_pipelines.sql` | `-` | `-` |
| `stg_pipeline_jobs` | `src/transform/models/staging/stg_pipeline_jobs.sql` | `-` | `-` |
| `stg_test_reports` | `src/transform/models/staging/stg_test_reports.sql` | `-` | `-` |
| `data_quality` | `src/validation/data_quality.py` | `-` | `check_commit_quality, check_mr_quality` |
| `idempotency` | `src/validation/idempotency.py` | `-` | `upsert_record` |
| `schema_validator` | `src/validation/schema_validator.py` | `CommitWithStats, Config, GroupMember, MRCommit, MergeRequestList (+2 more)` | `coverage_in_range, validate_commit, validate_group_members, validate_mr_commits, validate_mr_list (+3 more)` |
| `__init__` | `src/validation/__init__.py` | `-` | `-` |
| `app` | `src/webhook/app.py` | `-` | `health, lifespan, ops_status, receive_webhook` |
| `handlers` | `src/webhook/handlers.py` | `-` | `_execute_with_retry, _write_dlq, handle_mr_event, handle_pipeline_event, handle_push_event` |
| `validator` | `src/webhook/validator.py` | `-` | `verify_webhook_token` |
| `__init__` | `src/webhook/__init__.py` | `-` | `-` |
| `test_alerting` | `tests/test_alerting.py` | `TestDedup, TestFailureAlert, TestSlackBlockKit` | `_make_violation, test_failure_alert_contains_error_text, test_failure_alert_sent_on_db_exception, test_no_failure_alert_without_slack_url, test_no_violations_skips_send (+6 more)` |
| `test_checkpoint` | `tests/test_checkpoint.py` | `TestAddAlertedMr, TestDbGet, TestDbSet, TestDbUrl, TestGetAlertedMrIds (+5 more)` | `_mock_connection, test_should_append_new_mr_id_to_list, test_should_cap_list_at_500_entries, test_should_count_from_zero_on_first_failure, test_should_deserialize_json_list_transparently (+35 more)` |
| `test_client` | `tests/test_client.py` | `TestGet, TestGetMrWithChanges, TestPaginate, TestVerifyConnection` | `_make_client, _mock_response, test_calls_correct_endpoint, test_never_calls_list_endpoint, test_passes_per_page_100_param (+8 more)` |
| `test_config_bootstrap` | `tests/test_config_bootstrap.py` | `-` | `_scrub_env, _vault_filename, fake_load_dotenv, test_falls_back_to_dotenv_when_python_environment_unset, test_falls_back_to_dotenv_when_vault_file_missing (+8 more)` |
| `test_extraction` | `tests/test_extraction.py` | `TestCommitRecord, TestExtractProjectCommits, TestMrRecord, TestMrRecordAdditionalCases` | `_commit, _mr, test_ai_prefix_detection, test_bad_commit_message_flagged, test_build_mr_record_happy_path (+28 more)` |
| `test_freshness_alert` | `tests/test_freshness_alert.py` | `TestHealthyState, TestMissingWebhook, TestStaleETL` | `_freshness_row, _health_row, test_data_ops_webhook_preferred_over_default, test_no_alert_when_pipeline_fresh, test_no_webhook_logs_warning_no_db_call (+1 more)` |
| `test_metabase_client` | `tests/test_metabase_client.py` | `TestAddCardsToDashboard, TestCardExists, TestCreateCard, TestGetDatabaseId, TestGetOrCreateCollection (+6 more)` | `_make_client, _mock_resp, _setup_dashboard, _specs, setup_method (+60 more)` |
| `test_migrate` | `tests/test_migrate.py` | `-` | `_read_006, test_006_no_longer_has_the_old_bugs, test_006_templated_sql_resolves_to_valid_grant, test_checksum_is_deterministic_and_sensitive, test_discover_is_sorted_by_number (+9 more)` |
| `test_mr_commits` | `tests/test_mr_commits.py` | `TestGetMrCommits, TestMrCommitsGenerator, TestValidateMrCommits` | `_make_client, _mock_response, _mr_record, _raw_commit, _run (+48 more)` |
| `test_pipeline_run` | `tests/test_pipeline_run.py` | `TestPipelineRun` | `_run, fake_dlt_pipeline, fake_merge_requests, test_should_call_mark_failure_when_pipeline_run_raises, test_should_call_mark_run_success_when_pipeline_completes (+10 more)` |
| `test_sources_generators` | `tests/test_sources_generators.py` | `TestCommitsGenerator, TestMergeRequestsGenerator, TestPipelinesGenerator` | `_commit, _mr, _pipeline, _project, _run (+20 more)` |
| `test_validation` | `tests/test_validation.py` | `TestDataQuality, TestSchemaValidator` | `test_ai_commit_zero_loc_flagged, test_clean_data_no_warnings, test_commit_warns_on_missing_stats, test_merged_without_merged_at_flagged, test_mr_list_missing_required_raises (+11 more)` |
| `test_webhook_checkpoint` | `tests/test_webhook_checkpoint.py` | `TestCheckpoint, TestWebhook` | `__aenter__, __aexit__, _isolate_database_url, acquire, fetchval (+6 more)` |
| `__init__` | `tests/__init__.py` | `-` | `-` |

# Navigation
Xem cac tap tin cau hinh chinh tai [Key Config Files](../codebase/key_files.md).
