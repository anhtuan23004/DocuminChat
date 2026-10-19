# Backend development

Python3.12 + uv; dependencies tách khỏi requirements Streamlit cũ.

```bash
cd backend
uv sync --frozen --python 3.12
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv export --frozen --no-dev --no-emit-project --output-file requirements.lock > /dev/null
```

SQLite chỉ dùng test/isolated development; full Docker stack dùng PostgreSQL
và Alembic migrations. Nếu muốn chạy Python trực tiếp với SQLite:

```bash
uv run alembic upgrade head
uv run uvicorn app.main:app --port 8000
# Terminal khác, cùng backend/ và DATA_DIR/DATABASE_URL:
uv run python -m app.jobs.worker
```

Đọc [module boundaries](../docs/architecture/README.md),
[memory](../docs/architecture/memory.md) và [API](../docs/architecture/api.md).
