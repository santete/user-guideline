# API Rules

> Rule cho REST / GraphQL / RPC. Load khi đụng API contract.

---

## REST Conventions

### URL
- Plural noun: `/users`, `/orders` (KHÔNG `/user`, `/getOrders`)
- Lowercase, kebab-case: `/user-profiles` (KHÔNG `/userProfiles`)
- Versioning: `/v1/users` (URL) hoặc header `Accept: application/vnd.api.v1+json`
- Nested resource: `/users/{id}/orders` (max 2 cấp, sâu hơn → tách endpoint)

### Method
| Method   | Mục đích                       | Idempotent | Body  |
|----------|--------------------------------|------------|-------|
| `GET`    | Đọc                            | ✅         | ❌    |
| `POST`   | Tạo / action                   | ❌         | ✅    |
| `PUT`    | Replace toàn bộ                | ✅         | ✅    |
| `PATCH`  | Update 1 phần                  | ❌         | ✅    |
| `DELETE` | Xóa                            | ✅         | optional |

### Status Code
- `200` OK (GET, PATCH thành công)
- `201` Created (POST tạo resource)
- `204` No Content (DELETE thành công, không body)
- `400` Bad Request (input sai)
- `401` Unauthorized (chưa auth)
- `403` Forbidden (auth rồi nhưng không có quyền)
- `404` Not Found
- `409` Conflict (vd: duplicate email)
- `422` Unprocessable Entity (validation fail)
- `429` Too Many Requests (rate limit)
- `500` Internal Server Error (lỗi không lường trước)
- `503` Service Unavailable (downstream down)

KHÔNG dùng `200` cho mọi response rồi nhét `success: false` vào body — đó là anti-pattern.

---

## Response Format (chuẩn của project)

> ⚠️ TODO: Chốt format chuẩn cho project, ví dụ:

### Success
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}
```

### Error
```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with id 123 not found",
    "details": { "userId": 123 }
  }
}
```

### Pagination
- Cursor-based khi data > 10k records (scale tốt hơn offset)
- Offset-based cho list nhỏ
- LUÔN có `hasMore` / `nextCursor` trong response

---

## Validation

- Validate ở boundary (controller / route handler)
- Reject sớm với `400` / `422`, KHÔNG để invalid data đi vào service layer
- Schema validator: <vd: zod / joi / pydantic>
- LUÔN validate:
  - Type
  - Required vs optional
  - Range (min/max length, value)
  - Format (email, URL, UUID)
  - Business rule (vd: amount > 0)

---

## Authentication & Authorization

- Auth: JWT trong `Authorization: Bearer <token>` header
- KHÔNG để token trong URL query (log sẽ leak)
- Refresh token: separate endpoint, rotate sau mỗi lần dùng
- Authorization: check ở service layer, không chỉ ở controller (defense in depth)

---

## Rate Limiting

- Public endpoint: <vd: 60 req/min/IP>
- Authenticated: <vd: 600 req/min/user>
- Sensitive (login, register, OTP): <vd: 5 req/min/IP>
- Response khi limit: `429` + header `Retry-After: <seconds>`

---

## Backwards Compatibility

- Adding field optional → safe
- Removing field → BREAKING, cần version mới
- Changing field type → BREAKING
- Changing required field → BREAKING
- Khi cần breaking change: version mới, deprecate version cũ với timeline rõ ràng

---

## Documentation

- OpenAPI / Swagger spec là source of truth
- Generate spec từ code (decorator / annotation), không viết tay
- Mỗi endpoint phải có: description, request schema, response schema, error case, ví dụ

---

## GraphQL (nếu dùng)

> ⚠️ TODO: Bổ sung khi áp dụng GraphQL
- Query depth limit
- Query complexity limit
- DataLoader cho N+1
- Persisted query cho production
