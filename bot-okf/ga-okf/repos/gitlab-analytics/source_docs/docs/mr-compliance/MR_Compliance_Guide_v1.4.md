# CHUẨN TUÂN THỦ MERGE REQUEST (MR)

**GitLab | AI SDLC | Áp dụng cho toàn bộ Developer**

Phiên bản: 1.4 | Cập nhật: Tháng 04/2026 | ENG-STD-MR-002

> **TÀI LIỆU NỘI BỘ — Không phát tán bên ngoài**

---

# 1. TỔNG QUAN

Tài liệu này quy định **những gì Developer PHẢI làm** trước khi tạo và submit Merge Request trên GitLab. Ngắn gọn, hành động được, có thể dùng ngay.

| Mức độ | Định nghĩa | Hành động |
| :---- | :---- | :---- |
| **🔴 BLOCKER** | Vi phạm nghiêm trọng: security, data loss, CI fail, hardcoded secret | **PHẢI fix trước khi merge. Không exception.** |
| **🟡 REQUIRED** | Bắt buộc: missing test, sai logic, description thiếu, debug code còn trong MR | PHẢI fix trong MR này hoặc tạo ticket link trước khi merge |
| **🟢 GOOD PRACTICE** | Khuyến nghị: naming, refactor nhỏ, comment thêm | Prefix "Nit:" hoặc "Suggestion:" — author tự quyết định |

---

# 2. COMMIT MESSAGE — Conventional Commits

> **THAM CHIẾU:** Tiêu chuẩn: Conventional Commits v1.0 | Enforce bởi: GitLab Push Rules + Husky git hook

## 2.1 Format bắt buộc

```text
<type>(<scope>): <subject>
# type   : feat | fix | hotfix | refactor | test | docs | ci | chore | perf | security
# scope  : module/component bị ảnh hưởng (optional)
# subject: viết thường, không dấu chấm cuối, imperative mood (tiếng Anh)
# Giới hạn characters theo từng loại (GitLab platform rules):
# Regular commit message  → 500 chars  (custom Push Rules)
# Merge commit template   → 500 chars  (GitLab platform hard limit)
# Squash commit template  → 500 chars  (GitLab platform hard limit)
# Merge suggestions       → 255 chars  (GitLab platform hard limit)
#
# Best practice: subject <= 72 chars, mỗi dòng body <= 72 chars
```

> **BLOCKER:** 500 characters là giới hạn tự đặt cho commit thường — enforce bởi GitLab Push Rules (custom rule). Riêng Merge commit và Squash commit: GitLab platform giới hạn cứng 500 chars. Merge suggestions giới hạn 255 chars.

## 2.2 Squash Commit Message — khi merge nhiều commits

Khi MR được merge bằng chế độ **Squash commits**, GitLab tổng hợp tất cả commits thành 1. Squash message PHẢI tuân thủ format sau:

```text
# Format squash commit message (GitLab auto-fill, dev cần review và chỉnh):
<type>(<scope>): <summary of entire MR — max 72 chars>
Refs: <request-id>  (ID từ PM tool)
* <commit 1 summary>
* <commit 2 summary>
* <commit 3 summary>

# Ví dụ thực tế:
feat(checkout): add Stripe payment gateway integration
Refs: REQ-1042
* add Stripe SDK and config
* implement webhook validation
* add payment error handling [AI]
* test(checkout): generate unit tests for payment service

# Quy tắc:
# 1. Subject: giống commit message thường, max 72 chars
# 2. Refs: BẮT BUỘC — request-id từ PM tool để traceability
# 3. Body: list ngắn gọn các commits đã squash (nên có)
# 4. Toàn bộ message <= 500 characters
```

> **HƯỚNG DẪN:** GitLab: khi tạo MR tick "Squash commits when merge request is accepted". GitLab pre-fill squash message từ MR title — dev cần edit để thêm "Refs: `<request-id>`".

> **LƯU Ý:** 500 characters là giới hạn cứng của GitLab platform cho Squash commit message template (Settings → General → Merge requests → Squash commit message template). Không cần Push Rules cho giới hạn này — GitLab tự enforce.

## 2.3 Merge Commit Message Template — GitLab tự tạo

Khi MR merge bằng chế độ **Merge commit** (không Squash), GitLab tạo 1 merge commit. Template chuẩn nên set trong GitLab Settings:

