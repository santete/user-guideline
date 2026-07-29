# Acceptance Criteria & Deliverables

## Tiêu chí Nghiệm thu và Artifact Bàn giao cho PO

> **Tài liệu kèm theo:** [PRD-Features-DORA-Compliance.md](./PRD-Features-DORA-Compliance.md)
> **Phiên bản:** 1.0 — 2026-04-30
> **Mục đích:** Định nghĩa rõ "DONE" nghĩa là gì cho mỗi feature, team dev phải bàn giao gì, PO sign-off dựa trên gì.

---

## 1. Nguyên tắc nghiệm thu

| Nguyên tắc | Áp dụng |
|---|---|
| **No demo, no done** | Mỗi feature phải được demo cho PO + QA Lead + EM trước khi merge production |
| **Data must reconcile** | Số liệu trên dashboard phải khớp ±2% với manual count trên GitLab cho ≥ 5 mẫu kiểm tra |
| **Documentation as code** | Tooltip / disclaimer / glossary phải có trong UI, không chỉ trong tài liệu |
| **Backward compatible** | Khi đổi formula/threshold, phải bảo toàn lịch sử score (không recompute âm thầm) |
| **Failure is loud** | Khi data bị stale / extraction lỗi, UI phải báo rõ — không được "âm thầm hiển thị 0" |

---

## 2. Definition of Done — Cấp độ Feature

Mỗi feature (F-DORA-XX, F-QA-XX, F-CC-XX) chỉ được coi là DONE khi đáp ứng **tất cả** các điều kiện sau:

### 2.1 Functional Done

- [ ] Tất cả acceptance criteria trong PRD đều pass
- [ ] Demo trên môi trường staging với dữ liệu production-like (≥ 30 ngày data thực)
- [ ] PO ký nghiệm thu sau demo (có biên bản)

### 2.2 Data Quality Done

- [ ] Reconciliation report: chọn 5 MR / 5 dev / 5 project ngẫu nhiên, đối chiếu số liệu UI vs query trực tiếp GitLab → sai lệch ≤ 2%
- [ ] Edge case coverage: NULL fields, empty arrays, MR chưa merged, pipeline chưa finish → behavior đã được test
- [ ] Data lineage rõ ràng: với mỗi metric, có thể trace ngược đến field nguồn

### 2.3 UX Done

- [ ] Tooltip giải thích định nghĩa metric + nguồn data
- [ ] Disclaimer rõ ràng nếu là proxy (Deployment, Failure, Recovery)
- [ ] Loading state khi data > 3s
- [ ] Empty state khi không có data (không phải "0", phải là "Chưa có dữ liệu")
- [ ] Error state khi extraction stale (banner đỏ + last_updated_at)

### 2.4 Operational Done

- [ ] Run book vận hành đã update (cách triage khi feature lỗi)
- [ ] Alert đã wire vào Slack channel của QA/Ops
- [ ] Permission đã review (Dev không xem được MR người khác nếu out-of-scope)

---

## 3. Acceptance Criteria chi tiết — Module 1 (DORA)

### 3.1 F-DORA-01 — Deployment Frequency

| Tiêu chí | Cách verify |
|---|---|
| Hiển thị số deploy success / tuần / project | Pick 1 project → đếm thủ công pipeline success trên `main` 7 ngày → đối chiếu UI |
| Phân loại Elite/High/Low chính xác | Project có 7+ deploy/tuần phải hiển thị Elite |
| Drill-down ra list pipeline | Click 1 tuần → modal show pipeline IDs + timestamps |
| Tooltip "Deployment ≡ pipeline success on default branch" | Hover icon `?` cạnh title |
| Aggregate org/team/project | Sum 3 projects ≈ org level |

**Artifact bàn giao:**
- Reconciliation spreadsheet: 5 projects × 4 tuần (20 cells), expected vs actual
- Screenshot drill-down từ aggregate xuống MR cụ thể
- Tooltip text approved by PO

