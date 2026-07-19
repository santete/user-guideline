# Tài Liệu Đặc Tả Kiến Trúc: Offline-First & Background Sync (Supabase)

Yêu cầu chuyển đổi hệ thống sang kiến trúc **Local-First / Offline-First (Mô hình phân tán)**. 
- Mọi tương tác của người dùng (View, Like) sẽ được ghi ngay lập tức vào Cơ sở dữ liệu cục bộ trên trình duyệt (Local DB).
- Một **Background Worker** sẽ chạy ngầm, gom (batch) các thao tác này và đồng bộ (Sync) lên Server (Supabase) theo định kỳ hoặc khi có mạng trở lại.

Tài liệu này là đặc tả dành cho cả team **Frontend** và **Backend** để phối hợp xây dựng cơ chế này.

---

## 1. Thiết Kế Phía Client (Frontend & Browser)

### 1.1 Cơ sở dữ liệu cục bộ (Local Database)
Trình duyệt không hỗ trợ trực tiếp SQLite nguyên bản, do đó Frontend có 2 lựa chọn công nghệ:
1. **IndexedDB (Khuyên dùng):** Thông qua các thư viện như `Dexie.js` hoặc `RxDB`. Nhẹ, được hỗ trợ native trên mọi trình duyệt.
2. **SQLite WASM:** Dùng `sql.js` hoặc `wa-sqlite` nếu thực sự muốn dùng cú pháp SQL chuẩn dưới Client.

**Cấu trúc bảng cục bộ (`offline_events_queue`):**
| Cột | Mô Tả |
| :--- | :--- |
| `id` | UUID tự sinh cục bộ (Khóa chính). |
| `page_id` | ID của bài viết (vd: `win-to-ubuntu`). |
| `event_type` | Loại thao tác: `VIEW`, `LIKE`, `UNLIKE`. |
| `created_at` | Timestamp lúc người dùng thao tác. |
| `is_synced` | Trạng thái đồng bộ (0 = Chưa đồng bộ, 1 = Đã đồng bộ). |

### 1.2 Luồng xử lý của Background Worker
Sử dụng **Service Worker** (kết hợp Background Sync API) hoặc **Web Worker**:
1. Khi có event xảy ra, ghi ngay vào Local DB (UI cập nhật tức thì, không bị độ trễ mạng).
2. Worker định kỳ (vd: mỗi 30 giây) quét bảng tìm bản ghi có `is_synced = 0`.
3. Nhóm (Batch) toàn bộ event thành một mảng JSON.
4. Gửi mảng JSON qua API. Đánh dấu `is_synced = 1` nếu thành công.

---

## 2. Thiết Kế Phía Server (Backend - Supabase)

### Cấu trúc dữ liệu Payload từ Client
```json
{
  "device_id": "a1b2c3d4-...", // UUID định danh thiết bị ẩn danh
  "sync_data": [
    { "page_id": "win-to-ubuntu", "event_type": "VIEW", "count": 2 },
    { "page_id": "win-to-ubuntu", "event_type": "LIKE", "count": 1 }
  ]
}
```

### Hàm RPC Xử Lý Đồng Bộ: `sync_offline_events`
- **Tham số đầu vào:** `p_payload` (Kiểu `JSONB`)
- **Logic:** Lặp qua mảng JSON và thực hiện `UPSERT`.

