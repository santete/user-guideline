# Metabase Ops Panel — Setup Guide
> Thêm các question này vào 1 dashboard tên "Pipeline Ops" trong Metabase
> Admin → New Question → Native query → paste SQL → Save

---

## Question 1 — Pipeline Health (tile lớn đầu trang)

**Tên:** `Pipeline Status`
**Visualization:** Table
**Auto-refresh:** 1 giờ

```sql
SELECT
    CASE
        WHEN (SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'consecutive_failures')::int >= 3
            THEN '🔴 BLOCKED'
        WHEN (SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'consecutive_failures')::int > 0
            THEN '🟡 DEGRADED'
        ELSE '🟢 HEALTHY'
    END AS status,

    (SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'last_successful_run')
        AS last_success,

    (SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'consecutive_failures')::int
        AS failure_count,

    ROUND(
        EXTRACT(epoch FROM (
            NOW() - (SELECT value FROM gitlab_raw.pipeline_state WHERE key = 'last_successful_run')::timestamptz
        )) / 3600.0, 1
    ) AS hours_since_last_run
```

---

## Question 2 — Data Freshness (4 metric tiles)

**Tên:** `Data Freshness`
**Visualization:** Table

```sql
SELECT
    ROUND(EXTRACT(epoch FROM (NOW() - last_mr_sync))       / 3600.0, 1) AS mr_lag_hours,
    ROUND(EXTRACT(epoch FROM (NOW() - last_commit_sync))   / 3600.0, 1) AS commit_lag_hours,
    ROUND(EXTRACT(epoch FROM (NOW() - last_pipeline_sync)) / 3600.0, 1) AS pipeline_lag_hours,
    last_mr_sync::date       AS mr_last_date,
    last_commit_sync::date   AS commit_last_date,
    last_pipeline_sync::date AS pipeline_last_date
FROM gitlab_kpi.v_data_freshness
```

> **Alert:** Thêm Metabase alert nếu `mr_lag_hours > 24` → email QA Manager

---

## Question 3 — Raw Table Row Counts (7 ngày)

**Tên:** `Raw Table Counts — 7 days`
**Visualization:** Table

```sql
SELECT 'merge_requests' AS source,
       COUNT(*)          AS rows_7d,
       MAX(updated_at)   AS latest_sync
FROM gitlab_raw.merge_requests
WHERE updated_at > NOW() - INTERVAL '7 days'

UNION ALL
SELECT 'commits',
       COUNT(*),
       MAX(committed_date)
FROM gitlab_raw.commits
WHERE committed_date > NOW() - INTERVAL '7 days'

UNION ALL
SELECT 'pipelines',
       COUNT(*),
       MAX(updated_at)
FROM gitlab_raw.pipelines
WHERE updated_at > NOW() - INTERVAL '7 days'

ORDER BY source
```

---

## Question 4 — Violations Feed (live triage)

**Tên:** `Active Violations — Protected Branches`
**Visualization:** Table
**Auto-refresh:** 1 giờ
**Sort:** compliance_score ASC (worst first)

```sql
SELECT
    project_id,
    iid                                          AS "MR !",
    author_username                              AS author,
    state,
    compliance_score,
    array_to_string(violations, ', ')           AS violations,
    violation_count,
    mr_size,
    ci_status,
    created_at::date                            AS created,
    ROUND(
        EXTRACT(epoch FROM (NOW() - created_at)) / 3600.0, 1
    )                                           AS age_hours
FROM gitlab_kpi.v_violations
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY compliance_score ASC, created_at DESC
LIMIT 50
```

> Color rules:
> - `compliance_score < 40` → Red
> - `compliance_score 40–60` → Amber
> - `compliance_score 60–80` → Yellow

---

## Question 5 — Violation Summary by Project

**Tên:** `Violations by Project (7 days)`
**Visualization:** Bar chart (x=project_id, y=total)

```sql
SELECT
    project_id::text                                           AS project,
    COUNT(*)                                                   AS total_violations,
    ROUND(AVG(compliance_score)::numeric, 1)                  AS avg_score,
    COUNT(*) FILTER (WHERE 'MR_TOO_LARGE'   = ANY(violations)) AS too_large,
    COUNT(*) FILTER (WHERE 'NO_DESCRIPTION' = ANY(violations)) AS no_desc,
    COUNT(*) FILTER (WHERE 'CI_FAILED'      = ANY(violations)) AS ci_failed,
    COUNT(*) FILTER (WHERE 'NO_TICKET_REF'  = ANY(violations)) AS no_ticket,
    COUNT(*) FILTER (WHERE 'LOW_COVERAGE'   = ANY(violations)) AS low_cov
FROM gitlab_kpi.v_violations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY project_id
ORDER BY total_violations DESC
```

---

## Question 6 — Pipeline State Raw (debug)

**Tên:** `Pipeline State (debug)`
**Visualization:** Table
**Chỉ show khi cần debug — không cần trên dashboard chính**

```sql
SELECT
    key,
    value,
    updated_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS updated_local
FROM gitlab_raw.pipeline_state
ORDER BY key
```

---

## Cách layout dashboard "Pipeline Ops"

```
Row 1 (big numbers):
  ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ Pipeline Status  │ │ MR lag hours │ │Commit lag hrs│ │Active viol.  │
  │  🟢 HEALTHY      │ │     1.2h     │ │     0.8h     │ │    12 MRs    │
  └──────────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Row 2 (charts):
  ┌───────────────────────────┐ ┌────────────────────────────┐
  │ Violations by Project     │ │ Raw Table Row Counts 7d    │
  │ (bar chart)               │ │ (table)                    │
  └───────────────────────────┘ └────────────────────────────┘

Row 3 (full width):
  ┌──────────────────────────────────────────────────────────┐
  │ Active Violations Feed (worst first, auto-refresh 1h)   │
  └──────────────────────────────────────────────────────────┘
```

---

## Metabase Alerts nên set

| Condition | Alert | Recipient |
|---|---|---|
| `mr_lag_hours > 24` | Email | QA Manager |
| `failure_count >= 3` | Email + Slack | QA Manager + #engineering-quality |
| `total_violations > 20` in 24h | Slack | #engineering-quality |
| `avg_score < 60` | Email | Team Lead |
