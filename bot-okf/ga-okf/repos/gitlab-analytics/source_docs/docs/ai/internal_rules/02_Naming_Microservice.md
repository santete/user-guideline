---
type: naming-convention-rules
domain: microservices
audience: ai-agent
purpose: code-generation
source: Naming_Convention_v2.0.0_Telco_ISP
authoritative: true
language: vi
last_updated: 2026-04
---

# Naming Convention — Tham chiếu cho AI Agent

> File distill từ Naming Convention v2.0.0 (Telco ISP Domain). Áp dụng cho AI Agent sinh code, schema, migration, event.
> Mỗi rule có ID stable. Vi phạm BLOCKER → từ chối generate. Vi phạm REQUIRED → cảnh báo + xin confirm.

## Nguyên tắc tổng

**2 nhóm engine, 2 convention:**

| | SQL (MySQL/PostgreSQL/MSSQL) | NoSQL (MongoDB) |
|---|---|---|
| Style | `snake_case` xuyên suốt | DB: `snake_case` · Collection/Field: `camelCase` |
| Schema | Cố định, ACID, JOIN | Linh hoạt, embed, scale ngang |

**Quy tắc bất di bất dịch:** Tên service KHÔNG bao giờ chứa tên DB engine. Service name phản ánh **nghiệp vụ**, không phải hạ tầng.

## Mức độ vi phạm

- **BLOCKER** — Tuyệt đối không generate. Vi phạm = code review reject.
- **REQUIRED** — Phải tuân thủ. Reviewer block merge nếu sai.
- **GOOD_PRACTICE** — Khuyến nghị. Tuân nếu có thể.

---

## R-SVC: Service naming

### R-SVC-001
- **title**: Service name format
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Tên service PHẢI là `kebab-case` + suffix `-svc`
- **pattern**: `^[a-z][a-z0-9]*(-[a-z0-9]+)*-svc$`
- **examples_pass**:
  - `billing-svc`
  - `customer-svc`
  - `addon-provisioning-svc`
  - `line-provisioning-svc`
- **examples_fail**:
  - `BillingSvc` — không được PascalCase
  - `billing_svc` — không được snake_case
  - `billingService` — không được camelCase, suffix sai
  - `billing` — thiếu suffix `-svc`

### R-SVC-002
- **title**: Cấm tên DB engine trong service name
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Service name TUYỆT ĐỐI KHÔNG được chứa tên DB engine. Service name phản ánh nghiệp vụ, không hạ tầng.
- **forbidden_keywords** (case-insensitive): `mongo`, `mongodb`, `sql`, `mysql`, `postgres`, `postgresql`, `mssql`, `nosql`, `redis`, `elastic`, `kafka`
- **examples_fail**:
  - `mongo-product-service` — chứa "mongo"
  - `postgres-billing-handler` — chứa "postgres"
  - `sql-customer-svc` — chứa "sql"
  - `redis-cache-svc` — chứa "redis"
- **examples_pass**:
  - `product-catalog-svc` — phản ánh nghiệp vụ "product catalog"
  - `billing-svc` — phản ánh nghiệp vụ "billing"
- **rationale**: Quyết định chọn DB là kỹ thuật nội bộ, có thể đổi sau. Tên service phải bền vững theo nghiệp vụ.

### R-SVC-003
- **title**: Service name phản ánh Bounded Context (DDD)
- **severity**: GOOD_PRACTICE
- **tier**: REVIEWER_VERIFY
- **rule**: Tên service nên trùng với Bounded Context trong domain model, không nên đặt theo tech stack hay layer
- **examples_pass**: `customer-svc`, `subscription-svc`, `complaint-svc`
- **examples_fail**: `api-gateway-helper-svc`, `data-processor-svc` (mơ hồ)

---

## R-SQL: SQL conventions (MySQL / PostgreSQL / MS SQL Server)

### R-SQL-DB-001
- **title**: SQL database name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: SQL database name dùng `snake_case` + suffix `_db`
- **pattern**: `^[a-z][a-z0-9_]*_db$`
- **examples_pass**:
  - `billing_db`
  - `customer_db`
  - `subscription_db`
  - `addon_lifecycle_db`
