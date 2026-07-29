# Schema Reference — GitLab Analytics Database
> Cập nhật: 2026-06-09
> Database: `gitlab_analytics` | PostgreSQL 16

---

## Tổng quan kiến trúc dữ liệu

```
GitLab API v4
      │
      ▼  (dlt ETL pipeline — src/extraction/)
┌─────────────────────────────────────────┐
│  Schema: gitlab_raw                     │
│  Bảng thô từ API, không transform       │
│  merge_requests / commits / pipelines   │
│  pipeline_state / webhook_dlq           │
└────────────────────┬────────────────────┘
                     │ (dbt staging — src/transform/models/staging/)
                     ▼
┌─────────────────────────────────────────┐
│  Schema: gitlab_kpi_staging             │
│  Views làm sạch + chuẩn hóa kiểu dữ liệu│
│  stg_merge_requests / stg_commits       │
│  stg_pipelines                          │
└────────────────────┬────────────────────┘
                     │ (dbt marts — src/transform/models/marts/)
                     ▼
┌─────────────────────────────────────────┐
│  Schema: gitlab_kpi          │
│  Views KPI tính toán — Metabase đọc     │
│  v_mr_compliance / v_violations         │
│  v_weekly_kpi / v_ai_adoption           │
│  v_compliance_mgmt                      │
│  v_compliance_violation_detail          │
│  v_data_freshness                       │
└─────────────────────────────────────────┘
```

**Quy tắc đọc schema:**
- `gitlab_raw.*` — data gốc từ GitLab API, có thể có NULL, có `_dlt_*` internal columns
- `gitlab_raw_staging.*` — **dlt transient** — KHÔNG đọc, không ref(), không expose Metabase
- `gitlab_kpi_staging.*` — views đã coalesce NULL → 0/false, cast đúng kiểu
- `gitlab_kpi.*` — views tính KPI, dùng cho dashboard và alert

---

## ⚠️ Cross-schema invariant (BẮT BUỘC)

> Đây là điều kiện tiên quyết — vi phạm = MR reject ở review.

### Rule 1 — Không hardcode schema trong SQL
Mọi cross-schema reference PHẢI qua dbt macro `source()` / `ref()`. Không bao giờ viết `FROM gitlab_raw.x` / `JOIN gitlab_kpi.y` trực tiếp.

### Rule 2 — Layer flow một chiều
```
gitlab_raw  ──source()──►  stg_*  (gitlab_kpi_staging)
                              │
                              └──ref()──►  v_* (gitlab_kpi)
```
- Marts (`v_*`) CHỈ được `ref('stg_*')`, KHÔNG `source('gitlab_raw', ...)`
- Staging (`stg_*`) CHỈ được `source('gitlab_raw', ...)`, KHÔNG ref ngược lên marts
- KHÔNG mart nào được ref mart khác qua schema (chỉ qua `ref()` trong cùng project dbt)

### Rule 3 — `gitlab_raw_staging` immutable
KHÔNG model/query/script nào được consume schema này. dlt managed only.

### Rule 4 — Ops exception (allowed bypass staging)
4 views dưới đây được phép `source('gitlab_raw', ...)` trực tiếp vì cần đo raw freshness/volume gốc, không qua cast của staging:

| Mart | Lý do |
|---|---|
| `v_data_freshness` | Đo `MAX(updated_at)` raw, không qua coalesce |
| `v_ingestion_volume_daily` | Đếm row count raw mỗi ngày |
| `v_ops_pipeline_health` | `pipeline_state` không có stg view |
| `v_dlq_monitor` | `webhook_dlq` không có stg view |

**Thêm mart mới vào exception list = thay đổi invariant → cần discuss + cập nhật file này.**

### Self-check (chạy trước khi merge)

```bash
# Tìm vi phạm Rule 1 (hardcoded schema)
grep -rEn "FROM (gitlab_raw|gitlab_kpi)\." src/transform/models/

# Tìm vi phạm Rule 2 (mart ref source thay vì stg)
grep -rEn "source\('gitlab_raw'" src/transform/models/marts/ \
  | grep -vE "v_(data_freshness|ingestion_volume_daily|ops_pipeline_health|dlq_monitor)"

# Tìm vi phạm Rule 3 (consume raw_staging)
grep -rn "gitlab_raw_staging" src/
```

Cả 3 lệnh phải trả empty → invariant pass.

