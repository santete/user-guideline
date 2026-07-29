---
type: api-naming-rules
domain: api-design
audience: ai-agent
purpose: code-generation
source: API_Naming_Convention_ISC
authoritative: true
language: vi
last_updated: 2026-04
load_when:
  - thiết kế endpoint mới
  - đặt tên path / method
  - viết OpenAPI YAML
related_files:
  - 04_API_Response_and_Error.md
  - 02_Naming_Microservice.md
---

# API Naming Convention — Tham chiếu cho AI Agent

> File distill từ API Naming Convention ISC. Áp dụng khi thiết kế REST API endpoint, path, HTTP method, query.
> Mỗi rule có ID stable. Vi phạm BLOCKER → từ chối generate. Vi phạm REQUIRED → cảnh báo + xin confirm.

## Nguyên tắc tổng

**RESTful — danh từ số nhiều — không động từ trong path — HTTP method phân biệt CRUD.**

Cấu trúc endpoint chuẩn:

```
/{domain?}/{resource}/{id?}/{action?}
```

- `domain` (optional) — module hoặc nhóm hệ thống (`auth`, `admin`, `public`, `internal`)
- `resource` — danh từ số nhiều (`users`, `orders`, `products`)
- `id` (optional) — UUID hoặc numeric ID của resource cụ thể
- `action` (optional) — chỉ dùng khi nghiệp vụ KHÔNG phải CRUD thuần (`reset-password`, `cancel`, `approve`)

## Mức độ vi phạm

- **BLOCKER** — Tuyệt đối không generate. Vi phạm = code review reject ngay.
- **REQUIRED** — Phải tuân thủ. Reviewer block merge nếu sai.
- **GOOD_PRACTICE** — Khuyến nghị. Tuân nếu có thể.

---

## R-API-PATH: Path naming

### R-API-PATH-001
- **title**: Resource là danh từ số nhiều
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Tên resource trong path PHẢI là danh từ số nhiều, lowercase
- **examples_pass**:
  - `/users`
  - `/orders`
  - `/products`
  - `/categories`
  - `/audit-logs`
- **examples_fail**:
  - `/user` — phải số nhiều
  - `/Users` — không được PascalCase
  - `/user_list` — thừa từ "list"
  - `/getUsers` — không được động từ

### R-API-PATH-002
- **title**: Lowercase + kebab-case trong path
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Path PHẢI lowercase, từ ghép dùng kebab-case (gạch ngang `-`), không dùng underscore `_` hay camelCase
- **pattern**: `^/[a-z0-9-/{}]+$`
- **examples_pass**:
  - `/users/{id}/reset-password`
  - `/audit-logs`
  - `/order-items`
- **examples_fail**:
  - `/users/{id}/resetPassword` — không được camelCase
  - `/users/{id}/reset_password` — không được snake_case (path)
  - `/Users/{id}/ResetPassword` — không được PascalCase

### R-API-PATH-003
- **title**: Cấm động từ trong path
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: TUYỆT ĐỐI KHÔNG dùng động từ CRUD trong path. Dùng HTTP method để phân biệt operation.
- **forbidden_verbs_in_path**: `get`, `create`, `update`, `delete`, `fetch`, `add`, `remove`, `list`
- **examples_fail**:
  - `GET /getUsers` → đúng: `GET /users`
  - `POST /createUser` → đúng: `POST /users`
  - `POST /update-user/{id}` → đúng: `PUT /users/{id}`
  - `DELETE /deleteUser/{id}` → đúng: `DELETE /users/{id}`
  - `GET /fetchOrders` → đúng: `GET /orders`
- **exception**: Action ngoài CRUD được phép có verb (xem R-API-PATH-005), nhưng KHÔNG phải verb CRUD trên.

### R-API-PATH-004
- **title**: Tối đa 3 cấp lồng
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: Path KHÔNG được lồng quá 3 cấp resource. Quá sâu → tách thành endpoint riêng hoặc dùng query param.
- **examples_pass**:
  - `/orders/{id}/items` — 2 cấp ✅
  - `/users/{id}/sessions/{sid}` — 3 cấp ✅
- **examples_fail**:
  - `/users/{uid}/orders/{oid}/items/{iid}/comments` — 4 cấp ❌
- **alternative_for_deep**: Tách `/items/{iid}/comments` thành endpoint riêng `/order-items/{iid}/comments`

### R-API-PATH-005
- **title**: Action endpoint format khi không phải CRUD
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Khi nghiệp vụ KHÔNG ánh xạ được sang CRUD thuần, dùng action endpoint dạng kebab-case sau `/{id}/`
- **format**: `POST /{resource}/{id}/{action-verb}`
- **action_verb_rules**:
  - kebab-case
  - imperative mood (`reset-password`, `cancel`, `approve`, `archive`)
  - không dùng CRUD verb (xem R-API-PATH-003)
