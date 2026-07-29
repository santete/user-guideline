# Kế hoạch Cải thiện Dữ liệu — Data Improvement Plan (DIP)
# ENG-ANA-001 | v1.0 | 2026-04-13

**Trạng thái tổng:** DONE
**Ngày lập kế hoạch:** 2026-04-13
**Cập nhật lần cuối:** 2026-04-13
**Phụ thuộc:** pipeline.py (extraction), dbt models (transform), compliance_updater (auto-sync), Metabase (viz)
**Context snapshot:** `.claude/memory/dip_phase_N_done.md` — lưu sau mỗi phase hoàn thành

---

## Tổng quan tiến độ

| Phase | Tên                             | Trạng thái | Ước lượng  | Bắt đầu | Hoàn thành |
|-------|---------------------------------|------------|------------|---------|------------|
| 1     | Quick Wins — MR Enrichment      | DONE       | 1–2 ngày   | 2026-04-13 | 2026-04-13 |
| 2     | Review Quality KPI              | DONE       | 3–5 ngày   | 2026-04-13 | 2026-04-14 |
| 3     | Advanced Metrics (tuỳ chọn)     | DONE       | 5+ ngày    | 2026-04-14 | 2026-04-14 |
| A v1.6 | Advisory criteria R-MR-005/006 | PARTIAL   | 1 ngày     | 2026-05-17 | 2026-05-18 ship; data fill pending |

**Phase A v1.6 follow-on**: Code + dashboard ship complete nhưng B14/B15 đang render trống vì data gap. Plan khắc phục + CI quality gate thiết kế tại [`mr-compliance/v1.6_ci_quality_gate_plan.md`](mr-compliance/v1.6_ci_quality_gate_plan.md).

---

## 0. Cơ chế Context Snapshot

### 0.1 Tại sao cần snapshot?

Claude Code conversations có giới hạn context window. Nếu conversation overflow giữa một phase, conversation mới cần resume từ checkpoint đã biết. Snapshot đảm bảo continuity.

### 0.2 Cách hoạt động

Sau mỗi phase hoàn thành, lưu 1 file snapshot vào **project memory** (`.claude/memory/` — thư mục gốc project):

```
.claude/memory/dip_phase1_done.md   — sau Phase 1
.claude/memory/dip_phase2_done.md   — sau Phase 2
.claude/memory/dip_phase3_done.md   — sau Phase 3
```

Mỗi snapshot có format:

```yaml
---
name: DIP Phase N Complete
description: <tóm tắt 1 dòng>
type: project
---

# DIP Phase N — Hoàn thành <YYYY-MM-DD>

## Files đã tạo
- path/to/new_file.py — mục đích

## Files đã sửa
- path/to/modified.py — thay đổi gì

## Migration đã chạy
- 007_xxx.sql — thành công / thất bại

## Verification results
- SELECT count(*) FROM ... = N rows
- dbt run: 18/18 OK

## Vấn đề phát hiện
- (nếu có)

## Prerequisites cho Phase tiếp theo
- (điều kiện cần thoả mãn)
```

### 0.3 Cách resume ở conversation mới

```
1. Đọc .claude/memory/MEMORY.md          — tìm pointer đến snapshot
2. Đọc .claude/memory/dip_phase_N_done.md — trạng thái cụ thể
3. Đọc docs/planning/data_improvement_plan.md — tìm phase tiếp theo (PENDING)
4. Bắt đầu implement phase tiếp theo
```

### 0.4 Cập nhật MEMORY.md

Sau khi lưu snapshot, thêm dòng vào auto-memory index (user-level):

```
- [DIP Phase N Done](dip_phase_N_done.md) — <tóm tắt>, hoàn thành <YYYY-MM-DD>
```

### 0.5 Cập nhật tài liệu này

Sau mỗi phase:
1. Đổi `Trạng thái` của phase vừa xong: `PENDING` → `DONE`
2. Điền `Bắt đầu` và `Hoàn thành` trong bảng tiến độ
3. Ghi thêm section "Kết quả thực tế" vào cuối phase

---

## 1. Kiến trúc hiện tại & Gap Summary

### 1.1 Luồng dữ liệu hiện tại

```
GitLab API v4
  │
  ├── GET /groups/:gid/merge_requests (list, paginated)
  │     └→ GET /projects/:pid/merge_requests/:iid/changes (per-MR)
  │
  ├── GET /projects/:pid/repository/commits?with_stats=true
  │
  ├── GET /projects/:pid/pipelines
  │
  └── GET /projects/:pid/merge_requests/:iid/commits (mr_commits)
       │
       ▼
  src/extraction/pipeline.py ── dlt ──→ PostgreSQL gitlab_raw.*
       │
       ▼
  src/transform/models/ ── dbt ──→ PostgreSQL gitlab_kpi.* (marts) + gitlab_kpi_staging.* (staging)
       │
       ▼
  Metabase dashboards (Collections A/B/C/D/E) + Slack alerts
```

### 1.2 Data đã đủ cho compliance scoring (10/10 tiêu chí v1.4)

| # | Tiêu chí             | Max | Data field                    | Trạng thái |
|---|----------------------|-----|-------------------------------|------------|
| 1 | CI pass/fail         | 25  | `ci_passed`                   | OK         |
| 2 | Coverage tuyệt đối   | 10  | `coverage` (pipeline API)     | OK         |
| 3 | Coverage delta       | 5   | Computed SQL (2w vs 2w)       | OK         |
| 4 | MR size              | 15  | `mr_size` (parse diff)        | OK         |
| 5 | Description          | 10  | `has_description`             | OK         |
| 6 | Description template | 5   | `has_description_template`    | OK         |
| 7 | Ticket reference     | 10  | `has_ticket_ref`              | OK         |
| 8 | AI Disclosure        | 5   | `has_ai_disclosure`           | OK         |
| 9 | Branch naming        | 10  | `has_valid_branch_name`       | OK         |
| 10| MR title format      | 5   | `has_conventional_title`      | OK         |

