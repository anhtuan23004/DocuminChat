# Evidence cho bản khung

Ngày 13/10/2026. Branch local `feature/hermes-ui-skeleton`; không push/deploy
public, chưa chạy Hermes Agent hoặc GPU Colab.

| Check | Kết quả |
| --- | --- |
| Docker Compose config/build/up | Frontend/API/worker/PostgreSQL chạy local; migration0003 exit0 |
| PostgreSQL | pgvector extension `vector`, Alembic head0003 |
| Backend pytest | 23 passed: ingestion/PDF, ownership, SSE/idempotency, lease/fencing, Project/session scopes/migration, move/quota, rename, search messages/archive và escape wildcard |
| Ruff check/format | Passed cho backend |
| JS unit tests | 7 passed: split frames/UTF-8, EOF, error, cancellation, scope invalidation và nháp theo context |
| Browser Chrome | 9 passed: Project/session files/reload, search/rename, nháp/Back/gỡ file, nhiều attachments, viewport320/768/1024/1440, keyboard/native-dialog focus, upload worker thật, pin/archive/history, stream/live sources/XSS fixtures, offline/failed ingestion |
| HTTP smoke | Proxy + upload→worker→ready + persisted sessions + model-unconfigured503 |
| Docs link check | Passed cho links local trong tài liệu dự án |
| Scope regression check | Đảo điều kiện lọc retrieval → test isolation fail; khôi phục code → suite pass |
| Vendor source parity | 2.129 tracked source files byte-equal với reference pinned commit, không copy `.git`/personal state |
| Upstream source audit | Official agent-source dependency audit + 182 literal UI API paths |

Browser runtime dùng system Chrome qua `BROWSER_CHANNEL=chrome`; download
Playwright Chromium không hoàn tất trong phiên này. Fixtures stream/model
chỉ nằm trong tests. Những check trên không chứng minh Colab thật, semantic
retrieval, auth nhiều người, durable agent cycle hoặc full Hermes API parity.
Upstream Hermes test suite chưa được chạy.

`artifacts/ui-desktop.png`, `artifacts/ui-mobile.png`, `artifacts/project-desktop.png`
và `artifacts/project-mobile.png` là artifact local ignored,
không phải files cần có khi fresh clone. Xem screenshots tại workspace sau
khi chạy browser test.
