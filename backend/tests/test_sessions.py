import uuid

from app.storage import Session


def test_pin_archive_restore_and_owner_scope(stack):
    _, factory, _, client = stack
    session = client.post("/api/v1/sessions", json={"title": "Review document"}).json()
    path = f"/api/v1/sessions/{session['id']}"
    pinned = client.patch(path, json={"pinned": True})
    assert pinned.status_code == 200 and pinned.json()["pinned"]
    assert pinned.json()["created_at"]
    assert client.patch(path, json={"archived": True}).json()["archived"]
    assert client.get("/api/v1/sessions").json()["items"] == []
    assert client.get("/api/v1/sessions?archived=true").json()["items"][0]["id"] == session["id"]
    assert client.patch(path, json={"archived": False}).status_code == 200
    assert client.get("/api/v1/sessions").json()["items"][0]["pinned"]
    with factory() as db:
        foreign = Session(id=str(uuid.uuid4()), owner_id="other", title="private")
        db.add(foreign)
        db.commit()
        foreign_id = foreign.id
    assert client.patch(f"/api/v1/sessions/{foreign_id}", json={"pinned": True}).status_code == 404