- **examples_fail**:
  - `BillingDB` — không được PascalCase
  - `billing` — thiếu suffix `_db`
  - `billing-db` — không được kebab-case

### R-SQL-DB-002
- **title**: SQL schema name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: SQL schema dùng `snake_case`, KHÔNG dùng schema mặc định (`dbo` của MSSQL hoặc `public` của PostgreSQL)
- **pattern**: `^[a-z][a-z0-9_]*$`
- **examples_pass**: `billing.charge_items`, `subscription.subscriptions`
- **examples_fail**:
  - `dbo.charge_items` — dùng schema mặc định MSSQL
  - `public.subscriptions` — dùng schema mặc định PostgreSQL
  - `Billing.charge_items` — không được PascalCase

### R-SQL-OBJ-001
- **title**: SQL table name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Table name dùng `snake_case` và LUÔN số nhiều
- **pattern**: `^[a-z][a-z0-9_]*s$` (kết thúc bằng `s` — không bắt buộc nhưng khuyến nghị)
- **examples_pass**:
  - `charge_items`
  - `subscriptions`
  - `invoice_lines`
  - `payment_attempts`
- **examples_fail**:
  - `ChargeItem` — không được PascalCase
  - `chargeItems` — không được camelCase
  - `subscription` — phải số nhiều
  - `charge_item` — phải số nhiều

### R-SQL-OBJ-002
- **title**: SQL column name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Column name dùng `snake_case`
- **pattern**: `^[a-z][a-z0-9_]*$`
- **examples_pass**:
  - `customer_id`
  - `created_at`
  - `total_amount`
  - `is_active`
- **examples_fail**:
  - `customerId` — không được camelCase
  - `CustomerId` — không được PascalCase
  - `customer-id` — không được kebab-case

### R-SQL-OBJ-003
- **title**: SQL primary key
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Primary key tên là `id` kiểu UUID
- **postgresql_mysql**: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- **mssql**: `id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY`
- **examples_fail**:
  - `customer_id` làm PK của bảng `customers` — phải đặt là `id`
  - `BIGINT AUTO_INCREMENT` — không dùng auto-increment integer (lý do: cross-service ref cần UUID để không lộ business volume)

### R-SQL-OBJ-004
- **title**: SQL timestamp columns
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Mọi bảng nghiệp vụ PHẢI có 2 cột `created_at` và `updated_at`
- **postgresql_mysql_type**: `TIMESTAMPTZ DEFAULT NOW()`
- **mssql_type**: `DATETIME2 DEFAULT GETUTCDATE()`
- **exception**: Bảng lookup tĩnh không thay đổi (vd: country_codes) có thể bỏ `updated_at`

### R-SQL-OBJ-005
- **title**: SQL index name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Index name dùng pattern `{table}_{col}_idx`
- **pattern_single**: `{table}_{column}_idx`
- **pattern_composite**: `{table}_{col1}_{col2}_idx`
- **examples_pass**:
  - `subscriptions_customer_id_idx`
  - `orders_status_created_at_idx`
- **examples_fail**:
  - `IX_Subscriptions_CustomerId` — pattern MSSQL truyền thống, không dùng
  - `idx_customer` — thiếu table prefix

---

## R-MONGO: MongoDB conventions

### R-MONGO-DB-001
- **title**: MongoDB database name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: MongoDB database name dùng `snake_case`, KHÔNG có suffix `_db`
- **pattern**: `^[a-z][a-z0-9_]*$`
- **examples_pass**:
  - `product_catalog`
  - `promotion`
  - `notification`
  - `audit_log`
- **examples_fail**:
  - `product_catalog_db` — thừa suffix `_db` (khác SQL)
  - `productCatalog` — không được camelCase

### R-MONGO-OBJ-001
- **title**: MongoDB collection name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Collection name dùng `camelCase` và LUÔN số nhiều
- **pattern**: `^[a-z][a-zA-Z0-9]*s$` (số nhiều khuyến nghị kết thúc `s`)
- **examples_pass**:
  - `products`
  - `chargeItems`
  - `addonTemplates`
  - `campaigns`