### 1.3 Gaps — dữ liệu cần bổ sung

| Priority | Gap                                      | Impact     | Phase |
|----------|------------------------------------------|------------|-------|
| P0       | Review Metrics (reviewers, approvers)    | CAO        | 1+2   |
| P0       | Author Identity Mapping                  | CAO        | 1     |
| P1       | Cycle Time Breakdown (time-to-review)    | TRUNG BÌNH | 2     |
| P1       | Labels chưa dùng trong dbt models        | TRUNG BÌNH | 1     |
| P2       | Pipeline Jobs Detail (stages, test report)| THẤP      | 3     |
| P2       | DORA 4 Metrics                           | THẤP       | 3     |

### 1.4 API fields chưa khai thác

| Nguồn API             | Đang extract                                    | Sẽ thêm (DIP)                                |
|-----------------------|-------------------------------------------------|----------------------------------------------|
| MR list endpoint      | id, iid, title, state, author, labels...        | `reviewers[]`, `draft`                       |
| MR changes endpoint   | additions, deletions, diff_overflow              | `merge_user` (đã có trong response)          |
| **MỚI** MR approvals  | (chưa gọi)                                      | `approved_by[]`, `approved`                  |
| **MỚI** Group members | (chưa gọi)                                      | `id, username, name, email, access_level`    |
| **MỚI** MR notes      | (chưa gọi)                                      | `id, body, author, created_at, system`       |

---

## 2. Phase 1 — Quick Wins: MR Enrichment

**Trạng thái Phase 1:** IN_PROGRESS (code done, chờ run extraction + dbt verify)

### 2.1 Mục tiêu & Lý do

| Task  | Mô tả                                                         | Lý do                                                    |
|-------|---------------------------------------------------------------|----------------------------------------------------------|
| 1A    | Thêm `reviewers[]`, `approved_by[]`, `merge_user` vào MR     | Lỗ hổng lớn nhất: MR có thể score 100 mà chưa ai review |
| 1B    | Tạo extraction source `group_members` từ GitLab Members API   | Fix identity mismatch: git author_name ≠ GitLab username |
| 1C    | Đưa `label_names` (đã extract) vào dbt staging model          | Data đã có nhưng bị bỏ qua — giá trị phân loại MR       |
| 1D    | DB migration cho các trường mới                                | Prerequisite cho extraction                              |

### 2.2 Files cần tạo / sửa

**Files mới:**

| File                                                    | Mục đích                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `src/extraction/sources/group_members.py`               | dlt resource: `GET /groups/:gid/members` → `gitlab_raw.group_members` |
| `src/transform/models/staging/stg_group_members.sql`    | Staging view: clean raw members, coalesce nulls              |
| `src/infra/db/migrations/007_mr_review_fields.sql`      | ALTER TABLE merge_requests ADD COLUMN IF NOT EXISTS (5 cols) |

**Files sửa:**

| File                                                    | Thay đổi                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `src/extraction/sources/merge_requests.py`              | Thêm reviewers, approved_by, merge_user, draft vào `_build_mr_record()` |
| `src/extraction/client.py`                              | Thêm method `get_mr_approvals(project_id, mr_iid)`           |
| `src/extraction/pipeline.py`                            | Wire `group_members` vào `_ALL_SOURCES`, argparse             |
| `src/validation/schema_validator.py`                    | Thêm `GroupMember` Pydantic model; update `MergeRequestList`  |
| `src/transform/models/staging/stg_merge_requests.sql`   | Thêm 5 columns: reviewer_usernames, approved_by_usernames, merge_username, is_draft, label_names |
| `src/transform/models/staging/sources.yml`              | Thêm `group_members` source table definition                  |
| `.claude/memory/schema_snapshot.yaml`                   | Thêm `merge_request_approvals` + `group_members` schemas      |

### 2.3 Chi tiết Implementation

#### Task 1D: DB Migration (chạy ĐẦU TIÊN)

**File:** `src/infra/db/migrations/007_mr_review_fields.sql`

```sql
-- Migration 007: Add review/approval fields + ensure label_names column
-- Idempotent: safe to re-run
-- Pattern: xem migration 005 (cùng kiểu ALTER TABLE IF NOT EXISTS)

ALTER TABLE gitlab_raw.merge_requests
    ADD COLUMN IF NOT EXISTS reviewer_usernames text[],
    ADD COLUMN IF NOT EXISTS approved_by_usernames text[],
    ADD COLUMN IF NOT EXISTS merge_username text,
    ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS label_names text[];

-- Staging mirror nếu tồn tại (xem pattern migration 005)
ALTER TABLE IF EXISTS gitlab_raw_staging.merge_requests
    ADD COLUMN IF NOT EXISTS reviewer_usernames text[],
    ADD COLUMN IF NOT EXISTS approved_by_usernames text[],
    ADD COLUMN IF NOT EXISTS merge_username text,
    ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS label_names text[];

-- group_members table sẽ được dlt tự tạo khi extraction chạy lần đầu.
-- Chỉ cần đảm bảo schema tồn tại:
CREATE SCHEMA IF NOT EXISTS gitlab_raw;
```

#### Task 1A: Extract reviewers, approved_by, merge_user

**Bước 1 — `client.py`: thêm method `get_mr_approvals()`**

