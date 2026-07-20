# 🚀 ProjectNow API Integration Guide

Chào mừng bạn đến với tài liệu Hướng dẫn Tích hợp API của **ProjectNow**. Tài liệu này dành cho các Lập trình viên (Developer) từ các hệ thống thứ 3 (đặc biệt là Web tĩnh - Static Sites) muốn kết nối và đồng bộ dữ liệu sự kiện về trung tâm dữ liệu của ProjectNow một cách an toàn và chuẩn xác nhất.

---

## 1. 🔐 Cơ Chế Xác Thực & CORS (Authentication)

ProjectNow sử dụng **Domain-Restricted Public Key**.

> [!IMPORTANT]
> **Bảo mật API Key trong Môi Trường Web Tĩnh**
> Vì Web tĩnh (Static Site) không có Backend để giấu Key, nên API Key cấp cho bạn có thể được cấu hình **chỉ cho phép gọi từ danh sách Tên Miền (CORS Whitelist)** do bạn chỉ định (VD: `https://santete.github.io`).
>
> Bất kỳ ai ăn cắp Key của bạn và gọi từ một tên miền khác (hoặc dùng cURL/Postman không có Origin hợp lệ) đều sẽ bị máy chủ ProjectNow từ chối ngay lập tức (`403 Forbidden`). 
> 
> *Lưu ý: Bạn có thể nhúng Key này vào mã nguồn Frontend an toàn, nhưng phải yêu cầu Quản trị viên cấu hình đúng Domain.*

**Cách thức truyền Key:**
Khi gửi HTTP Request, bạn bắt buộc phải truyền Key vào Header theo cú pháp:
`Authorization: Bearer <YOUR_API_KEY>`

---

## 2. 📡 Endpoints

*(Lưu ý: API đang được định tuyến qua Proxy của máy chủ Vercel để hỗ trợ CORS và Custom Domain)*

### 2.1. Đẩy Dữ Liệu Lên (POST /sync-offline-events)

Hệ thống của bạn có thể hoạt động offline và gom (batch) các sự kiện lại để gửi một lần nhằm tiết kiệm tài nguyên.

- **URL:** `POST https://projectnow.app/api/functions/sync-offline-events`
- **Content-Type:** `application/json`

**Cấu trúc Payload (Request Body):**
```json
{
  "device_id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab",
  "sync_data": [
    { "page_id": "blog-post-1", "event_type": "VIEW", "count": 5 },
    { "page_id": "blog-post-1", "event_type": "LIKE", "count": 1 }
  ]
}
```

### 2.2. Lấy Dữ Liệu Về (GET /get-page-stats)

Sử dụng khi Web tĩnh của bạn vừa load xong và cần hiển thị tổng lượt View/Like hiện tại cho các bài viết.

- **URL:** `GET https://projectnow.app/api/functions/get-page-stats?page_ids=blog-post-1,intro`
- **Tham số URL:** `page_ids` (Danh sách ID trang, cách nhau bằng dấu phẩy).

**Kết Quả (Response):**
Trả về một Object với Key là `page_id` giúp client dễ truy xuất `O(1)`.
```json
{
  "success": true,
  "data": {
    "blog-post-1": { "views": 1500, "likes": 34 },
    "intro": { "views": 0, "likes": 0 }
  }
}
```

---

## 3. 🛡️ Quy Định Về Giới Hạn (Rate Limits & Anti-Spam)

Để đảm bảo hiệu năng và tính toàn vẹn dữ liệu, API áp dụng các quy định bảo vệ khắt khe:

> [!WARNING]
> **Rate Limit (Giới hạn gọi API):**
> - Hàm `POST sync-offline-events`: Tối đa **5 lần / 1 phút / 1 IP**. Bạn bắt buộc phải gom batch sự kiện.
> - Hàm `GET get-page-stats`: Tối đa **20 lần / 1 phút / 1 IP**. Hỗ trợ người dùng load nhiều trang liên tục.
> - Quá giới hạn sẽ trả về mã lỗi `429 Too Many Requests`.

> [!TIP]
> **Hard-Capping (Ngăn chặn thao túng số liệu):**
> Trong hàm Sync, thuộc tính `count` bị giới hạn tối đa là **5**. Server sẽ tự động cắt xuống còn 5 để chống bơm view ảo. Một `device_id` chỉ được tính `LIKE` 1 lần cho 1 bài viết.

---

## 4. 🛑 Bảng Mã Lỗi (Status Codes)

| HTTP Code | Lỗi | Xử Lý |
| :--- | :--- | :--- |
| `200 OK` | Thành công | Mọi thứ hoạt động hoàn hảo. |
| `400 Bad Request` | Sai dữ liệu | Thiếu tham số bắt buộc. |
| `401 Unauthorized` | Lỗi Xác thực | Thiếu API Key hoặc Key bị thu hồi. |
| `403 Forbidden` | Lỗi CORS Domain | Tên miền hiện tại của trình duyệt không khớp với danh sách được cấu hình cho API Key này. |
| `429 Too Many Requests` | Vượt Rate Limit | Hệ thống của bạn đang spam API. Hãy giảm tần suất gửi (batching). |
| `500 Internal Error` | Lỗi Server | Liên hệ quản trị viên. |
