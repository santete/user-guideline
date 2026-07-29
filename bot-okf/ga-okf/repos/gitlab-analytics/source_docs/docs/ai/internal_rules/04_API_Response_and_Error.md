---
type: api-response-and-error-rules
domain: api-design
audience: ai-agent
purpose: code-generation
source:
  - API_Response_Guideline_ISC
  - Error_Code_Guideline_ISC
authoritative: true
language: vi
last_updated: 2026-04
load_when:
  - code controller / response handler
  - throw / return error
  - mapping HTTP status code
  - thêm error code mới vào catalog
related_files:
  - 03_API_Naming.md
  - 05_API_Timeout.md
---

# API Response & Error Code — Tham chiếu cho AI Agent

> File distill GỘP từ API Response Guideline + Error Code Guideline ISC. 2 phần này gắn rất chặt: response chuẩn dùng error code chuẩn, nên gộp 1 file.
> Áp dụng khi code controller, return result, throw error, định nghĩa error code mới.

## Nguyên tắc tổng

**Cấu trúc response thống nhất** — `success`, `data`, `error`, `meta`. KHÔNG bao giờ trả response "trần" thiếu wrapper.

**Phân loại lỗi rõ 2 nhóm:**
- **Lỗi nghiệp vụ** → HTTP `200 OK` + `success: false` + business error code (`INVALID_OTP`, `USER_LOCKED`...)
- **Lỗi kỹ thuật** → HTTP `4xx`/`5xx` + `success: false` + technical error code (`AUTH_401`, `SYS_500`...) — middleware tự handle

**Mọi response đều có `trace_id`** để debug xuyên hệ thống.

## Mức độ vi phạm

- **BLOCKER** — Tuyệt đối không generate. Vi phạm = code review reject ngay.
- **REQUIRED** — Phải tuân thủ. Reviewer block merge nếu sai.
- **GOOD_PRACTICE** — Khuyến nghị. Tuân nếu có thể.

---

# PHẦN 1 — RESPONSE STRUCTURE

## R-RESP-STRUCTURE: Cấu trúc response

### R-RESP-STRUCTURE-001
- **title**: 4 trường top-level bắt buộc
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Mọi response PHẢI có đúng 4 trường top-level: `success`, `data`, `error`, `meta`. KHÔNG được thêm/bớt trường.
- **schema**:
  ```json
  {
    "success": <boolean>,
    "data": <object | array | null>,
    "error": <ErrorObject | null>,
    "meta": <MetaObject>
  }
  ```
- **examples_fail**:
  - `{ "user": {...} }` — trả thẳng object, thiếu wrapper
  - `{ "success": true, "data": {...} }` — thiếu `error` và `meta`
  - `{ "status": "ok", "result": {...} }` — sai field name

### R-RESP-STRUCTURE-002
- **title**: success=true thì error=null
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Khi `success: true` → `error` PHẢI là `null`. Khi `success: false` → `data` PHẢI là `null` và `error` PHẢI có structure đầy đủ.
- **invariants**:
  - `success === true` → `error === null` AND `data !== null` (trừ DELETE 204)
  - `success === false` → `data === null` AND `error !== null`
- **examples_fail**:
  - `{ "success": true, "data": null, "error": {...} }` — vừa success vừa có error
  - `{ "success": false, "data": {...}, "error": null }` — fail nhưng có data và không có error

### R-RESP-STRUCTURE-003
- **title**: Response success format
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Response thành công theo template:
  ```json
  {
    "success": true,
    "data": { /* object | array */ },
    "error": null,
    "meta": {
      "request_id": "req-...",
      "trace_id": "trace-...",
      "timestamp": "2025-06-16T09:00:00Z"
    }
  }
  ```