- **examples_fail**:
  - `charge_items` — không được snake_case (đây là Mongo, không phải SQL)
  - `Products` — không được PascalCase
  - `product` — phải số nhiều

### R-MONGO-OBJ-002
- **title**: MongoDB field name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Field name dùng `camelCase` (chuẩn JSON/BSON)
- **pattern**: `^[a-z][a-zA-Z0-9]*$`
- **exception**: `_id` (Mongo built-in, dùng nguyên)
- **examples_pass**:
  - `customerId`
  - `createdAt`
  - `planCode`
  - `addonConfig`
- **examples_fail**:
  - `customer_id` — không được snake_case (đây là Mongo)
  - `CustomerId` — không được PascalCase

### R-MONGO-OBJ-003
- **title**: MongoDB primary key
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Dùng `_id` (Mongo built-in) với type `ObjectId` hoặc `UUID string`
- **default**: `ObjectId` cho document nội bộ
- **uuid_string**: Khi cần đồng bộ ID với SQL service khác (vd: ID đến từ event)
- **example**: `{ "_id": ObjectId("64a3f...") }` hoặc `{ "_id": "550e8400-e29b-41d4-a716-446655440000" }`

### R-MONGO-OBJ-004
- **title**: MongoDB timestamp fields
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Mọi document nghiệp vụ PHẢI có 2 field `createdAt` và `updatedAt` kiểu `ISODate`
- **example**: `"createdAt": ISODate("2024-01-15T00:00:00Z")`

### R-MONGO-OBJ-005
- **title**: MongoDB index name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Index name dùng pattern `{collection}_{field}_1` (số `1` cho ascending, `-1` cho descending)
- **examples_pass**:
  - `products_planCode_1`
  - `auditLog_createdAt_-1`
- **example_create**:
  ```js
  db.products.createIndex(
    { planCode: 1 },
    { unique: true, name: "products_planCode_1" }
  );
  ```

### R-MONGO-OBJ-006
- **title**: MongoDB array field plural
- **severity**: GOOD_PRACTICE
- **tier**: REVIEWER_VERIFY
- **rule**: Field kiểu array dùng tên số nhiều
- **examples_pass**: `priceTiers: [...]`, `addons: [...]`, `tags: [...]`
- **examples_fail**: `priceTier: [...]`, `addon: [...]` (gây hiểu nhầm là object)

---

## R-CROSS: Cross-service reference

### R-CROSS-001
- **title**: Không có Foreign Key thật giữa services
- **severity**: BLOCKER
- **tier**: REVIEWER_VERIFY
- **rule**: Mỗi service có DB riêng. TUYỆT ĐỐI KHÔNG được tạo `FOREIGN KEY` constraint trỏ tới bảng của service khác.
- **rationale**: Cross-service FK phá tính autonomy của microservice, gây coupling chặt, không deploy độc lập được.
- **example_fail**:
  ```sql
  -- billing.charge_items trong billing-svc
  -- ❌ KHÔNG được FK qua subscription-svc
  customer_id UUID REFERENCES subscription.subscriptions(customer_id)
  ```
- **example_pass**:
  ```sql
  -- ✅ Chỉ lưu UUID, không có constraint
  customer_id UUID NOT NULL  -- logical ref tới customer-svc
  ```

### R-CROSS-002
- **title**: Cross-service reference field name
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Cross-service ID lưu dưới dạng UUID, naming theo convention của engine sở tại
- **sql_pattern**: `{entity}_id UUID NOT NULL`
- **mongo_pattern**: `{entity}Id: String` (UUID string)
- **examples_pass**:
  - SQL: `customer_id UUID NOT NULL` (trong billing-svc, ref customer-svc)
  - Mongo: `customerId: "550e8400-e29b-41d4-a716-446655440000"`
- **resolve_method**: API call sang service sở hữu, hoặc subscribe event để cache. KHÔNG dùng `$lookup` cross-DB hay JOIN cross-service.