**Mã giả SQL cho Backend Dev:**
```sql
CREATE OR REPLACE FUNCTION sync_offline_events(p_payload JSONB)
RETURNS boolean AS $$
DECLARE
    item JSONB;
    v_count int;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(p_payload->'sync_data')
    LOOP
        v_count := LEAST((item->>'count')::int, 5); -- BẢO MẬT: Chặn số lượng ảo
        
        INSERT INTO page_stats (page_id, views, likes)
        VALUES (
            item->>'page_id', 
            CASE WHEN item->>'event_type' = 'VIEW' THEN v_count ELSE 0 END,
            CASE WHEN item->>'event_type' = 'LIKE' THEN v_count ELSE 0 END
        )
        ON CONFLICT (page_id)
        DO UPDATE SET 
            views = page_stats.views + EXCLUDED.views,
            likes = GREATEST(
                page_stats.likes + EXCLUDED.likes - CASE WHEN item->>'event_type' = 'UNLIKE' THEN v_count ELSE 0 END, 
                0
            );
    END LOOP;
    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Chiến Lược Bảo Mật (Security & Anti-Abuse)

Vì đây là Web tĩnh không có xác thực người dùng (No Auth), cơ chế Sync dạng Batch (gửi số lượng) rất dễ bị Hacker chèn dữ liệu ảo (Ví dụ: chặn gói tin và sửa `"count": 1` thành `"count": 999999`). 

Để giải quyết triệt để, Team Backend và Frontend cần áp dụng các tầng bảo vệ sau:

### Tầng 1: Ngăn chặn thao túng số lượng (Hard Capping)
- **Vấn đề:** Trình duyệt tự gộp (batch) và gửi số lên. Kẻ xấu có thể gửi số cực lớn.
- **Giải pháp trên Database:** Trong file mã SQL `sync_offline_events` ở trên, sử dụng lệnh `LEAST(client_count, 5)`. 
- **Ý nghĩa:** Dù client có gửi số lượng là 10.000, Database cũng chỉ chấp nhận tối đa cộng thêm 5 đơn vị cho mỗi lần Sync. Vì chu kỳ Sync là 30s/lần, không thể nào một người bình thường xem hay like quá 5 lần trong 30s.

### Tầng 2: Giới hạn tần suất gọi API (Rate Limiting)
- **Vấn đề:** Kẻ xấu có thể viết Script gọi hàm `sync_offline_events` liên tục 100 lần mỗi giây.
- **Giải pháp trên Supabase:** 
  - Không mở trực tiếp hàm RPC này ra public.
  - Sử dụng **Supabase Edge Functions** (hỗ trợ Deno) làm màng lọc trung gian.
  - Cấu hình Rate Limit trên Edge Function chặn theo IP: 1 IP chỉ được phép gọi hàm Sync tối đa 5 lần / phút. Quá giới hạn sẽ trả về mã lỗi `429 Too Many Requests`.

### Tầng 3: Định danh thiết bị Ẩn danh (Device Fingerprinting)
- **Vấn đề:** 1 người F5 liên tục để tăng View/Like bất chấp giới hạn.
- **Giải pháp:** 
  - Lần đầu người dùng truy cập web, Frontend sinh ra một chuỗi ngẫu nhiên (UUID) lưu vào `localStorage` gọi là `device_id`.
  - Mọi payload gửi lên đều phải đính kèm `device_id`.
  - Backend tạo thêm 1 bảng phụ `device_actions (device_id, page_id, action_type)`.
  - Nếu `action_type = LIKE` và `device_id` này đã tồn tại, chặn không cho cộng thêm Like nữa. (Giống cách Youtube chặn like ảo).

### Tầng 4: Chống Bot bằng Invisible Turnstile (Tùy chọn)
- Nếu web có lượng truy cập lớn, hãy tích hợp **Cloudflare Turnstile** (ẩn) vào Frontend. 
- Background Worker trước khi gửi gói Sync sẽ xin một Token từ Turnstile. Backend Edge Function sẽ xác thực Token này để đảm bảo request đến từ một trình duyệt thật có người dùng, chứ không phải một đoạn Script Python cào dữ liệu.

---

## 4. 🚨 Các Yêu Cầu Chỉnh Sửa Khẩn Cấp Dành Cho Backend

Dựa trên tài liệu `developer_guide_api_auth.md` hiện tại do Backend cung cấp, quá trình tích hợp vào Web tĩnh đang gặp 2 cản trở lớn. Yêu cầu team Backend điều chỉnh ngay lập tức:

### Yêu cầu 4.1: Thay đổi cơ chế Xác thực (Hủy bỏ Long-lived Bearer Token)
- **Vấn đề:** Tài liệu yêu cầu truyền Secret API Key (`pj_live_...`) vào Header và *"tuyệt đối không nhúng vào mã nguồn Frontend"*. Tuy nhiên, vì đây là trang web tĩnh thuần túy (Static Website) không có Server đứng giữa, việc gọi API từ `sync-worker.js` bắt buộc phải hardcode Key này, dẫn đến lộ 100%.
- **Giải pháp yêu cầu:** 
  1. Backend phải cung cấp một **Public/Anon Key** (chỉ có đặc quyền gọi duy nhất API Sync này), thay vì dùng Secret Key toàn quyền.
  2. Bật cấu hình **CORS (Cross-Origin Resource Sharing)** trên API Server, và chỉ đưa vào Whitelist tên miền của trang web hướng dẫn này (VD: `https://santete.github.io`). Khi đó, kẻ gian dù có ăn cắp Public Key mang về máy cũng bị trình duyệt chặn không cho gọi API.

### Yêu cầu 4.2: Bổ sung API Lấy Dữ Liệu (GET Data)
- **Vấn đề:** Hiện tại Backend mới chỉ cung cấp API `POST /sync-offline-events` để Đẩy dữ liệu lên. Hệ thống đang hoàn toàn thiếu một API để Frontend Lấy dữ liệu tổng về hiển thị (VD: Tổng số view/like của từng bài viết hiện tại đang là bao nhiêu?).
- **Giải pháp yêu cầu:**
  Bổ sung gấp một endpoint dạng `GET` hoặc sử dụng trực tiếp Supabase JS Client với quyền đọc (Read-only) bảng `page_stats`.
  - **Endpoint dự kiến:** `GET https://api.projectnow.app/functions/v1/get-page-stats?page_ids=win-to-ubuntu,vscode-claude`
  - **Output dự kiến:** Mảng JSON chứa tổng view/like thực tế để web tĩnh khởi tạo giao diện lúc load trang ban đầu.