---

**Ai được đọc:**
- Role `analytics_ro` — read-only, dùng cho Metabase và alert script
- Không có quyền ghi bất cứ thứ gì vào DB

---

## Schema 1: `gitlab_raw` — Dữ liệu thô từ GitLab

### Bảng `gitlab_raw.merge_requests`

**Mục đích:** Lưu toàn bộ MR của group GitLab. Mỗi row = 1 MR.
Dữ liệu được upsert mỗi lần extraction chạy (write_disposition=merge, primary_key=id).

**Nguồn dữ liệu:**
- Phần lớn cột từ `GET /groups/:id/merge_requests` (list endpoint)
- `additions`, `deletions`, `changes_count` tính từ `GET /projects/:id/merge_requests/:iid/changes` + parse unified diff
- Các cột `has_*` được tính bằng Python trong extractor trước khi ghi

| Column | Kiểu | Nullable | Ý nghĩa |
|---|---|---|---|
| `id` | bigint | NO | GitLab MR ID — unique toàn hệ thống (primary key) |
| `iid` | bigint | YES | MR number trong project (e.g. `!42`) — chỉ unique trong project |
| `project_id` | bigint | YES | ID của GitLab project chứa MR này |
| `author_username` | varchar | YES | GitLab username của người tạo MR |
| `author_name` | varchar | YES | Tên hiển thị của người tạo MR |
| `title` | varchar | YES | Tiêu đề MR (tối đa 300 ký tự đã truncate) |
| `state` | varchar | YES | Trạng thái: `opened` / `merged` / `closed` / `locked` |
| `source_branch` | varchar | YES | Branch nguồn (branch của dev, e.g. `feat/REQ-123-payment`) |
| `target_branch` | varchar | YES | Branch đích (e.g. `main`, `develop`) |
| `created_at` | timestamptz | YES | Thời điểm tạo MR |
| `updated_at` | timestamptz | YES | Thời điểm cập nhật gần nhất — dùng làm cursor incremental sync |
| `merged_at` | timestamptz | YES | Thời điểm merge. **Có thể NULL kể cả khi state=merged** (race condition GitLab API) |
| `closed_at` | timestamptz | YES | Thời điểm close (nếu bị close, không merge) |
| `additions` | bigint | YES | Số dòng thêm vào — tính từ parse unified diff của `/changes` endpoint |
| `deletions` | bigint | YES | Số dòng xóa đi — tính từ parse unified diff của `/changes` endpoint |
| `mr_size` | bigint | YES | `additions + deletions` — tổng LOC thay đổi |
| `changes_count` | varchar | YES | Số file thay đổi (trả về dạng string từ API, e.g. `"16"`) |
| `has_description` | boolean | YES | `true` nếu description > 50 ký tự sau khi strip whitespace |
| `has_ticket_ref` | boolean | YES | `true` nếu description chứa ticket ref (Jira-style `ABC-123`, GitLab `Closes #`, v.v.) |
| `has_ai_disclosure` | boolean | YES | `true` nếu description chứa cụm `AI disclosure` (case-insensitive) |
| `has_ai_prefix` | boolean | YES | `true` nếu title bắt đầu bằng `[AI]` |
| `ci_passed` | boolean | YES | `true` nếu pipeline CI gần nhất của branch này thành công. Lấy từ `head_pipeline` (có thể null — xem stg_merge_requests để hiểu cách fallback) |
| `ci_status` | varchar | YES | Status text của CI pipeline: `success` / `failed` / `running` / `canceled` / null |
| `discussion_count` | bigint | YES | Số comments/threads trên MR (`user_notes_count` từ API) |
| `has_valid_branch_name` | boolean | YES | `true` nếu `source_branch` theo đúng format ENG-STD-MR-002: `type/PREFIX-123-description` hoặc `release/vX.Y.Z`. **NULL cho các MR cũ trước migration 005** |
| `has_conventional_title` | boolean | YES | `true` nếu title theo Conventional Commits: `[AI] type(scope): subject`. **NULL cho các MR cũ trước migration 005** |
| `has_screenshots` | boolean | YES | `true` nếu description chứa markdown image (`![…](…)`) hoặc `<img>` tag. Default `false`. Source: `R-MR-005` advisory check (migration 014). |
| `diverged_commits_count` | integer | YES | Số commits target_branch đang ahead của MR head. `0` = rebased, `> 0` = chưa rebase, **NULL = unknown** (extractor chưa pass `include_diverged_commits_count=true` hoặc GitLab omit). Source: `R-MR-006` advisory check (migration 014). |
| `_dlt_load_id` | varchar | NO | Internal dlt — ID của lần load data (không dùng trong analytics) |
| `_dlt_id` | varchar | NO | Internal dlt — row hash để detect duplicate (không dùng trong analytics) |