### R-CROSS-003
- **title**: Không dùng $lookup cross-service trong MongoDB
- **severity**: BLOCKER
- **tier**: REVIEWER_VERIFY
- **rule**: TUYỆT ĐỐI KHÔNG dùng `$lookup` để join collection thuộc service khác (kể cả nếu kỹ thuật cho phép qua cùng cluster).
- **rationale**: Tương tự R-CROSS-001 — phá autonomy của service.

---

## R-EVENT: Domain event naming

### R-EVENT-001
- **title**: Event name format
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Domain event name dùng `PascalCase` + Past Tense (động từ quá khứ). Áp dụng XUYÊN SUỐT bất kể engine — vì event là giao tiếp giữa services, không phải dữ liệu lưu trữ.
- **pattern**: `^[A-Z][a-zA-Z]*(ed|d|en)$` (heuristic past tense)
- **examples_pass**:
  - `OrderCreated`
  - `SubscriptionActivated`
  - `PaymentFailed`
  - `AddonActivationRequested`
  - `InvoiceIssued`
- **examples_fail**:
  - `order_created` — không được snake_case
  - `orderCreated` — không được camelCase
  - `CreateOrder` — không phải past tense (đây là command, không phải event)
  - `OrderCreate` — sai mood
- **rationale**: Past tense thể hiện "việc đã xảy ra rồi" — đúng bản chất event. Command (request) thì dùng imperative (`CreateOrder`), khác với event.

### R-EVENT-002
- **title**: Event payload field naming
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Payload event dùng `camelCase` (chuẩn JSON), bất kể engine sản sinh là SQL hay Mongo
- **example_pass**:
  ```json
  {
    "eventName": "OrderCreated",
    "orderId": "uuid-...",
    "customerId": "uuid-...",
    "createdAt": "2024-01-15T00:00:00Z"
  }
  ```

---

## R-DECISION: Khi nào chọn SQL vs MongoDB

### R-DECISION-SQL
- **dùng SQL khi** (1 trong các điều kiện):
  - ACID bắt buộc — tài chính, hợp đồng, giao dịch
  - Schema cố định — quan hệ rõ ràng giữa các entity
  - Query phức tạp — JOIN, GROUP BY, window functions
  - State machine — vòng đời có transition rõ ràng
  - Concurrent locking — pool IP, cấp phát tài nguyên
  - BI / Reporting — analytics, dashboard nội bộ
  - Audit trail — compliance, truy vết thay đổi

### R-DECISION-MONGO
- **dùng MongoDB khi** (1 trong các điều kiện):
  - Schema linh hoạt — config add-on mỗi loại khác nhau
  - Nested document — embed tự nhiên thay JOIN
  - Schema thay đổi thường — không muốn migration
  - Template đa dạng — notification, promotion campaign
  - Append-only log — event store, audit log volume lớn
  - Horizontal scale — sharding tự nhiên

### R-DECISION-DEFAULT
- **mặc định**: Khi mơ hồ → chọn **SQL (PostgreSQL)**. ACID + relational là lựa chọn an toàn cho domain telco.

---

## Service Catalog — 21 services hiện hữu

> Reference khi cần ref service hoặc tránh đặt trùng tên.

### Core (11 services)
| Service | DB | Engine | Trách nhiệm |
|---|---|---|---|
| `customer-svc` | `customer_db` | SQL | CRM, hồ sơ khách hàng, phân khúc |
| `subscription-svc` | `subscription_db` | SQL | Hợp đồng internet, vòng đời line |
| `product-catalog-svc` | `product_catalog` | MongoDB | Gói cước, add-on catalog (schema linh hoạt) |
| `addon-lifecycle-svc` | `addon_lifecycle_db` | SQL | Vòng đời business add-on |
| `order-svc` | `order_db` | SQL | Lifecycle đơn hàng |
| `billing-svc` | `billing_db` | SQL | Rating, charging, chu kỳ cước |
| `invoice-svc` | `invoice_db` | SQL | Hóa đơn, VAT, lưu trữ pháp lý |
| `payment-svc` | `payment_db` | SQL | Thanh toán, tích hợp cổng TT |
| `promotion-svc` | `promotion` | MongoDB | Campaign template, voucher |
| `dealer-svc` | `dealer_db` | SQL | Đại lý, kênh phân phối, hoa hồng |
| `complaint-svc` | `complaint_db` | SQL | Ticket, khiếu nại, CSAT |