```text
# Cấu hình tại: Project → Settings → General → Merge requests
# → Merge commit message template  (max 500 chars)
# Template khuyến nghị (paste vào GitLab Settings):
Merge branch %{source_branch} into %{target_branch}
%{title}
Refs: %{issues}
See merge request %{reference}

# GitLab variables có sẵn:
# %{title}          — MR title
# %{source_branch}  — tên branch nguồn
# %{target_branch}  — tên branch đích (main/develop)
# %{reference}      — MR reference (e.g. !42)
# %{issues}         — linked issues (e.g. Closes #123)
# %{co_authored_by} — co-authors nếu có
```

## 2.4 Ví dụ đúng / sai — commit message thường

| ✅ ĐÚNG | ❌ SAI |
| :---- | :---- |
| `feat(auth): add OAuth2 PKCE flow` | `Fixed bug` |
| `fix(api): resolve pagination off-by-one` | `WIP` |
| `[AI] feat(payment): generate Stripe hook` | `update code` |
| `[AI] refactor(service): extract handler` | `Add feature.` |
| `security: patch SQL injection in search` | `fix(Auth): Fixed.` |
| `test(user): add edge case for null email` | `Sửa lỗi đăng nhập` |

## 2.5 Quy tắc AI Disclosure trong Commit

Mọi commit có code được **Claude Code hoặc AI tool hỗ trợ** PHẢI thêm prefix **[AI]** vào đầu commit message:

```text
# Format khi có AI-assist:
[AI] <type>(<scope>): <subject>

# Ví dụ:
[AI] feat(auth): implement JWT refresh token logic
[AI] fix(cart): resolve item count mismatch on checkout
[AI] test(api): generate unit tests for payment service
```

> **LƯU Ý:** Prefix [AI] dùng để tracking AI adoption metrics tự động qua Git log. Khai báo trung thực — đây là KPI của team, không phải đánh giá cá nhân.

---

# 3. BRANCH NAMING CONVENTION

> **THAM CHIẾU:** Convention này được enforce bởi GitLab Push Rules. Branch không đúng format sẽ bị reject khi push.

## 3.1 Format bắt buộc

```text
<type>/<request-id>-<short-description>
# type        : feat | fix | hotfix | refactor | test | chore | perf | security
# request-id  : ID từ PM tool (JIRA, Linear, Notion...) — BẮT BUỘC
# description : kebab-case, chữ thường, tối đa 50 chars, mô tả ngắn gọn
# release/    : không cần request-id (ví dụ: release/v2.4.0)
# docs + ci   : KHÔNG tạo branch riêng — commit vào branch feat/fix/chore liên quan
```

## 3.2 Ví dụ theo từng loại

| Type | Ví dụ branch name | Khi nào dùng |
| :---- | :---- | :---- |
| **feat** | `feat/REQ-1042-stripe-payment-gateway` | Feature mới từ requirement / user story |
| **fix** | `fix/BUG-234-cart-null-pointer-error` | Bug fix thông thường (không urgent) |
| **hotfix** | `hotfix/INC-89-payment-service-down` | Bug critical trên production — ưu tiên cao nhất |
| **refactor** | `refactor/TECH-56-extract-auth-service` | Cải thiện code không thay đổi behavior |
| **chore** | `chore/DEVOPS-12-upgrade-node-version` | Dependency update, config, CI/CD, build tools |
| **test** | `test/QA-78-add-e2e-checkout-flow` | Thêm hoặc cập nhật test không liên quan feature mới |
| **perf** | `perf/TECH-91-optimize-db-query-index` | Cải thiện performance, không thay đổi behavior hay API |
| **security** | `security/SEC-07-patch-sql-injection-search` | Vá lỗ hổng bảo mật, security hardening — ưu tiên cao |
| **release** | `release/v2.4.0` | Release branch — không cần request-id |

> **LƯU Ý:** `docs` và `ci` KHÔNG tạo branch riêng — commit type docs/ci dùng trong commit message của branch feat/fix/chore liên quan. Ví dụ: branch `feat/REQ-1042-payment` có thể có commit `"docs(api): update payment endpoint reference"`.

## 3.3 Quy tắc quan trọng

