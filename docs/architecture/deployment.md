# Docker và vận hành local

```bash
python3 scripts/bootstrap_env.py
docker compose up -d --build --wait
docker compose ps --all
```

UI: `http://127.0.0.1:3030`. API/OpenAPI: `http://127.0.0.1:8000/docs`.
Chỉ hai ports bind loopback; PostgreSQL không publish port. `migrate` là
one-shot Alembic; exit 0 là bình thường. API/worker chờ migration thành công.
Frontend chạy độc lập được với `docker compose up -d --build frontend` và
báo backend offline cho đến khi có API.

| Service | Image / state | Scale |
| --- | --- | --- |
| frontend | Nginx static + proxy SSE | Stateless |
| api | Backend image, user10001 | Chưa cấu hình LB/replicas; port local cố định |
| worker | Cùng backend image, process đọc file, RAM cap1GB | `docker compose up -d --scale worker=2` |
| migrate | Cùng backend image, Alembic revisions0001→0002→0003 | Chạy một lần mỗi upgrade |
| postgres | PostgreSQL17 + pgvector0.8.1, named volume | Một instance local |

Base images pin digest. Python `uv.lock` là lock chuẩn, `requirements.lock`
được export có hashes cho Docker. JS runtime là native ES modules; Node và
Playwright chỉ dùng trong development/test, không nằm trong frontend image.

## Nối model

Trong `.env`, đặt `LLM_BASE_URL=https://.../v1`, `LLM_MODEL=documinchat`,
`LLM_API_KEY=...` nếu server yêu cầu. Base URL kết thúc `/v1`, adapter thêm
`/chat/completions`. Hỗ trợ stream SSE kiểu OpenAI với `data: [DONE]`.

```bash
docker compose up -d --force-recreate api worker
```

Colab nằm ngoài Docker local. Khi tunnel đổi URL, cập nhật env và recreate.
Đọc [Colab guide](../ref/colab-local-guide.md). Chỉ dùng HTTP cho inference
trên mạng local được tin cậy; kết nối remote dùng HTTPS. Không commit `.env`.
`LLM_TIMEOUT_SECONDS` là deadline toàn lượt, default120; nếu tăng, điều chỉnh
`proxy_read_timeout`180s ở Nginx tương ứng. Model phải đủ context; hiện chưa
có tokenizer budgeting.

## Jobs và persistence

Upload ghi UUID file vào volume `documents`, metadata/job vào PostgreSQL.
Project/session và file bindings cũng nằm trong PostgreSQL, dùng chung
ingestion/retrieval. Revision0003 gom dữ liệu cũ vào Project “Dữ liệu trước
Project” và giữ nguyên uploads/history; xem [migration](projects-and-files.md).
Worker claim bằng conditional SQL update, lease120s/token và tối đa3 lần
claim; extraction child process tối đa60s nên không cần heartbeat kéo dài.
Crash worker → job được reclaim sau lease. Old token hoặc lease expired
không publish được. Success/failed và chunks thay đổi cùng transaction.

Backup cần cả PostgreSQL và volume file cùng thời điểm phù hợp. Chưa có
backup automation. Crash giữa ghi file/commit có thể để lại orphan file;
cần reconciliation job trước production. Không chạy `down -v` nếu muốn
giữ dữ liệu; `docker compose down` vẫn giữ named volumes.

```bash
docker compose logs --tail=100 api worker migrate
docker compose stop
```

Đây là stack phát triển một người. Auth, least-privilege database roles,
rate limits, resource sizing, observability và backup/restore là các lát
cắt tiếp trước khi public deployment; Compose hiện tại không phải cấu hình
production nhiều người.