---

### 3.2 F-DORA-02 — Lead Time for Changes

| Tiêu chí | Cách verify |
|---|---|
| Tính `merged_at - first_commit_at` đúng cho 5 MR mẫu | Manual: lấy 5 MR đã merged, query commit đầu, tính tay → đối chiếu |
| Hiển thị avg, P50, P90 | Verify P90 > P50 > avg trong các trường hợp skewed |
| Loại MR chưa merged khỏi tính toán | MR state='opened' không xuất hiện |
| Maturity rating (Elite < 24h, High < 168h, Low ≥ 168h) | Test 3 MR với lead time 12h, 100h, 200h → đúng category |
| Drill-down ra list MR | Click tuần → list MR với lead_time_hours mỗi dòng |

**Artifact:**
- Test report: 5 MR mẫu, manual computed vs UI, sai lệch < 1%
- Performance: query trả < 5s với 90 ngày data

---

### 3.3 F-DORA-03 — Change Failure Rate

| Tiêu chí | Cách verify |
|---|---|
| Tỷ lệ failed/total tính đúng | Pick 1 project, đếm thủ công `status='failed'` vs `total` trên main 7 ngày |
| Reference line ở 15% | Hiển thị đường ngang trên chart |
| Drill-down ra list pipeline failed | Click → list với pipeline_id, failure_reason (nếu có) |

**Artifact:** Reconciliation 3 projects × 4 tuần.

---

### 3.4 F-DORA-04 — MTTR

| Tiêu chí | Cách verify |
|---|---|
| Tính `next_success - failure` đúng | Pick 3 incident pairs (failure + success kế tiếp), tính tay |
| Phân biệt failure không có recovery (ongoing incident) | Hiển thị riêng, không tính vào avg |
| Pair chính xác cùng project + branch | Failure trên `main` của project A không pair với success trên `develop` của project B |

**Artifact:** Báo cáo 5 incident scenarios với expected MTTR.

---

### 3.5 F-DORA-05 — Maturity Scorecard

| Tiêu chí | Cách verify |
|---|---|
| 4 cột DORA + composite_grade | Project có 4 Elite → composite Elite |
| Sort theo composite (worst on top) | Project Low ở đầu bảng |
| Color-coded từng ô | Elite=xanh, High=vàng, Low=đỏ |

**Artifact:** Excel export bảng scorecard 1 quý gần nhất, cho EM tham khảo.

---

### 3.6 F-DORA-06 — Cycle Time Breakdown

| Tiêu chí | Cách verify |
|---|---|
| 4 mốc: created → review → approval → merged | UI hiển thị timeline visualization |
| Avg/P50/P90 cho mỗi mốc | Verify P90 lớn nhất |
| MR "stuck" (>7d không có review) hiển thị riêng | Tab/filter "Stuck MRs" |
| Project chưa adopt approval → "N/A", không phải 0 | Verify trên project không có approval workflow |

**Artifact:** Báo cáo bottleneck analysis 12 tuần — chỉ ra giai đoạn nào tốn nhiều thời gian nhất.

---

### 3.7 F-DORA-07 — Reviewer Workload

| Tiêu chí | Cách verify |
|---|---|
| Top 10 reviewer by volume | Pick #1 → đếm thủ công MR họ comment trong tuần |
| Self-review detection | Tạo 1 MR test, author comment chính mình → flag self-review |
| Avg response time per reviewer | Verify với 5 reviewers mẫu |

**Artifact:** Heatmap reviewer × week (12 tuần).

---

### 3.8 F-DORA-08 — AI Adoption

| Tiêu chí | Cách verify |
|---|---|
| ai_commit_pct = AI commits / total commits | Pick 1 dev × 1 tuần → đếm thủ công |
| Reference line 30% target | Hiển thị trên chart |
| Detection logic transparency | Tooltip giải thích cách detect (signature/co-author) |

