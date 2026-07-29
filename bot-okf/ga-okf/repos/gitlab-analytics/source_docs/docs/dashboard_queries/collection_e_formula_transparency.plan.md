# Kế hoạch — Collection E: Compliance Formula & Scoring Transparency

**Trạng thái:** PLANNING — chưa implement
**Ngày lập kế hoạch:** 2026-04-04
**Người dùng mục tiêu:** QA Manager, Engineering Manager, Developer (self-service)
**Phụ thuộc:** compliance_updater system (✅ đã có), v_mr_compliance (✅), v_compliance_violation_detail (✅)

---

## 1. Mục tiêu & Vấn đề cần giải quyết

### Vấn đề hiện tại
Collection B (QA Compliance) hiện chỉ thể hiện **kết quả** (score, grade, violation count).
Không có chỗ nào giải thích **tại sao** một MR được score X, hay **tiêu chí nào** đang kéo điểm xuống ở mức team/project.

### Mục tiêu Collection E
> **"Từ công thức đến con số"** — hiển thị minh bạch cách tính điểm, trọng số từng tiêu chí, và team đang đạt/mất điểm ở đâu.

| Người dùng | Họ cần biết |
|-----------|-------------|
| QA Manager | Tiêu chí nào team đang fail nhiều nhất? Chúng ta mất bao nhiêu điểm trung bình/MR vì từng rule? |
| Engineering Manager | Project nào đang yếu rule gì? Xu hướng cải thiện theo tuần? |
| Developer | Tại sao MR của mình bị điểm thấp? Điểm từng hạng mục là bao nhiêu? |
| QA Lead (kỹ thuật) | Công thức hiện tại version nào? Trọng số đang áp dụng là gì? Đã đổi gì so với v1.3? |

---

## 2. Nguồn dữ liệu hiện có (reuse)

| View | Schema | Có gì dùng được |
|------|--------|-----------------|
| `v_mr_compliance` | gitlab_kpi | Tất cả boolean fields (ci_passed, has_description, …) + compliance_score + violations[] |
| `v_compliance_mgmt` | gitlab_kpi | Như trên + project_name, created_month, compliance_grade |
| `v_compliance_violation_detail` | gitlab_kpi | violation_type, score_weight, severity — unnested |
| `compliance_spec.yaml` | docs/ | Version, max_pts per criterion, label, category — nguồn sự thật công thức |

---

## 3. Dbt views mới cần build (2 views)

### 3a. `v_compliance_criterion_stats`

**Mục đích:** Tổng hợp per-criterion — pass rate, avg pts earned, pts lost — dùng cho E1, E2, E3, E4, E5.

**Logic:**

Unnest 10 criteria từ `v_compliance_mgmt` thành rows, mỗi row = 1 criterion × 1 MR.
Join với bảng mapping (inline VALUES) chứa max_pts và label từ compliance_spec.

```
Columns output:
  criterion_name     — 'ci_pass' | 'coverage_absolute' | …
  criterion_label    — 'CI pass/fail' | 'Coverage absolute' | …
  category           — 'Quality Gate' | 'MR Size' | …
  max_pts            — 25 | 10 | 5 | …  (từ compliance_spec.yaml)
  created_week       — date_trunc('week', created_at)
  created_month      — date_trunc('month', created_at)
  project_id
  project_name
  total_mrs          — COUNT(*)
  passed_count       — COUNT(*) WHERE pts_earned = max_pts
  pass_rate          — passed_count / total_mrs * 100
  avg_pts_earned     — AVG(pts_earned per MR)
  avg_pts_lost       — max_pts - avg_pts_earned
```

**Cách tính `pts_earned` per criterion:**
Dùng CASE WHEN trên boolean fields của `v_compliance_mgmt`:
```sql
-- ví dụ criterion ci_pass:
CASE WHEN ci_passed THEN 25 ELSE 0 END AS pts_earned
```
→ Unnest bằng VALUES + CROSS JOIN LATERAL hoặc UNION ALL (10 branches).

**Materialization:** view (refresh cùng dbt run hàng ngày)

---

### 3b. `v_mr_score_breakdown`

**Mục đích:** Per-MR, per-criterion — dùng cho E6 (drill-down individual MR).

