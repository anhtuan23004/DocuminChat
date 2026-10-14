"""Initial durable chat/document/job schema. pgvector reserved for the next retrieval slice."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(100), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("active_request", sa.String(36)),
        sa.Column("active_until", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_chat_sessions_owner_id", "chat_sessions", ["owner_id"])
    op.create_table(
        "messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("chat_sessions.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_messages_session_id", "messages", ["session_id"])
    op.create_table(
        "turns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("session_id", sa.String(36), sa.ForeignKey("chat_sessions.id"), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("message_id", sa.String(36), sa.ForeignKey("messages.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.UniqueConstraint("session_id", "request_id"),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("checksum", sa.String(64), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("owner_id", "checksum"),
    )
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"])
    op.create_table(
        "chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
    )
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False, unique=True
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("lease_token", sa.String(36)),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("error", sa.Text()),
    )
    op.create_index("ix_jobs_status", "jobs", ["status"])


def downgrade():
    for table in ["jobs", "chunks", "documents", "turns", "messages", "chat_sessions"]:
        op.drop_table(table)
