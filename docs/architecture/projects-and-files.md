# Tài liệu theo Project và session

Ngày 13/10/2026. Yêu cầu: quản lý tài liệu tại Project/session, tham khảo
[Projects and chats của ChatGPT](https://learn.chatgpt.com/docs/projects).
Áp dụng cách gom Project gồm hội thoại và nguồn chung; không coi mỗi chat
là cùng một transcript hoặc tự làm shared memory giữa các chat.

## Contract

- Project có owner, tên và danh sách chats. Chat có project_id nullable.
- File upload vào Project được dùng trong chats thuộc Project đó. File
  upload vào session chỉ thuộc session đó, kể cả khi chuyển chat sang Project.
- Physical document/chunks/job được dedup theo owner+checksum. Bảng
  document_bindings gắn document với **đúng một** Project hoặc session;
  không dedup quyền truy cập theo nội dung file.
- Khi bỏ file khỏi một nơi lưu, chỉ xóa binding; không xóa file/chunks,
  binding khác hoặc citations trong history. Chưa triển khai physical purge.
- Gửi chat không có document_ids → dùng các file ready trong session và
  Project cha, tối đa20 file được upload gần nhất. document_ids=[] → model chat không dùng tài liệu; list cụ
  thể phải là subset scope hiện tại. Ingestion và retrieval giữ boundaries cũ.
- Chuyển Project giữ transcript và file session, thay nguồn Project được
  kế thừa; chặn chuyển khi một turn còn active. Không copy chunks khi move.

## UI

Sidebar có Projects và mục hội thoại riêng. Trang Project tập trung tên,
hội thoại và tài liệu chung. Session có nút tài liệu/đính kèm trên composer;
bảng tài liệu mở theo context và phân biệt tệp Project/tệp hội thoại.
Composer hiện trực tiếp trong trang Project; nút thêm tệp mở file picker,
nút số file mở quản lý. File riêng hiển thị cạnh ô nhập với trạng thái xử lý.
Tài liệu mở trong dialog theo ngữ cảnh; source excerpts mở theo câu trả lời.
State khi đổi context có epoch/abort để response cũ
không ghi vào Project/session mới.

Sidebar recent chats không bị mất khi chọn Project. Search đọc tên/messages
đã lưu trên API, gồm chat lưu trữ; Back/breadcrumb phục hồi ngữ cảnh. Các
quyết định UX được ghi trong [research](../ref/chatgpt-webui-research.md).

## Migration

Alembic0003 thêm projects, session.project_id và document_bindings. Toàn
bộ documents cũ cùng owner được gắn vào Project “Dữ liệu trước Project”; các
sessions cũ của owner đó được gom vào Project này để giữ ngữ cảnh cũ.
IDs, messages, uploads, chunks và jobs được giữ nguyên. Downgrade giữ
document/history và trả schema về danh mục cũ; metadata Project mới bị bỏ.

Project, binding và scope là dữ liệu PostgreSQL. Không tạo mỗi Project một
DB/index hay một service. Full Hermes migration áp dụng scope này cho
workspace/project/session adapters; upstream snapshot giữ nguyên.