```
Columns output:
  mr_id, iid, project_id, project_name
  author_username, author_name
  created_at, compliance_score, compliance_grade
  criterion_name, criterion_label, category
  max_pts
  pts_earned
  passed          — boolean (pts_earned = max_pts)
  pct_contribution — pts_earned / compliance_score * 100 (share of total score)
```

**Note:** View này sẽ nặng hơn (nhiều rows = 10 × số MRs). Có thể filter `WHERE created_at >= NOW() - INTERVAL '90 days'` để kiểm soát kích thước.

---

## 4. Cards kế hoạch (7 cards)

### E1 — Formula Weight Reference Table
**Loại viz:** Table
**Nguồn:** `v_compliance_criterion_stats` GROUP BY criterion + JOIN static spec values
**Hiển thị:**

| Tiêu chí | Hạng mục | Điểm tối đa | Điểm TB đội đạt | Pass rate | Điểm TB bị mất |
|---------|----------|-------------|-----------------|-----------|----------------|
| CI pass/fail | Quality Gate | 25 | 22.1 | 88% | 2.9 |
| Coverage ≥80% | Quality Gate | 10 | 4.3 | 43% | 5.7 |
| … | … | … | … | … | … |
| **Tổng** | | **100** | **68.4** | | **31.6** |

**Mục đích:** Reference card — QA Manager xem ngay tiêu chí nào kéo điểm xuống nhất.
**Filter:** Date range (default: 30 ngày gần nhất)

---

### E2 — Criterion Pass Rate (Worst First)
**Loại viz:** Horizontal bar chart
**Nguồn:** `v_compliance_criterion_stats`
**Hiển thị:** 10 bars, sorted pass_rate ASC (tệ nhất trên cùng)
**Color coding:**
- pass_rate < 50% → đỏ
- pass_rate 50–79% → cam
- pass_rate ≥ 80% → xanh

**Mục đích:** Visual nhanh — "chúng ta đang fail tiêu chí nào nhiều nhất."
**Filter:** Date range, Project (optional)

---

### E3 — Score Decomposition by Category (Weekly Stack)
**Loại viz:** Stacked bar chart theo tuần
**Nguồn:** `v_compliance_criterion_stats` GROUP BY created_week, category
**Hiển thị:**
- X axis: tuần
- Y axis: avg pts earned (stacked by category)
- Reference line: 100 pts (max possible)
- 5 màu cho 5 categories: Quality Gate / MR Size / Documentation / AI Compliance / Convention

**Mục đích:** Xu hướng — thấy được team đang cải thiện hạng mục nào theo thời gian.

---

### E4 — Points Left on Table (Pts Lost per Criterion)
**Loại viz:** Horizontal bar chart
**Nguồn:** `v_compliance_criterion_stats`
**Hiển thị:** avg_pts_lost per criterion, sorted DESC
**Subtitle:** "Avg điểm bị mất mỗi MR theo từng tiêu chí (30 ngày)"
**Color:** severity mapping — BLOCKER criteria = đỏ, REQUIRED = cam

**Mục đích:** Prioritization tool — cho biết tiêu chí nào đang gây thiệt hại điểm nhiều nhất về mặt giá trị tuyệt đối.

---

### E5 — Criterion × Project Heatmap
**Loại viz:** Table với conditional formatting (pivot-style)
**Nguồn:** `v_compliance_criterion_stats` GROUP BY project_name, criterion_name
**Hiển thị:**

| Project | CI | Coverage | Delta | MR Size | Desc | Template | Ticket | AI | Branch | Title |
|---------|----|----|----|----|----|----|----|----|----|----|
| repo-A | 92% | 45% | 80% | 95% | 70% | 55% | 88% | 40% | 97% | 85% |
| repo-B | 100%| 78% | 90% | 88% | 95% | 72% | 91% | 62% | 100%| 88% |

**Color per cell:** < 60% đỏ / 60–79% cam / ≥ 80% xanh

**Mục đích:** Engineering Manager thấy ngay project nào yếu rule gì → assign coaching đúng chỗ.

---

### E6 — Individual MR Score Breakdown (Drill-down)
**Loại viz:** Table với progress bars
**Nguồn:** `v_mr_score_breakdown`
**Filter:** `iid` hoặc `author_username` hoặc `project_name` (Metabase variable)
**Hiển thị per MR:**