```python
def get_mr_approvals(self, project_id: int, mr_iid: int) -> dict:
    """GET /projects/:id/merge_requests/:iid/approvals — approval state."""
    try:
        return self.get(f"/projects/{project_id}/merge_requests/{mr_iid}/approvals")
    except Exception as e:
        logger.warning(f"Failed approvals for MR !{mr_iid}: {e}")
        return {}
```

**Bước 2 — `merge_requests.py`: cập nhật `_build_mr_record()`**

Hàm hiện tại: `_build_mr_record(mr, detail, project_name)` (line 131)
Đổi signature: `_build_mr_record(mr, detail, project_name, approvals=None)`

Thêm vào dict trả về (sau line 193):

```python
# reviewers — có sẵn trong MR list response, chỉ cần .get()
"reviewer_usernames": [r.get("username", "") for r in mr.get("reviewers", [])],

# approved_by — từ /approvals endpoint (truyền vào từ enrichment loop)
"approved_by_usernames": [
    a.get("user", {}).get("username", "")
    for a in (approvals or {}).get("approved_by", [])
],

# merge_user — có sẵn trong /changes response (detail dict)
"merge_username": (
    (detail.get("merge_user") or detail.get("merged_by") or {}).get("username")
),

# draft — có sẵn trong MR list response
"is_draft": mr.get("draft", False),
```

**Bước 3 — enrichment loop (line 96–109): thêm gọi approvals**

```python
for mr in validated_page:
    try:
        detail = client.get_mr_with_changes(mr["project_id"], mr["iid"])
        approvals = client.get_mr_approvals(mr["project_id"], mr["iid"])  # MỚI
        project_name = client.get_project_name(mr["project_id"])
        record = _build_mr_record(mr, detail, project_name, approvals)    # thêm param
        # ... (giữ nguyên phần còn lại)
```

> **Rate limit:** thêm 1 API call/MR. Với 100 MRs/sync window ≈ +10s. `get_mr_approvals()` đã có try/except nên fail không block.

#### Task 1B: Tạo extraction source `group_members`

**File mới:** `src/extraction/sources/group_members.py`

```python
"""Group members extractor — identity mapping for author resolution."""
import logging
from typing import Iterator
import dlt
from src.extraction.client import GitLabClient

logger = logging.getLogger(__name__)


@dlt.resource(write_disposition="merge", primary_key="id")
def group_members(client: GitLabClient, group_id: str) -> Iterator[dict]:
    """
    GET /groups/:gid/members — all group members for identity mapping.
    Dùng để resolve git author_name/email → GitLab username.
    """
    for page in client.paginate(
        f"/groups/{group_id}/members",
        params={"include_inherited": "true"},
    ):
        for m in page:
            yield {
                "id": m["id"],
                "username": m["username"],
                "name": m.get("name", ""),
                "email": m.get("email"),          # có thể null nếu private
                "state": m["state"],               # active, blocked, etc.
                "access_level": m["access_level"], # 10=Guest, 30=Developer, 40=Maintainer, 50=Owner
                "avatar_url": m.get("avatar_url"),
            }
    logger.info(f"group_members extraction complete")
```

**Wire vào `pipeline.py`:**

```python
# Thêm import:
from src.extraction.sources.group_members import group_members

# Sửa _ALL_SOURCES:
_ALL_SOURCES = {"mr", "commits", "pipelines", "mr_commits", "members"}

# Thêm vào argparse choices:
choices=["all", "mr", "commits", "pipelines", "mr_commits", "members"]

# Trong hàm run(), thêm block:
if "members" in sources_to_run:
    resources.append(group_members(client, group_id))
    logger.info("Source: group_members")
```

#### Task 1C: Surface `label_names` trong dbt

Thêm vào `stg_merge_requests.sql` (sau line 74 — trước `created_week`):

```sql
-- Labels — đã extract bởi merge_requests.py nhưng cần migration 007 để đảm bảo column tồn tại
coalesce(mr.label_names, '{}')::text[]                                as label_names,
```

> **Lưu ý:** Column `label_names` đã được extract bởi `merge_requests.py:189` nhưng trước đó bị drop khỏi staging vì dlt chưa tạo column trong early migrations. Migration 007 đảm bảo column tồn tại.

### 2.4 Verification Plan

```
- [ ] Chạy migration 007:
      docker exec -i gitlab_analytics_db psql -U analytics -d gitlab_analytics
        < src/infra/db/migrations/007_mr_review_fields.sql

- [ ] Verify columns mới:
      docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics
        -c "\d gitlab_raw.merge_requests"
      → Phải thấy: reviewer_usernames, approved_by_usernames, merge_username, is_draft, label_names

- [ ] Chạy extraction MR:
      python -m src.extraction.pipeline --source mr --since-days 7
      → Log không có error mới

- [ ] Verify MR data mới:
      SELECT iid, reviewer_usernames, approved_by_usernames, merge_username, is_draft
      FROM gitlab_raw.merge_requests
      WHERE updated_at > now() - interval '7 days'
      LIMIT 10;
      → reviewer_usernames có dữ liệu (có thể empty array {} cho MR chưa assign reviewer)

- [ ] Chạy extraction members:
      python -m src.extraction.pipeline --source members

- [ ] Verify members data:
      SELECT count(*) FROM gitlab_raw.group_members;
      → > 0 rows
      SELECT username, name, email FROM gitlab_raw.group_members LIMIT 5;

- [ ] Chạy dbt:
      cd src\transform
      set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
      → 0 errors

- [ ] Verify staging có columns mới:
      SELECT iid, reviewer_usernames, label_names
      FROM gitlab_kpi_staging.stg_merge_requests
      LIMIT 5;

- [ ] Verify stg_group_members:
      SELECT username, name, email FROM gitlab_kpi_staging.stg_group_members LIMIT 5;

- [ ] Verify v_weekly_kpi không bị broken (regression check):
      SELECT count(*) FROM gitlab_kpi.v_weekly_kpi;
      → Số lượng tương tự trước khi thay đổi
```

