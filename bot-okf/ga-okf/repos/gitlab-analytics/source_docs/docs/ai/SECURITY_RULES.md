# Security Rules

> Rule cho auth, input handling, secret. Load khi đụng security-related code.

---

## Authentication

- Password hash: `bcrypt` (cost ≥ 12) hoặc `argon2id`
- KHÔNG hash custom: không dùng MD5, SHA256 cho password
- JWT:
  - Algorithm: `RS256` (asymmetric) > `HS256` (symmetric, OK cho monolith)
  - Expiry: access token ngắn (15 phút), refresh token dài (7 ngày)
  - Secret: env var, độ dài ≥ 32 chars random
  - KHÔNG để JWT secret trong code, config file commit lên git
- Session: HttpOnly + Secure + SameSite cookie
- Logout: invalidate refresh token (lưu blacklist hoặc rotate)
- Multi-factor auth cho tài khoản admin

---

## Authorization

- Check ở **service layer**, không chỉ ở route guard
- Pattern: RBAC (role-based) hoặc ABAC (attribute-based)
- Default deny — explicit allow
- Mọi endpoint phải declare ai có quyền access
- Test authorization: viết test cho cả "user có quyền" và "user không có quyền"

---

## Input Validation

- Validate mọi input từ client (body, query, header, file upload)
- Dùng schema validator (zod, joi, pydantic), KHÔNG manual `if`
- Reject sớm với `400` / `422`
- Sanitize input dùng cho:
  - HTML output → escape (XSS)
  - SQL → parameterized query (SQL injection)
  - Shell command → KHÔNG concat, dùng spawn args (command injection)
  - File path → check traversal (`../`)

---

## Output Encoding

- Render HTML: framework auto-escape (React, Vue OK by default)
- KHÔNG `dangerouslySetInnerHTML` / `v-html` / `innerHTML` trừ khi sanitize bằng DOMPurify
- API response: JSON là an toàn nhất; nếu trả HTML → escape

---

## Secret Management

### Storage
- LUÔN trong env var, KHÔNG trong code
- `.env` local: KHÔNG commit (`.gitignore`)
- `.env.example`: commit, chỉ chứa key, không value
- Production: secret manager (AWS Secrets Manager, Vault, Doppler)
- Secret trong CI/CD: dùng secret store của platform (GitHub Actions secrets, etc.)

### Rotation
- API key, DB password: rotate ≥ mỗi 90 ngày
- JWT signing key: rotate ≥ mỗi 6 tháng
- Quy trình rotate phải zero-downtime (overlap key cũ + mới)

### What counts as secret
- API key, token (Stripe, AWS, Twilio...)
- DB credential
- JWT signing secret
- Encryption key
- Internal service token
- Webhook signing secret

---

## File Upload

- Whitelist file extension + MIME type (KHÔNG blacklist)
- Limit file size (per file + per request)
- Rename file khi lưu (KHÔNG dùng tên gốc — path traversal, naming collision)
- Lưu ngoài web root HOẶC trên object storage (S3, GCS)
- Scan virus với file public (ClamAV)
- KHÔNG serve file qua endpoint mà không check authorization

---

## Rate Limiting & Brute Force Protection

- Login endpoint: max 5 fail / 15 phút / IP, kèm captcha sau 3 fail
- OTP / password reset: max 3 / giờ / user
- API public: rate limit theo IP
- API authenticated: rate limit theo user

---

## CORS

- KHÔNG `Access-Control-Allow-Origin: *` cho endpoint authenticated
- Whitelist domain cụ thể
- KHÔNG `Access-Control-Allow-Credentials: true` đi kèm `*`

---

## Logging — KHÔNG log sensitive data

KHÔNG log:
- Password (kể cả hash)
- Full credit card, CVV
- JWT, session token, API key
- Personal ID (CCCD, SSN), full email khi không cần
- Request body của endpoint sensitive (login, payment)

Log với mask:
```
email: u***@example.com
phone: +84***1234
card: ****4242
```

---

## Dependency Security

- `npm audit` / `pip-audit` / `govulncheck` chạy trong CI
- Critical CVE: fix trong 7 ngày
- High CVE: fix trong 30 ngày
- Dependabot / Renovate: auto-PR cho security update
- Pin version trong `package-lock.json` / `poetry.lock` / `go.sum`

---

## OWASP Top 10 Awareness

Khi review code, mental check qua:
1. Broken Access Control
2. Cryptographic Failures
3. Injection (SQL, XSS, command)
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable & Outdated Components
7. Identification & Authentication Failures
8. Software & Data Integrity Failures
9. Security Logging & Monitoring Failures
10. Server-Side Request Forgery (SSRF)

---

## Hard Stops (LUÔN hỏi user)

- Disable / bypass auth check
- Disable HTTPS / SSL verification
- Disable CSRF / CORS protection
- Lưu password / secret dưới dạng plaintext
- Trả về stack trace cho client production
- Đụng vào code crypto / signing logic