> **Lưu ý về `additions`/`deletions`:** GitLab API không pre-compute các trường này trên MR object. Pipeline dùng `/changes` endpoint và tự đếm `+`/`-` lines từ unified diff. Binary files và mode-only changes đóng góp 0 vào cả hai.

---

### Bảng `gitlab_raw.commits`

**Mục đích:** Lưu toàn bộ commit của group. Mỗi row = 1 commit.
Được extraction với `?with_stats=true` để có `additions`/`deletions`.

| Column | Kiểu | Nullable | Ý nghĩa |
|---|---|---|---|
| `id` | varchar | NO | SHA hash đầy đủ của commit (primary key, e.g. `a3f9bc...`) |
| `short_id` | varchar | YES | SHA rút gọn 8 ký tự (e.g. `a3f9bc12`) — dùng khi hiển thị |
| `project_id` | bigint | YES | ID của GitLab project chứa commit này |
| `project_name` | varchar | YES | Tên project (e.g. `sale-platform-api`). **Chỉ có ở bảng commits, không có ở MR** |
| `author_name` | varchar | YES | Tên tác giả commit (từ git config) |
| `author_email` | varchar | YES | Email tác giả commit |
| `message` | varchar | YES | Nội dung commit message đầy đủ |
| `committed_date` | timestamptz | YES | Thời điểm commit được push lên GitLab |
| `authored_date` | timestamptz | YES | Thời điểm commit được tạo locally (có thể khác `committed_date` khi rebase) |
| `additions` | bigint | YES | Số dòng thêm vào trong commit này |
| `deletions` | bigint | YES | Số dòng xóa đi trong commit này |
| `total_loc` | bigint | YES | `additions + deletions` — tổng LOC thay đổi của commit |
| `is_ai` | boolean | YES | `true` nếu commit message bắt đầu bằng `[AI]` — tác giả khai báo có AI-assist |
| `is_conventional` | boolean | YES | `true` nếu commit message theo Conventional Commits format: `type(scope): subject` |
| `msg_length` | bigint | YES | Độ dài commit message tính bằng ký tự |
| `msg_over_500` | boolean | YES | `true` nếu `msg_length > 500` — vi phạm GitLab Push Rules limit |
| `_dlt_load_id` | varchar | NO | Internal dlt |
| `_dlt_id` | varchar | NO | Internal dlt |

---

### Bảng `gitlab_raw.pipelines`

**Mục đích:** Lưu toàn bộ CI/CD pipeline run. Mỗi row = 1 pipeline run.
Dùng để biết CI status và test coverage per branch.

| Column | Kiểu | Nullable | Ý nghĩa |
|---|---|---|---|
| `id` | bigint | NO | GitLab pipeline ID (primary key) |
| `project_id` | bigint | YES | ID của project chạy pipeline này |
| `project_name` | varchar | YES | Tên project |
| `ref` | varchar | YES | Branch hoặc tag trigger pipeline (e.g. `feat/REQ-123-payment`, `main`) |
| `status` | varchar | YES | Kết quả: `success` / `failed` / `canceled` / `skipped` / `running` / `pending` |
| `source` | varchar | YES | Nguồn trigger: `push` / `merge_request_event` / `schedule` / `web` / `api` |
| `created_at` | timestamptz | YES | Thời điểm pipeline được tạo |
| `updated_at` | timestamptz | YES | Thời điểm cập nhật gần nhất |
| `finished_at` | timestamptz | YES | Thời điểm pipeline kết thúc. **NULL nếu đang chạy hoặc pending** |
| `duration` | integer | YES | Thời gian chạy tính bằng giây. NULL nếu chưa finish |
| `coverage` | double precision | YES | % test coverage từ CI job report. **Thường NULL** — chỉ có giá trị khi CI job xuất coverage report |
| `_dlt_load_id` | varchar | NO | Internal dlt |
| `_dlt_id` | varchar | NO | Internal dlt |

