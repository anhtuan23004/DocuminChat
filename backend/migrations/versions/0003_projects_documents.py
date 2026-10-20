"""Scope files to a project or session; preserve legacy data in an explicit project."""

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])
    with op.batch_alter_table("chat_sessions") as batch:
        batch.add_column(sa.Column("project_id", sa.String(36)))
        batch.create_foreign_key("fk_session_project", "projects", ["project_id"], ["id"])
        batch.create_index("ix_chat_sessions_project_id", ["project_id"])
    op.create_table(
        "document_bindings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id")),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("chat_sessions.id")),
        sa.CheckConstraint(
            "(project_id IS NOT NULL AND session_id IS NULL) OR "
            "(project_id IS NULL AND session_id IS NOT NULL)",
            name="one_document_scope",
        ),
        sa.UniqueConstraint("document_id", "project_id"),
        sa.UniqueConstraint("document_id", "session_id"),
    )
    for column in ["document_id", "project_id", "session_id"]:
        op.create_index(f"ix_document_bindings_{column}", "document_bindings", [column])
    connection = op.get_bind()
    owners = connection.execute(sa.text("SELECT DISTINCT owner_id FROM documents")).scalars().all()
    for owner in owners:
        project_id = str(uuid.uuid4())
        connection.execute(
            sa.text(
                "INSERT INTO projects (id, owner_id, name, created_at) "
                "VALUES (:id, :owner, :name, :created)"
            ),
            {
                "id": project_id,
                "owner": owner,
                "name": "Dữ liệu trước Project",
                "created": datetime.now(UTC),
            },
        )
        docs = (
            connection.execute(
                sa.text("SELECT id FROM documents WHERE owner_id = :owner"), {"owner": owner}
            )
            .scalars()
            .all()
        )
        for doc in docs:
            connection.execute(
                sa.text(
                    "INSERT INTO document_bindings (id, document_id, project_id) "
                    "VALUES (:id, :doc, :project)"
                ),
                {"id": str(uuid.uuid4()), "doc": doc, "project": project_id},
            )
        connection.execute(
            sa.text("UPDATE chat_sessions SET project_id = :project WHERE owner_id = :owner"),
            {"project": project_id, "owner": owner},
        )


def downgrade():
    op.drop_table("document_bindings")
    with op.batch_alter_table("chat_sessions") as batch:
        batch.drop_index("ix_chat_sessions_project_id")
        batch.drop_constraint("fk_session_project", type_="foreignkey")
        batch.drop_column("project_id")
    op.drop_table("projects")