- `request-id` BẮT BUỘC với tất cả loại trừ `release/*` — không có ID = không có branch
- Branch type thể hiện MỤC ĐÍCH CHÍNH — không phải ràng buộc từng commit. Branch `feat/*` có thể chứa commit test/docs/fix đi kèm trong cùng feature, miễn là không có commit feat mới của một requirement khác.
- Dùng kebab-case (dấu gạch ngang), KHÔNG dùng underscore, camelCase, hay dấu cách
- Short description tối đa 50 characters — đủ để hiểu context, không cần giải thích dài
- Branch tồn tại trong thời gian 1 MR, xóa ngay sau khi merge (bật auto-delete trong GitLab)
- Không được commit trực tiếp lên main/master/develop — tất cả phải qua branch + MR

> **LƯU Ý:** `request-id` từ PM tool đảm bảo traceability: từ branch → commit → MR → requirement/ticket → có thể trace ngược lại. Đây là nền tảng để đo AI adoption metrics chính xác.

---

# 4. MR DESCRIPTION — Template bắt buộc

> **BLOCKER:** MR không có description đầy đủ sẽ bị REJECT ngay lập tức — không cần review code.

## 4.1 Template (copy vào `.gitlab/merge_request_templates/Default.md`)

```markdown
## 📋 Thay đổi này làm gì?
<!-- Mô tả ngắn: LÀM GÌ và TẠI SAO. KHÔNG mô tả HOW (code tự nói) -->

## 🔗 Ticket
Closes #<issue-number>  |  Ref: <PROJ-XXX>

## 🧪 Cách kiểm tra
1. ...
2. ...

## ✅ Self-review checklist
- [ ] CI/CD pipeline pass
- [ ] Unit test đã viết/cập nhật
- [ ] Không có debug code (console.log, print, breakpoint)
- [ ] Không có hardcoded secret (API key, password, token)
- [ ] Commit messages đúng Conventional Commits format

## 🤖 AI Disclosure
- [ ] Không dùng AI trong MR này
- [ ] Dùng AI — đã thêm [AI] prefix vào các commit liên quan
  - [ ] Viết code mới
  - [ ] Refactor code hiện có
  - [ ] Viết test
  - [ ] Debug / investigate
  - [ ] % LOC AI-assisted (ước tính): ____%
  - [ ] Đã đọc kỹ và hiểu từng dòng AI sinh ra

## ⚠️ Breaking Changes
(nếu không có, ghi N/A)

## 📸 Screenshots
(bắt buộc nếu có UI thay đổi)
```

> **HƯỚNG DẪN:** Cách cấu hình GitLab MR Template: tạo file `.gitlab/merge_request_templates/Default.md` trong repo → commit lên default branch → GitLab tự động load template khi tạo MR mới. Không cần cấu hình gì trên UI (UI textbox chỉ có ở GitLab Premium).

---

# 5. MR SIZE — Giới hạn kích thước

> **THAM CHIẾU:** Cơ sở: Google Engineering Practices + Microsoft ISE Playbook — "Small PRs have multiple advantages: easier to review, easier to deploy, minimize conflicts."

| Size | Lines changed | Yêu cầu | Review time |
| :---- | :---- | :---- | :---- |
| **XS** | < 50 LOC | Không yêu cầu gì thêm | < 15 phút |
| **S** | 50–200 LOC | Description đầy đủ | 15–30 phút |
| **M ⚠️** | 200–400 LOC | Giải thích rõ lý do trong description | 30–60 phút |
| **L ⛔** | 400–700 LOC | Reviewer CÓ THỂ yêu cầu split MR | 60–90 phút |
| **XL 🚫** | > 700 LOC | **BẮT BUỘC split — trừ migration/generated file** | Không review hiệu quả |

> **LƯU Ý:** Không tính LOC khi đo kích thước: generated code (`*.generated.*`, `*.min.js`), migrations, `vendor/`, lock files (`package-lock.json`, `yarn.lock`), binary files.

---

# 6. CODE QUALITY — Tiêu chí bắt buộc

> **THAM CHIẾU:** Cơ sở: ISO/IEC 25010:2023 — Maintainability, Reliability, Functional Suitability | Google Engineering Practices

## 6.1 Những thứ KHÔNG được có trong MR (BLOCKER)

