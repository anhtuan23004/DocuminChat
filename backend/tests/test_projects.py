import json
import uuid
from datetime import timedelta

import httpx

from app.integration.schemas import ChatRequest
from app.integration.turns import begin
from app.jobs.worker import process_one
from app.retrieval.search import search
from app.storage import Document, DocumentBinding, Session, now


def project(client, name):
    result = client.post("/api/v1/projects", json={"name": name})
    assert result.status_code == 201
    return result.json()["id"]


def session(client, project_id=None):
    return client.post("/api/v1/sessions", json={"project_id": project_id}).json()["id"]


def upload(client, content, **scope):
    result = client.post(
        "/api/v1/documents", data=scope, files={"file": ("file.txt", content.encode())}
    )
    assert result.status_code == 202
    return result.json()


def test_project_files_are_inherited_but_session_files_are_private(stack):
    settings, factory, _, client = stack
    p = project(client, "Research")
    a, b = session(client, p), session(client, p)
    common = upload(client, "Common refund policy", project_id=p)
    private = upload(client, "Private interview notes", session_id=a)
    process_one(settings, factory)
    process_one(settings, factory)
    assert {d["id"] for d in client.get(f"/api/v1/documents?session_id={a}").json()["items"]} == {
        common["id"],
        private["id"],
    }
    assert {d["id"] for d in client.get(f"/api/v1/documents?session_id={b}").json()["items"]} == {
        common["id"]
    }
    assert {d["id"] for d in client.get(f"/api/v1/documents?project_id={p}").json()["items"]} == {
        common["id"]
    }
    sources = search(
        factory, "local", [common["id"], private["id"]], "refund private", session_id=b
    )
    assert {s["document_id"] for s in sources} == {common["id"]}
    result = client.post(
        f"/api/v1/sessions/{b}/messages",
        json={
            "content": "private",
            "document_ids": [private["id"]],
            "request_id": str(uuid.uuid4()),
        },
    )
    assert result.status_code == 404


def test_scoped_upload_and_listing_require_exactly_one_target(stack):
    _, _, _, client = stack
    p, s = project(client, "Scope"), session(client)
    assert client.get("/api/v1/documents").status_code == 422
    assert client.post("/api/v1/documents", files={"file": ("x.txt", b"hello")}).status_code == 422
    assert (
        client.post(
            "/api/v1/documents",
            data={"project_id": p, "session_id": s},
            files={"file": ("x.txt", b"hello")},
        ).status_code
        == 422
    )
    assert client.get(f"/api/v1/documents?project_id={p}&session_id={s}").status_code == 422


def test_duplicate_file_reuses_ingestion_and_detach_affects_only_one_scope(stack):
    settings, factory, _, client = stack
    a, b = session(client), session(client)
    first = upload(client, "Shared bytes but separate sessions", session_id=a)
    second = upload(client, "Shared bytes but separate sessions", session_id=b)
    assert first["id"] == second["id"] and first["job_id"] == second["job_id"]
    assert first["bindings"][0]["id"] != second["bindings"][0]["id"]
    process_one(settings, factory)
    assert (
        client.delete(f"/api/v1/document-bindings/{first['bindings'][0]['id']}").status_code == 204
    )
    assert client.get(f"/api/v1/documents?session_id={a}").json()["items"] == []
    assert client.get(f"/api/v1/documents?session_id={b}").json()["items"][0]["status"] == "ready"
    result = client.post(
        f"/api/v1/sessions/{a}/messages",
        json={"content": "Shared", "document_ids": [first["id"]], "request_id": str(uuid.uuid4())},
    )
    assert result.status_code == 404


