---
type: compliance-rules
domain: gitlab-merge-request
audience: ai-agent
purpose: code-generation
source: MR_Compliance_Guide_v1.6
authoritative: true
language: vi
last_updated: 2026-04
---

# Quy tắc tuân thủ MR — Tham chiếu cho AI Agent

> File distill từ MR Compliance Guide v1.6. Áp dụng cho AI Agent sinh code, commit message, MR description.
> Mỗi rule có ID stable. Khi vi phạm BLOCKER → từ chối generate. Vi phạm REQUIRED → cảnh báo + xin confirm.

## Mức độ vi phạm (severity)

- **BLOCKER** — Tuyệt đối không generate output vi phạm. Block ngay, không thương lượng.
- **REQUIRED** — Phải tuân thủ. Reviewer sẽ block merge nếu thiếu.
- **GOOD_PRACTICE** — Khuyến nghị. Tuân nếu có thể, không bắt buộc.

## Tầng kiểm tra (tier)

- **AUTO_GATE** — CI/GitLab tự enforce. Agent code đúng để pipeline pass.
- **DEV_SELF_CHECK** — Agent (đóng vai dev) PHẢI verify trước khi submit MR.
- **REVIEWER_VERIFY** — Human review. Agent generate đúng để giảm gánh nặng.

---

## R-BRANCH: Branch naming

### R-BRANCH-001
- **title**: Branch prefix bắt buộc
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Branch name PHẢI bắt đầu bằng prefix hợp lệ + `/` + slug ngắn (kebab-case)
- **allowed_prefixes**:
  - `feature/` — tính năng mới (branch từ `develop`)
  - `bugfix/` — fix bug thường (branch từ `develop`)
  - `hotfix/` — fix bug production khẩn cấp (branch từ `main`)
  - `release/` — chuẩn bị release (branch từ `develop`)
  - `chore/` — task kỹ thuật (CI, deps, config)
  - `docs/` — chỉ cập nhật tài liệu
- **pattern**: `^(feature|bugfix|hotfix|release|chore|docs)/[a-z0-9-]+$`
- **examples_pass**:
  - `feature/auth-add-oauth2-login`
  - `bugfix/billing-null-tax-rate`
  - `hotfix/payment-gateway-timeout`
- **examples_fail**:
  - `feat/login` — sai prefix (phải là `feature`)
  - `fix/bug` — sai prefix (phải là `bugfix`)
  - `Feature/Login` — không được dùng PascalCase
  - `john-feature-1` — thiếu prefix

---

## R-COMMIT: Commit message

### R-COMMIT-001
- **title**: Conventional Commits format
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Commit message PHẢI theo format Conventional Commits
- **pattern**: `<type>(<scope>): <subject>`
- **allowed_types**:
  - `feat` — tính năng mới
  - `fix` — sửa bug
  - `refactor` — refactor code, không đổi behavior
  - `docs` — chỉ thay đổi tài liệu
  - `test` — thêm/sửa test
  - `chore` — task kỹ thuật, build, deps
  - `perf` — cải thiện performance
  - `style` — format, semicolon, không đổi logic
- **subject_rules**:
  - viết bằng tiếng Anh
  - imperative mood (`add`, không phải `added`/`adding`)
  - không kết thúc bằng dấu chấm
  - dưới 72 ký tự
- **examples_pass**:
  - `feat(auth): add OAuth2 login flow`
  - `fix(billing): handle null tax_rate in invoice`
  - `refactor(api): extract validator to separate class`
- **examples_fail**:
  - `update code` — thiếu type
  - `feat: stuff` — subject không cụ thể
  - `feat(auth): added new login.` — sai mood, có dấu chấm
  - `WIP` — không có ý nghĩa

### R-COMMIT-002-AI
- **title**: AI Disclosure tag
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Commit có code AI hỗ trợ PHẢI có tag `[AI]` ở cuối subject
- **applies_when**: `ai_assistance.used == true`
- **ai_assistance_categories** (tag áp dụng nếu thuộc 1 trong các nhóm này):
  - viết code mới
  - refactor code hiện có
  - viết test
  - debug / investigate