| Mức độ | Vi phạm | Ví dụ phát hiện |
| :---- | :---- | :---- |
| **BLOCKER** | Debug statements còn trong code | `console.log()`, `print()`, `debugger`, `breakpoint` |
| **BLOCKER** | Hardcoded secrets: API key, password, token, connection string | `const API_KEY = "sk-xxxx..."` hoặc `password = "admin123"` |
| **BLOCKER** | SQL injection risk: raw query ghép trực tiếp user input | `f"SELECT * WHERE name='{user_input}'"` |
| **BLOCKER** | CI/CD pipeline fail mà vẫn request review | Check pipeline status trước khi assign reviewer |
| **BLOCKER** | Sensitive data trong logs: PII, credentials, payment info | `log.info("User password: " + password)` |

## 6.2 Code phải đảm bảo (REQUIRED)

| Mức độ | Tiêu chí | Ghi chú |
| :---- | :---- | :---- |
| REQUIRED | Error handling đầy đủ — không có silent failure | Catch exception và log/propagate có chủ ý |
| REQUIRED | Không có magic numbers — dùng named constants | `const MAX_RETRY = 3` thay vì `if (count > 3)` |
| REQUIRED | Naming rõ ràng — tên mô tả được intent, không viết tắt | `getUserById()` thay vì `getU()`, `d`, `tmp`, `data` |
| REQUIRED | Input validation cho tất cả dữ liệu đến từ bên ngoài | Validate trước khi process, không trust user input |
| REQUIRED | Không over-engineer — giải quyết bài toán hiện tại, không speculative | "YAGNI — You Aren't Gonna Need It" (Google) |

---

# 7. TESTING — Unit Test & Coverage

> **BLOCKER:** Không có unit test cho business logic mới = REQUIRED violation. Test phải được merge cùng code trong cùng MR.

## 7.1 Phân biệt Unit Test và Test Coverage

| | Unit Test | Test Coverage |
| :---- | :---- | :---- |
| **Là gì?** | Test từng function/method riêng lẻ, mock dependency bên ngoài | Phần trăm dòng code/nhánh được unit test chạy qua |
| **Ai viết?** | Developer viết khi code — cùng MR với production code | CI/CD tự đo sau khi chạy unit test suite |
| **Yêu cầu?** | **BẮT BUỘC cho business logic mới — REQUIRED** | **Coverage không được drop > 5% so với main branch** |
| **Tool đo?** | Jest (JS/TS), Pytest (Python), JUnit (Java), xUnit (.NET) | Istanbul/c8 (JS), coverage.py (Python), JaCoCo (Java) — tích hợp CI |

## 7.2 Coverage tối thiểu theo loại code

| Loại code | Unit test (line coverage) | Branch coverage | Mức độ nếu thiếu |
| :---- | :---- | :---- | :---- |
| Business logic (service, domain, use-case) | ≥ 80% | ≥ 70% | REQUIRED |
| API controllers / route handlers | ≥ 70% | ≥ 60% | REQUIRED |
| Utility / Helper functions | ≥ 90% | ≥ 80% | REQUIRED |
| UI Components (React/Vue) | ≥ 60% | ≥ 50% | REQUIRED |
| Infrastructure / Config / Migration | ≥ 50% | N/A | GOOD PRACTICE |

## 7.3 Chất lượng Unit Test — tiêu chí bắt buộc

- Test name mô tả behavior: `"should return 404 when user not found"` — KHÔNG phải `"test_get_user"`
- Mỗi test có ít nhất 1 assertion rõ ràng về expected behavior, không chỉ assert mock được gọi
- Có test cho edge cases: null/undefined, empty string/array, boundary value, error path
- Test độc lập — chạy theo bất kỳ thứ tự, không phụ thuộc nhau hay external state
- Không có hardcoded credentials hoặc PII trong test data (dùng faker hoặc fixtures)

## 7.4 Prompt chuẩn để tạo Unit Test với Claude Code

Dùng 2 prompt sau — prompt 1 để sinh test, prompt 2 để kiểm tra coverage gap:

```text
# PROMPT 1 — Sinh unit test cho function mới:
Role: Bạn là Senior QA Engineer chuyên viết unit test.
Context: File [đường dẫn file] với function [tên function].
         Framework test đang dùng: [Jest / Pytest / JUnit].
Task: Viết unit test đầy đủ bao gồm:
  1. Happy path — input hợp lệ, output đúng
  2. Error cases — input không hợp lệ, exception handling
  3. Boundary values — giá trị biên (null, 0, max, empty)
  4. Side effects — mock dependency và verify chúng được gọi đúng
Format: Test name theo pattern: "should [expected result] when [condition]"
        Mỗi test chỉ có 1 assertion logic chính (AAA pattern: Arrange-Act-Assert)
```