**Artifact:** Methodology doc explaining AI detection rules + false positive rate estimate.

---

## 4. Acceptance Criteria chi tiết — Module 2 (QA Compliance)

### 4.1 F-QA-01 — Compliance Scoring

| Tiêu chí | Cách verify |
|---|---|
| 10 tiêu chí tự chấm điểm | Pick 5 MR → tính tay theo công thức → đối chiếu UI |
| Tổng điểm = 100 | Sum max_pts of 10 criteria = 100 |
| Score recompute khi MR update | Update description → score thay đổi trong 5 phút |
| Config file đổi được trọng số mà không deploy | Đổi `pts_true` của 1 criterion → reload → UI update |
| Pass/Warning/Fail thresholds (80/60) đúng | MR score 79 = WARNING, 80 = PASS |

**Artifact:**
- Test suite: 20 MR mẫu (mỗi mẫu cover 1 edge case) với expected score
- Config schema documentation (cách thêm criterion mới)

---

### 4.2 F-QA-02 — Violation Catalog

| Tiêu chí | Cách verify |
|---|---|
| 10 violation codes detect đúng | Tạo 10 MR test (mỗi cái vi phạm 1 thứ) → đúng code |
| 2 advisory không ảnh hưởng score | MR có NO_REVIEWER mà score vẫn 100 (nếu các criteria khác đều pass) |
| Heatmap dev × violation | UI hiển thị pivot table |
| Top violations theo count, dev affected | 3 ranking khác nhau |

**Artifact:**
- Catalog table (Excel) với 12 violation codes + label_vi + detection_sql + severity
- Test scenario doc: cách tạo MR test cho mỗi violation

---

### 4.3 F-QA-03 — Triage Queue

| Tiêu chí | Cách verify |
|---|---|
| Sort by score ASC, oldest first | MR score 30 ở trên MR score 80 |
| Highlight age > 24h | Visual indicator |
| Click iid mở GitLab tab mới | Verify URL đúng |
| Filter mặc định: created < 48h | Default time window |

**Artifact:** UAT scenario: QA Engineer triage 10 MR trong 5 phút, ghi nhận usability issues.

---

### 4.4 F-QA-04 — Compliance Trend Reporting

| Tiêu chí | Cách verify |
|---|---|
| Pass/Warn/Fail rate 8 tuần | 3 series không overlap |
| Reference line 80% | Hiển thị |
| Histogram score distribution | 5 buckets |
| Slack alert khi fail_rate > 25% | Test trigger |

**Artifact:**
- Sample weekly report PDF (auto-generated) cho QA Manager
- Sample Slack alert message

---

### 4.5 F-QA-05 — Developer Coaching Profile

| Tiêu chí | Cách verify |
|---|---|
| Trend 12 tuần per dev | Line chart |
| Top violations của dev vs team avg | So sánh side-by-side |
| 50 MR gần nhất với score | Table |
| Trend label IMPROVING/STABLE/DECLINING | Verify với 3 dev có pattern khác nhau |
| Disclaimer "không dùng cho perf review" | UI banner |

**Artifact:** Sample profile cho 3 dev (1 IMPROVING, 1 STABLE, 1 DECLINING).

---

### 4.6 F-QA-06 — Single MR Audit

| Tiêu chí | Cách verify |
|---|---|
| 10 dòng tiêu chí với earned/max | Pick 1 MR score 63 → audit page show breakdown |
| Trace back to source data | "View raw" link mở JSON modal |
| Total = sum 10 criteria | Math correct |

**Artifact:** Sample audit page cho 5 MR có score khác nhau (100, 80, 60, 40, 0).

---

### 4.7 F-QA-07 — Project Health Scorecard

| Tiêu chí | Cách verify |
|---|---|
| N rows × 7 cột | Mỗi project 1 dòng |
| composite_grade | RED khi có ≥ 2 metric đỏ |
| Sort by grade | RED ở trên đầu |

