# Rule: Quy tắc Cấu trúc Thư mục OKF trên Google Drive

## Nguyên tắc bắt buộc (CRITICAL RULE)
Khi thao tác với MCP Server `okf-gdrive` hoặc khởi tạo gói tri thức OKF cho bất kỳ dự án nào:

1. **KHÔNG BAO GIỜ ĐỂ FILE TRÀN RA ROOT**:
   - Tất cả các file OKF (bao gồm `index.md`, `log.md`, `context.md`, `memory.md`) **TUYỆT ĐỐI KHÔNG ĐƯỢC NẰM NGHANG HÀNG VỚI THƯ MỤC DỰ ÁN** hoặc văng ra ngoài Root.
   - Mọi file của một dự án **BẮT BUỘC** phải nằm hoàn toàn trong thư mục đại diện cho dự án đó.

2. **CẤU TRÚC ĐƯỜNG DẪN CHUẨN (`parentPath`)**:
   - Mọi tham số `parentPath` khi gọi tool `okf_create_node` hay `okf_append_content` phải có dạng phân cấp lồng tối thiểu 2 cấp: `<workspace_name>/<project_name>` (ví dụ: `google-antigravity/bot-okf`).

3. **MÔ HÌNH CẤU TRÚC TRÊN GOOGLE DRIVE**:
   ```text
   OKF_Workspace/
   └── <workspace_name>/
       └── <project_name>/     <-- MỌI FILE DỰ ÁN NẰM TRONG NÀY
           ├── index.md
           ├── log.md
           ├── context.md
           └── memory.md
   ```
