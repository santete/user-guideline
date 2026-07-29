---
type: Technical Debt
title: Technical Debt & Risk Audit
description: Danh gia cac diem rui ro ky thuat va no ky thuat cua du an legacy gitlab-analytics.
tags:
- governance
- debt
- risk
timestamp: '2026-07-28T16:17:46.828614+00:00'
---

# Technical Debt & Vulnerability Assessment
Phan tich cac vung ma nguon legacy can chu y khi refactor:

## AI-Generated Risk & Debt Audit
Dưới đây là báo cáo phân tích **Nợ kỹ thuật (Technical Debt)**, **Điểm rủi ro (Risk Assessment)** và **Khuyến nghị cho Kỹ sư mới (Onboarding Guidelines)** cho dự án legacy `gitlab-analytics`.

---

# I. BÁO CÁO PHÂN TÍCH NỢ KỸ THUẬT (TECHNICAL DEBT)

Dựa trên cấu trúc 322 modules và các thư viện đang sử dụng, dự án mang nhiều đặc trưng của một hệ thống Data/Analytics Pipeline nâng cao nhưng đang gánh chịu nợ kỹ thuật lớn về **kiến trúc đồng bộ/bất đồng bộ**, **phụ thuộc thư viện chồng chéo** và **sự phình to của tooling nội bộ (Over-automation)**.

### 1. Xung đột Kiến trúc Async vs Sync (Tech Stack Friction)
*   **Thư viện HTTP:** Dự án dùng song song cả `requests` (Sync) và `httpx` (Async/Sync).
*   **Thư viện Database:** Dùng cả `asyncpg` (Async) và `psycopg2-binary` (Sync).
*   **Rủi ro:** Việc trộn lẫn mã bất đồng bộ (FastAPI, `asyncpg`, `httpx`) và mã đồng bộ (`requests`, `psycopg2`) rất dễ dẫn đến hiện tượng **Event Loop Blocking** (nghẽn luồng xử lý async trong FastAPI) hoặc rò rỉ kết nối Database Connection Pool nếu không quản lý cẩn thận.

### 2. Sự phình to và trùng lặp Tooling Custom (`.claude/` Ecosystem)
*   Chiếm số lượng module rất lớn trong tổng số 322 modules.
*   **Tồn tại mã nguồn song song 2 ngôn ngữ:** Thấy rõ sự trùng lặp giữa Node.js và Python trong thư mục `.claude/hooks/` (ví dụ: `halluc-score.js` vs `halluc-score.py`, `post-write-check.js` vs `post-write-check.py`).
*   **Tác động:** Tạo ra thêm chi phí bảo trì (Maintenance Overhead). Một thay đổi trong logic kiểm tra có thể phải sửa ở cả JS và Python script. gây hoang mang cho dev mới khi phải tìm hiểu hệ thống hook quá phức tạp.

### 3. Code Smell & Thiết kế Procedural (Mã dạng thủ tục)
*   Tệp `ops.py` có kích thước **21 KB** với **23 hàm nhưng 0 Class**. Đây là dấu hiệu của "God Script" (Tệp làm quá nhiều việc thủ tục), khó unit test độc lập, dễ vi phạm nguyên lý Single Responsibility.
*   Thiếu các cấu trúc OOP/Abstraction trong các tệp vận hành chính.

### 4. Rủi ro Phụ thuộc Thư viện (Dependencies Debt)
*   `psycopg2-binary`: Nhà phát triển `psycopg2` chính thức cảnh báo **không nên dùng bản `-binary` trên Production** do vấn đề liên kết thư viện C (SSL/TLS libraries crash hoặc segfault trên các môi trường Linux khác nhau).
*   Kết hợp `dlt` (data load tool) + `dbt-postgres`: Việc đẩy dữ liệu ETL/ELT đang dựa nhiều vào các script kiểm tra sai lệch schema custom (`drift_check.py`, `check-drift.md`), chứng tỏ pipeline dữ liệu chưa thực sự ổn định tự động.

---

# II. ĐÁNH GIÁ ĐIỂM RỦI RO (RISK SCORECARD)

| Tiêu chí rủi ro | Mức độ | Điểm (1-10) | Mô tả chi tiết |
| :--- | :---: | :---: | :--- |
| **Rủi ro Môi trường & Chạy Local** | **Rất cao** | **8.5/10** | Tệp `LOCAL_SETUP.md` dài gần 49KB + hệ thống Custom Hooks phức tạp dễ khiến Dev mới mất 2-3 ngày không chạy nổi môi trường local. |
| **Rủi ro Vận hành Pipeline (Data Reliability)** | **Cao** | **7.5/10** | Xung đột driver DB (Async/Sync) và rủi ro Schema Drift từ GitLab API thay đổi. |
| **Rủi ro Bảo trì Codebase (Maintainability)** | **Cao** | **7.0/10** | Tồn tại code trùng lặp (JS/Python), nhiều file markdown đóng vai trò command/agent chưa rõ ràng. |
| **Rủi ro Hiệu năng (Performance)** | **Trung bình** | **6.0/10** | Sử dụng `psycopg2-binary` và nguy cơ block event loop do gọi thư viện sync trong route FastAPI. |

