"""add pending_archives table

Revision ID: e7a3b4c5d6f7
Revises: d5b2f3a4e5c6
Create Date: 2026-04-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision: str = "e7a3b4c5d6f7"
down_revision: Union[str, None] = "d5b2f3a4e5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pending_archives",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("debate_external_id", sa.String(), nullable=False, unique=True),
        sa.Column("full_state", JSONB, nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="10"),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pending_archives_debate_external_id",
        "pending_archives",
        ["debate_external_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_pending_archives_debate_external_id")
    op.drop_table("pending_archives")