> **Lưu ý về `coverage`:** Không phải mọi project đều cấu hình CI để xuất coverage. Nếu không có cấu hình `coverage` trong `.gitlab-ci.yml`, cột này luôn NULL. Các KPI view xử lý trường hợp này bằng `CASE WHEN coverage IS NULL THEN 0` (không phạt MR không có data).

---

### Bảng `gitlab_raw.pipeline_state`

**Mục đích:** Key-value store lưu trạng thái của ETL pipeline.
Thay thế file YAML để checkpoint survive qua các CI run khác nhau.

| Column | Kiểu | Ý nghĩa |
|---|---|---|
| `key` | text PK | Tên của state variable |
| `value` | text | Giá trị (có thể là ISO timestamp, số, JSON string) |
| `updated_at` | timestamptz | Lần cuối cập nhật |

**Các keys quan trọng:**

| Key | Ý nghĩa | Ví dụ giá trị |
|---|---|---|
| `last_successful_run` | Timestamp lần extraction thành công gần nhất | `2026-03-30T07:23:52Z` |
| `last_mr_updated_at` | Cursor incremental sync cho MR — lần sau chỉ lấy MR mới hơn timestamp này | `2026-03-30T14:20:43+07:00` |
| `last_commit_date` | Cursor cho commits | `2026-02-25T21:59:11+07:00` |
| `last_pipeline_updated_at` | Cursor cho pipelines | `2026-03-26T23:32:18+07:00` |
| `run_count` | Tổng số lần extraction chạy thành công | `42` |
| `consecutive_failures` | Số lần thất bại liên tiếp. ≥ 3 → Healer agent escalate lên human | `0` |
| `alerted_mr_ids` | JSON array ID của MR đã được gửi alert — tránh gửi trùng | `[1234, 5678]` |
| `last_failure` | JSON object mô tả lỗi gần nhất: `{agent, error, timestamp}` | `{...}` |
| `schema_version` | Phiên bản schema của pipeline state | `v1.0` |

---

### Bảng `gitlab_raw.webhook_dlq`

**Mục đích:** Dead-letter queue — lưu webhook event bị lỗi sau khi hết retry.
Dùng để điều tra và replay thủ công khi cần.

| Column | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigserial PK | Auto-increment ID |
| `event_type` | text | Loại webhook event (e.g. `merge_request`, `push`, `pipeline`) |
| `payload` | jsonb | Toàn bộ payload JSON từ GitLab webhook |
| `error_message` | text | Thông báo lỗi khi xử lý event này |
| `failed_at` | timestamptz | Thời điểm event bị đưa vào DLQ |
| `retry_count` | smallint | Số lần đã thử lại trước khi từ bỏ |
| `replayed` | boolean | `false` = chưa replay, `true` = đã xử lý lại |
| `replayed_at` | timestamptz | Thời điểm replay (NULL nếu chưa replay) |

**Cách replay thủ công:**
```sql
-- Đánh dấu đã replay (sau khi xử lý bằng tay)
UPDATE gitlab_raw.webhook_dlq SET replayed = true, replayed_at = NOW()
WHERE id = <id>;
```

---

## Schema 2: `gitlab_kpi_staging` — Views staging (dbt)

> Views này không dùng trực tiếp cho dashboard. Chúng là lớp trung gian làm sạch data trước khi tính KPI.

### View `gitlab_kpi_staging.stg_merge_requests`

**Mục đích:** Làm sạch `gitlab_raw.merge_requests` — coalesce NULL, cast timestamp, giải quyết vấn đề `ci_passed` luôn NULL.

**Vấn đề đặc biệt cần biết:** GitLab list endpoint trả về `head_pipeline = null` cho hầu hết MR. View này giải quyết bằng cách JOIN với bảng `pipelines` để lấy CI status của pipeline gần nhất trên cùng branch:
```
ci_passed = COALESCE(
    NULLIF(mr.ci_passed, false),   -- ưu tiên giá trị raw nếu có
    pipeline_join.is_success       -- fallback từ pipelines table
)
```

**Các cột thêm so với raw:**
- `mr_size` — tính lại từ `additions + deletions` (đã coalesce NULL → 0)
- `created_week` — `DATE_TRUNC('week', created_at)` để group by tuần

---

### View `gitlab_kpi_staging.stg_commits`

