# Git Convention

> Rule cho commit, branch, PR. Load khi Phase 0 phân loại task là "git operation".

---

## Commit Message

Format: `<type>(<scope>): <subject>`

### Type
| Type     | Khi nào dùng                                           |
|----------|--------------------------------------------------------|
| `feat`   | Thêm feature mới                                       |
| `fix`    | Fix bug                                                |
| `docs`   | Sửa doc, README, comment                               |
| `style`  | Format, đổi space/indent (KHÔNG đổi logic)             |
| `refactor` | Refactor code, không thêm feature, không fix bug    |
| `perf`   | Cải thiện performance                                  |
| `test`   | Thêm / sửa test                                        |
| `chore`  | Build, tooling, config (vd: update dep)                |
| `ci`     | CI/CD config                                           |
| `build`  | Build system, package config                           |
| `revert` | Revert commit trước                                    |

### Scope
- Lowercase, kebab-case
- Tên module / domain (vd: `auth`, `payment`, `user-profile`)
- Optional, nhưng khuyến khích có

### Subject
- ≤ 72 ký tự
- Tiếng Anh, viết thường, imperative mood (`add`, không phải `added` / `adds`)
- KHÔNG dấu chấm cuối câu

### Body (optional)
- Wrap 72 ký tự / dòng
- Giải thích "**vì sao**" thay vì "**làm gì**" (diff đã nói "làm gì" rồi)

### Footer (optional)
- `Refs: #123`        — tham chiếu issue
- `Closes: #123`      — đóng issue khi merge
- `BREAKING CHANGE:`  — mô tả breaking change

### Ví dụ ĐÚNG
```
feat(auth): add JWT refresh token endpoint
fix(payment): handle null response from VNPay callback
refactor(user): extract email validation to shared util
docs(readme): update local setup for M-series Mac
chore(deps): bump zod to 3.23.8

feat(api): support cursor-based pagination

Offset pagination doesn't scale beyond 100k records due to
DB index limitations. Cursor-based approach uses indexed
primary key, scaling to millions of rows.

Closes: #456
```

### Ví dụ SAI
```
❌ Update code                    (không có type, vague)
❌ feat: Fixed bug.               (sai type, có dấu chấm, capitalized)
❌ feat(Auth): Add JWT...         (scope viết hoa)
❌ fix bug login                  (thiếu type / scope, không clear)
❌ feat(auth): added JWT refresh token endpoint that allows users to renew their session token without re-authenticating  (subject quá dài)
```

---

## Branch Naming

Format: `<type>/<ticket-id>-<short-desc>`

| Type        | Khi nào                                  |
|-------------|------------------------------------------|
| `feature/`  | Feature mới                              |
| `fix/`      | Bug fix thường                           |
| `hotfix/`   | Bug critical trên prod, cần merge nhanh  |
| `chore/`    | Tooling, config, refactor không user-facing |
| `docs/`     | Chỉ doc                                  |
| `release/`  | Branch release (vd: `release/v1.2.0`)    |

### Format
- Lowercase, kebab-case
- `<ticket-id>` lấy từ Jira / Linear / GitHub issue (vd: `PROJ-123`)
- `<short-desc>` ngắn gọn, 3-5 từ

### Ví dụ
```
✅ feature/PROJ-123-jwt-refresh
✅ fix/PROJ-456-vnpay-null-callback
✅ hotfix/PROJ-789-payment-double-charge
✅ chore/upgrade-node-22

❌ john-branch                   (không có type, không meaningful)
❌ feature/NewLoginFlow          (PascalCase, không có ticket)
❌ fix/bug                       (vague)
```

---

## Branch Rules

- KHÔNG commit trực tiếp vào `main` / `master` / `develop`
- KHÔNG `git push --force` lên branch chung — chỉ `--force-with-lease` lên branch riêng
- KHÔNG rebase / rewrite history sau khi đã push lên branch shared
- Branch life: < 1 tuần. Vượt → merge / rebase với base branch để tránh drift
- Delete branch sau khi merge

---

## Pull Request

### Title
- Cùng format với commit message: `<type>(<scope>): <subject>`

### Description (template)
```markdown
## What
<mô tả ngắn gọn thay đổi>

## Why
<vì sao cần thay đổi này>

## How
<cách tiếp cận, decision quan trọng>

## Testing
<đã test gì, manual hay automated>

## Screenshots / Recording
<nếu UI change>

## Checklist
- [ ] Đã chạy lint, typecheck, test local
- [ ] Đã update doc nếu cần
- [ ] Đã thêm test cho code mới
- [ ] Không có secret / API key trong code
- [ ] Reviewer đã được assign
```

### Rules
- 1 PR = 1 logical change. Không gom 5 feature vào 1 PR
- PR < 400 dòng diff (lý tưởng < 200). Vượt → tách
- Phải có ≥ 1 reviewer approve trước khi merge
- CI phải xanh
- Strategy: **Squash and merge** (giữ history sạch) — tune theo team

---

## Tags & Releases

- Semver: `vMAJOR.MINOR.PATCH` (vd: `v1.2.3`)
- Tag trên `main` sau khi release thành công
- Release note auto generate từ commit message (yêu cầu commit theo convention)

---

## Pre-commit Checks (chạy local)

> Đảm bảo các check này pass TRƯỚC khi commit. Hooks (`.claude/settings.json`
> và `.husky/`) sẽ enforce — nhưng tốt nhất là tự chạy trước.

```bash
<lint-cmd>          # vd: pnpm lint
<typecheck-cmd>     # vd: pnpm typecheck
<test-cmd>          # chỉ test liên quan
```
