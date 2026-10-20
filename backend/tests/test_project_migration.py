import os
import subprocess
import sys

from sqlalchemy import create_engine, text


def test_legacy_files_and_transcript_survive_project_migration_and_downgrade(tmp_path):
    url = f"sqlite:///{tmp_path}/legacy.db"
    env = {**os.environ, "DATABASE_URL": url}

    def migrate(version):
        command = "downgrade" if version == "-1" else "upgrade"
        subprocess.run(
            [sys.executable, "-m", "alembic", command, version],
            env=env,
            check=True,
            capture_output=True,
        )

    migrate("0002")
    engine = create_engine(url)
    with engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO chat_sessions (id, owner_id, title, created_at, updated_at, pinned, archived) "
                "VALUES ('chat', 'local', 'legacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0)"
            )
        )
        db.execute(
            text(
                "INSERT INTO documents (id, owner_id, name, checksum, path, version, status, created_at) "
                "VALUES ('file', 'local', 'old.txt', 'hash', '/existing/file.txt', 1, 'ready', CURRENT_TIMESTAMP)"
            )
        )
        db.execute(
            text(
                "INSERT INTO messages (id, session_id, role, content, status, sources, created_at) "
                "VALUES ('message', 'chat', 'user', 'existing history', 'completed', '[]', CURRENT_TIMESTAMP)"
            )
        )
    migrate("head")
    with engine.connect() as db:
        project = db.scalar(text("SELECT project_id FROM chat_sessions WHERE id='chat'"))
        assert project
        assert (
            db.scalar(text("SELECT project_id FROM document_bindings WHERE document_id='file'"))
            == project
        )
        assert db.scalar(text("SELECT path FROM documents WHERE id='file'")) == "/existing/file.txt"
        assert (
            db.scalar(text("SELECT content FROM messages WHERE id='message'")) == "existing history"
        )
    migrate("-1")
    with engine.connect() as db:
        assert (
            db.scalar(text("SELECT content FROM messages WHERE id='message'")) == "existing history"
        )
        assert db.scalar(text("SELECT path FROM documents WHERE id='file'")) == "/existing/file.txt"
    engine.dispose()