### 2.5 Post-Phase 1 Snapshot Template

Sau khi Phase 1 hoàn thành, lưu vào `.claude/memory/dip_phase1_done.md`:

```markdown
---
name: DIP Phase 1 Complete
description: Quick Wins done — reviewers/approved_by/merge_user/group_members/labels extraction + staging
type: project
---

# DIP Phase 1 — Hoàn thành <YYYY-MM-DD>

## Files đã tạo
- src/extraction/sources/group_members.py
- src/transform/models/staging/stg_group_members.sql
- src/infra/db/migrations/007_mr_review_fields.sql

## Files đã sửa
- src/extraction/sources/merge_requests.py — thêm reviewers, approved_by, merge_user, draft
- src/extraction/client.py — thêm get_mr_approvals()
- src/extraction/pipeline.py — wire group_members source
- src/validation/schema_validator.py — thêm GroupMember model
- src/transform/models/staging/stg_merge_requests.sql — thêm 5 columns
- src/transform/models/staging/sources.yml — thêm group_members

## Verification results
- group_members: N rows
- reviewer_usernames populated: N/M MRs
- dbt run: XX/XX OK

## Prerequisites cho Phase 2
- reviewer_usernames column populated → có thể detect NO_REVIEWER
- approved_by_usernames column populated → có thể detect NOT_APPROVED
- group_members table populated → có thể fix v_weekly_kpi identity join
```

---

## 3. Phase 2 — Review Quality KPI

**Trạng thái Phase 2:** PENDING
**Phụ thuộc:** Phase 1 phải DONE (cần reviewer_usernames, approved_by_usernames, group_members)

### 3.1 Mục tiêu & Lý do

| Task  | Mô tả                                                              | Lý do                                                   |
|-------|--------------------------------------------------------------------|---------------------------------------------------------|
| 2A    | Thêm 2 violations mới: `NO_REVIEWER`, `NOT_APPROVED`              | Advisory — phát hiện MR merge không review/approve       |
| 2B    | Extract MR Notes → xây dựng `time_to_first_review` metric         | Breakdown cycle time → phát hiện review bottleneck       |
| 2C    | Fix identity mapping trong `v_weekly_kpi` (author_name mismatch)   | Join sai khi git name ≠ GitLab display name              |

### 3.2 Files cần tạo / sửa

**Files mới:**

| File                                                    | Mục đích                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `src/extraction/sources/mr_notes.py`                    | dlt resource: `GET /projects/:pid/merge_requests/:iid/notes` → `gitlab_raw.mr_notes` |
| `src/transform/models/staging/stg_mr_notes.sql`         | Staging: clean notes, compute `is_human_review`, `is_approval_event` |
| `src/transform/models/marts/v_review_quality.sql`       | Mart: time_to_first_review, review_count, discussion_resolved_rate |

**Files sửa:**

| File                                                    | Thay đổi                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `docs/mr-compliance/compliance_spec.yaml`               | Thêm 2 violations: NO_REVIEWER, NOT_APPROVED                 |
| `src/extraction/client.py`                              | Thêm `get_mr_notes(project_id, mr_iid)`                      |
| `src/extraction/pipeline.py`                            | Wire `mr_notes` vào secondary-pass (pattern như mr_commits)   |
| `src/validation/schema_validator.py`                    | Thêm `MRNote` Pydantic model                                 |
| `src/transform/models/staging/sources.yml`              | Thêm `mr_notes` source table definition                       |
| `src/transform/models/marts/v_mr_compliance.sql`        | Auto-updated bởi `compliance_updater apply`                   |
| `src/transform/models/marts/v_compliance_violation_detail.sql` | Auto-updated bởi `compliance_updater apply`            |
| `src/transform/models/marts/v_weekly_kpi.sql`           | Fix join: dùng group_members mapping thay vì author_name      |

### 3.3 Chi tiết Implementation

#### Task 2A: Thêm violations NO_REVIEWER, NOT_APPROVED

**Bước 1 — Sửa `compliance_spec.yaml`:**

Thêm vào cuối section `violations:`:

```yaml
  - code: NO_REVIEWER
    label_vi: "MR chưa được assign reviewer"
    category: "Review Process"
    severity: REQUIRED
    score_weight: 0          # advisory only — chưa tính điểm, đợi promote ở version kế tiếp (pattern đã validate trong Phase A v1.6)
    detection_sql: >-
      mr.reviewer_usernames is null
      or array_length(mr.reviewer_usernames, 1) is null

  - code: NOT_APPROVED
    label_vi: "MR merged mà chưa được approve"
    category: "Review Process"
    severity: REQUIRED
    score_weight: 0          # advisory only
    detection_sql: >-
      mr.state = 'merged'
      and (mr.approved_by_usernames is null
           or array_length(mr.approved_by_usernames, 1) is null)
```

> **QUAN TRỌNG:**
> - `score_weight = 0` (advisory). Tổng điểm vẫn là 100. Để thêm scoring cần bump standard lên version kế tiếp + reallocate weights (pattern: Phase A v1.6 đã ship R-MR-005/006 ở advisory, chờ adoption đủ để promote).
> - `detection_sql` dùng `mr.*` alias — fields này phải tồn tại trong CTE `mr` của `v_mr_compliance.sql`.
>   Vì CTE `mr` select từ `stg_merge_requests`, và Phase 1 đã thêm `reviewer_usernames` + `approved_by_usernames`
>   vào staging → field tự động có mặt.
> - `compliance_updater` cần hỗ trợ `score_weight: 0` (violation chỉ tracking, không ảnh hưởng score).
>   Kiểm tra trước khi apply: `python -m src.compliance_updater check`