```text
# PROMPT 2 — Kiểm tra coverage gap trước khi submit MR:
Role: Bạn là QA Lead review test coverage report.
Context: Coverage report sau đây từ CI pipeline:
         [paste nội dung coverage report hoặc uncovered lines]
Task: Phân tích và xác định:
  1. Những branch/line nào chưa được cover có risk cao (business critical)?
  2. Edge cases nào còn thiếu test?
  3. Suggest thêm test cases cụ thể cho những gap quan trọng nhất.
Ưu tiên: business logic > error handling > happy path đã có.
```

> **HƯỚNG DẪN:** AI-generated tests thường test implementation thay vì behavior — verify từng test thực sự assert đúng business rule. Test "xanh" không có nghĩa là test "tốt".

---

# 8. QUY TẮC ĐỐI VỚI AI-ASSISTED CODE

## 8.1 Nguyên tắc cốt lõi

| Nguyên tắc | Nội dung |
| :---- | :---- |
| Developer chịu trách nhiệm | AI viết code, developer chịu trách nhiệm 100%. "AI viết nên không biết" không phải lý do hợp lệ. |
| Transparency bắt buộc | Khai báo AI trong MR description VÀ trong commit message. Không khai báo = vi phạm quy trình. |
| Review kỹ hơn, không phải ít hơn | AI có thể hallucinate logic, bỏ qua edge cases, sinh insecure code. Phải đọc kỹ từng dòng. |
| Không merge AI code chưa hiểu | Nếu không giải thích được code làm gì và tại sao, không được merge dù CI pass. |
| AI pre-review trước human review | Dùng Claude Code review MR diff của mình trước khi assign reviewer. Tìm lỗi hiển nhiên trước. |

## 8.2 Prompt gợi ý cho self-review

```text
# Prompt để review security trước khi submit MR:
"Đọc git diff này và kiểm tra:
 1. OWASP Top 10 risks (injection, auth bypass, hardcoded secrets)
 2. Logic có đúng với yêu cầu trong ticket không
 3. Edge cases nào chưa được xử lý
 4. Test có thực sự verify behavior không hay chỉ verify mock"

# Prompt để tạo unit test:
"Viết unit test cho function này gồm: happy path,
 error cases, và boundary values. Test name theo format:
 should [expected behavior] when [condition]"
```

## 8.3 Quy tắc Commit Convention cho AI-code

```text
# Format:
[AI] <type>(<scope>): <subject>

[AI] feat(auth): implement OAuth2 PKCE flow
[AI] fix(api): resolve pagination off-by-one error
[AI] refactor(service): extract notification handler
[AI] test(payment): generate unit tests for Stripe webhook

# Mục đích: tracking, auditing, và đo AI adoption metrics
# Enforce bởi: GitLab Push Rules + git commit-msg hook
```

---

# 9. BREAKING CHANGES & VERSIONING

> **THAM CHIẾU:** Cơ sở: Semantic Versioning 2.0.0 (semver.org) | Conventional Commits v1.0 | Google API Design Guide

## 9.1 Breaking Change là gì? — Định nghĩa rõ ràng

Breaking change là bất kỳ thay đổi nào **bắt buộc caller/consumer phải sửa code của họ** để không bị lỗi. Nguyên tắc: nếu consumer giữ nguyên code cũ, họ sẽ bị lỗi sau khi MR này merge.

### Những thứ LUÔN LUÔN là Breaking Change:

