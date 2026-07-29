---
type: api-timeout-rules
domain: api-design
audience: ai-agent
purpose: code-generation
source: API_Timeout_Configuration_ISC
authoritative: true
language: vi
last_updated: 2026-04
load_when:
  - setup HTTP / gRPC client
  - cấu hình timeout cho external call
  - implement retry / circuit breaker
  - viết code có DB / cache call
related_files:
  - 04_API_Response_and_Error.md
---

# API Timeout Configuration — Tham chiếu cho AI Agent

> File distill từ API Timeout Configuration ISC. Áp dụng khi setup HTTP client, gRPC client, DB call, retry logic.
> Mục tiêu: tránh treo hệ thống do request vô thời hạn, đảm bảo phản hồi đúng SLA, log đầy đủ để observability.

## Nguyên tắc tổng

**LUÔN có timeout cho mọi I/O call.** KHÔNG chấp nhận default vô thời hạn của ngôn ngữ/framework.

Timeout áp dụng ở 5 tầng:

| Tầng | Mô tả |
|---|---|
| Frontend | Web/Mobile App, Portal, POS UI |
| Backend | API Gateway, BFF, dịch vụ nghiệp vụ |
| Internal Service | Microservice nội bộ liên thông |
| External Call | API bên thứ ba (đối tác, hệ sinh thái) |
| Database / Cache | Kết nối DB, Redis, Search Engine |

## Mức độ vi phạm

- **BLOCKER** — Tuyệt đối không generate. Vi phạm = code review reject ngay.
- **REQUIRED** — Phải tuân thủ. Reviewer block merge nếu sai.
- **GOOD_PRACTICE** — Khuyến nghị. Tuân nếu có thể.

---

## R-TIMEOUT-MUST: Bắt buộc có timeout

### R-TIMEOUT-MUST-001
- **title**: Mọi I/O call PHẢI có timeout
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Bất kỳ HTTP / gRPC / DB / cache / message queue call ĐỀU PHẢI có timeout rõ ràng. KHÔNG được để vô thời hạn.
- **applies_to**:
  - HTTP/HTTPS request (axios, fetch, HttpClient, RestTemplate, requests, Guzzle...)
  - gRPC call (any language)
  - Database query (SQL, MongoDB)
  - Cache operation (Redis, Memcached)
  - Message queue produce/consume (Kafka, RabbitMQ)
  - External API call (third-party)
- **examples_fail**:
  - JS: `await fetch(url)` — không có signal/timeout
  - .NET: `httpClient.GetAsync(url)` — không có CancellationToken
  - Python: `requests.get(url)` — không có `timeout=`
  - Java: `restTemplate.getForObject(url, ...)` — dùng default
- **examples_pass**:
  - JS: `await fetch(url, { signal: AbortSignal.timeout(2000) })`
  - .NET: `httpClient.GetAsync(url, cts.Token)` với CancellationTokenSource set timeout
  - Python: `requests.get(url, timeout=2)`
  - Java: `RestTemplate` cấu hình `requestFactory` với connect/read timeout

---

## R-TIMEOUT-VALUE: Giá trị timeout

### R-TIMEOUT-VALUE-001
- **title**: Timeout theo loại API
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Chọn timeout theo bảng tham chiếu dưới. KHÔNG đặt timeout tùy hứng.
- **reference_table**:

| Loại API | Timeout khuyến nghị | Ghi chú |
|---|---|---|
| Truy vấn đơn giản (GET) | 100ms – 1s | Ưu tiên cache nếu có |
| Ghi dữ liệu (POST/PUT) | 300ms – 2s | Không nên blocking quá lâu |
| Tạo job / trigger task | 500ms – 2s | Ưu tiên dùng queue thay vì blocking |
| Upload file / xử lý ảnh | 5s – 10s | Giới hạn dung lượng + xử lý song song |
| Webhook callback | ≤ 3s | Phải retry được từ phía gọi lại |
| Internal microservice call | 200ms – 1s | Gọi lồng nhau cần circuit breaker |
| Batch API / async processing | 10s – 30s hoặc dùng queue | Trả về `job_id` để xử lý bất đồng bộ |
| Tác vụ AI / OCR / ML | 20s+ (NÊN queue) | Hạn chế blocking sync call |