**Bước 2 — Cập nhật `v_compliance_violation_detail.sql`:**

Thêm `"Review Process"` vào accepted_values trong `sources.yml`:
```yaml
- accepted_values:
    values: ['Naming Convention', 'Documentation', 'AI Compliance', 'Quality Gate', 'MR Size', 'Review Process', 'Other']
```

**Bước 3 — Chạy compliance_updater:**

```cmd
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics
python -m src.compliance_updater check
python -m src.compliance_updater apply --dry-run
python -m src.compliance_updater apply
```

**Bước 4 — Chạy dbt:**

```cmd
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics\src\transform
set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
```

#### Task 2B: Extract MR Notes → v_review_quality

**Pattern:** Giống `mr_commits` — secondary-pass source đọc MR IDs từ DB rồi gọi per-MR endpoint.

**Bước 1 — `client.py`: thêm method**

```python
def get_mr_notes(self, project_id: int, mr_iid: int) -> list:
    """GET /projects/:id/merge_requests/:iid/notes — comments và system events."""
    result = self.get(
        f"/projects/{project_id}/merge_requests/{mr_iid}/notes",
        params={"sort": "asc", "order_by": "created_at", "per_page": 100},
    )
    return result if isinstance(result, list) else []
```

**Bước 2 — File mới:** `src/extraction/sources/mr_notes.py`

```python
@dlt.resource(write_disposition="merge", primary_key=["mr_id", "note_id"])
def mr_notes(client: GitLabClient, mr_records: list[dict]) -> Iterator[dict]:
    """
    Extract notes (comments/reviews) per MR.
    Secondary-pass: reads MR list from DB, then calls Notes API per MR.
    """
    for i, mr in enumerate(mr_records):
        try:
            raw_notes = client.get_mr_notes(mr["project_id"], mr["iid"])
            for note in raw_notes:
                yield {
                    "note_id": note["id"],
                    "mr_id": mr["id"],
                    "mr_iid": mr["iid"],
                    "project_id": mr["project_id"],
                    "author_username": note["author"]["username"],
                    "body": (note.get("body") or "")[:500],   # truncate
                    "created_at": note["created_at"],
                    "system": note.get("system", False),
                    "resolvable": note.get("resolvable", False),
                    "resolved": note.get("resolved", False),
                    "extracted_at": datetime.now(timezone.utc).isoformat(),
                }
            time.sleep(0.1)  # rate limiting
        except Exception as e:
            logger.warning(f"Failed notes for MR !{mr['iid']}: {e}")
        if (i + 1) % 50 == 0:
            logger.info(f"{i+1}/{len(mr_records)} MRs processed (notes)")
```

**Bước 3 — Wire vào `pipeline.py`:** Giống block `mr_commits` (line 99–120), thêm block `mr_notes` ngay sau.

**Bước 4 — Mart model:** `v_review_quality.sql`

```sql
-- Key metrics per MR:
-- time_to_first_review_hours = (first human note created_at - mr.created_at) / 3600
-- review_count               = count human notes (not system, resolvable hoặc general comment)
-- discussion_resolved_rate   = resolved / total resolvable
-- approval_timestamp         = earliest system note containing 'approved this merge request'
```

#### Task 2C: Fix v_weekly_kpi identity mapping

**Vấn đề hiện tại (v_weekly_kpi.sql line 68–69):**

```sql
left join mr_agg m
       on m.author_name = c.author_name   -- BUG: git name ≠ GitLab display name
      and m.week        = c.week
```

**Giải pháp: dùng `stg_group_members` làm mapping table:**

```sql
-- CTE mapping: git author_email → canonical username
author_map as (
    select distinct
        gm.username,
        gm.name         as display_name,
        gm.email        as gitlab_email
    from {{ ref('stg_group_members') }} gm
    where gm.email is not null
),

commit_agg as (
    select
        c.committed_week as week,
        coalesce(am.username, c.author_name) as author_key,  -- prefer mapped username
        c.author_email,
        -- ... (giữ nguyên aggregations)
    from {{ ref('stg_commits') }} c
    left join author_map am
           on lower(am.gitlab_email) = lower(c.author_email)  -- case-insensitive email match
    group by 1, 2, 3
),

mr_agg as (
    select
        created_week as week,
        author_username as author_key,              -- MR đã có username chính xác
        -- ... (giữ nguyên aggregations)
    from {{ ref('v_mr_compliance') }}
    group by 1, 2
)

-- Join bằng author_key (username) thay vì author_name
select ...
from commit_agg c
left join mr_agg m on m.author_key = c.author_key and m.week = c.week
```

> **Lưu ý:** `stg_group_members.email` có thể null nếu user đặt email là private trên GitLab.
> Fallback: `coalesce(am.username, c.author_name)` giữ author_name gốc khi mapping không tìm thấy.

### 3.4 Verification Plan

