---
type: compliance-index
audience: ai-agent
purpose: code-generation
authoritative: true
language: vi
last_updated: 2026-04
---

# Compliance Rules — Master Index cho AI Agent

> Đây là **entry point** cho toàn bộ compliance. AI Agent đọc file này TRƯỚC để biết load file rule chi tiết nào theo task.

---

## 📚 Toàn bộ bộ tài liệu

```
compliance/
├── 00_INDEX.md                       ← BẠN ĐANG ĐỌC FILE NÀY
├── 01_MR_Compliance.md               ← Quy tắc Merge Request, commit, branch
├── 02_Naming_Microservice.md         ← Naming convention service / DB / table
├── 03_API_Naming.md                  ← Endpoint, path, HTTP method, query
├── 04_API_Response_and_Error.md      ← Response structure + Error code catalog
├── 05_API_Timeout.md                 ← Timeout config, cancellation, retry
└── 06_Coding_Convention.md           ← Coding convention (ưu tiên .NET, naming/format/comment)
```

| File | Source gốc | Phạm vi |
|---|---|---|
| `01_MR_Compliance.md` | MR_Compliance_Guide v1.6 | Branch, commit, MR description, AI disclosure |
| `02_Naming_Microservice.md` | Naming Convention v2.0.0 (Telco ISP) | Service name, DB, table/collection, column/field, event |
| `03_API_Naming.md` | API Naming Convention ISC | REST endpoint, path, method, query, OpenAPI |
| `04_API_Response_and_Error.md` | API Response + Error Code Guideline ISC | Response wrapper, error structure, catalog mã lỗi |
| `05_API_Timeout.md` | API Timeout Configuration ISC | Timeout per layer, retry, cancellation, log |
| `06_Coding_Convention.md` | Coding Convention ISC (.NET) | Naming, folder, format, comment, error handling, testing |

---

## 🎯 Decision tree — Agent load file nào?

> Match task → load file tương ứng. CÓ THỂ load nhiều file cho 1 task phức tạp.

### A. Task liên quan Git / MR
- Tạo branch mới → `01_MR_Compliance.md` (R-BRANCH)
- Viết commit message → `01_MR_Compliance.md` (R-COMMIT)
- Tạo MR description → `01_MR_Compliance.md` (R-MR)
- Self-check trước push → `01_MR_Compliance.md` (R-MR-CHECKLIST)

### B. Task liên quan kiến trúc & data model
- Đặt tên service mới → `02_Naming_Microservice.md` (R-SVC)
- Tạo SQL schema / migration → `02_Naming_Microservice.md` (R-SQL)
- Tạo MongoDB collection → `02_Naming_Microservice.md` (R-MONGO)
- Đặt tên domain event → `02_Naming_Microservice.md` (R-EVENT)
- Cross-service reference → `02_Naming_Microservice.md` (R-CROSS)
- Chọn engine (SQL vs Mongo) → `02_Naming_Microservice.md` (R-DECISION)

### C. Task liên quan API design
- Thiết kế REST endpoint mới → `03_API_Naming.md`
- Đặt tên path / chọn HTTP method → `03_API_Naming.md` (R-API-PATH, R-API-METHOD)
- Query parameter, pagination → `03_API_Naming.md` (R-API-QUERY)
- Viết file OpenAPI YAML → `03_API_Naming.md` (R-API-OPENAPI)

### D. Task liên quan code response / error
- Code controller, return result → `04_API_Response_and_Error.md` (R-RESP-STRUCTURE)
- Throw / handle error → `04_API_Response_and_Error.md` (R-ERROR-CATEGORY)
- Chọn / thêm error code → `04_API_Response_and_Error.md` (R-ERROR-CODE, R-ERROR-CATALOG)
- Mapping HTTP status → `04_API_Response_and_Error.md` (R-HTTP-STATUS)

### E. Task liên quan I/O / external call
- Setup HTTP / gRPC client → `05_API_Timeout.md` (R-TIMEOUT-MUST, R-TIMEOUT-VALUE)
- Cấu hình env timeout → `05_API_Timeout.md` (R-TIMEOUT-CONFIG)
- Implement retry logic → `05_API_Timeout.md` (R-TIMEOUT-VALUE-002, R-TIMEOUT-VALUE-003)
- Handle timeout error response → `05_API_Timeout.md` (R-TIMEOUT-RESPONSE) + `04_API_Response_and_Error.md`