| Tiêu chí | Điểm tối đa | Đạt được | Kết quả |
|---------|-------------|----------|---------|
| CI pass/fail | 25 | 25 | ✅ PASS |
| Coverage ≥80% | 10 | 5 | ⚠️ 60–79% |
| Coverage delta | 5 | 5 | ✅ Stable |
| MR Size | 15 | 0 | ❌ XL (750 LOC) |
| … | … | … | … |
| **Tổng** | **100** | **67** | **WARNING** |

**Mục đích:** Developer tự tra cứu tại sao MR bị điểm thấp.

---

### E7 — Formula Live Reference Panel
**Loại viz:** Table (static-ish, từ dbt view)
**Nguồn:** Inline query hoặc dbt seed từ `compliance_spec.yaml`
**Hiển thị:**

```
Standard: ENG-STD-MR-002 v1.4 | Updated: 2026-04
────────────────────────────────────────────────────
Category         Criterion              Max pts   Rule
Quality Gate     CI pass/fail           25        ci_passed = true
Quality Gate     Coverage ≥ 80%         10        coverage >= 80% (NULL = 0)
Quality Gate     Coverage ≥ 60%          5        60 ≤ coverage < 80
Quality Gate     Coverage delta          5        drop ≤ 5% vs 2w avg (NULL = +5)
MR Size          ≤ 400 LOC (M)          15        mr_size <= 400
MR Size          ≤ 700 LOC (L)           8        400 < mr_size <= 700
Documentation    Description present    10        len(description) > 50
Documentation    Template ≥ 3/5 secs     5        has_description_template
Documentation    Ticket reference       10        has_ticket_ref
AI Compliance    AI Disclosure [x]       5        has_ai_disclosure
Convention       Branch naming          10        has_valid_branch_name
Convention       MR title format         5        has_conventional_title
────────────────────────────────────────────────────
Total max:                            100 pts
PASS: ≥80 | WARNING: 60–79 | FAIL: <60
```

**Mục đích:** Formula reference luôn đồng bộ với code — khi compliance_updater apply thì view này tự cập nhật.

---

## 5. Dependencies & Thứ tự build

```
Phase 1 — dbt views (prerequisite)
  ├── v_compliance_criterion_stats   (dùng cho E1, E2, E3, E4, E5)
  └── v_mr_score_breakdown           (dùng cho E6)

Phase 2 — Metabase cards
  ├── E7 Formula Reference  (đơn giản nhất, inline query, không cần view mới)
  ├── E1 Weight Table       (cần v_compliance_criterion_stats)
  ├── E2 Pass Rate Bar      (cần v_compliance_criterion_stats)
  ├── E4 Points Lost        (cần v_compliance_criterion_stats)
  ├── E3 Stack Trend        (cần v_compliance_criterion_stats)
  ├── E5 Heatmap            (cần v_compliance_criterion_stats)
  └── E6 Drill-down         (cần v_mr_score_breakdown)

Phase 3 — Metabase dashboard layout
  └── Tạo Collection E, arrange cards, set cross-filter (E5 click → filter E6)
```

---

## 6. Ràng buộc kỹ thuật cần lưu ý

### 6a. Tính toán pts_earned per criterion
`v_mr_compliance` không có cột `pts_earned` riêng từng tiêu chí — chỉ có tổng `compliance_score`.
→ Phải tính lại từ boolean fields trong `v_compliance_criterion_stats`:

```sql
-- Ví dụ trong UNION ALL để unnest 10 criteria:
SELECT iid, project_id, 'ci_pass' AS criterion_name, 25 AS max_pts,
       CASE WHEN ci_passed THEN 25 ELSE 0 END AS pts_earned
FROM gitlab_kpi.v_compliance_mgmt
UNION ALL
SELECT iid, project_id, 'coverage_absolute', 10,
       CASE
         WHEN test_coverage IS NULL THEN 0
         WHEN test_coverage >= 80   THEN 10
         WHEN test_coverage >= 60   THEN 5
         ELSE 0
       END
FROM gitlab_kpi.v_compliance_mgmt
-- ... 8 UNION ALL tiếp theo
```