| Mức độ | Breaking Change | Ví dụ |
| :---- | :---- | :---- |
| **BLOCKER** | Xóa hoặc đổi tên API endpoint, function, method public | `GET /api/v1/users` → xóa hoặc đổi sang `/api/v2/users`; `getUserById()` → đổi thành `fetchUser()` |
| **BLOCKER** | Thay đổi kiểu dữ liệu của tham số hoặc return value | `userId: int` → `userId: string`; `return User` → `return UserDTO` (field khác) |
| **BLOCKER** | Thêm tham số bắt buộc (required) vào function/API đang có | `createUser(name)` → `createUser(name, role)`; `POST /users { name }` → `{ name, department } required` |
| **BLOCKER** | Xóa trường bắt buộc trong response API hoặc contract | `response.userId` bị xóa khỏi JSON response; `event.payload.amount` removed from event schema |
| **BLOCKER** | Thay đổi behavior: cùng input nhưng output khác (silent) | `calculateTax()` trước trả về số bao gồm VAT, sau khi MR trả về số chưa có VAT |
| **BLOCKER** | Schema database xóa hoặc đổi tên cột đang được dùng | `DROP COLUMN user_email`; `ALTER TABLE RENAME COLUMN price TO amount` |
| **BLOCKER** | Thay đổi authentication/authorization contract | API key auth → JWT auth (consumer phải đổi cách gọi); Public endpoint → yêu cầu auth token |

### Những thứ KHÔNG phải Breaking Change (backward compatible):

| Mức độ | Backward Compatible — KHÔNG phải Breaking Change | Ví dụ |
| :---- | :---- | :---- |
| OK | Thêm endpoint mới, không xóa endpoint cũ | Thêm `GET /api/v2/users`, giữ `/api/v1/users` |
| OK | Thêm optional field vào response | Thêm `"displayName"` vào User response (optional) |
| OK | Thêm optional parameter với default value | `createUser(name, role="user")` — role có default |
| OK | Thêm cột mới vào DB table (nullable hoặc có default) | `ALTER TABLE ADD COLUMN last_login TIMESTAMP NULL` |
| OK | Sửa lỗi bug mà output đúng với spec đã documented | Fix calculation trả về đúng số thay vì số sai |
| OK | Refactor internal implementation không đổi public API | Tách service thành 2 class nhưng interface giữ nguyên |
| OK | Cải thiện performance không thay đổi contract | Thêm index, cache — result giống nhau, nhanh hơn |

> **BLOCKER:** GRAY ZONE: Thay đổi error message, HTTP status code, thứ tự field trong JSON, hoặc thêm validation chặt hơn — có thể là breaking change tùy consumer. Phải đánh dấu là breaking change nếu không chắc.

## 9.2 Commit Convention cho Breaking Change

Breaking change PHẢI được khai báo trong commit message theo **2 vị trí bắt buộc**:

```text
# Cách 1 — Dấu chấm than (!) trong subject: phổ biến và ngắn gọn
<type>(<scope>)!: <subject>

# Cách 2 — BREAKING CHANGE footer: chi tiết hơn, kết hợp được với Cách 1
<type>(<scope>): <subject>
BREAKING CHANGE: <mô tả rõ thay đổi là gì và consumer cần làm gì>

# Kết hợp cả hai (recommended cho breaking change quan trọng):
feat(api)!: replace userId integer with UUID string
BREAKING CHANGE: userId field in all User endpoints changes from integer
to UUID string format (e.g. "a1b2c3d4-..."). Consumers must update any
int parsing to string.
Migration script at: db/migrations/2026_04_migrate_user_ids.sql
Refs: REQ-2001
```

## 9.3 Ví dụ commit message Breaking Change thực tế

| ✅ ĐÚNG — Breaking Change rõ ràng | ❌ SAI — Ẩn Breaking Change |
| :---- | :---- |
| `feat(payment)!: change amount from int to decimal` `BREAKING CHANGE: amount field changes from integer (cents) to decimal (dollars). Update all consumers parsing payment.amount. Refs: REQ-1500` | `feat(payment): update amount field` `// Không đề cập type thay đổi` `// Consumer không biết phải update gì` |
| `refactor(auth)!: remove legacy API key auth` `BREAKING CHANGE: X-API-Key header no longer accepted. All requests must use Bearer token. See migration guide: docs/auth-migration.md` | `refactor(auth): cleanup authentication` `// Ai biết được cleanup là gì?` `// API key bị xóa nhưng không ai hay` |

## 9.4 Semantic Versioning — Đánh version khi MR

Version format: **MAJOR.MINOR.PATCH** (ví dụ: 2.4.1). Quy tắc tăng version dựa trên loại thay đổi trong MR:

| Version | Tăng khi nào | Commit type | Ví dụ |
| :---- | :---- | :---- | :---- |
| **MAJOR (x.0.0)** | Breaking change — consumer PHẢI update code | Bất kỳ type + `!` hoặc `BREAKING CHANGE` footer | `1.4.2 → 2.0.0` khi xóa/đổi API |
| **MINOR (0.x.0)** | Tính năng mới, backward compatible — consumer KHÔNG cần update | `feat`, `feat!` khi KHÔNG có BREAKING CHANGE | `1.4.2 → 1.5.0` khi thêm endpoint mới |
| **PATCH (0.0.x)** | Bug fix, backward compatible — không thêm tính năng mới | `fix`, `hotfix`, `perf`, `refactor`, `docs`, `chore`, `test` | `1.4.2 → 1.4.3` khi fix bug calculation |

### Tag version trên GitLab sau khi merge

```bash
# Sau khi MR breaking change được merge vào main:
git checkout main && git pull

# Tạo annotated tag (recommended — có message đính kèm)
git tag -a v2.0.0 -m "feat(api)!: replace userId int with UUID
BREAKING CHANGE: userId changes to UUID string.
See migration guide in docs/breaking-changes/v2.0.0.md"
git push origin v2.0.0

# Hoặc dùng GitLab UI: Repository → Tags → New tag
# Tag name: v2.0.0
# Create from: main
# Message: paste breaking change description
```

## 9.5 Quy trình bắt buộc khi MR có Breaking Change

| # | Bước thực hiện | Ai làm |
| :---- | :---- | :---- |
| 1 | Commit message có dấu `!` và/hoặc `BREAKING CHANGE` footer với mô tả đầy đủ | Dev |
| 2 | MR description section "Breaking Changes" điền rõ: (a) thay đổi là gì, (b) consumer bị ảnh hưởng là ai, (c) migration plan | Dev |
| 3 | Reviewer xác nhận breaking change được document đủ — nếu thiếu migration plan = Blocker | Reviewer |
| 4 | Notify trực tiếp các team/service bị ảnh hưởng TRƯỚC khi merge (Slack, email) — không để họ tự phát hiện sau khi deploy | Dev + Tech Lead |
| 5 | Merge vào main, tạo GitLab tag với version mới (MAJOR bump nếu breaking change) | Maintainer |
| 6 | Cập nhật CHANGELOG.md với breaking change details và migration guide | Dev |
| 7 | Tạo migration script nếu cần (DB schema change, data transform) và verify trên staging trước production | Dev + QA |

> **LƯU Ý:** Deprecation trước Breaking Change: nếu có thể, thêm deprecation warning trước ít nhất 1 sprint. Giữ nguyên API cũ + thêm API mới (dual support), thông báo sunset date rõ ràng.

---

# 10. DEFINITION OF DONE — Checklist trước khi Submit

Hoàn thành checklist này **TRƯỚC KHI** assign reviewer. MR submit mà không qua self-review = vi phạm quy trình.

## A. Structure & Description

| | Tiêu chí | Mức độ |
| :---- | :---- | :---- |
| ☐ | MR title ngắn gọn, mô tả thay đổi theo Conventional Commits format | REQUIRED |
| ☐ | Description đầy đủ theo template: Thay đổi gì, Ticket, Steps to test, Checklist, AI Disclosure | **BLOCKER** |
| ☐ | AI Disclosure điền đầy đủ — kể cả khi KHÔNG dùng AI (tích vào ô "Không dùng AI") | REQUIRED |
| ☐ | MR size hợp lý — nếu > 400 LOC, đã giải thích lý do hoặc đã split | REQUIRED |
| ☐ | Breaking changes được ghi rõ với migration plan (nếu có) | REQUIRED |
| ☐ | Tất cả commit messages tuân thủ Conventional Commits, [AI] prefix đúng chỗ | REQUIRED |

## B. Code & Security

| | Tiêu chí | Mức độ |
| :---- | :---- | :---- |
| ☐ | Đã đọc toàn bộ diff của mình — không có dòng code nào chưa đọc qua | REQUIRED |
| ☐ | Không có debug statements: `console.log()`, `print()`, `debugger`, TODO không có ticket | **BLOCKER** |
| ☐ | Không có hardcoded secrets, API key, password, connection string | **BLOCKER** |
| ☐ | Input validation có đủ cho tất cả dữ liệu đến từ bên ngoài (user input, API response) | **BLOCKER** |
| ☐ | Không có raw SQL query ghép trực tiếp user input — dùng parameterized query hoặc ORM | **BLOCKER** |
| ☐ | Không có sensitive data trong logs (email, password, token, card number) | **BLOCKER** |
| ☐ | Nếu có AI-generated code: đã đọc kỹ từng dòng, hiểu logic, không có hallucinated API | REQUIRED |