### F. Task liên quan code style / naming / format
- Đặt tên class / method / variable / file → `06_Coding_Convention.md` (naming)
- Format code, indent, line length → `06_Coding_Convention.md` (format)
- Viết comment / XML doc → `06_Coding_Convention.md` (comment)
- Folder / namespace structure → `06_Coding_Convention.md` (folder)
- Error handling pattern (try/catch, exception) → `06_Coding_Convention.md` (error handling) + `04_API_Response_and_Error.md`
- Test naming / structure → `06_Coding_Convention.md` (testing) + `01_MR_Compliance.md / R-TEST`

---

## 🌐 Severity & Tier — định nghĩa CROSS-CUTTING

> Định nghĩa này xuyên suốt cả 5 file. Mỗi rule trong file detail có severity + tier riêng.

### Severity (mức độ vi phạm)

| Mức | Hành xử của Agent |
|---|---|
| **BLOCKER** | Tuyệt đối không generate output vi phạm. Block ngay, báo human. |
| **REQUIRED** | Cảnh báo human, xin confirm trước khi tiếp tục. |
| **GOOD_PRACTICE** | Note trong commit message, không block. |

### Tier (tầng kiểm tra)

| Tier | Ý nghĩa |
|---|---|
| **AUTO_GATE** | CI/GitLab tự enforce. Agent code đúng để pipeline pass. |
| **DEV_SELF_CHECK** | Agent (đóng vai dev) PHẢI verify trước khi submit MR. |
| **REVIEWER_VERIFY** | Human review. Agent generate đúng để giảm gánh nặng. |

---

## 🔄 Workflow tổng — Code generation lifecycle

> Workflow đầy đủ khi agent thực hiện task end-to-end. Mỗi bước reference rule từ file detail.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. NHẬN task → xác định loại                                    │
│    - Feature mới?                                                │
│    - Bug fix?                                                    │
│    - Refactor?                                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. TẠO BRANCH                                                    │
│    → 01_MR_Compliance.md / R-BRANCH-001                          │
│    Format: feature/{slug} | bugfix/{slug} | hotfix/{slug}        │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. THIẾT KẾ (nếu là feature mới)                                │
│                                                                  │
│    a. Service mới?                                               │
│       → 02_Naming_Microservice.md / R-SVC-*                      │
│       Chọn engine: → R-DECISION                                  │
│                                                                  │
│    b. Schema/DB?                                                 │
│       → SQL: R-SQL-DB, R-SQL-OBJ                                 │
│       → MongoDB: R-MONGO-DB, R-MONGO-OBJ                         │
│                                                                  │
│    c. API endpoint?                                              │
│       → 03_API_Naming.md / R-API-PATH, R-API-METHOD              │
│       Sinh OpenAPI YAML: R-API-OPENAPI                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. IMPLEMENT                                                     │
│                                                                  │
│    a. Code controller / handler                                  │
│       → 04_API_Response_and_Error.md / R-RESP-STRUCTURE          │
│       → Field naming: R-RESP-FIELD-001 (snake_case)              │
│                                                                  │
│    b. Error handling                                             │
│       → 04_API_Response_and_Error.md / R-ERROR-CATEGORY          │
│       → Phân biệt nghiệp vụ (return) vs kỹ thuật (throw)         │
│       → Chọn / thêm error code: R-ERROR-CODE                     │
│                                                                  │
│    c. External / DB / cache call                                 │
│       → 05_API_Timeout.md / R-TIMEOUT-MUST, R-TIMEOUT-VALUE      │
│       → Cấu hình env: R-TIMEOUT-CONFIG-001                       │
│       → Cancellation: R-TIMEOUT-CANCEL-001                       │
│                                                                  │
│    d. Cross-service event publish                                │
│       → 02_Naming_Microservice.md / R-EVENT-001 (PascalCase past)│
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. TEST                                                          │
│    → 01_MR_Compliance.md / R-TEST-001 (unit test cho biz logic) │
│    → R-TEST-002 (lint local pass)                                │
│    → R-TEST-003 (unit test local pass)                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. SELF-CHECK trước commit                                       │
│    → 01_MR_Compliance.md / R-CODE-001..005                       │
│    - Không debug code, hardcoded secret, log PII                 │
│    - Input validation, no SQL inject                             │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. COMMIT                                                        │
│    → 01_MR_Compliance.md / R-COMMIT-001 (Conventional Commits)   │
│    → R-COMMIT-002-AI ([AI] tag nếu dùng AI)                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. REBASE & PUSH                                                 │
│    → 01_MR_Compliance.md / R-MR-006-REBASED                      │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. TẠO MR                                                        │
│    → 01_MR_Compliance.md / R-MR-002 (8 section)                  │
│    → R-MR-003 (AI Disclosure mutually exclusive)                 │
│    → R-MR-CHECKLIST (6 self-check items)                         │
│    → R-MR-001-LOC (kiểm tra LOC trong ngưỡng)                    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. AUTO-GATES & REVIEWER                                         │
│     → CI pipeline pass (R-AUTOGATE)                              │
│     → Reviewer approve                                           │
│     → Merge                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Cross-cutting rules — Rule áp dụng xuyên file