### Provisioning (5 services)
| Service | DB | Engine | Trách nhiệm |
|---|---|---|---|
| `line-provisioning-svc` | `line_provisioning_db` | SQL | Cấp phát/thu hồi line, lệnh OLT/BRAS |
| `addon-provisioning-svc` | `addon_provisioning_db` | SQL | Điều phối kỹ thuật, Strategy Pattern |
| `ip-management-svc` | `ip_management_db` | SQL | Pool IP tĩnh, cấp phát, binding |
| `radius-adapter-svc` | `radius_adapter_db` | SQL | RADIUS/AAA, apply policy |
| `bandwidth-profile-svc` | `bandwidth_profile` | MongoDB | Profile tốc độ Ultrafast |

### Supporting (5 services)
| Service | DB | Engine | Trách nhiệm |
|---|---|---|---|
| `notification-svc` | `notification` | MongoDB | SMS, email, push — template đa dạng |
| `identity-svc` | `identity_db` | SQL | Auth, OAuth2, token, phân quyền |
| `number-management-svc` | `number_management_db` | SQL | Pool MSISDN, cấp phát số |
| `reporting-svc` | `reporting_db` | SQL | BI, analytics, dashboard nội bộ |
| `audit-log-svc` | `audit_log` | MongoDB | Append-only event log, compliance |

---

## Quy trình tổng cho Agent (workflow)

```
1. NHẬN task tạo entity mới → xác định loại:
   - Service mới? → R-SVC-001, R-SVC-002, R-SVC-003
   - Schema/migration SQL? → R-SQL-DB-*, R-SQL-OBJ-*
   - Collection Mongo? → R-MONGO-DB-*, R-MONGO-OBJ-*
   - Cross-service field? → R-CROSS-*
   - Event Kafka/RabbitMQ? → R-EVENT-*

2. CHỌN engine:
   - Match điều kiện R-DECISION-SQL → PostgreSQL
   - Match điều kiện R-DECISION-MONGO → MongoDB
   - Mơ hồ → R-DECISION-DEFAULT (SQL)

3. KIỂM TRA service catalog:
   - Service tương tự đã tồn tại? → KHÔNG tạo trùng, ref service hiện hữu
   - Engine của service đó là gì? → tuân convention theo engine

4. SINH NAME:
   - Service: kebab-case-svc, không chứa engine name
   - SQL DB: snake_case_db
   - Mongo DB: snake_case (không _db)
   - SQL table/column: snake_case, table số nhiều
   - Mongo collection/field: camelCase, collection số nhiều
   - Event: PascalCase past tense

5. SINH SCHEMA:
   - SQL: id UUID PK, created_at + updated_at, không FK cross-service
   - Mongo: _id ObjectId/UUID, createdAt + updatedAt, không $lookup cross-service

6. INDEX:
   - SQL: {table}_{col}_idx
   - Mongo: {collection}_{field}_1
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

| Thành phần | SQL | MongoDB |
|---|---|---|
| Service | `kebab-case-svc` | `kebab-case-svc` |
| DB | `snake_case_db` | `snake_case` (không `_db`) |
| Schema | `snake_case` (không `dbo`/`public`) | — |
| Table/Collection | `snake_case` số nhiều | `camelCase` số nhiều |
| Column/Field | `snake_case` | `camelCase` |
| PK | `id UUID` | `_id ObjectId/UUID` |
| Cross-ref | `{entity}_id UUID` | `{entity}Id: String` |
| Index | `{table}_{col}_idx` | `{collection}_{field}_1` |
| Timestamp | `created_at` / `updated_at` | `createdAt` / `updatedAt` |
| Event | `PascalCase` past tense — `OrderCreated` (như nhau) |

---

*File này là tham chiếu authoritative cho AI Agent. Khi conflict với hướng dẫn khác, file này thắng. Update theo `Naming_Convention` document khi có version mới.*
