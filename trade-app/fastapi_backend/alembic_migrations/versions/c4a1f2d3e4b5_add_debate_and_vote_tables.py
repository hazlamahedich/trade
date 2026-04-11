"""Add debate and vote tables

Revision ID: c4a1f2d3e4b5
Revises: b389592974f8
Create Date: 2026-04-11

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c4a1f2d3e4b5"
down_revision: Union[str, None] = "b389592974f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "debates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("external_id", sa.String(), nullable=False),
        sa.Column("asset", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("max_turns", sa.Integer(), nullable=False),
        sa.Column("current_turn", sa.Integer(), nullable=False),
        sa.Column("guardian_verdict", sa.String(), nullable=True),
        sa.Column("guardian_interrupts_count", sa.Integer(), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_debates_external_id", "debates", ["external_id"], unique=True)

    op.create_table(
        "votes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("debate_id", sa.UUID(), nullable=False),
        sa.Column("choice", sa.String(), nullable=False),
        sa.Column("voter_fingerprint", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["debate_id"], ["debates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_votes_debate_fingerprint_unique",
        "votes",
        ["debate_id", "voter_fingerprint"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_votes_debate_fingerprint_unique", table_name="votes")
    op.drop_table("votes")
    op.drop_index("ix_debates_external_id", table_name="debates")
    op.drop_table("debates")
