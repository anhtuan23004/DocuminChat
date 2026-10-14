import io
import os
import subprocess
import sys
import uuid
from datetime import timedelta

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.integration.schemas import ChatRequest
from app.integration.turns import begin, finish
from app.jobs.worker import process_one
from app.storage import Base, Session, database, now


def test_pdf_text_is_extracted_with_page_reference(stack, session_scope):
    settings, factory, _, client = stack
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"BT /F1 12 Tf 20 200 Td (Refund period is thirty days.) Tj ET")
    page[NameObject("/Contents")] = writer._add_object(stream)
    data = io.BytesIO()
    writer.write(data)
    doc = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("refund.pdf", data.getvalue())},
    ).json()
    process_one(settings, factory)
    from app.retrieval.search import search

    sources = search(factory, "local", [doc["id"]], "refund", session_id=session_scope)
    assert sources[0]["page"] == 1
    assert "thirty days" in sources[0]["text"]


def test_active_turn_conflict_expiry_and_fenced_late_completion(stack):
    settings, factory, _, client = stack
    sid = client.post("/api/v1/sessions", json={}).json()["id"]
    first = ChatRequest(content="first", request_id=uuid.uuid4())
    a = begin(factory, settings, sid, first)
    second = ChatRequest(content="second", request_id=uuid.uuid4())
    with pytest.raises(HTTPException) as conflict:
        begin(factory, settings, sid, second)
    assert conflict.value.status_code == 409
    with factory() as db:
        db.get(Session, sid).active_until = now() - timedelta(seconds=1)
        db.commit()
    b = begin(factory, settings, sid, second)
    assert not finish(factory, sid, str(first.request_id), a["message_id"], "late", [], "completed")
    assert finish(factory, sid, str(second.request_id), b["message_id"], "current", [], "completed")
    history = client.get(f"/api/v1/sessions/{sid}/messages").json()["items"]
    assert history[1]["status"] == "failed" and history[-1]["content"] == "current"


def test_initial_migration_matches_models_and_is_idempotent(tmp_path):
    from sqlalchemy import inspect

    from app.config import Settings

    url = f"sqlite:///{tmp_path}/migrations.db"
    env = {**os.environ, "DATABASE_URL": url}
    for _ in range(2):
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            env=env,
            check=True,
            capture_output=True,
        )
    engine, _ = database(Settings(database_url=url))
    inspector = inspect(engine)
    for name, table in Base.metadata.tables.items():
        assert set(table.columns.keys()) == {col["name"] for col in inspector.get_columns(name)}
    engine.dispose()


def test_external_origin_cannot_mutate_local_identity(stack):
    _, _, _, client = stack
    assert (
        client.post(
            "/api/v1/sessions", json={}, headers={"Origin": "https://untrusted.example"}
        ).status_code
        == 403
    )


def test_production_rejects_local_auth_adapter():
    from app.config import Settings

    with pytest.raises(RuntimeError, match="real auth"):
        Settings(app_env="production").validate()
