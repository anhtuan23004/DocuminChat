# Frontend DocuminChat: UX theo ChatGPT, tham khảo capabilities Hermes

Ngày 13/10/2026. UI hiện tại được cải tiến theo luồng ChatGPT Projects:
một sidebar, nhập câu hỏi trực tiếp trong Project, file riêng cạnh composer,
tìm chat trên dữ liệu đã lưu, menu đổi tên/chuyển Project, Back và nháp theo
context. [Nghiên cứu và design contract](../ref/chatgpt-webui-research.md)
ghi nguồn chính thức, vấn đề quan sát và cách kiểm chứng.

Hermes vẫn là nguồn tham khảo cho skills, memory, usage, profiles và agent
activity/cycle. Source đầy đủ nằm trong `vendor/hermes-webui/` với commit/license.

[Full workbench architecture](hermes-full-workbench.md) mô tả dependency
source và ranh giới API/runtime/storage cần migrate để scale. Không coi
copy HTML/JS là full backend integration.

`frontend/` có HTTP/SSE/upload/history chạy với backend mới và tests.
Các panels/capabilities còn lại cần backend contracts thực tế để tích hợp.
[Thiết kế prototype đã archive](../archive/2026-10-12-pre-full-workbench/frontend-prototype.md).

Prototype hiện có [Project/session files](projects-and-files.md): sidebar
Projects, trang Project gồm composer, nguồn chung và chats, file riêng đính
kèm từ composer. Tài liệu mở trong dialog theo Project/session đang chọn;
focus trap dùng native dialog. Sidebar mobile có inert và keyboard focus.
URL giữ context khi reload/Back. Đây là contract khi mở rộng full workbench.

Runtime vẫn là native ES modules, không thêm framework/dependencies:
`chat.js` điều phối context và SSE; `history.js`/`projects.js` quản lý danh
sách; `search.js`, `drafts.js`, `messages.js`, `session-options.js` phụ trách
các luồng tương ứng; `documents.js`/`sources.js` giữ tách file và citations.
CSS chia thành tokens/shell/chat/projects/dialogs; không chồng các lớp
override của prototype trước.

Các files upstream cần giữ khi port:

- [index.html](../../vendor/hermes-webui/static/index.html): full shell/composer/panels.
- [style.css](../../vendor/hermes-webui/static/style.css): layout/themes/responsive.
- [sessions.js](../../vendor/hermes-webui/static/sessions.js): sidebar/history.
- [messages.js](../../vendor/hermes-webui/static/messages.js): streaming/activity/recovery.
- [panels.js](../../vendor/hermes-webui/static/panels.js): skills/memory/insights/settings.
- [workspace.js](../../vendor/hermes-webui/static/workspace.js): shared API helper/workspace UI.
- [assistant_turn_anchors.js](../../vendor/hermes-webui/static/assistant_turn_anchors.js):
  turn owner identity và live/final reconciliation.

Port theo compatibility API của DocuminChat, giữ handlers và features;
capability/state mapping cần tests theo [API inventory](../ref/hermes-api-inventory.md).
Native backend/agent code được giữ trong vendor để port/đối chiếu, không
được import ngầm vào FastAPI hoặc đọc state Hermes cá nhân trên máy.