- **example_pass**: `feat(payment): add Stripe webhook handler [AI]`
- **example_fail**: `feat(payment): add Stripe webhook handler` — thiếu tag dù dùng AI
- **rationale**: Tracking AI adoption metrics tự động qua Git log. Khai báo trung thực — đây là KPI team, không đánh giá cá nhân.

---

## R-CODE: Nội dung code

### R-CODE-001
- **title**: Cấm debug code còn sót
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Code submit KHÔNG được chứa debug statement còn sót
- **forbidden_patterns**:
  - `console.log(`, `console.debug(` — JS/TS
  - `print(` — Python (trừ CLI/script intentional)
  - `pp(`, `binding.pry` — Ruby
  - `var_dump(`, `dd(` — PHP/Laravel
  - `breakpoint()` — Python
  - `debugger;` — JS/TS
- **exception**: Logging có chủ ý → dùng logger framework (`logger.info`, `log.debug`)
- **agent_action**: Trước khi commit, scan diff cho các pattern trên. Tìm thấy → xóa hoặc thay bằng logger.

### R-CODE-002
- **title**: Cấm hardcoded secret
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: KHÔNG được hardcode credential, API key, password, token, JWT secret trong source
- **forbidden_patterns**:
  - `password = "..."` (literal value)
  - `api_key = "sk_..."`, `Bearer eyJ...`
  - `mysql://user:pass@host`
  - AWS access key (`AKIA...`)
  - GitHub PAT (`ghp_...`)
- **required_alternatives**:
  - environment variable: `process.env.X`, `os.getenv("X")`
  - secret manager: Vault, AWS Secrets Manager, GCP Secret Manager
  - config file ngoài git: `.env.local` (trong `.gitignore`)
- **examples_fail**:
  - `const apiKey = "sk-1234567890abcdef"`
  - `DATABASE_URL = "postgres://admin:p@ssw0rd@db.prod"`
- **examples_pass**:
  - `const apiKey = process.env.STRIPE_API_KEY`
  - `DATABASE_URL = config.get("database.url")`

### R-CODE-003
- **title**: Cấm log PII raw
- **severity**: BLOCKER
- **tier**: REVIEWER_VERIFY
- **rule**: KHÔNG được log thông tin định danh cá nhân (PII) ở dạng raw
- **pii_examples**: email, phone, CCCD/CMND, password, JWT, full credit card number, full name + DOB
- **required_handling**:
  - mask: `user@***.com`, `094***1234`
  - hash: `sha256(email)`
  - bỏ hẳn khỏi log
- **example_fail**: `logger.info(f"User {user.email} logged in with password {password}")`
- **example_pass**: `logger.info(f"User {user.id} logged in")`

### R-CODE-004
- **title**: Input validation bắt buộc
- **severity**: BLOCKER
- **tier**: REVIEWER_VERIFY
- **rule**: Mọi external input PHẢI được validate trước khi xử lý
- **external_input_sources**:
  - HTTP request body / query params / path params
  - message queue payload (Kafka, RabbitMQ)
  - file upload
  - third-party API response
- **required_check**: Validation rule rõ ràng (length, format, type, range, enum)
- **recommended_libs**: Joi, zod, pydantic, JSR-303, FluentValidation

### R-CODE-005
- **title**: Tránh SQL injection
- **severity**: BLOCKER
- **tier**: AUTO_GATE
- **rule**: KHÔNG được build SQL query bằng string concatenation với user input
- **forbidden**:
  - `f"SELECT * FROM users WHERE id = {user_id}"` (Python f-string)
  - `"SELECT * FROM x WHERE id=" + id` (JS concat)
  - String interpolation any language
- **required**: parameterized query / prepared statement / ORM
- **examples_fail**:
  - `cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")`
- **examples_pass**:
  - `cursor.execute("SELECT * FROM users WHERE name = %s", (name,))`
  - `User.objects.filter(name=name)` (ORM)

