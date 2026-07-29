# Hướng dẫn QA tự tạo Dashboard Compliance trên Metabase
> Dành cho: QA Engineer / QA Lead (DIY workflow trên Metabase UI)
> Cập nhật: 2026-05-19
> Phiên bản Metabase: OSS (port 3000)

---

> ℹ️ **Đọc trước khi bắt đầu**
>
> Project đã có **55 dashboards card auto-provisioned** qua `src/metabase/setup_dashboards.py` (6 collections A–F). Đa số use case QA cần (Pass Rate, Top Violations, Project Health, Developer Segmentation, AI Adoption, DORA…) đã có sẵn → xem [`dashboard_catalog.md`](./dashboard_catalog.md) + [`qa_dashboard_guide.md`](./qa_dashboard_guide.md) trước.
>
> Doc này hữu ích khi: (1) QA muốn build ad-hoc question/dashboard riêng cho dự án nhỏ, (2) tự học workflow Metabase UI, (3) tạo chart cho stakeholder mà cần custom layout. Nếu chỉ cần insight chuẩn → dùng dashboards có sẵn.

---

## Trước khi bắt đầu

### Hiểu nhanh hệ thống tính điểm (v1.6 — 10 tiêu chí + 2 advisory)

Mỗi MR được chấm **compliance score 0–100** theo 10 tiêu chí scoring. Chi tiết đầy đủ (severity, công thức, edge cases) ở:
- [`qa_dashboard_guide.md` §2](./qa_dashboard_guide.md#2-hệ-thống-tính-điểm-compliance-v16) — narrative
- `docs/ai/internal_rules/01_MR_Compliance.md` — rule definitions (source of truth)
- `docs/mr-compliance/compliance_spec.yaml` — machine-readable spec

**Tóm tắt thang điểm:**

| Hạng mục | Điểm tối đa | Tiêu chí chính |
|---|---|---|
| Quality Gate | 40 | CI pass (25), Coverage tuyệt đối (10), Coverage delta (5 — GOOD_PRACTICE) |
| MR Size | 15 | ≤ 200 LOC = 15, ≤ 400 = 12, ≤ 700 = 8, > 700 = 0 |
| Documentation | 25 | Description (10), Template (5 — GOOD_PRACTICE), Ticket ref (10) |
| AI Compliance | 5 | `R-COMMIT-002-AI` + `R-MR-003-AI-DISCLOSURE` đồng bộ |
| Naming Convention | 15 | Branch (10), MR Title (5 — GOOD_PRACTICE) |
| **Total** | **100** | |

**Advisory (v1.6 Phase A — 0 điểm, tracking only):**
- `R-MR-005-SCREENSHOTS-UI` — Screenshot cho UI MR (xem [B14])
- `R-MR-006-REBASED` — Rebase trước MR (xem [B15])

**Ngưỡng đánh giá:**
- 🟢 **≥ 80** — PASS
- 🟡 **60–79** — WARNING
- 🔴 **< 60** — FAIL

### Hai views dùng để build dashboard

| View | Dùng để làm gì |
|---|---|
| `v_compliance_mgmt` | Tỉ lệ tuân thủ theo thời gian, theo project, theo dev |
| `v_compliance_violation_detail` | Phân tích từng loại vi phạm — ai, project nào, nhiều nhất là gì |

> Cả hai view đều nằm trong database **gitlab_analytics**, schema **gitlab_kpi_gitlab_kpi**.

---

## Phần 1 — Tạo từng Chart (Question)

Mỗi chart bên dưới là một **Question** trong Metabase.
Tạo xong rồi pin vào Dashboard ở Phần 2.

---

### Chart 1 — Pass Rate theo Tháng (Line Chart)

**Mục đích:** Xem xu hướng tuân thủ tháng này so với tháng trước.

**Bước thực hiện:**

1. Vào **New → Question**
2. Chọn **gitlab_analytics** → tìm và chọn **v_compliance_mgmt**
3. Click **Summarize**:
   - **Metric 1:** Count of rows → đặt tên `Tổng MRs`
   - **Metric 2:** Count of rows → thêm filter `compliance_grade = PASS` → đặt tên `MRs Pass`
4. **Group by:** `created_month`
5. Chọn kiểu chart: **Line** (2 đường: Tổng và Pass)
6. Để tính % trực tiếp, dùng **Custom Expression:**
   ```
   CountIf([Compliance Grade] = "PASS") / Count * 100
   ```
   Đặt tên: `Pass Rate (%)`
7. **Save** → đặt tên: `Pass Rate theo Tháng`

**Kết quả mong đợi:**
```
Tháng       | Tổng MRs | Pass | Pass Rate
2026-01     |  6,284   |  0   |    0%
2026-02     |  3,320   |  0   |    0%
2026-03     |  6,441   |  9   |    0.1%
```

---

### Chart 2 — Pass Rate theo Tuần (Line Chart)

Tương tự Chart 1, nhưng **Group by `created_week`** thay vì tháng.
Dùng để theo dõi tuần này so với tuần trước.

**Save** → đặt tên: `Pass Rate theo Tuần`

---

### Chart 3 — Pass Rate theo Quý (Bar Chart)

Tương tự Chart 1, nhưng **Group by `quarter_label`** (ví dụ: `2026-Q1`).
Dùng cho báo cáo quý lên Ban Giám đốc.

**Save** → đặt tên: `Pass Rate theo Quý`

---

### Chart 4 — Compliance Score Trung Bình theo Tuần

**Mục đích:** Thấy điểm trung bình đang tăng hay giảm.

1. **New → Question** → chọn **v_compliance_mgmt**
2. **Summarize:**
   - Average of `compliance_score` → tên `Avg Score`
   - Count → tên `Số MRs`
3. **Group by:** `created_week`
4. Chart type: **Line** (Avg Score) + **Bar** (Số MRs) → dùng **Combo chart**
5. **Save** → `Compliance Score Trung Bình theo Tuần`

---

### Chart 5 — Top Violations (Bar Chart ngang)

**Mục đích:** Violation nào đang xuất hiện nhiều nhất — ưu tiên fix gì trước.

1. **New → Question** → chọn **v_compliance_violation_detail**
2. **Filter:** `created_month = [tháng hiện tại]` (hoặc để làm dynamic filter sau)
3. **Summarize:**
   - Count of rows → tên `Số lần vi phạm`
   - Count distinct `mr_id` → tên `Số MRs vi phạm`
4. **Group by:** `violation_label`
5. Chart type: **Row chart** (bar ngang, dễ đọc label dài)
6. Sort: descending theo `Số MRs vi phạm`
7. **Save** → `Top Violations tháng này`

---

### Chart 6 — Violation theo Category (Donut Chart)

**Mục đích:** Nhìn nhanh tổng quan — vấn đề chính là Naming, Documentation, hay Quality Gate?

1. **New → Question** → chọn **v_compliance_violation_detail**
2. **Summarize:**
   - Count distinct `mr_id` → tên `Số MRs`
3. **Group by:** `violation_category`
4. Chart type: **Pie / Donut**
5. **Save** → `Violations theo Category`

---

### Chart 7 — Scorecard theo Project (Table)

**Mục đích:** Project nào đang tệ nhất — để biết cần can thiệp ở đâu.

1. **New → Question** → chọn **v_compliance_mgmt**
2. **Filter:** `is_protected_target = true` (chỉ nhìn MR vào main/develop)
3. **Summarize:**
   - Count → `Tổng MRs`
   - Average of `compliance_score` → `Avg Score`
   - CountIf `compliance_grade = FAIL` → `Số FAIL`
   - Count distinct `author_username` → `Số devs`
4. **Group by:** `project_name`
5. **Filter sau summarize:** Count ≥ 3 (loại project chỉ có 1–2 MR lẻ)
6. Chart type: **Table** với conditional formatting:
   - `Avg Score < 60` → nền đỏ
   - `Avg Score 60–79` → nền vàng
   - `Avg Score ≥ 80` → nền xanh
7. Sort: `Avg Score` tăng dần (tệ nhất lên đầu)
8. **Save** → `Scorecard Project`

---

### Chart 8 — Developer Segmentation (Table)

**Mục đích:** Ai đang Champion, ai đang At-risk trong tháng này.

1. **New → Question** → chọn **v_compliance_mgmt**
2. **Filter:** `created_month = [tháng hiện tại]`
3. **Summarize:**
   - Count → `Số MRs`
   - Average of `compliance_score` → `Avg Score`
   - Average of `mr_size` → `Avg Size`
   - CountIf `compliance_grade = FAIL` → `Số FAIL`
4. **Group by:** `author_username`, `author_name`
5. Chart type: **Table** với conditional formatting trên `Avg Score`
6. **Save** → `Developer Compliance tháng này`

> **Phân loại thủ công sau khi xem bảng:**
> - Avg Score ≥ 75 và Số MRs ≥ 3 → **Champion**
> - Avg Score < 60 và Số MRs ≥ 3 → **Speed demon** (cần coaching)
> - Avg Score < 60 và Số MRs < 3 → **At-risk** (cần intervention)
> - Avg Score ≥ 75 và Số MRs < 3 → **Careful contributor**

---

### Chart 9 — Violation của từng Dev (Drilldown Table)

**Mục đích:** Khi đã xác định dev có vấn đề, xem họ đang vi phạm gì.

1. **New → Question** → chọn **v_compliance_violation_detail**
2. **Summarize:**
   - Count distinct `mr_id` → `Số MRs vi phạm`
3. **Group by:** `author_username`, `violation_label`
4. Chart type: **Table**
5. **Save** → `Violations theo Dev`

---

### Chart 10 — Trend vi phạm theo Tuần (Stacked Bar)

**Mục đích:** Violation đang tăng hay giảm theo từng tuần — tín hiệu cải thiện.

1. **New → Question** → chọn **v_compliance_violation_detail**
2. **Summarize:**
   - Count distinct `mr_id` → `Số MRs vi phạm`
3. **Group by:** `created_week` + `violation_category`
4. Chart type: **Stacked Bar**
5. **Save** → `Trend Violations theo Tuần`

---

## Phần 2 — Tạo Dashboard

### Tạo Dashboard chính

1. Vào **New → Dashboard**
2. Đặt tên: `QA Compliance Overview`
3. Click **Add a question** → thêm từng chart đã tạo ở Phần 1

### Layout đề xuất

```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│  Pass Rate     │  Avg Score     │  Tổng Vi Phạm  │  Data Freshness│
│  (số lớn)      │  (số lớn)      │  (số lớn)      │  (số lớn)      │
│  Chart 1 tile  │  Chart 4 tile  │  tính từ       │  v_data_fresh  │
│                │                │  viol_detail   │                │
└────────────────┴────────────────┴────────────────┴────────────────┘
┌──────────────────────────────┬─────────────────────────────────────┐
│  Pass Rate theo Tuần         │  Top Violations tháng này           │
│  (Chart 2 — Line)            │  (Chart 5 — Row chart)              │
│                              │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
┌──────────────────────────────┬─────────────────────────────────────┐
│  Violations theo Category    │  Trend Violations theo Tuần         │
│  (Chart 6 — Donut)           │  (Chart 10 — Stacked Bar)           │
│                              │                                     │
└──────────────────────────────┴─────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Scorecard Project (Chart 7 — Table, full width)                 │
└──────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│  Developer Compliance tháng này (Chart 8 — Table, full width)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phần 3 — Thêm Filters vào Dashboard

Filter cho phép thay đổi time range / project / dev mà không cần tạo chart mới.

### Thêm Date Range Filter

1. Trong Dashboard, click **Add a filter**
2. Chọn **Time → Month and year**
3. Đặt tên: `Tháng`
4. **Link filter này đến** tất cả charts dùng `v_compliance_mgmt` và `v_compliance_violation_detail`:
   - Với mỗi chart: chọn column `created_month`
5. Set default value: tháng hiện tại

### Thêm Project Filter

1. **Add a filter → Text → Is**
2. Đặt tên: `Project`
3. Link đến column `project_name` trong tất cả charts
4. Để trống default (= hiển thị tất cả)

### Thêm Target Branch Filter

1. **Add a filter → Text → Is**
2. Đặt tên: `Chỉ nhánh chính`
3. Link đến column `is_protected_target`
4. Default: `true` (chỉ nhìn MR vào main/develop/staging)

---

## Phần 4 — Tạo Dashboard Drilldown (Tháng / Quý)

Tạo dashboard thứ 2 cho báo cáo định kỳ:

1. **New → Dashboard** → đặt tên: `QA Compliance — Báo cáo Định kỳ`
2. Thêm vào:
   - Chart 1 (Pass Rate theo Tháng)
   - Chart 3 (Pass Rate theo Quý)
   - Chart 4 (Score theo Tuần)
   - Chart 7 (Scorecard Project — lọc theo quý)
   - Chart 8 (Developer — lọc theo quý)
3. Thêm filter **Quarter** (Time → Quarter and year)

---

## Phần 5 — Thiết lập Alerts tự động

Metabase có thể gửi email hoặc Slack khi chỉ số vượt ngưỡng.

### Alert 1 — Pass Rate giảm dưới 70%

1. Mở Chart 1 (Pass Rate theo Tháng)
2. Click icon chuông **🔔 → Create alert**
3. Cấu hình:
   - **Condition:** `Pass Rate (%) < 70`
   - **Check:** Weekly (mỗi thứ Hai)
   - **Notify:** Email QA Lead
4. **Save**

### Alert 2 — Có MR FAIL trên nhánh chính

1. Mở Chart 8 (Developer Compliance)
2. Filter thêm: `is_protected_target = true` và `compliance_grade = FAIL`
3. **Create alert:**
   - **Condition:** Rows > 0 (tức là có MR FAIL)
   - **Check:** Daily (mỗi sáng 8:00)
   - **Notify:** Email QA + Slack channel

### Alert 3 — Project có Avg Score < 50

1. Mở Chart 7 (Scorecard Project)
2. **Create alert:**
   - **Condition:** `Avg Score < 50`
   - **Check:** Weekly
   - **Notify:** Email QA Lead + Eng Manager liên quan

---

## Phần 6 — Tips & Gotchas

### Metabase không GROUP BY được mảng violations trực tiếp

`v_compliance_mgmt` có cột `violations` là mảng (`{CI_FAILED, NO_DESCRIPTION}`).
Metabase **không thể filter hay group** cột kiểu mảng này.

→ **Dùng `v_compliance_violation_detail`** cho mọi phân tích theo loại vi phạm.
Đây là lý do view này tồn tại.

### Lọc "chỉ nhánh production" để tránh nhiễu

Nhiều MR là branch dev nội bộ, không nhất thiết phải follow đủ quy trình.
Khi báo cáo lên management, nên filter `is_protected_target = true`
(chỉ lấy MR target vào `main`, `master`, `develop`, `dev`, `staging`).

### Khi số liệu không khớp với thực tế

Nếu chart hiển thị số khác với những gì dev báo:

1. Kiểm tra **Data freshness** — data có được sync trong 24h không?
2. Kiểm tra filter `created_month` có đang active không
3. Kiểm tra filter `is_protected_target` — có đang lọc bỏ MR không?

### Schema name trong Metabase

Khi browse tables trong Metabase, các view nằm ở:
- **Schema:** `gitlab_kpi_gitlab_kpi`
- **Tables:** `v_compliance_mgmt`, `v_compliance_violation_detail`, `v_mr_compliance`, `v_violations`, `v_weekly_kpi`, `v_ai_adoption`

---

## Tổng hợp nhanh — 10 Charts cần tạo

| # | Tên Chart | View dùng | Chart type | Mục đích |
|---|---|---|---|---|
| 1 | Pass Rate theo Tháng | v_compliance_mgmt | Line | Trend tháng |
| 2 | Pass Rate theo Tuần | v_compliance_mgmt | Line | Theo dõi tuần |
| 3 | Pass Rate theo Quý | v_compliance_mgmt | Bar | Báo cáo quý |
| 4 | Avg Score theo Tuần | v_compliance_mgmt | Combo | Điểm trung bình |
| 5 | Top Violations | v_compliance_violation_detail | Row | Ưu tiên fix |
| 6 | Violations theo Category | v_compliance_violation_detail | Donut | Tổng quan |
| 7 | Scorecard Project | v_compliance_mgmt | Table | Project risk |
| 8 | Developer Compliance | v_compliance_mgmt | Table | Dev performance |
| 9 | Violations theo Dev | v_compliance_violation_detail | Table | Dev drilldown |
| 10 | Trend Violations theo Tuần | v_compliance_violation_detail | Stacked Bar | Cải thiện hay không |

---

*Xem thêm:*
- *[qa_dashboard_guide.md](./qa_dashboard_guide.md) — Hướng dẫn đọc và interpret dashboard auto-provisioned*
- *[dashboard_catalog.md](./dashboard_catalog.md) — Inventory 55 cards có sẵn (script-managed)*
- *[../ops/ops_runbook.md](../ops/ops_runbook.md) — Xử lý khi data không được cập nhật*