**Mục đích:** Làm sạch `gitlab_raw.commits` — coalesce NULL cho các boolean/số.

**Cột thêm:**
- `total_loc` — `additions + deletions`
- `committed_week` — `DATE_TRUNC('week', committed_date)` để group by tuần

---

### View `gitlab_kpi_staging.stg_pipelines`

**Mục đích:** Làm sạch `gitlab_raw.pipelines`.

**Logic đặc biệt:**
- `finished_at` — fallback về `updated_at` nếu NULL (pipeline cũ không có `finished_at`)
- `is_success` — boolean `status = 'success'` để dùng trong JOIN
- `coverage` — cast về float (API đôi khi trả về kiểu khác)

---

## Schema 3: `gitlab_kpi` — Views KPI (dbt)

> **Đây là schema Metabase đọc.** Tất cả dashboard và alert query từ schema này.

---

### View `v_mr_compliance` — Compliance Score mỗi MR

**Mục đích:** View trung tâm của hệ thống. Tính compliance score 0–100 cho mỗi MR.
Được dùng bởi tất cả views KPI khác thông qua `{{ ref('v_mr_compliance') }}`.

**Cách tính score:**
```
compliance_score =
    [has_description]        × 15  +
    [has_ticket_ref]         × 15  +
    [ci_passed]              × 25  +
    [mr_size ≤ 400]          × 15  (hoặc ≤ 700 = 8đ, > 700 = 0đ)  +
    [coverage ≥ 80%]         × 15  (hoặc ≥ 60% = 8đ, < 60% = 0đ,
                                    NULL coverage = 0đ không phạt) +
    [has_valid_branch_name]  × 10  +
    [has_conventional_title] × 5
                                = tối đa 100đ
```

| Column | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | bigint | GitLab MR ID |
| `iid` | bigint | MR number trong project (hiển thị là `!42`) |
| `project_id` | bigint | ID project GitLab |
| `author_username` | varchar | Username người tạo MR |
| `author_name` | varchar | Tên hiển thị người tạo MR |
| `title` | varchar | Tiêu đề MR |
| `state` | varchar | `opened` / `merged` / `closed` |
| `source_branch` | varchar | Branch nguồn của MR |
| `target_branch` | varchar | Branch đích (main/develop/...) |
| `created_at` | timestamptz | Thời điểm tạo MR |
| `merged_at` | timestamptz | Thời điểm merge (null nếu chưa merge) |
| `mr_size` | bigint | Tổng LOC thay đổi (additions + deletions) |
| `additions` | bigint | Số dòng thêm |
| `deletions` | bigint | Số dòng xóa |
| `size_label` | text | Phân loại kích thước: `XS` (<50) / `S` (≤200) / `M` (≤400) / `L` (≤700) / `XL` (>700) |
| `cycle_time_hours` | numeric | Thời gian từ tạo → merge tính bằng giờ. NULL nếu chưa merge |
| `test_coverage` | float | % test coverage từ pipeline gần nhất của branch này. `0` nếu không có data (không phạt) |
| `has_description` | boolean | MR có description > 50 ký tự |
| `has_ticket_ref` | boolean | Description có tham chiếu ticket |
| `has_ai_disclosure` | boolean | Description khai báo AI assistance |
| `has_ai_prefix` | boolean | Title có prefix `[AI]` |
| `ci_passed` | boolean | CI pipeline pass |
| `ci_status` | varchar | Text status CI: `success` / `failed` / `unknown` |
| `has_valid_branch_name` | boolean | Branch name đúng format ENG-STD-MR-002 |
| `has_conventional_title` | boolean | Title theo Conventional Commits |
| `created_week` | date | Tuần tạo MR (Monday) — dùng GROUP BY tuần |
| `compliance_score` | integer | Điểm tuân thủ 0–100 |
| `violations` | text[] | Mảng các violation code. Ví dụ: `{CI_FAILED, NO_DESCRIPTION}`. Empty array nếu pass hết |

**Violation codes:**

| Code | Ý nghĩa | Điểm bị trừ |
|---|---|---|
| `MR_TOO_LARGE` | MR > 700 LOC | 15đ |
| `NO_DESCRIPTION` | Không có description | 15đ |
| `NO_TICKET_REF` | Không có ticket reference | 15đ |
| `NO_AI_DISCLOSURE` | Không khai báo AI (informational) | 0đ |
| `CI_FAILED` | CI không pass | 25đ |
| `LOW_COVERAGE` | Coverage < 60% (chỉ khi có data) | 7đ |
| `BRANCH_NAMING_VIOLATION` | Branch name sai format | 10đ |
| `MR_TITLE_VIOLATION` | Title không theo convention | 5đ |