```
- [ ] compliance_updater check — không lỗi validation
- [ ] compliance_updater apply --dry-run — hiển thị 2 violations mới, 0 score changes
- [ ] compliance_updater apply — update v_mr_compliance.sql và v_compliance_violation_detail.sql
      → Kiểm tra trailing comma sau apply (xem .claude/memory feedback_linter_sql.md)
- [ ] dbt run — 0 errors

- [ ] Verify NO_REVIEWER:
      SELECT count(*) FROM gitlab_kpi.v_compliance_violation_detail
      WHERE violation_type = 'NO_REVIEWER';

- [ ] Verify NOT_APPROVED:
      SELECT count(*) FROM gitlab_kpi.v_compliance_violation_detail
      WHERE violation_type = 'NOT_APPROVED';

- [ ] Chạy mr_notes extraction:
      python -m src.extraction.pipeline --source mr_notes --since-days 30

- [ ] Verify mr_notes:
      SELECT count(*) FROM gitlab_raw.mr_notes;
      → > 0

- [ ] Verify v_review_quality:
      SELECT iid, time_to_first_review_hours, review_count
      FROM gitlab_kpi.v_review_quality
      WHERE time_to_first_review_hours IS NOT NULL
      LIMIT 10;

- [ ] Verify v_weekly_kpi identity fix:
      -- Trước fix: nhiều MR bị mất do join miss
      SELECT sum(mr_count) FROM gitlab_kpi.v_weekly_kpi;
      → Số lượng tăng đáng kể sau fix (mr_count trước đó bị 0 do author_name mismatch)

- [ ] Cross-check: so sánh tổng mr_count với count(*) FROM gitlab_kpi.v_mr_compliance
```

### 3.5 Post-Phase 2 Snapshot Template

Lưu vào `.claude/memory/dip_phase2_done.md` với format tương tự Phase 1.

---

## 4. Phase 3 — Advanced Metrics (Tuỳ chọn)

**Trạng thái Phase 3:** PENDING
**Phụ thuộc:** Phase 1 DONE (pipeline_jobs độc lập); Phase 2 DONE (reviewer workload cần v_review_quality)

### 4.1 Mục tiêu & Lý do

| Task  | Mô tả                                                              | Lý do                                                    |
|-------|--------------------------------------------------------------------|---------------------------------------------------------|
| 3A    | Extract Pipeline Jobs + Test Reports                               | Biết stage nào fail, số test pass/fail (không chỉ coverage %) |
| 3B    | Tính DORA 4 metrics                                               | Engineering management KPI standard                       |
| 3C    | Reviewer Workload dashboard                                        | Phát hiện reviewer bottleneck                            |

### 4.2 Files cần tạo / sửa

**Files mới:**

| File                                                    | Mục đích                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `src/extraction/sources/pipeline_jobs.py`               | dlt resource: `GET /projects/:pid/pipelines/:pipeline_id/jobs` |
| `src/extraction/sources/test_reports.py`                | dlt resource: `GET /projects/:pid/pipelines/:pipeline_id/test_report` |
| `src/transform/models/staging/stg_pipeline_jobs.sql`    | Staging: job-level data, duration, stage name                |
| `src/transform/models/staging/stg_test_reports.sql`     | Staging: test suite results                                  |
| `src/transform/models/marts/v_dora_metrics.sql`         | DORA 4: deploy freq, lead time, MTTR, change failure rate    |
| `src/transform/models/marts/v_reviewer_workload.sql`    | Per-reviewer: review count, avg time, open reviews           |

**Files sửa:**

| File                                                    | Thay đổi                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| `src/extraction/client.py`                              | Thêm `get_pipeline_jobs()`, `get_test_report()`              |
| `src/extraction/pipeline.py`                            | Wire 2 sources mới                                           |
| `src/validation/schema_validator.py`                    | Thêm `PipelineJob`, `TestSuiteReport` models                 |
| `src/transform/models/staging/sources.yml`              | Thêm `pipeline_jobs`, `test_reports` tables                   |
| `src/metabase/setup_dashboards.py`                      | Thêm Collection F (DORA) cards (tuỳ chọn)                    |

### 4.3 Chi tiết Implementation

#### Task 3A: Pipeline Jobs + Test Reports

**Pattern:** Secondary-pass — đọc pipeline IDs từ `gitlab_raw.pipelines`, gọi per-pipeline endpoints.

**pipeline_jobs.py:**
- Endpoint: `GET /projects/:pid/pipelines/:pipeline_id/jobs`
- Fields: `job_id, pipeline_id, project_id, stage, name, status, duration, created_at, finished_at`
- Primary key: `job_id`
- Chỉ lấy pipeline gần đây (vd: 30 ngày)

**test_reports.py:**
- Endpoint: `GET /projects/:pid/pipelines/:pipeline_id/test_report`
- Fields: `pipeline_id, project_id, total_time, total_count, success_count, failed_count, skipped_count, error_count`
- Primary key: `pipeline_id`
- **Lưu ý:** endpoint trả 404 nếu pipeline không có test report → handle gracefully (try/except → skip)

#### Task 3B: DORA 4 Metrics

**v_dora_metrics.sql:**

| Metric | Cách tính | Nguồn |
|--------|-----------|-------|
| Deployment frequency | Count successful pipelines on default branch / tuần | `stg_pipelines` WHERE ref IN ('main','master') AND is_success |
| Lead time for changes | `merged_at - min(mr_commits.authored_date)` trung bình | `v_mr_compliance` + `stg_mr_commits` |
| Time to restore | `next_success.created_at - failure.created_at` trung bình per branch | `stg_pipelines` window function |
| Change failure rate | Failed pipelines / Total pipelines on default branch / tuần | `stg_pipelines` |

> **Lưu ý:** `lead_time_for_changes` có thể tính từ data hiện có mà không cần Phase 3A.

#### Task 3C: Reviewer Workload Dashboard

**v_reviewer_workload.sql:**

```sql
-- Unnest reviewer_usernames (Phase 1) → 1 row per (MR, reviewer)
-- Join v_review_quality (Phase 2) cho time metrics
-- Aggregate per reviewer per week:
--   reviews_assigned, reviews_completed, avg_review_time_hours, open_review_count
```

### 4.4 Verification Plan