- **agent_action**: Khi setup client → match loại API với bảng → chọn giá trị trong khoảng. Default về middle của khoảng nếu không có yêu cầu cụ thể.

### R-TIMEOUT-VALUE-002
- **title**: Tổng retry time ≤ timeout phía trên
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Khi có retry logic, tổng thời gian (timeout × số lần retry + backoff) PHẢI ≤ timeout của tầng gọi phía trên
- **formula**: `total_retry_time = timeout_per_call × retry_count + sum(backoff_delays)`
- **examples_pass**:
  - Frontend timeout = 5s, internal service: timeout 1.5s × 2 retry + 0s backoff = 3s ≤ 5s ✅
- **examples_fail**:
  - Frontend timeout = 3s, internal service: timeout 2s × 3 retry = 6s > 3s ❌ — frontend timeout xảy ra trước, retry vô nghĩa
- **agent_action**: Khi sinh retry config, tự tính total và verify với timeout phía trên. Vượt → giảm retry count hoặc giảm timeout per call.

### R-TIMEOUT-VALUE-003
- **title**: Retry phải có giới hạn
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Retry KHÔNG được vô hạn. Phải có max retry count + backoff strategy.
- **forbidden**:
  - `while (true) { try { call() } catch { sleep(1) } }` — retry vô hạn
  - Polly `.Retry()` không truyền số lần
- **required**:
  - Max retry: 2-3 lần cho lỗi tạm thời (network, 5xx)
  - Backoff: exponential với jitter (1s, 2s, 4s + random)
  - KHÔNG retry cho 4xx (client error) trừ 408, 429