---

### View `v_violations` — MR đang vi phạm

**Mục đích:** Subset của `v_mr_compliance` — chỉ giữ MR có ít nhất 1 violation VÀ target vào nhánh protected. Đây là "alert feed" — QA triage hàng ngày từ view này.

**Filter áp dụng:**
- `array_length(violations, 1) > 0` — có ít nhất 1 vi phạm
- `target_branch IN ('main','master','develop','dev','staging')` — chỉ nhánh production-bound

**Cột đặc biệt:**
- `violation_count` — `array_length(violations, 1)` — số lượng vi phạm

**Sort mặc định:** `compliance_score ASC, created_at DESC` — tệ nhất lên đầu, mới nhất lên đầu trong cùng score.

---

### View `v_weekly_kpi` — KPI theo developer theo tuần

**Mục đích:** Tổng hợp hiệu suất mỗi developer mỗi tuần — kết hợp cả commit activity và MR quality. Dùng cho weekly review và developer segmentation.

**Cách tính:** Pre-aggregate commits và MRs riêng trước khi JOIN để tránh N×M fan-out.

| Column | Ý nghĩa |
|---|---|
| `week` | Tuần (Monday) |
| `author_name` | Tên developer |
| `author_email` | Email developer |
| `total_commits` | Tổng số commit trong tuần |
| `ai_commits` | Số commit có `[AI]` prefix |
| `ai_commit_pct` | `ai_commits / total_commits × 100` |
| `bad_commit_msg_count` | Số commit không theo Conventional Commits |
| `long_commit_count` | Số commit message > 500 ký tự (vi phạm GitLab Push Rules) |
| `total_loc_changed` | Tổng LOC thay đổi qua commit |
| `ai_loc_changed` | LOC thay đổi bởi AI-assisted commits |
| `ai_loc_pct` | `ai_loc_changed / total_loc_changed × 100` |
| `projects_touched` | Số project khác nhau developer commit vào tuần này |
| `mr_count` | Số MR tạo trong tuần |
| `avg_mr_size` | Kích thước MR trung bình (LOC) |
| `avg_compliance_score` | Điểm compliance trung bình của MR tuần này |
| `mr_with_violations` | Số MR có ít nhất 1 violation |

> **Lưu ý join:** View join commits → MRs bằng `author_name`. Nếu tên git config khác tên GitLab profile, một số developer có thể bị split thành 2 rows.

---

### View `v_ai_adoption` — AI adoption theo tuần và project

**Mục đích:** Theo dõi xu hướng adoption AI tool của từng project theo thời gian.
Dùng cho báo cáo hàng tháng lên Engineering Manager.

| Column | Ý nghĩa |
|---|---|
| `week` | Tuần (Monday) |
| `project_name` | Tên project GitLab |
| `total_commits` | Tổng commits trong tuần tại project đó |
| `ai_commits` | Số commits có `[AI]` prefix |
| `total_loc` | Tổng LOC thay đổi |
| `ai_loc` | LOC thay đổi bởi AI-assisted commits |
| `ai_commit_pct` | % commits có AI (0–100) |
| `ai_loc_pct` | % LOC thay đổi bởi AI (0–100) |

**Tín hiệu cần chú ý:**
- `ai_commit_pct = 0%` liên tục → project chưa dùng AI hoặc không khai báo
- `ai_commit_pct > 80%` → phụ thuộc nhiều vào AI, cần review chất lượng

---

### View `v_data_freshness` — Độ tươi của dữ liệu

**Mục đích:** Single-row view cho Metabase dashboard — hiển thị "Data cập nhật lúc X". Cảnh báo QA khi data bị stale (pipeline chết).

| Column | Ý nghĩa |
|---|---|
| `last_mr_sync` | `MAX(updated_at)` của `gitlab_raw.merge_requests` |
| `last_pipeline_sync` | `MAX(updated_at)` của `gitlab_raw.pipelines` |
| `last_commit_sync` | `MAX(committed_date)` của `gitlab_raw.commits` |
| `queried_at` | `NOW()` — thời điểm query chạy |