## C. Testing & CI/CD

| | Tiêu chí | Mức độ |
| :---- | :---- | :---- |
| ☐ | CI/CD pipeline PASS hoàn toàn — không có failed job | **BLOCKER** |
| ☐ | Unit test đã được viết cho business logic mới — coverage đạt threshold | REQUIRED |
| ☐ | Test coverage không drop > 5% so với main branch (xem CI report) | REQUIRED |
| ☐ | Test names mô tả behavior rõ ràng, có test cho edge cases | REQUIRED |
| ☐ | Bug fix MR: đã thêm regression test để bug không tái xuất hiện | REQUIRED |

---

# 11. COMMENT CONVENTION — Cho Reviewer

Mọi comment trong MR PHẢI có prefix rõ ràng để author biết comment có blocking hay không:

| Prefix | Mức độ | Ví dụ |
| :---- | :---- | :---- |
| `Blocker:` | P0 — Phải fix | `Blocker: SQL injection risk tại dòng 47, user input đưa thẳng vào query` |
| `Required:` | P1 — Cần fix | `Required: thiếu error handling nếu API call timeout ở đây` |
| `Nit:` | P2 — Nhỏ, không block | `Nit: có thể dùng optional chaining ?.  cho ngắn hơn` |
| `Suggestion:` | P2 — Gợi ý | `Suggestion: consider extracting này thành helper để reuse` |
| `Q:` | Câu hỏi, không action | `Q: tại sao chọn Redis thay vì in-memory cache ở đây?` |
| `FYI:` | Thông tin, không action | `FYI: có ticket #234 đang refactor module này tuần tới` |
| `Praise:` | Khen ngợi | `Praise: cách xử lý edge case này rất tốt, đáng học!` |

> **LƯU Ý:** Reviewer response SLA: Hotfix = 2 giờ làm việc | Feature/Fix = 1 ngày làm việc. Quá hạn → ping trực tiếp hoặc escalate Tech Lead.

---

# QUICK REFERENCE — Checklist 1 trang

In trang này và dán lên màn hình. Dùng trước mỗi lần submit MR.

## CHECKLIST TRƯỚC KHI SUBMIT MR

| | **Commit & Description** | | **Code & Security** |
| :---- | :---- | :---- | :---- |
| ☐ | Commit message đúng Conventional Commits | ☐ | Không có debug statements **(BLOCKER)** |
| ☐ | [AI] prefix cho commit AI-assisted | ☐ | Không có hardcoded secrets **(BLOCKER)** |
| ☐ | MR description đủ 5 section của template | ☐ | Input validation đầy đủ **(BLOCKER)** |
| ☐ | AI Disclosure điền đầy đủ (kể cả "không dùng") | ☐ | Không có SQL injection risk **(BLOCKER)** |
| ☐ | MR size ≤ 400 LOC (hoặc đã giải thích) | ☐ | Không có PII/credentials trong logs **(BLOCKER)** |
| | **Testing & CI/CD** | | **AI-Generated Code** |
| ☐ | CI/CD pipeline PASS **(BLOCKER)** | ☐ | Đã đọc kỹ từng dòng AI sinh ra |
| ☐ | Unit test cho business logic mới | ☐ | Verify không có hallucinated API call |
| ☐ | Coverage không drop > 5% vs main | ☐ | AI pre-review security đã làm |
| ☐ | Test name mô tả behavior, có edge cases | ☐ | Logic AI đúng với yêu cầu ticket |

> 🔴 **BLOCKER** = không merge &nbsp;|&nbsp; 🟡 **REQUIRED** = phải fix &nbsp;|&nbsp; 🟢 **GOOD PRACTICE** = khuyến nghị &nbsp;|&nbsp; **[AI]** prefix bắt buộc cho mọi commit có AI assist

---

*Phiên bản 1.4 | Tháng 04/2026 | ENG-STD-MR-002 | Review định kỳ mỗi 6 tháng*