```
- [ ] Chạy pipeline_jobs extraction (30 ngày)
- [ ] Verify: SELECT count(*) FROM gitlab_raw.pipeline_jobs
- [ ] Chạy test_reports extraction (30 ngày)
- [ ] Verify: SELECT count(*) FROM gitlab_raw.test_reports
- [ ] dbt run — 0 errors (bao gồm v_dora_metrics, v_reviewer_workload)
- [ ] Verify DORA:
      SELECT week, deployment_frequency, lead_time_hours, change_failure_rate
      FROM gitlab_kpi.v_dora_metrics
      ORDER BY week DESC LIMIT 4;
- [ ] Verify reviewer workload:
      SELECT reviewer_username, week, reviews_assigned, avg_review_time_hours
      FROM gitlab_kpi.v_reviewer_workload
      ORDER BY week DESC, reviews_assigned DESC LIMIT 10;
```

### 4.5 Post-Phase 3 Snapshot Template

Lưu vào `.claude/memory/dip_phase3_done.md`.

---

## 5. Dependencies & Thứ tự Build

```
Phase 1 (Quick Wins) ──────────────────────────────────────────────────
  │
  ├── 1D: Migration 007 (CHẠY ĐẦU TIÊN)
  │     │
  │     ├── 1A: merge_requests.py enrichment (reviewers, approved_by, merge_user)
  │     │     └── Cần: client.get_mr_approvals() method
  │     │
  │     └── 1C: Surface label_names trong stg_merge_requests
  │
  ├── 1B: group_members extraction source (độc lập với 1A)
  │     └── Cần: GroupMember Pydantic model
  │
  └── [dbt run] → rebuild staging models
  │
  ▼
Phase 2 (Review Quality) ── Phụ thuộc Phase 1 ─────────────────────────
  │
  ├── 2A: NO_REVIEWER + NOT_APPROVED violations
  │     ├── Phụ thuộc: 1A (reviewer_usernames column populated)
  │     └── Dùng: compliance_updater apply
  │
  ├── 2B: mr_notes extraction + v_review_quality (độc lập với 2A)
  │     └── Phụ thuộc: client.py pattern từ Phase 1
  │
  ├── 2C: v_weekly_kpi identity fix
  │     └── Phụ thuộc: 1B (group_members table populated)
  │
  └── [dbt run] → rebuild all models
  │
  ▼
Phase 3 (Advanced) ── Phụ thuộc Phase 1+2 ─────────────────────────────
  │
  ├── 3A: pipeline_jobs + test_reports (có thể bắt đầu nếu Phase 1 done)
  │     └── Độc lập
  │
  ├── 3B: DORA 4 metrics
  │     └── Phụ thuộc: 3A (pipeline_jobs data)
  │
  └── 3C: Reviewer workload
        └── Phụ thuộc: 2B (v_review_quality) + 1A (reviewer_usernames)
```

---

## 6. Ước lượng Độ phức tạp

| Hạng mục                         | Độ phức tạp  | Ghi chú                                                |
|----------------------------------|-------------|--------------------------------------------------------|
| Migration 007                    | Thấp         | ALTER TABLE IF NOT EXISTS (pattern migration 005)       |
| `group_members.py`               | Thấp         | Single paginated endpoint, simple schema                |
| `merge_requests.py` enrichment   | Trung bình   | Thêm 1 API call/MR trong hot loop — cần rate limit     |
| `stg_merge_requests.sql` update  | Thấp         | Thêm 5 columns với coalesce                             |
| `stg_group_members.sql`          | Thấp         | Simple staging view                                     |
| `compliance_spec.yaml` + updater | Thấp         | 2 entries mới, chạy apply                               |
| `mr_notes.py` extraction         | Trung bình+  | Secondary-pass, nhiều notes/MR, rate limiting critical  |
| `stg_mr_notes.sql`               | Thấp         | Cast + computed flags                                   |
| `v_review_quality.sql`           | Trung bình   | Window functions cho first-review detection              |
| `v_weekly_kpi.sql` identity fix  | Trung bình   | Careful join redesign, không được break metrics cũ       |
| `pipeline_jobs.py`               | Trung bình   | Secondary-pass, per-pipeline API call                   |
| `test_reports.py`                | Trung bình   | Handle 404 gracefully                                   |
| `v_dora_metrics.sql`             | Cao          | Complex window functions, nhiều time-series              |
| `v_reviewer_workload.sql`        | Trung bình   | Aggregation từ review_quality + reviewer_usernames      |

---

## 7. Ràng buộc Kỹ thuật & Edge Cases

### 7a. `reviewers[]` có sẵn trên list endpoint

`reviewers` nằm trong MR list response — chỉ cần `mr.get("reviewers", [])`. **Không cần API call thêm.**

### 7b. `approved_by[]` cần API call riêng

Không có trên list hay changes endpoint. Phải gọi:
`GET /projects/:pid/merge_requests/:iid/approvals`
Thêm ~0.1s/MR. Với 100 MRs/sync window ≈ +10s tổng. Chấp nhận được.
Method `get_mr_approvals()` có try/except → fail silent, trả `{}`.

### 7c. `merge_user` đã có trong changes response

`detail.get("merge_user")` hoặc `detail.get("merged_by")` — **không cần API call thêm**.
Field chỉ có giá trị khi MR đã merge (`state='merged'`).

### 7d. Author identity mismatch — chi tiết

- Git `author_name` (vd: "trungtt22") ≠ GitLab `author.name` (vd: "Trung Tran Thien")
- Git `author_email` thường match với GitLab email → dùng làm join key
- `stg_group_members` cung cấp mapping chính thức
- **Không dùng fuzzy match** — dùng exact match trên `lower(email)`
- Khi email là private (null), fallback giữ `author_name` gốc

### 7e. `label_names` column history