**Ngưỡng đánh giá:**
- `last_mr_sync > NOW() - 2h` → OK
- `last_mr_sync > NOW() - 24h` → Warning
- `last_mr_sync < NOW() - 24h` → **Data stale — pipeline có thể đang fail**

---

### View `v_compliance_mgmt` — View quản trị tổng hợp

**Mục đích:** Enriched version của `v_mr_compliance` cho dashboard quản trị.
Thêm `project_name` (join từ commits), time buckets để Metabase GROUP BY linh hoạt, và `compliance_grade` dạng text.

**Khác biệt so với `v_mr_compliance`:**

| Column mới | Ý nghĩa |
|---|---|
| `project_name` | Tên project (resolved từ commits — MR API không trả về) |
| `is_protected_target` | `true` nếu `target_branch` là main/master/develop/dev/staging |
| `created_week` | Tuần tạo MR (date) |
| `created_month` | Tháng tạo MR (date đầu tháng, e.g. `2026-03-01`) |
| `created_quarter` | Quý tạo MR (date đầu quý, e.g. `2026-01-01`) |
| `created_year` | Năm tạo MR (integer) |
| `quarter_label` | Label quý dạng string, e.g. `2026-Q1` — dùng hiển thị trên chart |
| `compliance_grade` | `PASS` (≥80) / `WARNING` (60–79) / `FAIL` (<60) |
| `violation_count` | `array_length(violations, 1)` — số vi phạm |
| `is_ui_related` | `true` nếu MR có label `frontend`/`ui`/`design` — drives R-MR-005 (Phase A v1.6) |
| `has_screenshots` | Passthrough from `gitlab_raw.merge_requests` — advisory R-MR-005 check |
| `diverged_commits_count` | Passthrough from `gitlab_raw.merge_requests` — advisory R-MR-006 check (NULL = unknown = PASS) |
| `is_rebased` | Derived 3-state từ `diverged_commits_count` in `stg_merge_requests` (NULL = unknown, NOT stored as raw column) |

**Cách dùng điển hình trong Metabase:**

```sql
-- Tỉ lệ tuân thủ theo tháng
SELECT created_month, COUNT(*) FILTER (WHERE compliance_grade='PASS') / COUNT(*)::float
FROM v_compliance_mgmt GROUP BY 1 ORDER BY 1;

-- Project tệ nhất tháng này
SELECT project_name, AVG(compliance_score)
FROM v_compliance_mgmt
WHERE created_month = DATE_TRUNC('month', NOW()) AND is_protected_target = true
GROUP BY 1 ORDER BY 2 ASC LIMIT 10;
```

---

### View `v_compliance_violation_detail` — Violation unnested

**Mục đích:** Giải quyết giới hạn của Metabase với PostgreSQL ARRAY column — `violations[]` không thể GROUP BY hay filter trực tiếp trong Metabase GUI.

View này UNNEST mảng violations thành rows riêng lẻ: **1 MR có 3 violations → 3 rows trong view này.**

**Khi nào dùng view này thay vì `v_compliance_mgmt`:**
- Muốn đếm số lần xuất hiện của từng violation type
- Muốn biết "project X đang vi phạm những gì"
- Muốn biết "dev Y lặp lại vi phạm gì"
- Muốn GROUP BY violation category (Naming / Documentation / Quality Gate / AI Compliance)

| Column | Ý nghĩa |
|---|---|
| `mr_id` | ID của MR (join key về `v_compliance_mgmt`) |
| `iid` | MR number trong project |
| `project_id` | ID project |
| `project_name` | Tên project |
| `author_username` | Username developer |
| `author_name` | Tên developer |
| `title` | Tiêu đề MR |
| `state` | Trạng thái MR |
| `target_branch` | Branch đích |
| `is_protected_target` | MR vào nhánh protected |
| `created_at` | Thời điểm tạo MR |
| `created_week` | Tuần |
| `created_month` | Tháng |
| `created_quarter` | Quý |
| `created_year` | Năm |
| `quarter_label` | Label quý, e.g. `2026-Q1` |
| `compliance_score` | Điểm compliance của MR |
| `compliance_grade` | `PASS` / `WARNING` / `FAIL` |
| `violation_count` | Tổng số violation của MR này |
| `mr_size` | Kích thước MR (LOC) |
| `size_label` | `XS` / `S` / `M` / `L` / `XL` |
| `cycle_time_hours` | Thời gian tạo → merge (giờ) |
| `violation_type` | **Code violation cụ thể** (e.g. `CI_FAILED`) |
| `violation_label` | Nhãn tiếng Việt (e.g. `CI pipeline thất bại`) |
| `violation_category` | Nhóm: `Naming Convention` / `Documentation` / `AI Compliance` / `Quality Gate` / `MR Size` / `Security & Process` |
| `score_weight` | Số điểm bị mất do violation này (CI_FAILED=25, NO_DESCRIPTION=15, …). **Advisory violations** (`NO_SCREENSHOTS_UI`, `NOT_REBASED` — Phase A v1.6) có `score_weight = 0` — vẫn xuất hiện trong leaderboard nhưng không trừ điểm. |

