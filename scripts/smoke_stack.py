"""Smoke an already running local stack with an explicit test document (no model needed)."""
import json
import time
import urllib.error
import urllib.request
import uuid

base = "http://127.0.0.1:3030/api/v1"


def call(path, method="GET", body=None, content_type="application/json"):
    request = urllib.request.Request(base + path, data=body, method=method,
                                     headers={"Content-Type": content_type})
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


assert call("/health")["status"] == "ok"
session = call("/sessions", "POST", b'{}')
boundary = uuid.uuid4().hex
body = (f'--{boundary}\r\nContent-Disposition: form-data; name="session_id"\r\n\r\n{session["id"]}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="smoke-fixture.txt"\r\n'
        'Content-Type: text/plain\r\n\r\nRefund period is thirty days. Smoke fixture only.\r\n'
        f'--{boundary}--\r\n').encode()
doc = call("/documents", "POST", body, f"multipart/form-data; boundary={boundary}")
deadline = time.monotonic() + 30
while time.monotonic() < deadline:
    job = call(f"/jobs/{doc['job_id']}")
    if job["status"] in {"completed", "failed"}:
        break
    time.sleep(0.5)
assert job["status"] == "completed", job
assert any(item["id"] == doc["id"] and item["status"] == "ready" for item in call(f"/documents?session_id={session['id']}")["items"])
assert any(item["id"] == session["id"] for item in call("/sessions")["items"])
assert call(f"/sessions/{session['id']}/messages")["items"] == []
if not call("/health")["model_configured"]:
    try:
        call(f"/sessions/{session['id']}/messages", "POST", json.dumps({
            "content": "refund period", "document_ids": [doc["id"]], "request_id": str(uuid.uuid4())
        }).encode())
        raise AssertionError("Unconfigured model must not generate an answer")
    except urllib.error.HTTPError as error:
        assert error.code == 503
print("OK: HTTP/proxy, upload → worker → ready, PostgreSQL sessions, unconfigured-model handling.")