- **examples_pass** (Polly C#):
  ```csharp
  Policy
    .Handle<HttpRequestException>()
    .OrResult<HttpResponseMessage>(r => (int)r.StatusCode >= 500)
    .WaitAndRetryAsync(3, attempt =>
        TimeSpan.FromSeconds(Math.Pow(2, attempt)) +
        TimeSpan.FromMilliseconds(Random.Next(100)));
  ```

---

## R-TIMEOUT-CONFIG: Cấu hình timeout

### R-TIMEOUT-CONFIG-001
- **title**: KHÔNG hardcode timeout
- **severity**: BLOCKER
- **tier**: DEV_SELF_CHECK
- **rule**: Giá trị timeout TUYỆT ĐỐI KHÔNG được hardcode trong source code. PHẢI cấu hình qua env variable hoặc config server.
- **forbidden_patterns**:
  - `setTimeout(() => abort(), 2000)` — literal `2000` trong code
  - `httpClient.Timeout = TimeSpan.FromSeconds(5)` — literal `5`
  - `requests.get(url, timeout=10)` — literal `10`
- **required_alternatives**:
  - Env variable: `process.env.API_TIMEOUT_PAYMENT`, `os.getenv("API_TIMEOUT_PAYMENT")`
  - Config file: `appsettings.json`, `application.yml`
  - Config server: Spring Cloud Config, Consul, AWS AppConfig
- **naming_convention** (env var):
  - Format: `API_TIMEOUT_{SERVICE}_{OPERATION}` (uppercase, snake_case)
  - Đơn vị: milliseconds (ms)
  - Examples:
    - `API_TIMEOUT_PAYMENT=2000`
    - `API_TIMEOUT_USER_GET=500`
    - `DB_TIMEOUT_QUERY=1000`
- **examples_pass**:
  ```javascript
  const timeout = parseInt(process.env.API_TIMEOUT_PAYMENT || '2000');
  fetch(url, { signal: AbortSignal.timeout(timeout) });
  ```

### R-TIMEOUT-CONFIG-002
- **title**: Default value an toàn khi env missing
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Khi đọc timeout từ env, PHẢI có default value an toàn (không quá nhỏ, không quá lớn)
- **examples_pass**: `parseInt(process.env.API_TIMEOUT || '2000')` — default 2s
- **examples_fail**:
  - `parseInt(process.env.API_TIMEOUT)` — env missing → NaN → timeout không hoạt động
  - Default = 60000 (60s) — quá lớn, không thực tế

---

## R-TIMEOUT-RESPONSE: Response khi timeout

### R-TIMEOUT-RESPONSE-001
- **title**: Response chuẩn khi timeout
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Khi timeout xảy ra, response PHẢI theo cấu trúc chuẩn (xem 04_API_Response_and_Error.md)
- **error_code_mapping**:
  - Server tự timeout xử lý → `REQ_TIMEOUT` (HTTP 408)
  - Gọi external service timeout → `EXT_504` (HTTP 504)
- **template**:
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "REQ_TIMEOUT",
      "message": "The request timed out after 2000ms.",
      "retryable": true
    },
    "meta": {
      "request_id": "...",
      "trace_id": "...",
      "timestamp": "..."
    }
  }
  ```
- **retryable**: PHẢI là `true` cho timeout error (xem R-ERROR-CODE-005 ở 04_API_Response_and_Error.md)

---

## R-TIMEOUT-LOG: Logging khi timeout

### R-TIMEOUT-LOG-001
- **title**: Log đầy đủ khi timeout xảy ra
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Mọi event timeout PHẢI được log với đủ thông tin để debug và alert
- **required_fields**:
  - `endpoint` — URL hoặc operation name
  - `actual_duration_ms` — thời gian xử lý thực tế trước khi timeout
  - `configured_timeout_ms` — timeout đã cấu hình
  - `request_id` hoặc `trace_id`
  - `client_ip` (nếu là incoming request)
  - `user_id` (nếu có authenticated context)
- **example_log** (structured):
  ```json
  {
    "level": "warn",
    "event": "request_timeout",
    "endpoint": "POST /payments/charge",
    "actual_duration_ms": 2050,
    "configured_timeout_ms": 2000,
    "trace_id": "trace-abc-123",
    "user_id": "user-456"
  }
  ```
- **agent_action**: Khi setup timeout handler (catch AbortError, TimeoutException, etc.) → tự động log với đủ field này.

---

## R-TIMEOUT-CANCEL: Cancellation propagation

### R-TIMEOUT-CANCEL-001
- **title**: Dùng cancellation primitive đúng ngôn ngữ
- **severity**: REQUIRED
- **tier**: DEV_SELF_CHECK
- **rule**: Implement timeout dùng đúng cancellation primitive của ngôn ngữ/framework, KHÔNG dùng `setTimeout + flag` thủ công.
- **language_mapping**:
  | Ngôn ngữ / Framework | Primitive |
  |---|---|
  | JavaScript / TypeScript | `AbortController` / `AbortSignal.timeout(ms)` |
  | Node.js (modern) | `AbortSignal.timeout(ms)` (Node 17+) |
  | .NET / C# | `CancellationTokenSource` + `CancellationToken` |
  | Java | `CompletableFuture.orTimeout()` hoặc `Future.get(timeout, unit)` |
  | Python (sync) | `requests`: `timeout=` param |
  | Python (async) | `asyncio.wait_for(coro, timeout)` |
  | Go | `context.WithTimeout(ctx, duration)` |

- **examples_pass**:
  - JS:
    ```javascript
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        // log timeout (R-TIMEOUT-LOG-001)
        // return REQ_TIMEOUT response (R-TIMEOUT-RESPONSE-001)
      }
    } finally {
      clearTimeout(timeout);
    }
    ```
  - C#:
    ```csharp
    using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
    try {
      var response = await httpClient.GetAsync(url, cts.Token);
    } catch (OperationCanceledException) {
      // log timeout
      // return EXT_504 response
    }
    ```
  - Go:
    ```go
    ctx, cancel := context.WithTimeout(parentCtx, 2*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    ```

### R-TIMEOUT-CANCEL-002
- **title**: Truyền timeout qua HTTP header khi gọi service nội bộ
- **severity**: GOOD_PRACTICE
- **tier**: DEV_SELF_CHECK
- **rule**: Khi gọi service nội bộ, NÊN truyền timeout qua header `X-Request-Timeout` để service được gọi biết deadline
- **header_format**: `X-Request-Timeout: {milliseconds}`
- **example**: `X-Request-Timeout: 2000`
- **rationale**: Service được gọi có thể tự cancel xử lý nội bộ nếu nhận timeout signal, tiết kiệm tài nguyên.

---

## Anti-patterns — TUYỆT ĐỐI tránh

| ❌ Anti-pattern | ✅ Đúng | Vi phạm rule |
|---|---|---|
| Không đặt timeout | Luôn có timeout phù hợp từng loại | R-TIMEOUT-MUST-001 |
| Retry vô hạn | Giới hạn 2-3 lần + backoff exp | R-TIMEOUT-VALUE-003 |
| Hardcode timeout | Dùng env variable hoặc config | R-TIMEOUT-CONFIG-001 |
| Blocking lâu phía frontend | Queue + xử lý bất đồng bộ + trả `job_id` | R-TIMEOUT-VALUE-001 |
| Tự cài timeout dùng setTimeout + flag | Dùng AbortController / CancellationToken | R-TIMEOUT-CANCEL-001 |
| Retry tổng > timeout phía trên | Total retry ≤ timeout caller | R-TIMEOUT-VALUE-002 |
| Không log timeout event | Log đủ field debug | R-TIMEOUT-LOG-001 |

---

## Quy trình tổng cho Agent (workflow)

```
1. NHẬN task có I/O call (HTTP/gRPC/DB/cache/MQ):
   - Xác định loại operation (GET đơn giản? POST? Upload? Batch? AI?)

2. CHỌN timeout value theo R-TIMEOUT-VALUE-001 table:
   - Match loại operation → khoảng timeout khuyến nghị
   - Lấy giá trị middle nếu không có yêu cầu cụ thể

3. CẤU HÌNH timeout (R-TIMEOUT-CONFIG-001):
   - Tạo env variable theo naming `API_TIMEOUT_{SERVICE}_{OP}`
   - Đọc từ env với default an toàn (R-TIMEOUT-CONFIG-002)
   - KHÔNG hardcode literal value

4. IMPLEMENT cancellation (R-TIMEOUT-CANCEL-001):
   - Dùng đúng primitive ngôn ngữ (AbortController/CancellationToken/context)
   - Cleanup resource trong finally block

5. NẾU có retry:
   - Max 2-3 lần + exponential backoff + jitter (R-TIMEOUT-VALUE-003)
   - Verify total retry time ≤ timeout phía trên (R-TIMEOUT-VALUE-002)
   - Chỉ retry với 5xx, 408, 429, network error — KHÔNG retry 4xx khác

6. HANDLE timeout error:
   - Log đầy đủ field (R-TIMEOUT-LOG-001)
   - Return response chuẩn với REQ_TIMEOUT hoặc EXT_504 (R-TIMEOUT-RESPONSE-001)
   - Set retryable=true

7. CROSS-REF:
   - Response format → 04_API_Response_and_Error.md
   - Error code REQ_TIMEOUT/EXT_504 trong catalog
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
| GET đơn giản | Timeout 100ms-1s, dùng env var |
| POST/PUT | Timeout 300ms-2s |
| Upload | Timeout 5-10s, giới hạn size |
| Internal service call | Timeout 200ms-1s + circuit breaker |
| External API | Timeout 1-3s + retry exp |
| AI/ML/Batch | Queue + `job_id`, KHÔNG sync timeout |
| Retry | Max 2-3, exp backoff, total ≤ caller timeout |
| Cấu hình | Env var `API_TIMEOUT_*`, KHÔNG hardcode |
| Cancellation | AbortController (JS) / CancellationToken (.NET) / context (Go) |
| Timeout error | `REQ_TIMEOUT` (server) / `EXT_504` (upstream), retryable=true |

---

*File này là tham chiếu authoritative cho AI Agent về Timeout. Cross-reference với 04_API_Response_and_Error.md cho error code REQ_TIMEOUT / EXT_504.*
