# Testing Rules

> Rule cho viết / sửa test. Load khi đụng test code.

---

## Strategy

### Test Pyramid
- **Unit (70%)**: Test 1 function / class isolation, mock dependencies
- **Integration (20%)**: Test multiple unit phối hợp, có thể đụng DB/cache thật (in-memory hoặc test container)
- **E2E (10%)**: Test full user flow qua API / UI

KHÔNG đảo ngược pyramid — too many E2E = chậm + flaky + khó debug.

---

## Coverage

- Unit test coverage: ≥ 80% cho module business critical
- KHÔNG ép 100% — code đơn giản (getter, DTO) không cần test
- Coverage không phải mục tiêu cuối — **test đúng case quan trọng** > **coverage cao**

---

## Naming

### File
- `<source-file>.test.<ext>` (vd: `user-service.test.ts`)
- HOẶC trong folder `__tests__/` cạnh source

### Test name
- Pattern: `should <expected> when <condition>`
- Hoặc: `<method>(): <case>`

```ts
// ✅ Good
it('should return null when user not found', ...)
it('should throw ValidationError when email invalid', ...)
it('createUser(): rejects duplicate email', ...)

// ❌ Bad
it('test1', ...)
it('works', ...)
it('user', ...)
```

---

## Structure: Arrange - Act - Assert (AAA)

```ts
it('should hash password before saving', async () => {
  // Arrange
  const dto = { email: 'a@b.com', password: 'plain123' };
  const repo = createMockRepo();
  const service = new UserService(repo);

  // Act
  await service.createUser(dto);

  // Assert
  expect(repo.save).toHaveBeenCalledWith(
    expect.objectContaining({ password: expect.not.stringContaining('plain123') })
  );
});
```

---

## What to Test

### Must test
- Happy path
- Error path (input sai, dependency fail)
- Edge case: null, empty, max value, boundary
- Authorization (user không có quyền → reject)
- Race condition (nếu có concurrency)

### Don't test
- Framework / library code (đã có test của tác giả)
- Trivial getter / setter
- Logging output (trừ khi log là contract)
- Implementation detail (test behavior, không test how)

---

## Mocking

- Mock external dependency: HTTP, DB, time, random, file system
- KHÔNG mock thứ mình đang test (object under test)
- KHÔNG over-mock — nếu mock 5 thứ để test 1 function → có lẽ thiết kế sai
- Time-dependent test: dùng fake timer (`vi.useFakeTimers()`, `freezegun`)
- Random: seed hoặc inject random source

---

## Test Data

- Factory pattern thay vì copy-paste object: `userFactory.build({ email: 'x' })`
- KHÔNG share state giữa test (mỗi test setup riêng, teardown riêng)
- Dùng `beforeEach` để reset, KHÔNG dùng `beforeAll` cho mutable state

---

## Database Test

- KHÔNG test trên DB production / staging
- Test container (Postgres in Docker) hoặc SQLite in-memory cho speed
- Migration chạy trước test
- Mỗi test wrap trong transaction → rollback (giữ DB clean)
- HOẶC truncate table sau mỗi test

---

## Async Test

- LUÔN `await` — không có "fire and forget"
- Test promise rejection: `await expect(fn()).rejects.toThrow(...)`
- Timeout cho test chậm: `it('...', { timeout: 10000 }, ...)`
- Flaky test do timing → fix bằng deterministic wait, KHÔNG `setTimeout`

---

## E2E / Integration

- Chạy trên CI, không phải local mỗi commit
- Test data: seed riêng cho test, KHÔNG dùng prod data
- Cleanup sau mỗi test run
- Retry policy cho flaky network: 1-2 lần, không quá 3
- Capture screenshot / video khi fail

---

## Anti-patterns

- ❌ Test có if/else branching → tách thành 2 test
- ❌ Multiple assertion không liên quan trong 1 test
- ❌ Test phụ thuộc thứ tự chạy (test A phải chạy trước test B)
- ❌ Sleep / setTimeout để "wait for async"
- ❌ Comment out failing test (xem CLAUDE.md hard stops)
- ❌ `expect(true).toBe(true)` placeholder để pass coverage

---

## CI Integration

- Test phải pass trên CI mới merge được
- Chạy theo thứ tự: lint → typecheck → unit → integration → e2e
- Fail fast: stop ngay khi 1 stage fail
- Cache `node_modules` / `.venv` để CI nhanh
