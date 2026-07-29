# Database Rules

> Rule cho schema, migration, query. Load khi đụng database.

---

## Schema Design

### Naming
- Table: `snake_case`, plural (`users`, `order_items`)
- Column: `snake_case` (`created_at`, `user_id`)
- Index: `idx_<table>_<columns>` (`idx_users_email`)
- Foreign key: `fk_<table>_<ref_table>` (`fk_orders_users`)
- Unique constraint: `uq_<table>_<columns>` (`uq_users_email`)

### Required Columns
Mọi table BẮT BUỘC có:
- `id` (UUID hoặc bigint, primary key)
- `created_at` (timestamp with timezone, default now)
- `updated_at` (timestamp with timezone, auto update)

Tables có soft delete:
- `deleted_at` (nullable timestamp)

### Types
- ID: UUID v4 (distributed-friendly) HOẶC bigint (gọn hơn cho monolith)
- Tiền: `decimal(19, 4)`, KHÔNG `float` (precision loss)
- Timestamp: LUÔN `timestamptz`, KHÔNG `timestamp` thường
- Enum: dùng table riêng (lookup table) HOẶC native enum (cẩn thận khi cần thêm value)
- JSON: chỉ khi structure thật sự dynamic; nếu có schema rõ → tạo column riêng

---

## Indexing

- Index column dùng trong `WHERE`, `JOIN`, `ORDER BY`
- Composite index: thứ tự column theo selectivity (cao trước)
- KHÔNG over-index: mỗi index làm chậm INSERT / UPDATE
- Foreign key column → LUÔN có index
- Đo bằng `EXPLAIN ANALYZE` trước khi thêm index

---

## Migration

### Rules
- 1 migration = 1 thay đổi logical
- LUÔN backward compatible với code đang chạy
  (deploy DB trước → deploy code → cleanup migration sau)
- KHÔNG sửa migration đã merge — tạo migration mới
- Test migration cả `up` và `down` (rollback)
- Migration trên prod: chạy ngoài giờ peak, có backup trước

### Pattern: Add column safely
```
Step 1: ADD COLUMN nullable
Step 2: Backfill data (batch, không khóa table)
Step 3: ADD NOT NULL constraint (sau khi backfill xong)
Step 4: Code dùng column mới
```

### Pattern: Remove column safely
```
Step 1: Code ngừng đọc / ghi column
Step 2: Deploy code
Step 3: DROP COLUMN (migration sau, có thể vài tuần sau)
```

### Pattern: Rename column
```
KHÔNG rename trực tiếp.
Step 1: ADD new column
Step 2: Backfill + dual-write (code ghi cả 2 column)
Step 3: Migrate read sang column mới
Step 4: Stop write column cũ
Step 5: DROP column cũ
```

---

## Query

- KHÔNG `SELECT *` trong production code (chọn cột cần)
- KHÔNG N+1 — dùng JOIN, IN clause, hoặc DataLoader
- LIMIT mọi query trả list (default LIMIT, max LIMIT)
- Transaction cho operation đọc-rồi-ghi shared state
- KHÔNG raw SQL khi ORM làm được — raw SQL chỉ khi cần performance / feature riêng
- Khi raw SQL: parameterized query, KHÔNG string concat (SQL injection)

---

## Performance

- Query > 100ms → optimize hoặc cache
- Query đụng table > 1M rows → MUST có index phù hợp
- Pagination: cursor-based khi data lớn
- Cache layer cho read-heavy: Redis, TTL hợp lý
- Avoid: `LIKE '%foo%'` (full table scan), `OR` qua nhiều column khác nhau

---

## Data Safety

### Hard Stops (Phase 0 hard stop — luôn hỏi user)
- `DROP TABLE`, `DROP COLUMN`
- `TRUNCATE`
- `DELETE` không có `WHERE` hoặc `WHERE` quá broad
- `UPDATE` không có `WHERE`
- Migration trên prod
- Bất kỳ query nào động vào > 1000 rows

### Backup
- Daily automated backup (giữ ≥ 30 ngày)
- Test restore quy trình mỗi quý
- Trước migration lớn: snapshot manual

---

## Sensitive Data

- Password: `bcrypt` / `argon2`, KHÔNG MD5 / SHA256
- PII (email, phone, ID): cân nhắc encrypt at rest
- Credit card: KHÔNG lưu trừ khi PCI DSS compliant — dùng token từ payment provider
- Audit log cho mọi access vào sensitive table