**Artifact:** Screenshot scorecard tất cả active projects (sample).

---

### 4.8 F-QA-08 — Real-time Alert

| Tiêu chí | Cách verify |
|---|---|
| BLOCKER trên main → Slack ngay | Tạo MR test với CI fail → check Slack trong 5 phút |
| Dedup 24h | Update cùng MR → không alert lại |
| Max 10 violations/message | Trigger 15 violations cùng lúc → 2 messages |
| Format: link, list violations, score, author tag | Verify text format |

**Artifact:**
- Sample Slack messages (5 scenarios)
- Alert log table (timestamp, MR, channel, status)

---

### 4.9 F-QA-09 — Formula Transparency

| Tiêu chí | Cách verify |
|---|---|
| Reference table 10 tiêu chí | Match với compliance_spec |
| Pass rate per criterion (worst-first) | Sort ASC |
| Points lost per criterion | Identify high-impact criteria |
| Heatmap criterion × project | Cross-dimension view |
| Detection flag distribution | Phát hiện extraction bug |

**Artifact:** "Formula book" — tài liệu giải thích từng tiêu chí + công thức cho dev.

---

### 4.10 F-QA-10 — Long Commit Detection

| Tiêu chí | Cách verify |
|---|---|
| List commits message > 500 chars | Manual count trên 1 project |
| Aggregate by dev | Count + latest_occurrence |
| Note về Push Rules | UI banner |

**Artifact:** Báo cáo 1 lần / tháng cho QA Lead.

---

## 5. Acceptance Criteria chi tiết — Cross-cutting (CC)

### 5.1 F-CC-01 — Multi-dimensional Filter

| Tiêu chí | Cách verify |
|---|---|
| 5 dimensions: time, project, dept, team, role, dev | Tất cả filter hoạt động |
| Filter persist qua session | Reload không mất filter |
| Share URL có filter applied | Copy URL → mở tab mới → filter giống nguyên |
| Type-ahead search dev | < 200ms response |

**Artifact:** UAT script cho 10 filter combinations.

---

### 5.2 F-CC-02 — User Dimension Management

| Tiêu chí | Cách verify |
|---|---|
| Auto-import từ GitLab Members | ≥ 95% users được import |
| CSV upload mapping | Test với file 100 rows |
| Preview matched count | Hiển thị "85/100 matched, 15 unmatched" |
| Unassigned fallback | Dev không có mapping → "Unassigned" trên dashboard |
| Email private (NULL) → fallback username/name | Verify với 3 users private email |

**Artifact:**
- Sample CSV template
- Mapping admin UI screenshot
- Reconciliation: 50 users mapped vs unmapped

---

### 5.3 F-CC-03 — Data Freshness Monitor

| Tiêu chí | Cách verify |
|---|---|
| Banner top mọi page | Visible always |
| Per-source lag (MR/Commit/Pipeline) | 3 cards riêng |
| Color rules: green<2h, amber<24h, red≥24h | Threshold đúng |
| Slack alert nếu > 24h | Disconnect mock → alert fire |

**Artifact:** Alert log (test): 5 incidents stale → 5 Slack messages.

---

### 5.4 F-CC-04 — Drill-down Navigation

| Tiêu chí | Cách verify |
|---|---|
| 2+ levels depth | Aggregate → MR list → MR detail |
| Breadcrumb back-navigation | Click breadcrumb → quay lại đúng filter state |
| Cross-filter (click 1 chart filter chart khác) | Optional: nice-to-have |

**Artifact:** UX flow diagram cho 5 user journeys (QA triage, EM weekly review, etc.)

---

## 6. Artifacts bàn giao tổng thể

Khi sản phẩm đến mốc release, team dev phải bàn giao **đầy đủ** các artifact sau:

### 6.1 Documentation Artifacts