---

## R-TEST: Testing

### R-TEST-001
- **title**: Unit test cho business logic mới
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: Code có business logic mới PHẢI có unit test cover behavior
- **not_required_for**: pure UI styling, config-only change, docs change, generated code, migration script
- **coverage_target**: ≥ 80% line coverage cho file mới
- **required_cases**: Mỗi function business mới có ít nhất 1 happy path + 1 edge case + 1 error case

### R-TEST-002
- **title**: Lint local pass trước khi push
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Chạy linter local và fix mọi error trước khi push
- **agent_action**: Trước khi commit, chạy lint command của project (`eslint`, `pylint`, `ktlint`, `detekt`, `golangci-lint`...) và đảm bảo zero error.

### R-TEST-003
- **title**: Unit test local pass
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Chạy unit test local và đảm bảo PASS trước khi push
- **agent_action**: Chạy `npm test` / `pytest` / `mvn test` / `gradle test` / `go test ./...` tương ứng. Fail → fix trước khi commit, không submit code đỏ.

---

## R-MR: Merge Request

### R-MR-001-LOC
- **title**: Giới hạn LOC theo loại MR
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: MR nên ở trong ngưỡng khuyến nghị; vượt max phải comment lý do
- **limits**:
  - `hotfix`: recommended 100, max 200
  - `bugfix`: recommended 200, max 400
  - `feature` (BE): recommended 400, max 600
  - `feature` (FE): recommended 600, max 900
  - `chore` / `refactor`: recommended 400, max 800
- **override_rule**: Vượt max → bắt buộc comment lý do trong MR description
- **agent_action**: Generate diff vượt recommended → đề xuất tách MR thành nhiều phần. Vượt max → block, hỏi human confirm.

### R-MR-002-DESCRIPTION
- **title**: MR description đầy đủ 8 section
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: MR description PHẢI có đủ 8 section template
- **required_sections**:
  1. **Thay đổi này làm gì?** — mô tả ngắn LÀM GÌ và TẠI SAO (KHÔNG mô tả HOW — code tự nói)
  2. **Ticket** — `Closes #<issue-number>` hoặc `Ref: PROJ-XXX`
  3. **Cách kiểm tra** — list bước reproduce/verify
  4. **Self-review checklist** — tick các item self-check (xem R-MR-CHECKLIST)
  5. **AI Disclosure** — chọn 1 trong 2 option (xem R-MR-003-AI-DISCLOSURE)
  6. **MR Type** — label scope (e.g. `scope:ui` cho MR UI)
  7. **Breaking Changes** — ghi `N/A` nếu không có
  8. **Screenshots** — bắt buộc nếu UI thay đổi (xem R-MR-005)

### R-MR-003-AI-DISCLOSURE
- **title**: AI Disclosure mutually exclusive
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Trong AI Disclosure section, PHẢI chọn ĐÚNG 1 trong 2 option (không được tick cả 2 hoặc không tick gì)
- **option_a**: `[ ] Không dùng AI trong MR này`
- **option_b**: `[ ] Dùng AI — đã thêm tag [AI] vào cuối subject của các commit liên quan`
- **if_option_b_chosen** — phải tick các sub-items áp dụng:
  - `[ ] Viết code mới`
  - `[ ] Refactor code hiện có`
  - `[ ] Viết test`
  - `[ ] Debug / investigate`
  - `[ ] % LOC AI-assisted (ước tính): ___%`
  - `[ ] Đã đọc kỹ và hiểu từng dòng AI sinh ra`

### R-MR-004-LINKED-TICKET
- **title**: Linked ticket bắt buộc
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: MR PHẢI có link tới ticket/issue nguồn
- **format**:
  - GitLab issue: `Closes #123`
  - Jira: `Ref: PROJ-456`
- **exception**: chore/docs nhỏ có thể không có ticket nhưng phải ghi `Ref: N/A — <lý do>`