def test_moving_chat_changes_project_context_and_preserves_local_files_and_history(stack):
    settings, factory, app, client = stack
    p, q = project(client, "A"), project(client, "B")
    s = session(client, p)
    left = upload(client, "Alpha research data", project_id=p)
    right = upload(client, "Beta research data", project_id=q)
    local = upload(client, "Private research data", session_id=s)
    for _ in range(3):
        process_one(settings, factory)
    app.state.provider_transport = httpx.MockTransport(
        lambda _: httpx.Response(
            200, text='data: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: [DONE]\n\n'
        )
    )
    client.post(
        f"/api/v1/sessions/{s}/messages",
        json={"content": "research", "request_id": str(uuid.uuid4()), "document_ids": [left["id"]]},
    )
    assert client.patch(f"/api/v1/sessions/{s}", json={"project_id": q}).json()["project_id"] == q
    ids = {d["id"] for d in client.get(f"/api/v1/documents?session_id={s}").json()["items"]}
    assert ids == {right["id"], local["id"]}
    assert len(client.get(f"/api/v1/sessions/{s}/messages").json()["items"]) == 2
    assert client.get(f"/api/v1/sessions?project_id={p}").json()["items"] == []
    assert (
        client.patch(f"/api/v1/sessions/{s}", json={"project_id": None}).json()["project_id"]
        is None
    )
    assert {d["id"] for d in client.get(f"/api/v1/documents?session_id={s}").json()["items"]} == {
        local["id"]
    }


def test_chat_automatically_uses_only_ready_files_in_its_scope(stack):
    settings, factory, app, client = stack
    p = project(client, "Project context")
    s, other = session(client, p), session(client)
    upload(client, "Project research facts", project_id=p)
    upload(client, "Secret research facts", session_id=other)
    for _ in range(2):
        process_one(settings, factory)
    seen = []

    def provider(request):
        seen.append(json.loads(request.content))
        return httpx.Response(
            200, text='data: {"choices":[{"delta":{"content":"answer"}}]}\n\ndata: [DONE]\n\n'
        )

    app.state.provider_transport = httpx.MockTransport(provider)
    result = client.post(
        f"/api/v1/sessions/{s}/messages",
        json={"content": "research", "request_id": str(uuid.uuid4())},
    )
    assert "event: done" in result.text
    assert "Project research facts" in seen[0]["messages"][0]["content"]
    assert "Secret research facts" not in seen[0]["messages"][0]["content"]


def test_foreign_project_cannot_be_read_attached_or_selected(stack):
    from app.storage import Project

    _, factory, _, client = stack
    with factory() as db:
        private = Project(id=str(uuid.uuid4()), owner_id="other", name="Private")
        db.add(private)
        db.commit()
        pid = private.id
    assert client.get(f"/api/v1/projects/{pid}").status_code == 404
    assert client.get(f"/api/v1/documents?project_id={pid}").status_code == 404
    assert client.post("/api/v1/sessions", json={"project_id": pid}).status_code == 404
    assert (
        client.post(
            "/api/v1/documents", data={"project_id": pid}, files={"file": ("x.txt", b"hello")}
        ).status_code
        == 404
    )


def test_automatic_file_selection_has_the_same_twenty_file_limit_as_explicit_requests(stack):
    settings, factory, _, client = stack
    p = project(client, "Large project")
    s = session(client, p)
    with factory() as db:
        for index in range(22):
            doc = Document(
                id=str(uuid.uuid4()),
                owner_id="local",
                name=f"file-{index}.txt",
                checksum=str(index),
                path=f"test-{index}.txt",
                status="ready",
                created_at=now() + timedelta(seconds=index),
            )
            db.add(doc)
            db.add(DocumentBinding(document_id=doc.id, project_id=p))
        db.commit()
    turn = begin(factory, settings, s, ChatRequest(content="facts", request_id=uuid.uuid4()))
    assert len(turn["document_ids"]) == 20
    with factory() as db:
        assert [db.get(Document, id).name for id in turn["document_ids"]] == [
            f"file-{index}.txt" for index in range(21, 1, -1)
        ]


def test_project_move_is_blocked_during_a_turn_but_recovers_after_its_deadline(stack):
    settings, factory, _, client = stack
    p = project(client, "Destination")
    s = session(client)
    begin(factory, settings, s, ChatRequest(content="facts", request_id=uuid.uuid4()))
    assert client.patch(f"/api/v1/sessions/{s}", json={"project_id": p}).status_code == 409
    assert client.get(f"/api/v1/sessions/{s}").json()["project_id"] is None
    with factory() as db:
        db.get(Session, s).active_until = now() - timedelta(seconds=1)
        db.commit()
    result = client.patch(f"/api/v1/sessions/{s}", json={"project_id": p})
    assert result.status_code == 200 and result.json()["project_id"] == p