| # | Artifact | Định dạng | Người chịu trách nhiệm |
|---|---|---|---|
| 1 | PRD đã ký nghiệm thu | PDF | PO (đã có: PRD-Features-DORA-Compliance.md) |
| 2 | User Manual cho QA Engineer | Markdown / Confluence | Tech Writer + Dev Lead |
| 3 | User Manual cho Engineering Manager | Markdown / Confluence | Tech Writer + Dev Lead |
| 4 | Admin Guide (config violation, mapping user) | Markdown | Dev Lead |
| 5 | Operations Runbook (xử lý sự cố) | Markdown (đã có: docs/ops/ops_runbook.md) | DevOps |
| 6 | Glossary chính thức | Markdown (đã có trong PRD §13) | PO |
| 7 | Compliance Spec v1.4 (formula reference) | YAML (đã có: compliance_spec.yaml) | QA Lead |
| 8 | Dashboard Catalog (mô tả từng chart) | Markdown (đã có: docs/guides/dashboard_catalog.md) | Dev Lead |

### 6.2 Test & Quality Artifacts

| # | Artifact | Mục đích |
|---|---|---|
| 9 | Test Plan tổng thể (UAT script) | PO ký nghiệm thu |
| 10 | Reconciliation Report (5 MR × 5 project × 5 dev mẫu) | Chứng minh data accuracy |
| 11 | Edge Case Test Report (NULL, empty, race conditions) | Chứng minh robustness |
| 12 | Performance Test Report (load time mỗi dashboard) | Đảm bảo < 5s |
| 13 | Security/Permission Audit (ai xem được gì) | Đảm bảo Dev không xem MR người khác (nếu out-of-scope) |
| 14 | Browser Compatibility Report (Chrome, Firefox, Edge, Safari) | UX consistent |

### 6.3 Operational Artifacts

| # | Artifact | Mục đích |
|---|---|---|
| 15 | Deployment Checklist | Quy trình release |
| 16 | Rollback Plan | Khi release fail |
| 17 | Monitoring Dashboard (system health) | Track health của chính sản phẩm |
| 18 | SLO/SLA Definition | Data freshness 99% < 2h, dashboard uptime 99.5% |
| 19 | Alert Runbook (mỗi alert có troubleshooting steps) | On-call team dùng |
| 20 | Backup & Recovery Procedure | Data resilience |

### 6.4 Demo & Training Artifacts

| # | Artifact | Mục đích |
|---|---|---|
| 21 | Demo Video (15-20 phút, tổng quan sản phẩm) | Onboarding new users |
| 22 | Training Deck (slide cho 4 personas) | Roll-out training |
| 23 | FAQ document | Self-service |
| 24 | Sample Reports (weekly compliance, monthly DORA, quarterly executive) | Template cho stakeholders |

### 6.5 Configuration Artifacts

| # | Artifact | Mục đích |
|---|---|---|
| 25 | Threshold Configuration File | Đổi threshold không cần deploy |
| 26 | Compliance Spec File | Đổi violation rules không cần code |
| 27 | User Mapping CSV Template | QA Lead/HR tự maintain |
| 28 | Alert Channel Configuration | Slack channels cho từng severity |

---

## 7. Quality Gates — Phải pass trước khi GO-LIVE

| Gate | Tiêu chí | Threshold |
|---|---|---|
| **G1: Functional** | Acceptance criteria coverage | 100% features trong PRD |
| **G2: Data Accuracy** | Reconciliation sai lệch | ≤ 2% trên 25 mẫu kiểm tra |
| **G3: Performance** | Dashboard load time (P95) | ≤ 5 giây |
| **G4: Reliability** | Uptime trên staging 30 ngày | ≥ 99.5% |
| **G5: Data Freshness** | Sync lag (P95) | ≤ 2 giờ |
| **G6: Security** | Permission audit | 0 critical findings |
| **G7: UX** | Usability test với 3 QA Engineer + 2 EM | ≥ 80% task completion < 2 phút |
| **G8: Documentation** | Artifacts §6 | 28/28 đã bàn giao |
| **G9: Training** | Train-the-trainer session | Hoàn thành cho ≥ 1 QA Lead + 1 EM |
| **G10: Adoption Plan** | Rollout schedule có buy-in từ stakeholder | EM + QA Lead + Dev Lead ký |