Column đã extract (`merge_requests.py:189`) nhưng bị drop khỏi `stg_merge_requests.sql` do dlt chưa tạo column trong early migrations. Migration 007 đảm bảo column tồn tại. Sau migration, staging model tham chiếu an toàn.

### 7f. compliance_updater markers

Violations được auto-generate giữa markers `@compliance_updater:start/end:violations` trong `v_mr_compliance.sql`.
**KHÔNG sửa tay** — chỉ sửa `compliance_spec.yaml` rồi chạy `apply`.

Sau khi apply, **luôn kiểm tra trailing commas** (xem bug đã biết trong `.claude/memory/feedback_linter_sql.md`):
- `end as violation_label,`    ← phải có comma
- `end as violation_category,` ← phải có comma
- `end as score_weight,`       ← phải có comma
- `end as violation_severity`  ← KHÔNG có comma (cột cuối)

### 7g. MR Notes rate limiting

Notes endpoint có thể trả 100+ notes/MR với MR active. Cho 100+ MRs = 10,000+ API calls.
- Dùng `time.sleep(0.1)` giữa các MRs
- Giới hạn `--since-days 30` cho notes extraction
- Chỉ lấy notes từ MRs có `state in ('opened', 'merged')`, bỏ qua `closed`

### 7h. NO_REVIEWER và NOT_APPROVED bắt đầu 0 pts

Advisory only — tracking visibility. Để thêm scoring (pattern Phase A v1.6 đã validate):
1. Tăng standard lên version kế tiếp (e.g. ENG-STD-MR-002 v1.7 sau v1.6)
2. Phân bổ lại điểm (tổng vẫn = 100)
3. Cập nhật compliance_spec.yaml với score_weight > 0
4. Chạy compliance_updater apply

### 7i. Test report 404

`GET /projects/:pid/pipelines/:pipeline_id/test_report` trả 404 nếu pipeline không có test artifacts.
Handle: `try/except` → skip, log warning. Không block extraction.

### 7j. dbt schema naming convention

- **Staging models:** schema = `gitlab_kpi_staging` (dbt_project.yml: `+schema: staging`, profile target prepends `gitlab_kpi`)
- **Mart models:** schema = `gitlab_kpi` (dbt_project.yml: không có `+schema`, dùng profile default)
- Verification queries phải dùng đúng schema:
  - `gitlab_kpi_staging.stg_*` cho staging views
  - `gitlab_kpi.v_*` cho mart views

---

## 8. Checklist trước khi bắt đầu

```
- [ ] Confirm GitLab API token có scope `read_api` (đủ cho /members và /notes)
- [ ] Confirm PostgreSQL có đủ disk cho mr_notes (~50 rows/MR × 500 MRs = 25K rows)
- [ ] Verify pipeline hiện tại chạy được:
      python -m src.extraction.pipeline --since-days 1
- [ ] Verify dbt hiện tại chạy được:
      cd src\transform
      set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
- [ ] Đọc .claude/memory/pipeline_state.yaml — kiểm tra consecutive_failures
      (hiện tại = 2, lỗi: InvalidNativeValue — DATABASE_URL format sai)
- [ ] FIX: Giải quyết pipeline failure hiện tại trước khi bắt đầu DIP
      → Set DATABASE_URL đúng format: postgresql://user:pass@host:5432/dbname
      → Reset consecutive_failures về 0
- [ ] Back up DB trước khi bắt đầu:
      docker exec gitlab_analytics_db pg_dump -U analytics gitlab_analytics > backup_pre_dip.sql
```

---

## 9. Lệnh tham khảo (Windows cmd)

```cmd
rem === EXTRACTION =========================================================
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics

rem MR (với reviewer/approval data mới)
python -m src.extraction.pipeline --source mr --since-days 7

rem Group Members
python -m src.extraction.pipeline --source members

rem MR Notes (Phase 2)
python -m src.extraction.pipeline --source mr_notes --since-days 30

rem Pipeline Jobs (Phase 3)
python -m src.extraction.pipeline --source pipeline_jobs --since-days 30

rem Full extraction
python -m src.extraction.pipeline --since-days 7

rem === DBT ================================================================
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics\src\transform
set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt run --profiles-dir . --target dev
set DB_USER=analytics&& set DB_PASSWORD=123456&& set DB_HOST=localhost&& set DB_PORT=5432&& set DB_NAME=gitlab_analytics&& dbt test --profiles-dir . --target dev

rem === COMPLIANCE UPDATER =================================================
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics
python -m src.compliance_updater check
python -m src.compliance_updater apply --dry-run
python -m src.compliance_updater apply

rem === MIGRATION ==========================================================
docker exec -i gitlab_analytics_db psql -U analytics -d gitlab_analytics < src/infra/db/migrations/007_mr_review_fields.sql

rem === METABASE ===========================================================
cd C:\Users\nangh\Documents\gitlab-analytics_v1\gitlab-analytics
set METABASE_URL=http://localhost:3000&& set METABASE_USER=sangtt@fpt.com&& set METABASE_PASSWORD=Trinhsang@9999&& python -m src.metabase.setup_dashboards

rem === VERIFICATION QUERIES (psql) ========================================
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "SELECT count(*) FROM gitlab_raw.group_members;"
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "SELECT iid, reviewer_usernames, approved_by_usernames FROM gitlab_raw.merge_requests WHERE updated_at > now() - interval '7 days' LIMIT 5;"
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "SELECT count(*) FROM gitlab_raw.mr_notes;"
docker exec gitlab_analytics_db psql -U analytics -d gitlab_analytics -c "SELECT * FROM gitlab_kpi.v_data_freshness;"
```

---

*Tài liệu này là living document — được cập nhật sau mỗi phase hoàn thành.*
*Tạo bởi Claude Code | ENG-ANA-001 | 2026-04-13*