### R-RESP-STRUCTURE-004
- **title**: Response error format
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Response lỗi theo template:
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "INVALID_OTP",
      "message": "Mã OTP không hợp lệ hoặc đã hết hạn",
      "details": { "field": "sms_otp" },
      "retryable": false
    },
    "meta": {
      "request_id": "req-...",
      "trace_id": "trace-...",
      "timestamp": "2025-06-16T09:01:00Z"
    }
  }
  ```

---

## R-RESP-META: Meta fields

### R-RESP-META-001
- **title**: Meta bắt buộc 3 field
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: `meta` PHẢI có ít nhất 3 field: `request_id`, `trace_id`, `timestamp`
- **fields**:
  - `request_id` — sinh từ gateway hoặc entry endpoint, định danh từng request
  - `trace_id` — sinh từ hệ thống tracing (OpenTelemetry), trace xuyên service
  - `timestamp` — ISO 8601 timestamp tạo response
- **examples_fail**:
  - `meta` không có `trace_id` — KHÔNG trace được lỗi cross-service
  - `timestamp: "2025-06-16"` — sai format, phải full ISO

### R-RESP-META-002
- **title**: Pagination meta
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Khi response trả về list có phân trang, `meta.pagination` PHẢI có đủ 6 field
- **schema**:
  ```json
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_items": 42,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
  ```
- **agent_action**: Endpoint trả list → bắt buộc thêm pagination vào meta. Tính `total_pages = ceil(total_items / limit)`.

---

## R-RESP-FIELD: Field naming

### R-RESP-FIELD-001
- **title**: Input/output field dùng snake_case
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Mọi field trong request body và response body dùng `snake_case`
- **examples_pass**:
  - `"user_id": 123`, `"created_at": "..."`, `"total_amount": 1000`
- **examples_fail**:
  - `"userId"` — không được camelCase
  - `"UserId"` — không được PascalCase
- **rationale**: Đồng bộ với column convention SQL (xem `02_Naming_Microservice.md`).

---

# PHẦN 2 — ERROR HANDLING

## R-ERROR-CATEGORY: Phân loại lỗi

### R-ERROR-CATEGORY-001
- **title**: Phân biệt rõ lỗi nghiệp vụ vs lỗi kỹ thuật
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Lỗi PHẢI được phân loại đúng để chọn HTTP status code
- **decision_tree**:
  ```
  Lỗi này có phải do nghiệp vụ (validation business rule, state không hợp lệ, OTP sai...)?
    YES → HTTP 200 + success=false + business code  (DEV chủ động return)
    NO  → Là lỗi kỹ thuật (auth fail, server crash, DB down, rate limit...)
        → HTTP 4xx/5xx + success=false + technical code  (MIDDLEWARE handle)
  ```
- **examples**:
  - "OTP sai" → nghiệp vụ → HTTP 200, code `INVALID_OTP`
  - "Token hết hạn" → kỹ thuật → HTTP 401, code `AUTH_401`
  - "Email đã tồn tại" → nghiệp vụ → HTTP 200, code `DUPLICATE_EMAIL`
  - "Database mất kết nối" → kỹ thuật → HTTP 500, code `DB_500`

### R-ERROR-CATEGORY-002
- **title**: Lỗi nghiệp vụ TUYỆT ĐỐI dùng HTTP 200
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Lỗi nghiệp vụ PHẢI trả HTTP `200 OK` + `success: false`. KHÔNG dùng 4xx/5xx cho lỗi nghiệp vụ.
- **rationale**: Tách bạch lỗi infrastructure (FE/BFF retry/alert) khỏi lỗi business (FE hiển thị message).
- **examples_pass**: `INVALID_OTP` → HTTP 200
- **examples_fail**: `INVALID_OTP` → HTTP 400 (sai — OTP sai là nghiệp vụ, không phải request format sai)

### R-ERROR-CATEGORY-003
- **title**: Không dùng throw cho lỗi nghiệp vụ
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Lỗi nghiệp vụ PHẢI return response object, KHÔNG throw exception. Throw chỉ dành cho lỗi kỹ thuật để middleware bắt.
- **examples_pass** (C#):
  ```csharp
  if (otp != expected) {
      return ApiResponse.BusinessError("INVALID_OTP", "Mã OTP không hợp lệ");
  }
  ```
- **examples_fail**:
  ```csharp
  if (otp != expected) {
      throw new InvalidOtpException(); // ❌ throw cho nghiệp vụ
  }
  ```

### R-ERROR-CATEGORY-004
- **title**: Lỗi kỹ thuật do middleware handle
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: Code business KHÔNG được tự handle/build response cho lỗi kỹ thuật (DB down, auth fail, timeout). Middleware/exception handler bắt và format theo chuẩn.
- **examples**:
  - DB connection fail → middleware bắt `DbConnectionException` → trả `DB_500`
  - JWT invalid → auth middleware bắt → trả `AUTH_401`
  - Rate limit hit → rate limit middleware → trả `RATE_429`

---

## R-ERROR-CODE: Error code format

### R-ERROR-CODE-001
- **title**: Format mã lỗi
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Mã lỗi theo format `{PREFIX}_{CODE}` UPPERCASE
- **prefix_module** (chọn 1 phù hợp):
  - `GEN` — generic, áp dụng nhiều module
  - `AUTH` — authentication, authorization
  - `USR` — user
  - `PROD` — product
  - `SYS` — system
  - `REQ` — request
  - `DB` — database
  - `MQ` — message queue
  - `EXT` — external service
- **code_part** (chọn 1 dạng):
  - HTTP status: `AUTH_401`, `USR_404`, `SYS_500`
  - Ngữ nghĩa cụ thể: `INVALID_OTP`, `USER_LOCKED`, `DUPLICATE_EMAIL`
- **examples_pass**:
  - `AUTH_401`, `USR_404`, `SYS_500`, `INVALID_OTP`, `USER_LOCKED`
- **examples_fail**:
  - `auth_401` — phải UPPERCASE
  - `Auth401` — phải có dấu `_`
  - `INVALID-OTP` — không dùng dấu `-`

### R-ERROR-CODE-002
- **title**: Mã lỗi PHẢI nằm trong catalog
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: KHÔNG được dùng mã lỗi tự đặt ad-hoc trong code. Mọi mã lỗi PHẢI có trong file catalog.
- **catalog_location**: `ErrorCodes/` directory (tách theo module)
  - `ErrorCodes/General.cs`
  - `ErrorCodes/Auth.cs`
  - `ErrorCodes/User.cs`
  - `ErrorCodes/Product.cs`
  - `ErrorCodes/System.cs`
- **agent_action**:
  - Trước khi return error, check mã có trong catalog không
  - Nếu mã chưa có → thêm vào file catalog tương ứng (theo prefix), KHÔNG hardcode literal trong service code
- **examples_pass** (C#):
  ```csharp
  return ApiResponse.BusinessError(AuthErrorCodes.InvalidOtp);
  ```
- **examples_fail**:
  ```csharp
  return ApiResponse.BusinessError("INVALID_OTP"); // ❌ literal string
  ```

### R-ERROR-CODE-003
- **title**: Naming pattern lỗi nghiệp vụ
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Lỗi nghiệp vụ đặt tên theo prefix ngữ nghĩa
- **patterns**:
  - `INVALID_*` — dữ liệu sai format / không hợp lệ (`INVALID_OTP`, `INVALID_EMAIL`, `INVALID_PASS`)
  - `MISSING_*` — thiếu field bắt buộc (`MISSING_CAPTCHA`, `MISSING_TOKEN`)
  - `DUPLICATE_*` — trùng dữ liệu (`DUPLICATE_EMAIL`, `DUPLICATE_USERNAME`)
  - `NOT_FOUND_*` — không tìm thấy (`NOT_FOUND_USER`)
  - `UNAUTHORIZED_*` — không có quyền (`UNAUTHORIZED_DEVICE`)
  - `EXPIRED_*` — đã hết hạn (`INVITE_EXPIRED`, `TOKEN_EXPIRED`)
  - `LOCKED_*` / `*_LOCKED` — bị khóa (`USER_LOCKED`, `ACCOUNT_LOCKED`)
  - `BUSINESS_RULE_*` — vi phạm quy tắc nghiệp vụ
  - Hành vi cụ thể (không cần prefix nếu đã rõ): `MFA_REQUIRED`, `SESSION_CONFLICT`, `FILE_TOO_LARGE`, `IMAGE_INVALID`, `NOTIFY_FAILED`

### R-ERROR-CODE-004
- **title**: Naming pattern lỗi kỹ thuật
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Lỗi kỹ thuật đặt tên theo `{MODULE}_{HTTP_CODE}`
- **examples_pass**: `REQ_400`, `AUTH_401`, `AUTH_403`, `USR_404`, `RATE_429`, `SYS_500`, `DB_500`, `DB_503`, `MQ_502`, `EXT_504`

### R-ERROR-CODE-005
- **title**: error.retryable PHẢI set đúng
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Trường `error.retryable` cho biết client có thể retry không
- **set_true_when**:
  - Lỗi tạm thời: `SYS_500`, `DB_503`, `EXT_504`, `REQ_TIMEOUT`, `MQ_502`
  - Rate limit: `RATE_429` (sau khoảng cooldown)
- **set_false_when**:
  - Validation fail: `INVALID_OTP`, `INVALID_EMAIL`, `MISSING_CAPTCHA`
  - Authorization fail: `AUTH_401`, `AUTH_403`, `UNAUTHORIZED_DEVICE`
  - Business rule violation: `USER_LOCKED`, `DUPLICATE_EMAIL`, `INVITE_EXPIRED`
- **rationale**: FE/client dựa vào `retryable` để quyết định auto-retry hay show error message.

---

## R-ERROR-CATALOG: Error code catalog

> Catalog chuẩn — agent reference khi cần error code. Khi cần mã mới, thêm vào đây + file catalog tương ứng.

### Mã thành công (HTTP 2xx)

| Mã | HTTP | Mô tả |
|---|---|---|
| `GEN_200` | 200 | Thao tác thành công (generic) |
| `USR_200` | 200 | Lấy thông tin người dùng thành công |
| `AUTH_200` | 200 | Đăng nhập thành công |
| `PROD_200` | 200 | Lấy danh sách sản phẩm thành công |
| `AUTH_201` | 201 | Tạo access token mới |
| `USR_204` | 204 | Xóa người dùng thành công (No content) |

### Lỗi nghiệp vụ (HTTP 200 + success=false)

| Mã | retryable | Mô tả |
|---|---|---|
| `INVALID_OTP` | false | Mã OTP không hợp lệ hoặc đã hết hạn |
| `USER_LOCKED` | false | Tài khoản người dùng bị khóa |
| `DUPLICATE_EMAIL` | false | Email đã tồn tại trong hệ thống |
| `INVALID_PASS` | false | Mật khẩu không đúng định dạng |
| `MISSING_CAPTCHA` | false | Thiếu CAPTCHA trong request |
| `UNAUTHORIZED_DEVICE` | false | Thiết bị không được phép truy cập |
| `INVITE_EXPIRED` | false | Link mời đã hết hạn |
| `INVALID_PROFILE` | false | Thông tin hồ sơ không hợp lệ |
| `NOTIFY_FAILED` | true | Gửi thông báo thất bại |
| `SESSION_CONFLICT` | false | Đăng nhập đồng thời gây xung đột session |
| `FILE_TOO_LARGE` | false | File upload vượt giới hạn |
| `IMAGE_INVALID` | false | Định dạng ảnh không hỗ trợ |
| `MFA_REQUIRED` | false | Cần xác thực đa yếu tố |

### Lỗi kỹ thuật (HTTP 4xx/5xx — middleware handle)

| Mã | HTTP | retryable | Mô tả |
|---|---|---|---|
| `REQ_400` | 400 | false | Request sai định dạng, thiếu field |
| `AUTH_401` | 401 | false | Chưa xác thực / thiếu token |
| `AUTH_403` | 403 | false | Không có quyền truy cập |
| `USR_404` | 404 | false | Không tìm thấy người dùng |
| `PROD_404` | 404 | false | Không tìm thấy sản phẩm |
| `REQ_TIMEOUT` | 408 | true | Yêu cầu xử lý quá lâu |
| `RATE_429` | 429 | true | Gửi quá nhiều request |
| `UPGRADE_REQUIRED` | 426 | false | Cần nâng cấp phiên bản client |
| `SYS_500` | 500 | true | Lỗi hệ thống (null/crash bất thường) |
| `DB_500` | 500 | true | Lỗi kết nối hoặc xử lý database |
| `DB_503` | 503 | true | Database quá tải / không sẵn sàng |
| `MQ_502` | 502 | true | Lỗi message queue (Kafka, RabbitMQ) |
| `EXT_504` | 504 | true | Timeout khi gọi hệ thống bên ngoài |

---

## R-HTTP-STATUS: HTTP status mapping

### R-HTTP-STATUS-001
- **title**: HTTP status code chuẩn
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Khi cần dùng HTTP status, chọn theo bảng sau (KHÔNG dùng status không có ý nghĩa rõ)

| HTTP | Khi nào dùng |
|---|---|
| `200` | Thành công HOẶC lỗi nghiệp vụ |
| `201` | Tạo resource mới thành công (POST) |
| `204` | Thành công, không có response body (DELETE) |
| `400` | Request sai format, thiếu field bắt buộc, JSON invalid |
| `401` | Thiếu/sai token, chưa xác thực |
| `403` | Đã xác thực nhưng không có quyền |
| `404` | URL sai hoặc resource không tồn tại |
| `408` | Request timeout phía server |
| `426` | Client cần nâng cấp version |
| `429` | Rate limit hit |
| `500` | Crash, lỗi hệ thống không lường |
| `502` | Upstream service lỗi (gateway) |
| `503` | Server quá tải hoặc bảo trì |
| `504` | Timeout khi gọi upstream service |

---

## Quy trình tổng cho Agent (workflow)

```
1. ĐANG CODE response handler:
   - Thành công? → R-RESP-STRUCTURE-003 (success=true template)
   - Lỗi nghiệp vụ? → R-RESP-STRUCTURE-004 (success=false template) + HTTP 200
   - Lỗi kỹ thuật? → THROW exception cho middleware (R-ERROR-CATEGORY-003, 004)