- **examples_pass**:
  - `POST /users/{id}/reset-password`
  - `POST /orders/{id}/cancel`
  - `POST /invoices/{id}/send`
  - `PATCH /orders/{id}/status` — đổi trạng thái dùng PATCH
- **examples_fail**:
  - `POST /resetUserPassword/{id}` — verb đứng đầu, không kebab-case
  - `POST /users/{id}/resetPassword` — camelCase

---

## R-API-METHOD: HTTP Method

### R-API-METHOD-001
- **title**: HTTP method ánh xạ đúng CRUD
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: HTTP method PHẢI ánh xạ đúng semantic theo bảng dưới
- **mapping**:
  | Method | Semantic | Path ví dụ |
  |---|---|---|
  | `GET` | Đọc danh sách / chi tiết, idempotent, KHÔNG side effect | `GET /users`, `GET /users/{id}` |
  | `POST` | Tạo mới resource HOẶC trigger action | `POST /users`, `POST /users/{id}/reset-password` |
  | `PUT` | Cập nhật toàn bộ resource (full replace), idempotent | `PUT /users/{id}` |
  | `PATCH` | Cập nhật một phần resource | `PATCH /users/{id}` |
  | `DELETE` | Xóa resource, idempotent | `DELETE /users/{id}` |
- **examples_fail**:
  - `GET /users` trả side effect (vd: ghi log thay đổi state) — vi phạm idempotent
  - `POST /users/{id}` để cập nhật toàn bộ — phải dùng `PUT`
  - `DELETE /users` không có ID — phải có target cụ thể

### R-API-METHOD-002
- **title**: GET không có request body
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: GET request KHÔNG được có request body. Tham số truyền qua path hoặc query string.
- **rationale**: HTTP spec không cấm nhưng nhiều proxy/CDN drop body của GET.

---

## R-API-QUERY: Query parameter

### R-API-QUERY-001
- **title**: Query param dùng snake_case
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Query parameter dùng `snake_case` (KHÁC với path là kebab-case)
- **examples_pass**:
  - `GET /products?category=abc&page_size=20`
  - `GET /logs?trace_id=xyz&level=error`
  - `GET /users/check-email?email=abc@example.com`
- **examples_fail**:
  - `GET /products?pageSize=20` — không được camelCase
  - `GET /products?page-size=20` — query không được kebab-case (path mới dùng)

### R-API-QUERY-002
- **title**: Filtering / search dùng query, không dùng path
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Filter, search, sort, pagination PHẢI qua query string, KHÔNG đưa vào path
- **examples_pass**:
  - `GET /products?status=active&sort=name`
  - `GET /users?page=2&page_size=20`
- **examples_fail**:
  - `GET /products/active` — đưa filter "active" vào path
  - `GET /users/page/2` — đưa pagination vào path

### R-API-QUERY-003
- **title**: Pagination params chuẩn
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Pagination dùng 2 param chuẩn: `page` (1-indexed) và `page_size`
- **examples_pass**: `GET /users?page=1&page_size=20`
- **examples_fail**:
  - `?p=1&size=20` — viết tắt khó hiểu
  - `?offset=0&limit=20` — không phải chuẩn ISC (trừ khi project có lý do dùng cursor-based pagination, phải document)

---

## R-API-VERSION: Versioning

### R-API-VERSION-001
- **title**: Versioning chỉ cho public API
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: Prefix `/api/v1/` CHỈ dùng cho public API hoặc khi có lý do kỹ thuật rõ ràng. KHÔNG lặp prefix cho mọi internal API.
- **examples_pass_public**: `/api/v1/products`, `/api/v2/users`
- **examples_fail_internal**: `/api/v1/internal/jobs` — internal API không cần versioning

### R-API-VERSION-002
- **title**: Versioning format
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Versioning theo path, format `v{N}` (số nguyên), không dùng date hoặc semver trong URL
- **examples_pass**: `/api/v1/`, `/api/v2/`
- **examples_fail**: `/api/v1.2.3/`, `/api/2024-01/`, `/api/V1/`

---

## R-API-DOMAIN: Domain prefix

### R-API-DOMAIN-001
- **title**: Phân module theo domain prefix (dự án lớn)
- **severity**: GOOD_PRACTICE
- **tier**: REVIEWER_VERIFY
- **rule**: Trong dự án nhiều module, dùng domain prefix để phân nhóm rõ ràng
- **common_domains**:
  - `/auth/*` — authentication, OAuth, OTP
  - `/admin/*` — admin-only operations
  - `/public/*` — public-facing API
  - `/internal/*` — service-to-service internal