### R-MR-005-SCREENSHOTS-UI
- **title**: Screenshot bắt buộc cho thay đổi UI
- **severity**: REQUIRED
- **tier**: REVIEWER_VERIFY
- **rule**: MR có thay đổi UI PHẢI đính kèm screenshot before/after
- **trigger**: label `scope:ui` HOẶC diff chứa file UI
- **ui_file_extensions**: `.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`, `.styled.ts`

### R-MR-006-REBASED
- **title**: Rebase trước khi tạo MR
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Branch PHẢI được rebase từ nhánh đích mới nhất, không có conflict
- **agent_action**: Trước khi tạo MR: `git fetch origin <target-branch>` → `git rebase origin/<target-branch>` → resolve conflict (nếu có) → `git push --force-with-lease`

---

## R-MR-CHECKLIST: Self-review checklist (Section 4.1)

> 6 item TICK lúc tạo MR. Đây là DEV_SELF_CHECK — agent tick được vì đã verify trước khi push.

```
[ ] Đã chạy lint local pass                  (R-TEST-002)
[ ] Đã chạy unit test local pass              (R-TEST-003)
[ ] Không có debug code                        (R-CODE-001)
[ ] Không có hardcoded secret                  (R-CODE-002)
[ ] Commit messages đúng Conventional Commits  (R-COMMIT-001)
[ ] Đã rebase từ nhánh đích mới nhất           (R-MR-006-REBASED)
```

> ⚠️ **KHÔNG** đưa các item AUTO_GATE vào self-review (CI pipeline pass, coverage, SAST). Đó là việc của hệ thống, không phải dev tick.

---

## R-AUTOGATE: Automated gates (informational)

> Agent KHÔNG tick các item này. Code đúng để pipeline pass.

| ID | Title | Severity | Enforcement |
|---|---|---|---|
| R-AUTOGATE-001 | CI/CD pipeline pass | BLOCKER | GitLab `Settings → Merge requests → Pipelines must succeed` |
| R-AUTOGATE-002 | Code coverage threshold | REQUIRED | Coverage tổng không giảm; file mới ≥ 80% |
| R-AUTOGATE-003 | SAST scan pass | BLOCKER | Không có vulnerability High/Critical |
| R-AUTOGATE-004 | Lint zero error | REQUIRED | Linter trên CI zero error |

---

## Quy trình tổng cho Agent (workflow)

```
1. NHẬN task → xác định loại (feature/bugfix/hotfix/chore/docs)
2. TẠO branch theo R-BRANCH-001
3. SINH code:
   - Tuân R-CODE-001..005 (no debug, no secret, no PII log, validate input, no SQL inject)
   - Viết unit test theo R-TEST-001 nếu có business logic
4. CHECK trước commit:
   - Chạy lint (R-TEST-002) → fix tới zero error
   - Chạy unit test (R-TEST-003) → ensure PASS
   - Scan diff cho debug code & secret
5. COMMIT:
   - Format Conventional Commits (R-COMMIT-001)
   - Thêm tag [AI] cuối subject (R-COMMIT-002-AI)
6. REBASE (R-MR-006-REBASED) → push
7. TẠO MR:
   - Description đủ 8 section (R-MR-002)
   - Link ticket (R-MR-004)
   - AI Disclosure đúng 1 option (R-MR-003)
   - Tick 6 item self-review (R-MR-CHECKLIST)
   - Screenshot nếu UI (R-MR-005)
8. ĐỢI auto-gates xanh → reviewer approve → merge
```

---

## Hành xử khi vi phạm

| Vi phạm | Agent action |
|---|---|
| BLOCKER | Dừng generate, báo human, KHÔNG submit |
| REQUIRED | Cảnh báo human, hỏi confirm trước khi tiếp tục |
| GOOD_PRACTICE | Note trong commit/MR description, không block |

---

*File này là tham chiếu authoritative cho AI Agent. Khi conflict với hướng dẫn khác, file này thắng. Update theo `MR_Compliance_Guide` khi có version mới.*
