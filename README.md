# DocuminChat

Khung chạy local: **UI custom theo Hermes + FastAPI/LangGraph + ingestion
worker + PostgreSQL/pgvector**, toàn bộ stack Docker hóa. Model đặt trên
Colab/GPU server qua API OpenAI-compatible.

**Hướng cập nhật:** UX chat/Project theo ChatGPT; phát triển các capabilities
tham khảo Hermes WebUI, bao gồm skills, memory, usage và agent activity/cycle.
Full snapshot đã import vào `vendor/hermes-webui/`.
Đọc [full workbench + scale](docs/architecture/hermes-full-workbench.md). UI ở
port3030 hiện là prototype kiểm chứng backend; full Hermes API/runtime migration
chưa hoàn tất, không coi các panels vendor là features đã nối backend mới.

## Chạy

```bash
python3 scripts/bootstrap_env.py
docker compose up -d --build --wait
```

Mở **http://127.0.0.1:3030**. OpenAPI: http://127.0.0.1:8000/docs.
UI/upload/history hoạt động khi chưa có model; gửi chat cần cấu hình
`LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` trong `.env`, sau đó:

```bash
docker compose up -d --force-recreate api worker
```

[Hướng dẫn Colab](docs/ref/colab-local-guide.md) mô tả server/tunnel và nối
backend. Không cần chạy Hermes hay tải model vào máy local để khởi động UI.

Sidebar có **Projects**: tạo Project, thêm file dùng chung và mở các chat
trong Project. Nhập câu hỏi ngay ở trang Project; **Cmd/Ctrl+K** tìm tên/nội
dung trong toàn bộ lịch sử, gồm chat lưu trữ. Menu chat có đổi tên và chuyển
Project; Back khôi phục context và nháp trong phiên trình duyệt.
Nút đính kèm trên composer lưu file riêng cho session; bảng
tài liệu hiển thị cả file riêng và nguồn kế thừa từ Project. Chuyển Project
giữ lịch sử và file riêng. [Contract và migration](docs/architecture/projects-and-files.md).
Xem [nghiên cứu UX ChatGPT](docs/ref/chatgpt-webui-research.md).

## Cấu trúc

```text
frontend/                 UI độc lập, native ES modules, Nginx
backend/app/
  integration/            contracts, ownership, chat turns
  projects/               Project/session scope và quyền kế thừa tài liệu
  documents/              PDF/TXT parsing và chunking
  retrieval/              tìm kiếm và source references
  generation/             OpenAI-compatible streaming adapter
  rag/                    graph retrieve → respond
  jobs/                   durable ingestion worker
  storage.py              schema/shared persistence
backend/migrations/       Alembic migrations
scripts/                  bootstrap env, checks
compose.yaml              frontend/api/worker/migrate/postgres
references/hermes-webui/  source reference đã clone, ignored
vendor/hermes-webui/      full pinned fork snapshot + upstream contracts/tests
docs/ref/                nguồn tham khảo / Colab / retrieval nghiên cứu
docs/architecture/       kiến trúc và contract code hiện hành
docs/archive/            khảo sát và thiết kế trước đây
```

Đọc [docs index](docs/README.md), [kiến trúc](docs/architecture/README.md),
[API](docs/architecture/api.md), [Docker/vận hành](docs/architecture/deployment.md).

## Phạm vi bản khung

Đã có upload PDF có text/TXT, worker thật, chunks theo trang, lịch sử trong
PostgreSQL, request idempotency, source ownership, LangGraph và SSE adapter.
Retrieval hiện dùng **từ khóa**; pgvector extension đã cài nhưng chưa có
embedding/dense retrieval. PDF scan báo cần OCR. Model chưa cấu hình/đứt
stream được hiển thị rõ; không có câu trả lời mẫu trong app.

Đây là development một người, ports bind loopback và identity server `local`.
Chưa có authentication nhiều người, tokenizer budgeting hay cấu hình
production. Đọc giới hạn và thứ tự nâng cấp trong architecture.

## Kiểm tra

```bash
cd backend
uv sync --frozen --python 3.12
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
cd ../frontend
npm ci
npm test
npx playwright install chromium
npm run test:browser
cd ..
python3 scripts/check_docs.py
```

Browser test real stack dùng model chưa cấu hình; test stream thành công
sử dụng fixture riêng. Không có GPU/Colab session trong test tự động.

Code Streamlit cũ (`app.py`, `models/`, `utils/`, `requirements.txt`) vẫn giữ
nguyên để đối chiếu. Hướng dẫn cũ ở [archive README](docs/archive/2026-10-12-pre-skeleton/root-README.md).
Backend mới không import hay dùng dependencies của bản cũ.