2. CHỌN error code:
   - Check catalog (R-ERROR-CATALOG) — có mã phù hợp chưa?
   - Có → dùng (R-ERROR-CODE-002 — không hardcode literal)
   - Không có → thêm mã mới vào catalog file:
     * Đặt tên theo R-ERROR-CODE-001 (PREFIX_CODE)
     * Pattern lỗi nghiệp vụ → R-ERROR-CODE-003
     * Pattern lỗi kỹ thuật → R-ERROR-CODE-004
     * Set retryable đúng (R-ERROR-CODE-005)

3. SET HTTP status:
   - Nghiệp vụ → 200 (R-ERROR-CATEGORY-002)
   - Kỹ thuật → 4xx/5xx theo R-HTTP-STATUS-001 (middleware tự set)

4. ĐẢM BẢO meta đầy đủ:
   - request_id, trace_id, timestamp (R-RESP-META-001)
   - pagination nếu list (R-RESP-META-002)

5. CHECK invariants (R-RESP-STRUCTURE-002):
   - success=true → error=null + data có giá trị
   - success=false → data=null + error có structure đầy đủ

6. CROSS-REF:
   - Endpoint design → 03_API_Naming.md
   - Timeout response → 05_API_Timeout.md (response timeout dùng REQ_TIMEOUT/EXT_504)
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

| Tình huống | Action |
|---|---|
| Trả thành công | `success: true, data: {...}, error: null, meta: {...}` |
| Lỗi nghiệp vụ | HTTP 200 + `success: false, data: null, error: {code, message, retryable}` |
| Lỗi kỹ thuật | THROW → middleware → HTTP 4xx/5xx |
| Trả list | Thêm `meta.pagination` (6 field) |
| Field naming | `snake_case` cho input/output |
| Mã lỗi | `PREFIX_CODE` UPPERCASE, có trong catalog |
| trace_id | LUÔN có trong meta |

---

*File này là tham chiếu authoritative cho AI Agent về Response + Error. Khi conflict với hướng dẫn khác, file này thắng. Cross-reference với 03_API_Naming.md và 05_API_Timeout.md.*