Một số rule xuất hiện nhiều file vì chúng cross-domain. Để dễ tra cứu:

### Cross-cutting #1 — Field naming
| Context | Convention | File detail |
|---|---|---|
| SQL column | `snake_case` | `02 / R-SQL-OBJ-002` |
| MongoDB field | `camelCase` | `02 / R-MONGO-OBJ-002` |
| API request/response field | `snake_case` | `04 / R-RESP-FIELD-001` |
| API query param | `snake_case` | `03 / R-API-QUERY-001` |
| API path | `kebab-case` | `03 / R-API-PATH-002` |
| Service name | `kebab-case-svc` | `02 / R-SVC-001` |
| Domain event | `PascalCase` past tense | `02 / R-EVENT-001` |
| Branch name | `kebab-case` (sau prefix) | `01 / R-BRANCH-001` |
| Env variable | `UPPER_SNAKE_CASE` | `05 / R-TIMEOUT-CONFIG-001` |

### Cross-cutting #2 — trace_id / request_id
| Context | Yêu cầu | File detail |
|---|---|---|
| Mọi response | Bắt buộc có trong `meta` | `04 / R-RESP-META-001` |
| Log timeout | Bắt buộc có | `05 / R-TIMEOUT-LOG-001` |
| Log error | Bắt buộc có | `04 / R-ERROR-CATEGORY-004` |

### Cross-cutting #3 — UUID làm ID
| Context | Yêu cầu | File detail |
|---|---|---|
| SQL primary key | `id UUID DEFAULT gen_random_uuid()` | `02 / R-SQL-OBJ-003` |
| Cross-service ref | UUID, KHÔNG có FK thật | `02 / R-CROSS-001, R-CROSS-002` |
| MongoDB `_id` | ObjectId hoặc UUID string | `02 / R-MONGO-OBJ-003` |

### Cross-cutting #4 — AI Disclosure
| Context | Yêu cầu | File detail |
|---|---|---|
| Commit có AI hỗ trợ | Tag `[AI]` cuối subject | `01 / R-COMMIT-002-AI` |
| MR description | AI Disclosure section, mutually exclusive | `01 / R-MR-003-AI-DISCLOSURE` |

---

## ⚖️ Conflict resolution — Khi rule mâu thuẫn

Thứ tự ưu tiên khi 2 rule mâu thuẫn:

1. **BLOCKER thắng REQUIRED thắng GOOD_PRACTICE** — severity cao hơn thắng.
2. **Rule cụ thể (specific) thắng rule chung (generic)** — vd: rule về MongoDB collection thắng rule chung về "tên dùng snake_case".
3. **File số lớn hơn KHÔNG mặc định thắng** — không có hierarchy theo số file. Cần evaluate theo nội dung.
4. **Khi vẫn không rõ** → Agent BLOCK, báo human, KHÔNG tự quyết.