**ĐIỂM RỦI RO TỔNG THỂ DỰ ÁN: 7.25 / 10 (Mức Rủi Ro Cao)**

---

# III. 5-8 KHUYẾN NGHỊ KỸ THUẬT VÀ CẢNH BÁO CHO KỸ SƯ MỚI ONBOARDING

Dưới đây là các hành động bắt buộc và cảnh báo dành cho kỹ sư mới tiếp quản dự án:

### 1. [Cảnh báo] Kiểm tra kỹ luồng Async/Sync trong Code FastAPI
*   **Sự cố dễ gặp:** Không bao giờ gọi `requests.get()` hoặc `psycopg2` query bên trong một hàm `async def` của FastAPI. Nó sẽ block toàn bộ server uvicorn.
*   **Hành động:** Quy hoạch lại: Luồng FastAPI phải dùng `httpx.AsyncClient` và `asyncpg`. Mã ETL/CLI đồng bộ chạy ngầm mới dùng `requests`/`psycopg2`.

### 2. [Cảnh báo] Cẩn trọng với hệ thống Git Hooks nội bộ (`.claude/hooks`)
*   **Sự cố dễ gặp:** Các hook `pre-commit`, `pre-push`, `post-write` bằng cả Node.js và Python có thể âm thầm reject commit hoặc làm chậm tốc độ commit dữ liệu do chạy nhiều script kiểm tra (`halluc-score`, `drift_check`).
*   **Hành động:** Đọc kỹ `.claude/hooks/README.md` trước khi thực hiện commit đầu tiên. Nếu gặp lỗi khi commit, hãy kiểm tra xem hook Node.js hay Python đang thất bại.

### 3. [Khuyến nghị] Chuẩn hóa thư viện PostgreSQL Driver cho Production
*   **Hành động:** Thay thế `psycopg2-binary` bằng `psycopg2` (biên dịch từ source) hoặc nâng cấp lên `psycopg` v3 trong file `pyproject.toml`/`requirements.txt` để tránh lỗi phân bổ bộ nhớ hoặc SSL crash trên Production Container.

### 4. [Khuyến nghị] Refactor module đơn điệu `ops.py`
*   **Hành động:** Tệp `ops.py` (23 functions) hiện tại quá ôm đồm. Kỹ sư mới khi thêm feature không nên tiếp tục viết hàm tự do vào đây. Hãy tách `ops.py` thành các module nhỏ theo nghiệp vụ (vd: `ops/gitlab_sync.py`, `ops/db_maintenance.py`) và viết Unit Test bằng `pytest`.

### 5. [Khuyến nghị] Thống nhất 1 Ngôn ngữ cho Automation/Tooling Scripts
*   **Hành động:** Đề xuất với Team loại bỏ bớt phần duplicate code giữa Node.js và Python trong thư mục `.claude/`. Dự án là Python (`py311`), ưu tiên giữ lại các hook/script viết bằng Python để tận dụng venv chung (`drift_check.py`, `halluc-score.py`) và loại bỏ runtime Node.js nếu không cần thiết.

### 6. [Khuyến nghị] Đọc thuộc lòng `LOCAL_SETUP.md` nhưng luôn xác minh lại thực tế
*   **Hành động:** Tài liệu `LOCAL_SETUP.md` rất chi tiết (48KB) chứng tỏ setup môi trường phức tạp. Tuy nhiên, dự án legacy thường có tài liệu bị out-of-date. Khi setup, nếu gặp bước lỗi, hãy chủ động cập nhật lại file này (Doc-as-Code) để giúp người sau.

### 7. [Khuyến nghị] Giám sát chặt chẽ Pipeline với `dlt` và `dbt`
*   **Hành động:** Kiểm tra kỹ các quy tắc Transformer và Extractor. Chạy lệnh kiểm tra Drift (`python .claude/hooks/python/drift_check.py` hoặc CLI tương đương) trước và sau khi đổi cấu trúc database/API để đảm bảo `dbt` không bị gãy transform models.

# Governance Link
Xem cac luu y quan trong tai [Legacy Caveats](../governance/legacy_caveats.md).