**Lưu ý:** Logic tính điểm PHẢI khớp với `v_mr_compliance.sql` — đây là nguồn duy nhất của sự thật. Khi compliance_updater apply thì `v_compliance_criterion_stats.sql` cũng cần cập nhật thủ công theo (chưa auto-generate).

**Future work:** Có thể extend compliance_updater để generate cả view này.

### 6b. Coverage absolute — 2 tiers chia sẻ 1 criterion slot
Coverage ≥ 80% và ≥ 60% kỹ thuật là 2 scoring rules nhưng nên merge thành 1 criterion `coverage_absolute` trong view (max_pts = 10, pts_earned = 10/5/0).

### 6c. MR size — tiered (L = 8 pts, không phải 0)
MR size L (400–700) vẫn được 8/15 pts — không phải pass/fail thuần.
Trong E2 (pass rate), nên định nghĩa "pass" = pts_earned = max_pts (15) → chỉ count MR size ≤ 400.

### 6d. E5 Heatmap — Metabase không có native pivot
Cần GROUP BY project_name + criterion_name → Metabase Table viz + dùng conditional formatting.
Không thể auto-pivot. Có thể dùng Python (setup_dashboards.py) để build card SQL với pivot tĩnh.

### 6e. Coverage delta — NULL = neutral (+5 pts)
Khi tính pass rate cho coverage_delta: NULL là PASS (5/5 pts), không phải FAIL.
Cần xử lý đặc biệt trong CASE.

---

## 7. Metabase Collection E — Layout dự kiến

```
┌─────────────────────────────────────────────────────────────────┐
│  E — Compliance Formula & Scoring Transparency                  │
│  Filter: [Date Range ▼]  [Project ▼]                           │
├─────────────────┬───────────────────────────────────────────────┤
│  E7             │  E1 — Formula Weight Reference Table          │
│  Formula Live   │  (criterion | max_pts | avg_earned | pass%)   │
│  Reference      │                                               │
│  (static table) │                                               │
├─────────────────┴───────────────────────────────────────────────┤
│  E2 — Criterion Pass Rate          │  E4 — Pts Lost per Criterion│
│  (horizontal bar, sorted worst→best)│  (horizontal bar, DESC)    │
├────────────────────────────────────┴────────────────────────────┤
│  E3 — Score Decomposition by Category (Weekly Stacked Bar)      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  E5 — Criterion × Project Heatmap (Table)                       │
│  [click project row → filter E6]                                │
├─────────────────────────────────────────────────────────────────┤
│  E6 — Individual MR Score Breakdown                             │
│  Filter: [MR iid ▼] [Author ▼]                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Checklist trước khi implement

- [ ] Confirm `v_compliance_mgmt` có đủ columns: `ci_passed`, `test_coverage`, `mr_size`, `has_description`, `has_description_template`, `has_ticket_ref`, `has_ai_disclosure`, `has_valid_branch_name`, `has_conventional_title`
- [ ] Verify `coverage_delta` column có trong `v_compliance_mgmt` (kế thừa từ `v_mr_compliance`)
- [ ] Quyết định filter mặc định cho E6 (last 90 ngày — tránh view quá nặng)
- [ ] Quyết định `v_compliance_criterion_stats` có cần `project_name` filter hay global stats là đủ
- [ ] Align với team: "pass" của MR Size là ≤ 400 (full 15 pts) hay bất kỳ pts > 0?
- [ ] Confirm compliance_spec.yaml version number để hiển thị đúng trên E7

---

## 9. Ước lượng độ phức tạp

| Hạng mục | Độ phức tạp | Ghi chú |
|----------|-------------|---------|
| `v_compliance_criterion_stats` | Medium | 10 UNION ALL branches, cần test logic match v_mr_compliance |
| `v_mr_score_breakdown` | Medium | Tương tự nhưng per-MR — cần filter date để kiểm soát size |
| E7 Formula Reference | Low | Inline query hoặc CTE đơn giản |
| E1, E2, E4 | Low | Aggregate đơn giản từ criterion_stats |
| E3 Stack Trend | Low-Medium | GROUP BY week + category |
| E5 Heatmap | Medium | Conditional formatting, không có native pivot |
| E6 Drill-down | Medium | Metabase variable filter + format |
| setup_dashboards.py integration | Low | Thêm Collection E vào script hiện có |
