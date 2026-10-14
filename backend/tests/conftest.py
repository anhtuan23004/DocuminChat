import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.storage import database


@pytest.fixture
def stack(tmp_path):
    settings = Settings(
        database_url=f"sqlite:///{tmp_path}/test.db",
        data_dir=tmp_path / "files",
        llm_base_url="https://inference.example/v1",
        llm_model="test-model",
    )
    engine, factory = database(settings)
    from app.storage import Base

    Base.metadata.create_all(engine)
    app = create_app(settings, factory)
    with TestClient(app) as client:
        yield settings, factory, app, client
    engine.dispose()


@pytest.fixture
def session_scope(stack):
    return stack[3].post("/api/v1/sessions", json={}).json()["id"]
