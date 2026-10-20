"""Create local-only .env without overwriting an existing configuration."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parent.parent
target = root / ".env"
if target.exists():
    print("Giữ nguyên .env hiện có.")
else:
    content = (root / ".env.example").read_text().replace(
        "POSTGRES_PASSWORD=\n", f"POSTGRES_PASSWORD={secrets.token_hex(24)}\n")
    with target.open("x", encoding="utf-8") as file:
        file.write(content)
    target.chmod(0o600)
    print("Đã tạo .env local. Có thể cấu hình LLM_* trước khi chạy Docker.")
