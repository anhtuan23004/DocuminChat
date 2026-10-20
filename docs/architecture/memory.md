# Lưu và sử dụng hội thoại

`chat_sessions` lưu owner/title/active request. `messages` lưu cả user,
assistant, status và source references. `turns` lưu request ID/fingerprint,
message ID và trạng thái để chống gọi lại model khi retry một request đã
hoàn tất. PostgreSQL là nơi lưu chính; reload trình duyệt tải lại từ API.

Session pin/archive và updated_at cũng lưu PostgreSQL. UI có nhóm thời gian,
tìm trong danh sách đã tải, ghim/lưu trữ/khôi phục. Lưu trữ chỉ đổi metadata,
không xóa history hoặc đổi owner.

`project_id` xác định nguồn tài liệu được kế thừa, không gộp messages giữa
các sessions. Project chia sẻ file; context hội thoại vẫn lấy history của
chính session đang gửi. Chuyển Project giữ transcript và file riêng;
[document bindings](projects-and-files.md) thay đổi nguồn chung được kế thừa.

Mỗi lượt graph lấy tối đa 20 messages completed gần nhất, tổng không quá
16.000 ký tự, cộng query và các chunks tìm được. Giới hạn history/context
được cấu hình ở [Settings](../../backend/app/config.py); chưa có tính token
chính xác, summarization, long-term memory hoặc LangGraph checkpoint.

Assistant failed/streaming không đưa vào context lượt sau. User của lượt
failed vẫn được lưu; giới hạn này không bảo đảm lịch sử luôn ghép theo cặp
turn. Cần thêm policy context theo turn khi triển khai conversation sâu.

Source references giữ document/version/page/chunk. Xem excerpt qua source
API kiểm tra quyền tại thời điểm đọc. Browser chỉ giữ selection/request
state, không có một kho history thứ hai trong localStorage.

Nháp đang nhập giữ trong RAM theo session hoặc Project mới. Tạo session
từ Project sẽ chuyển nháp sang session đó; Back/chuyển chat khôi phục nháp
trong phiên browser. Reload đóng bộ nhớ này; nháp chưa gửi không phải
message đã lưu trong PostgreSQL hay long-term memory.

Đổi model không xóa history. Thêm memory dài hạn/checkpoint sau khi đã xác
định use case, retention, quyền đọc và chiến lược xóa dữ liệu; không coi các
module đó là dependencies mặc định của bản khung.
