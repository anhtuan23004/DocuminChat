"""Persist pin/archive state and the time of the latest user turn."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "chat_sessions",
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("chat_sessions", sa.Column("updated_at", sa.DateTime(timezone=True)))
    op.execute("UPDATE chat_sessions SET updated_at = created_at")
    with op.batch_alter_table("chat_sessions") as batch:
        batch.alter_column("updated_at", existing_type=sa.DateTime(timezone=True), nullable=False)


def downgrade():
    with op.batch_alter_table("chat_sessions") as batch:
        batch.drop_column("updated_at")
        batch.drop_column("archived")
        batch.drop_column("pinned")
