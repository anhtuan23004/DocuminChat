# Tài liệu DocuminChat

Ba nhóm riêng để không nhầm khảo sát với implementation:

- [architecture/](architecture/README.md): kiến trúc **đang có code**, API,
  memory, Docker và phần cần triển khai tiếp.
- [ref/](ref/README.md): Hermes/source/template, Colab, khảo sát retrieval và
  benchmark; không quyết định features đã hoàn thành.
- [archive/](archive/README.md): khảo sát UI thay thế, Streamlit legacy và
  snapshot thiết kế trước khi dựng khung.

Bắt đầu với [architecture](architecture/README.md), rồi [API](architecture/api.md)
và [chạy Docker](architecture/deployment.md). Hướng đã chốt: frontend custom
lấy nguyên lý/bố cục Hermes; backend của DocuminChat quản lý nghiệp vụ/data.

Hướng UI mới giữ gần toàn bộ [Hermes workbench](architecture/hermes-full-workbench.md).
[Evidence của khung](architecture/verification.md) phân biệt phần đã chạy và
phần full API/runtime migration còn lại.

[Quản lý tài liệu theo Project/session](architecture/projects-and-files.md)
mô tả UI tham khảo ChatGPT Projects, quyền kế thừa file và migration dữ liệu cũ.

[Nghiên cứu ChatGPT WebUI](ref/chatgpt-webui-research.md) ghi ảnh/nguồn chính
thức, điểm khó dùng đã sửa và contract giao diện hiện tại.