Ví dụ thực tế:
- "API path dùng `kebab-case` (R-API-PATH-002)" vs "Field naming snake_case" — KHÔNG mâu thuẫn vì khác context (path vs field).
- "MongoDB collection `camelCase` (R-MONGO-OBJ-001)" vs "API response field `snake_case` (R-RESP-FIELD-001)" — KHÔNG mâu thuẫn vì DB lưu camelCase nhưng serializer convert sang snake_case ở response layer.

---

## 🧰 Quick reference — Cheat sheet xuyên 5 file

### Naming nhanh

| Layer | Convention | File |
|---|---|---|
| Branch | `feature/auth-add-login` | `01` |
| Commit | `feat(auth): add login flow [AI]` | `01` |
| Service | `billing-svc` | `02` |
| SQL DB | `billing_db` | `02` |
| SQL table | `charge_items` | `02` |
| SQL column | `customer_id` | `02` |
| Mongo DB | `product_catalog` | `02` |
| Mongo collection | `products`, `chargeItems` | `02` |
| Mongo field | `customerId` | `02` |
| API path | `/users/{id}/reset-password` | `03` |
| API query | `?page_size=20` | `03` |
| Response field | `user_id`, `created_at` | `04` |
| Error code | `INVALID_OTP`, `AUTH_401` | `04` |
| Event | `OrderCreated` | `02` |
| Env timeout | `API_TIMEOUT_PAYMENT=2000` | `05` |

### BLOCKER tuyệt đối — TUYỆT ĐỐI không vi phạm

| Rule | File | Mô tả |
|---|---|---|
| R-CODE-001..005 | `01` | Debug code, secret, PII log, no validate input, SQL inject |
| R-COMMIT-001 | `01` | Commit không theo Conventional Commits |
| R-SVC-002 | `02` | Service name chứa tên DB engine |
| R-CROSS-001 | `02` | FK cross-service trong SQL |
| R-CROSS-003 | `02` | `$lookup` cross-service trong Mongo |
| R-API-PATH-003 | `03` | Verb CRUD trong API path |
| R-API-METHOD-001 | `03` | HTTP method sai semantic |
| R-RESP-STRUCTURE-001 | `04` | Response thiếu wrapper 4 field |
| R-RESP-STRUCTURE-002 | `04` | Vi phạm invariant success/error/data |
| R-ERROR-CATEGORY-001..003 | `04` | Phân loại lỗi sai, throw cho lỗi nghiệp vụ |
| R-ERROR-CODE-002 | `04` | Hardcode error code literal |
| R-TIMEOUT-MUST-001 | `05` | I/O call không có timeout |
| R-TIMEOUT-VALUE-002 | `05` | Total retry > caller timeout |
| R-TIMEOUT-VALUE-003 | `05` | Retry vô hạn |
| R-TIMEOUT-CONFIG-001 | `05` | Hardcode timeout value |

---

## 📥 Hành vi load tài liệu của Agent

### Khi bắt đầu task mới
1. **LUÔN load `00_INDEX.md` (file này) trước** để map task → file detail
2. Match task vào Decision Tree (mục 🎯)
3. Load các file detail tương ứng (1 hoặc nhiều)
4. Bắt đầu làm việc

### Khi gặp tình huống không rõ
1. Tra Cross-cutting rules (mục 🔗) trước
2. Không có → tra Conflict resolution (mục ⚖️)
3. Vẫn không rõ → BLOCK, báo human

### Khi hoàn thành 1 bước
- Đối chiếu với Workflow tổng (mục 🔄) để đảm bảo không bỏ bước
- Đặc biệt: bước 6 (Self-check) trước commit, bước 9 (MR) đầy đủ 8 section

---

## 🔄 Maintenance

- **Nguyên tắc**: Mỗi file detail có owner riêng, có thể update độc lập
- **Khi update**: Cập nhật `last_updated` ở front-matter của file đó VÀ ở INDEX này
- **Khi thêm file mới**: Update mục 📚 và Decision tree (mục 🎯) ở INDEX
- **Conflict mới phát sinh**: Update mục ⚖️ Conflict resolution

---

*INDEX này là entry point bắt buộc cho mọi AI Agent dùng bộ compliance này. Mọi rule chi tiết nằm trong file detail tương ứng.*