> Sản phẩm chỉ GO-LIVE khi 10/10 gates đều PASS. Gate fail nào → blocker cho release.

---

## 8. Sign-off Process

### 8.1 Cấp độ feature

```
Dev Lead → QA Lead → PO ký nghiệm thu từng feature
```

Form mẫu:
```
Feature ID: F-DORA-01
Demo date: YYYY-MM-DD
Attendees: PO, QA Lead, EM, Dev Lead
Acceptance criteria: PASS / PARTIAL / FAIL
Reconciliation result: X/Y samples match
Open issues: [list nếu có]
Sign-off: PO signature
```

### 8.2 Cấp độ release

```
PO → Engineering Manager → Stakeholder Committee
```

Sign-off bao gồm:
- 28/28 artifacts đã bàn giao
- 10/10 quality gates PASS
- Rollback plan đã được approve
- Communication plan cho user community

### 8.3 Post-release acceptance (30 ngày sau go-live)

PO sẽ đo lường adoption + outcome:

| Metric | Target sau 30 ngày |
|---|---|
| Daily active users (QA + EM) | ≥ 5 unique users/day |
| Dashboard view count | ≥ 100 views/day |
| Slack alert response time (median) | ≤ 4 giờ |
| User satisfaction (CSAT survey) | ≥ 4/5 |
| Critical bug count | 0 |
| Data freshness incident count | ≤ 2 |

Nếu sau 30 ngày target không đạt → Retrospective + Action plan với team dev.

---

## 9. UAT Scenarios — Kịch bản nghiệm thu

### Scenario 1: QA Engineer Daily Triage

```
Persona: QA Engineer
Goal: Triage MR vi phạm trong vòng 10 phút
Steps:
  1. Mở dashboard Collection A
  2. Xem Active Violations Feed → đếm số MR fail
  3. Click MR có score thấp nhất → đọc breakdown
  4. Comment trên GitLab MR + Slack mention author
  5. Mark MR là "đã contact" (nếu có feature note)
Pass criteria:
  - Hoàn thành 10 MR trong 10 phút
  - Không cần switch tab > 3 lần / MR
  - Information đủ để comment có nội dung (không phải chỉ "fix it")
```

### Scenario 2: EM Weekly Review

```
Persona: Engineering Manager
Goal: Chuẩn bị weekly report 30 phút
Steps:
  1. Mở DORA Maturity Scorecard → identify project Low
  2. Drill-down Lead Time chart → tìm bottleneck
  3. Mở Cycle Time Breakdown → tìm stage stuck
  4. Export bảng → paste vào weekly slide
Pass criteria:
  - Hoàn thành trong 30 phút
  - Số liệu match GitLab khi cross-check
```

### Scenario 3: QA Manager Monthly Report

```
Persona: QA Manager
Goal: Tạo monthly compliance report
Steps:
  1. Filter time range = last month
  2. Capture Compliance Trend chart (8 tuần)
  3. Capture Top Violation Types
  4. Capture Heatmap dev × violation
  5. Identify top 3 dev cần coaching
Pass criteria:
  - Report dùng được cho stakeholder review
  - Action items rõ ràng (3 dev cần coaching, 2 violation cần workshop)
```

### Scenario 4: Developer Self-service

```
Persona: Developer
Goal: Tự audit MR của mình
Steps:
  1. Mở Single MR Audit
  2. Nhập MR iid của mình
  3. Xem breakdown 10 tiêu chí
  4. Identify tiêu chí FAIL → đọc tooltip → fix
Pass criteria:
  - Hiểu được vì sao bị trừ điểm trong 2 phút
  - Có actionable info để fix
```

