import uuid

from app.storage import Message, Session


def test_history_search_reads_saved_messages_across_projects_and_archived_chats(stack):
    _, factory, _, client = stack
    project = client.post("/api/v1/projects", json={"name": "Research"}).json()
    chat = client.post(
        "/api/v1/sessions", json={"project_id": project["id"], "title": "Interview"}
    ).json()
    client.patch(f"/api/v1/sessions/{chat['id']}", json={"archived": True})
    with factory() as db:
        db.add(
            Message(session_id=chat["id"], role="user", content="Rare needle inside saved messages")
        )
        foreign = Session(id=str(uuid.uuid4()), owner_id="other", title="Rare needle")
        db.add(foreign)
        db.commit()
    result = client.get(
        "/api/v1/sessions", params={"q": "NEEDLE", "include_archived": "true"}
    ).json()["items"]
    assert [item["id"] for item in result] == [chat["id"]]
    assert client.get("/api/v1/sessions", params={"q": "needle"}).json()["items"] == []
    assert (
        client.get("/api/v1/sessions", params={"q": "%", "include_archived": "true"}).json()[
            "items"
        ]
        == []
    )


def test_rename_chat_persists_and_rejects_blank_titles(stack):
    _, _, _, client = stack
    chat = client.post("/api/v1/sessions", json={}).json()
    path = f"/api/v1/sessions/{chat['id']}"
    response = client.patch(path, json={"title": "  Design review  "})
    assert response.status_code == 200 and response.json()["title"] == "Design review"
    assert client.get(path).json()["title"] == "Design review"
    assert client.patch(path, json={"title": "   "}).status_code == 422
