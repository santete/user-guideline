# 📊 Product Requirement Document (PRD)

## Dev Performance & QA Compliance Dashboard (GitLab-based, DORA-aligned)

---

# 🎯 1. Overview

## 1.1 Mục tiêu sản phẩm

Xây dựng một hệ thống dashboard tập trung để:

* Đo lường hiệu suất phát triển phần mềm theo **DORA metrics**
* Theo dõi hành vi dev dựa trên dữ liệu GitLab
* Kiểm soát **compliance QA** (merge rule, convention)
* Cung cấp insight cho:

  * Engineering Manager
  * QA Lead
  * Dev Lead
  * PO

---

## 1.2 Problem Statement

Hiện tại:

* Không có hệ thống đo lường chuẩn hóa hiệu suất dev
* Dữ liệu GitLab chưa được khai thác đúng
* QA khó kiểm soát việc tuân thủ quy trình (merge, branch, commit)
* Không có visibility về:

  * lead time
  * failure rate
  * quality

---

## 1.3 Goals

* Chuẩn hóa đo lường theo DORA
* Tăng visibility toàn hệ thống
* Giảm lỗi do process không tuân thủ
* Hỗ trợ ra quyết định dựa trên dữ liệu

---

# 🧠 2. Scope

## 2.1 In Scope

* Dashboard DORA metrics
* Tracking activity GitLab
* QA compliance rules
* Alert vi phạm
* Drill-down theo:

  * team
  * project
  * developer

---

## 2.2 Out of Scope (Phase 1)

* Code quality static analysis
* AI prediction
* Cross-repo analytics nâng cao

---

# 📊 3. Key Metrics (DORA-based)

## 3.1 Deployment Frequency

* Số lần deploy / ngày / tuần
* Theo project / team

---

## 3.2 Lead Time for Changes

* Thời gian từ:

```text
commit → merge → deploy
```

---

## 3.3 Change Failure Rate

* % deploy gây lỗi
* Mapping:

```text
failed pipeline / rollback / hotfix
```

---

## 3.4 MTTR (Mean Time to Recovery)

* Thời gian từ:

```text
incident → resolved
```

---

# 📈 4. GitLab Activity Metrics

## 4.1 Commit Metrics

* số commit / dev
* commit frequency
* commit size (lines changed)

---

## 4.2 Merge Request (MR)

* thời gian open → merge
* số lần review
* số lần rework

---

## 4.3 Pipeline Metrics

* pass rate
* failure rate
* duration

---

# 🧩 5. QA Compliance Metrics

## 5.1 Merge Rule Compliance

### Rules:

* bắt buộc code review ≥ 1
* không merge trực tiếp vào main
* pipeline phải pass

### Metrics:

* % MR vi phạm
* số lần bypass rule

---

## 5.2 Branch Convention

### Rules:

```text
feature/*
bugfix/*
hotfix/*
```

### Metrics:

* % branch sai format

---

## 5.3 Commit Convention

### Rules:

```text
feat:
fix:
chore:
```

### Metrics:

* % commit sai format

---

## 5.4 PR Quality

* thiếu description
* không link ticket
* không có reviewer

---

# 🏗️ 6. System Architecture

```text
GitLab API / Webhook
        ↓
Data Ingestion Service
        ↓
Data Processing / Aggregation
        ↓
Metrics Engine
        ↓
Dashboard API
        ↓
Frontend Dashboard
```

---

# ⚙️ 7. Functional Requirements

## 7.1 Data Ingestion

* pull data từ GitLab API
* support webhook (real-time)

---

## 7.2 Metrics Engine

* tính toán DORA metrics
* tính compliance metrics

---

## 7.3 Dashboard

* hiển thị:

  * overview
  * team view
  * dev view
* filter:

  * time range
  * project
  * team

---

## 7.4 Alert System

* cảnh báo khi:

  * violation threshold vượt mức
  * failure rate tăng

---

## 7.5 Drill-down

* từ tổng quan → chi tiết từng MR / commit

---

# 🖥️ 8. UI/UX Requirements

## 8.1 Dashboard Overview

* 4 DORA metrics (card view)
* trend chart

---

## 8.2 Compliance Panel

* violation rate
* top violators

---

## 8.3 Developer Performance View

* activity timeline
* MR stats
* compliance score

---

## 8.4 QA View

* danh sách MR vi phạm
* filter theo rule

---

# 📄 9. Data Model (High-level)

## Entities:

* Project
* Developer
* Commit
* MergeRequest
* Pipeline
* Deployment
* Incident

---

# 🔐 10. Security & Access Control

* Role-based:

  * Admin
  * QA
  * Manager
  * Dev
* Mask sensitive data

---

# 📊 11. KPI / Success Metrics

* 100% project onboard
* ≥ 90% MR comply rule
* giảm 30% failure rate
* giảm 20% lead time

---

# ⚠️ 12. Risks & Mitigation

| Risk                  | Mitigation                 |
| --------------------- | -------------------------- |
| Data không chính xác  | validate + retry           |
| Dev phản ứng tiêu cực | minh bạch + explain metric |
| Metric bị “gaming”    | audit + multiple signals   |

---

# 🚀 13. Roadmap

## Phase 1 – Foundation

* ingest GitLab data
* basic dashboard
* DORA metrics

---

## Phase 2 – Compliance

* QA rule engine
* violation tracking

---

## Phase 3 – Advanced Analytics

* trend analysis
* anomaly detection

---

## Phase 4 – Intelligence

* recommendation
* predictive insight

---

# 🧠 14. Key Insight

> Dashboard này KHÔNG phải để “đánh giá cá nhân dev”
> mà để:
> **tối ưu hệ thống phát triển phần mềm**

---

# 🎯 15. Conclusion

Sản phẩm này sẽ:

* chuẩn hóa cách đo hiệu suất dev
* tăng minh bạch
* giúp QA kiểm soát quy trình
* cải thiện chất lượng delivery

---