### Scenario 5: Admin Update Compliance Rule

```
Persona: QA Lead
Goal: Thêm 1 tiêu chí mới (vd: tickets phải link Confluence)
Steps:
  1. Edit compliance_spec config file
  2. Run dry-run preview
  3. Apply changes
  4. Verify dashboard reflects new criterion
Pass criteria:
  - Không cần dev intervention
  - Total score vẫn = 100 (hoặc theo plan re-distribute)
  - Lịch sử score được preserve
```

---

## 10. Risk-based Testing Priority

| Priority | Tiêu chí | Lý do |
|---|---|---|
| **P0 (must test)** | F-QA-01 (Scoring), F-QA-08 (Alert), F-DORA-02 (Lead Time) | Trực tiếp ảnh hưởng quyết định + data accuracy |
| **P1 (should test)** | F-QA-04 (Trend), F-DORA-04 (MTTR), F-CC-02 (Dim user) | Stakeholder reporting + user identity |
| **P2 (nice to test)** | F-DORA-08 (AI), F-QA-10 (Long commit), F-CC-04 (Drill-down) | Auxiliary, có fallback nếu fail |

---

## 11. Reconciliation Sample Plan (Bắt buộc khi nghiệm thu)

Để chứng minh data accuracy, team dev phải submit **Reconciliation Spreadsheet** với:

### 11.1 MR-level

| MR iid | Project | Manual score | UI score | Diff | Notes |
|---|---|---|---|---|---|
| !101 | proj-a | 85 | 85 | 0 | |
| !102 | proj-b | 60 | 62 | 2 | Coverage delta tính lệch nhẹ |
| ... (≥ 25 mẫu) | | | | | |

**Pass threshold:** ≥ 95% rows có |Diff| ≤ 5

### 11.2 DORA-level

| Project | Week | Manual deploy_freq | UI deploy_freq | Diff | Notes |
|---|---|---|---|---|---|
| proj-a | W12 | 8 | 8 | 0 | |
| proj-a | W11 | 5 | 5 | 0 | |
| ... (≥ 20 mẫu) | | | | | |

**Pass threshold:** 100% match (DORA là count, không có rounding)

### 11.3 Identity Mapping

| Username | Manual department | UI department | Match |
|---|---|---|---|
| trungtt22 | Engineering | Engineering | ✓ |
| ... (≥ 30 mẫu) | | | |

**Pass threshold:** ≥ 95% match (cho phép Unassigned cho user mới)

---

## 12. Continuous Acceptance — Sau go-live

PO sẽ duy trì **monthly acceptance review** với checklist:

- [ ] Số liệu vẫn accuracy (re-run 5 mẫu reconciliation)
- [ ] Không có regression về performance
- [ ] User satisfaction survey vẫn ≥ 4/5
- [ ] Backlog issue cao priority đã được xử lý
- [ ] Dashboard adoption tăng hoặc stable
- [ ] Compliance pass rate trend đúng hướng (tăng hoặc stable, không suy giảm)

---

## 13. Escalation Path

| Tình huống | Escalate đến |
|---|---|
| Acceptance criteria fail trong UAT | Dev Lead → fix trong 5 ngày |
| Data accuracy < 95% reconciliation | Dev Lead + Tech Lead → root cause + fix |
| Quality gate fail | Engineering Manager → re-plan release |
| User complaint > 5 ticket / tuần | PO → review priorities |
| Critical bug production | On-call → Healer auto-retry → manual escalate nếu fail 3x |

---

*Tài liệu này là source of truth cho tiêu chí nghiệm thu. Mọi tranh chấp về "đã DONE chưa" tham chiếu tài liệu này.*

*— PO, ENG-ANA-001, 2026-04-30*