**Ví dụ query:**
```sql
-- Top violations tháng này, theo nhóm
SELECT violation_category, violation_label, COUNT(DISTINCT mr_id) AS mr_count
FROM v_compliance_violation_detail
WHERE created_month = DATE_TRUNC('month', NOW())
GROUP BY 1, 2 ORDER BY 3 DESC;
```

---

## Sơ đồ quan hệ giữa các views

```
gitlab_raw.merge_requests ──┐
gitlab_raw.pipelines   ──────┤
                             ▼
                   stg_merge_requests ──┐
                   stg_pipelines   ──────┤
                                        ▼
                              v_mr_compliance
                                    │
                    ┌───────────────┼──────────────────┐
                    ▼               ▼                  ▼
              v_violations   v_compliance_mgmt   v_weekly_kpi
                                    │
                                    ▼
                      v_compliance_violation_detail

gitlab_raw.commits ─────────────────────────────────────┐
                                                         ▼
                                            stg_commits ─┤
                                                         ├──► v_weekly_kpi
                                                         ├──► v_ai_adoption
                                                         └──► v_compliance_mgmt (project_name)
```

---

## Schema 4: `gitlab_raw_staging` — dlt transient (KHÔNG dùng)

> ⚠️ **Đừng nhầm với `gitlab_kpi_staging`.** Cùng có chữ "staging" nhưng khác bản chất:
> - `gitlab_raw_staging` = **dlt managed**, bảng vật lý tạm trong vòng load. dbt KHÔNG `ref()`.
> - `gitlab_kpi_staging` = **dbt managed**, views `stg_*` được mọi mart ref().

**Cách dlt dùng**: trong mỗi `pipeline.run()`, dlt INSERT row mới vào `gitlab_raw_staging.<table>` rồi MERGE sang `gitlab_raw.<table>` qua primary key. Sau khi merge xong, bảng staging giữ lại slice cuối (không truncate auto) — đó là rows residue thấy trong inventory.

**Bảng có mặt**: mirror 1-1 với `gitlab_raw.*` (`merge_requests`, `commits`, `pipelines`, `pipeline_jobs`, `mr_commits`, `mr_notes`, `test_reports`, `group_members`, ...).

**Quy tắc**:
- KHÔNG query trực tiếp từ Metabase / dbt / alert script
- KHÔNG cần `analytics_ro` grant
- Có thể DROP các bảng `__*` empty residue (vd `merge_requests__label_names` từ migration 008) — idempotent

Chi tiết row counts: xem [db_inventory.md §gitlab_raw_staging](./db_inventory.md).

---

## Quyền truy cập

| Role | Quyền | Dùng bởi |
|---|---|---|
| `analytics` (owner) | Đọc + Ghi toàn bộ `gitlab_raw`, `gitlab_raw_staging`, `gitlab_kpi`, `gitlab_kpi_staging` | dlt ETL, dbt, migration scripts |
| `analytics_ro` | SELECT only trên `gitlab_raw` và `gitlab_kpi` | Metabase, alert script |

> Schema `gitlab_kpi_staging` (dbt staging views) + `gitlab_raw_staging` (dlt transient) không expose cho Metabase — internal only.

---

*Xem thêm:*
- *[architecture_etl.md](./architecture_etl.md) — Luồng data end-to-end và checkpoint flow*
- *[qa_metabase_dashboard_builder.md](./qa_metabase_dashboard_builder.md) — Hướng dẫn tạo dashboard trên Metabase*
- *[ops_runbook.md](./ops_runbook.md) — Xử lý sự cố pipeline*
