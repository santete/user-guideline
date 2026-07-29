# Coding Rules

> Rule cho việc viết / sửa code. Load khi Phase 0 phân loại task là "code change".
> Mỗi rule kèm RATIONALE để hiểu vì sao tồn tại.

---

## Naming

- **Files**: `kebab-case.ts` (vd: `user-service.ts`)
- **Folders**: `kebab-case/`
- **Classes / Types**: `PascalCase` (vd: `UserService`, `OrderStatus`)
- **Functions / Variables**: `camelCase` (vd: `getUser`, `isReady`)
- **Constants**: `SCREAMING_SNAKE_CASE` (vd: `MAX_RETRY`)
- **Boolean**: prefix `is` / `has` / `can` / `should`
- **Async function**: nếu trả về Promise thì tên rõ nghĩa (`fetchUser`, không phải `user`)

> ⚠️ TODO: tune cho language thật của project (Python: `snake_case` cho function/var, etc.)

---

## File Structure

- 1 file = 1 trách nhiệm chính
- Max ~300 dòng / file. Vượt → tách
- Max ~50 dòng / function. Vượt → tách
- Import order: built-in → external → internal absolute → relative
- Export: prefer named export, hạn chế default export

---

## Type Safety (nếu dùng TS / Python typed / Go)

- KHÔNG `any`, `unknown` mà không cast type rõ ràng
- KHÔNG `// @ts-ignore`, `# type: ignore` — phải fix root cause
- DTO / API contract: định nghĩa type / schema tại 1 chỗ duy nhất
- Validate input ở boundary (API, message queue), không validate lung tung giữa layer

---

## Error Handling

- KHÔNG silent catch (`catch (e) {}` rỗng)
- KHÔNG `catch` rồi `throw e` lại y nguyên — hoặc xử lý, hoặc để bubble up
- Error class: dùng custom error có context (`UserNotFoundError`, không phải `Error("not found")`)
- Log error với context: `userId`, `requestId`, `operation`
- Distinguish: expected error (4xx) vs unexpected error (5xx + alert)

---

## Async / Concurrency

- LUÔN handle Promise rejection — không có "fire and forget" trừ khi document rõ
- Race condition: dùng lock / transaction khi update shared state
- N+1 query: detect và batch (DataLoader, `IN (...)`, hoặc join)

---

## Comments

- Code tự explain > comment. Comment giải thích "**vì sao**", không phải "**làm gì**"
- TODO format: `// TODO(username, ticket): description`
- Không leave commented-out code — git có history

---

## Patterns được dùng trong project

> ⚠️ TODO: Điền pattern cụ thể của project. Vài ví dụ:

- **Layer**: Controller → Service → Repository (không skip layer)
- **DI**: <vd: dùng tsyringe / nestjs DI / manual constructor>
- **Validation**: <vd: zod / class-validator / pydantic>
- **Logging**: <vd: pino / winston / structlog>

---

## Anti-patterns (BANNED)

- ❌ God object / God function (>200 dòng, >10 params)
- ❌ Magic number không có constant
- ❌ Mutate function argument
- ❌ Side effect ở module level (top-level code chạy lúc import)
- ❌ Catch lỗi rồi return `null` / `undefined` mà không log
- ❌ Hardcode URL, API key, magic string
- ❌ Copy-paste code thay vì refactor

---

## When Adding New Dependency

Trước khi `pnpm add` / `pip install` / `go get`:

1. Có thể giải quyết bằng stdlib hoặc package có sẵn không?
2. Package có maintained không? (last commit < 1 năm, > 100 weekly downloads)
3. License có conflict không? (GPL / AGPL → cẩn thận)
4. Bundle size impact (frontend đặc biệt quan trọng)
5. → Báo user xác nhận TRƯỚC khi install (xem CLAUDE.md "Hard Stops")
