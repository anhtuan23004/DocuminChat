# DocuminChat UI prototype

Đây là prototype kiểm chứng API. UI đích giữ gần toàn bộ Hermes workbench
trong `vendor/hermes-webui/`, theo [kiến trúc migration](../docs/architecture/hermes-full-workbench.md).

Prototype theo Hermes: vanilla HTML/CSS/JS, native modules, responsive drawers.
History/file/job/source đều qua backend API. Output được render plaintext
bằng `textContent`; không có model key hoặc fallback answer trong frontend.

```bash
docker compose up -d --build frontend
cd frontend
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

Browser tests cần full stack tại port3030 và model **chưa cấu hình** cho các
case real-stack; provider/stream thành công dùng fixtures riêng được ghi rõ.
Screenshots ở `artifacts/` root repo. [API contract](../docs/architecture/api.md).

Đã kiểm thử browser bằng Google Chrome local với profile test riêng:

```bash
BROWSER_CHANNEL=chrome npm run test:browser
```
