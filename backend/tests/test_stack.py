import io
import json
import uuid
from datetime import UTC

import httpx
from pypdf import PdfWriter

from app.jobs.worker import process_one
from app.storage import Document, Job, Session


def test_real_ingestion_and_source_ownership(stack, session_scope):
    settings, factory, _, client = stack
    upload = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={
            "file": ("policy.txt", b"The refund period is thirty days. Refunds need a receipt.")
        },
    )
    assert upload.status_code == 202
    document = upload.json()
    assert document["status"] == "pending"
    assert process_one(settings, factory)
    assert client.get(f"/api/v1/jobs/{document['job_id']}").json()["status"] == "completed"
    assert (
        client.get(f"/api/v1/documents?session_id={session_scope}").json()["items"][0]["status"]
        == "ready"
    )
    with factory() as db:
        foreign = Document(
            id=str(uuid.uuid4()),
            owner_id="someone-else",
            name="private.txt",
            checksum="foreign",
            path="not-needed",
            status="ready",
        )
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id
    session_id = session_scope
    assert (
        client.post(
            f"/api/v1/sessions/{session_id}/messages",
            json={
                "content": "hello",
                "document_ids": [foreign_id],
                "request_id": str(uuid.uuid4()),
            },
        ).status_code
        == 404
    )


def test_invalid_and_image_only_pdf_fail_honestly(stack, session_scope):
    settings, factory, _, client = stack
    assert (
        client.post(
            "/api/v1/documents",
            data={"session_id": session_scope},
            files={"file": ("x.pdf", b"not a PDF")},
        ).status_code
        == 422
    )
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    data = io.BytesIO()
    writer.write(data)
    doc = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("scan.pdf", data.getvalue())},
    ).json()
    process_one(settings, factory)
    job = client.get(f"/api/v1/jobs/{doc['job_id']}").json()
    assert job["status"] == "failed"
    assert "OCR" in job["error"]


def test_stream_history_idempotency_and_sources(stack, session_scope):
    settings, factory, app, client = stack
    doc = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("refund.txt", b"The refund period is thirty days.")},
    ).json()
    process_one(settings, factory)
    seen = []

    def provider(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"Ba mươi ngày [1]."}}]}\n\ndata: [DONE]\n\n',
        )

    app.state.provider_transport = httpx.MockTransport(provider)
    session_id = session_scope
    payload = {
        "content": "refund period?",
        "document_ids": [doc["id"]],
        "request_id": str(uuid.uuid4()),
    }
    result = client.post(f"/api/v1/sessions/{session_id}/messages", json=payload)
    assert result.status_code == 200
    assert "event: delta" in result.text and "event: done" in result.text
    assert "event: sources" in result.text and "event: trace" in result.text
    assert "thirty days" in seen[0]["messages"][0]["content"]
    retry = client.post(f"/api/v1/sessions/{session_id}/messages", json=payload)
    assert "event: done" in retry.text
    assert len(seen) == 1
    history_items = client.get(f"/api/v1/sessions/{session_id}/messages").json()["items"]
    assert len(history_items) == 2
    assert history_items[1]["trace"]["matched_chunks"] == 1
    assert history_items[1]["trace"]["phase"] == "completed"
    payload["content"] = "different request"
    assert client.post(f"/api/v1/sessions/{session_id}/messages", json=payload).status_code == 409
    sources = history_items[1]["sources"]
    assert sources[0]["score"] >= 1
    assert "refund" in sources[0]["matched_terms"]
    assert client.get(f"/api/v1/sources/{sources[0]['chunk_id']}").json()["text"]
    with factory() as db:
        d = db.get(Document, doc["id"])
        d.owner_id = "someone-else"
        db.commit()
    assert client.get(f"/api/v1/sources/{sources[0]['chunk_id']}").status_code == 404


def test_unconfigured_model_and_truncated_stream(stack):
    settings, _, app, client = stack
    session_id = client.post("/api/v1/sessions", json={}).json()["id"]
    payload = {"content": "hello", "request_id": str(uuid.uuid4())}
    settings.llm_model = ""
    assert client.post(f"/api/v1/sessions/{session_id}/messages", json=payload).status_code == 503
    settings.llm_model = "test-model"
    app.state.provider_transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200, text='data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'
        )
    )
    result = client.post(f"/api/v1/sessions/{session_id}/messages", json=payload)
    assert "event: error" in result.text and "event: done" not in result.text
    history = client.get(f"/api/v1/sessions/{session_id}/messages").json()["items"]
    assert history[-1]["status"] == "failed"


def test_expired_job_is_reclaimed_and_old_lease_cannot_publish(stack, session_scope):
    from datetime import datetime, timedelta

    from app.jobs.worker import claim, publish

    _, factory, _, client = stack
    doc = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("x.txt", b"useful text")},
    ).json()
    old = claim(factory)
    with factory() as db:
        job = db.get(Job, doc["job_id"])
        job.lease_until = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    new = claim(factory)
    assert new["token"] != old["token"]
    assert not publish(factory, old, [(1, "stale")], None)
    assert publish(factory, new, [(1, "current")], None)


def test_foreign_session_and_upload_deduplication(stack, session_scope):
    _, factory, _, client = stack
    with factory() as db:
        s = Session(id=str(uuid.uuid4()), owner_id="other", title="private")
        db.add(s)
        db.commit()
        session_id = s.id
    assert client.get(f"/api/v1/sessions/{session_id}/messages").status_code == 404
    a = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("a.txt", b"same contents")},
    ).json()
    b = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={"file": ("b.txt", b"same contents")},
    ).json()
    assert a["id"] == b["id"]


def test_modular_pipeline_presets_and_ab_sandbox(stack, session_scope):
    settings, factory, _app, client = stack
    presets = client.get("/api/v1/presets")
    assert presets.status_code == 200
    items = presets.json()["items"]
    assert len(items) >= 3
    assert any(p["id"] == "preset-b" for p in items)

    doc = client.post(
        "/api/v1/documents",
        data={"session_id": session_scope},
        files={
            "file": (
                "sla-2026.txt",
                b"Vi pham SLA gian doan qua 4 gio phat 8% phi thang. Mien tru khi bao tri.",
            )
        },
    ).json()
    process_one(settings, factory)

    sandbox_res = client.post(
        "/api/v1/eval/sandbox",
        json={
            "module": "ab",
            "query": "Mức phạt SLA và miễn trừ?",
            "session_id": session_scope,
            "document_ids": [doc["id"]],
        },
    )
    assert sandbox_res.status_code == 200
    ab_data = sandbox_res.json()
    assert ab_data["module"] == "ab"
    assert "column_a" in ab_data and "column_b" in ab_data
    assert "rag_triad" in ab_data["column_b"]