- **examples_pass**:
  - `POST /auth/login`
  - `GET /admin/users`
  - `GET /public/products`
  - `POST /internal/jobs`

---

## R-API-OPENAPI: OpenAPI documentation

### R-API-OPENAPI-001
- **title**: Mỗi API phải có YAML mô tả OpenAPI 3.0
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: Mỗi endpoint PHẢI có file YAML mô tả theo chuẩn OpenAPI 3.0
- **location**: `docs/api/openapi/{module}/{endpoint}.yaml`
- **filename_rule**: Trùng với resource hoặc action chính
- **examples**:
  - `docs/api/openapi/users/users.yaml`
  - `docs/api/openapi/auth/change-password.yaml`
- **agent_action**: Khi tạo endpoint mới → tự động sinh kèm file YAML stub trong đúng path

### R-API-OPENAPI-002
- **title**: YAML phải validate được
- **severity**: REQUIRED
- **tier**: AUTO_GATE
- **rule**: File YAML PHẢI validate qua Swagger Editor / openapi-validator trước khi merge
- **enforcement**: CI job chạy `openapi-cli lint` hoặc tương đương

---

## Tham chiếu nghiệp vụ — endpoint chuẩn ISC

> Khi gặp các nghiệp vụ phổ biến, dùng đúng các endpoint chuẩn này.

| Chức năng | Method + Path |
|---|---|
| Đăng nhập | `POST /auth/login` |
| Đăng xuất | `POST /auth/logout` |
| Refresh token | `POST /auth/refresh` |
| Gửi lại OTP | `POST /auth/resend-otp` |
| Đổi mật khẩu | `POST /users/{id}/change-password` |
| Reset password | `POST /users/{id}/reset-password` |
| Kiểm tra tồn tại email | `GET /users/check-email?email=...` |
| Cập nhật trạng thái đơn hàng | `PATCH /orders/{id}/status` |
| Hủy đơn hàng | `POST /orders/{id}/cancel` |
| Xuất file Excel | `GET /reports/{type}/export` |
| Gửi notification | `POST /notifications` |

---

## Quy trình tổng cho Agent (workflow)

```
1. NHẬN task tạo endpoint mới → xác định:
   - Resource là gì? (danh từ số nhiều)
   - Operation thuộc CRUD hay action ngoài CRUD?
   - Có domain prefix không? (auth/admin/public/internal)
   - Là internal hay public? (versioning)

2. CHỌN HTTP method theo R-API-METHOD-001:
   - Đọc → GET
   - Tạo → POST
   - Cập nhật toàn bộ → PUT
   - Cập nhật một phần → PATCH
   - Xóa → DELETE
   - Action ngoài CRUD → POST + action verb

3. SINH PATH:
   - Resource: lowercase, số nhiều, kebab-case (R-API-PATH-001, 002)
   - KHÔNG động từ CRUD trong path (R-API-PATH-003)
   - Tối đa 3 cấp lồng (R-API-PATH-004)
   - Action verb kebab-case (R-API-PATH-005)

4. SINH QUERY PARAM (nếu có filter/search/pagination):
   - snake_case (R-API-QUERY-001)
   - page + page_size cho pagination (R-API-QUERY-003)

5. CHECK với endpoint chuẩn ISC ở table trên — match được thì dùng đúng

6. SINH OpenAPI YAML stub tại đúng location:
   - docs/api/openapi/{module}/{endpoint}.yaml

7. CROSS-REF:
   - Response structure → 04_API_Response_and_Error.md
   - Timeout config → 05_API_Timeout.md
```

---

## Hành xử khi vi phạm

| Vi phạm | Agent action |
|---|---|
| BLOCKER | Dừng generate, báo human, KHÔNG submit |
| REQUIRED | Cảnh báo human, hỏi confirm trước khi tiếp tục |
| GOOD_PRACTICE | Note trong commit message, không block |

---

## Quick lookup — Cheat sheet

| Thành phần | Convention |
|---|---|
| Resource | `lowercase`, danh từ số nhiều |
| Path word separator | `kebab-case` (gạch ngang) |
| Query param | `snake_case` |
| Path verb | KHÔNG có verb CRUD |
| Action endpoint | `POST /{resource}/{id}/{verb-kebab}` |
| Pagination | `?page=1&page_size=20` |
| Versioning | `/api/v1/` chỉ cho public API |
| YAML location | `docs/api/openapi/{module}/{endpoint}.yaml` |

---

*File này là tham chiếu authoritative cho AI Agent về API naming. Khi conflict với hướng dẫn khác, file này thắng. Cross-reference với 04_API_Response_and_Error.md cho response structure.*
