"""add audit_events, hallucination_flags, audit_dlq tables

Revision ID: g2b4c6d8e0f1
Revises: f1a2b3c4d5e6
Create Date: 2026-04-18

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision: str = "g2b4c6d8e0f1"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "debate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("debates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sequence_number", sa.BigInteger, nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(20), nullable=False),
        sa.Column("payload", JSONB, nullable=False, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "debate_id", "sequence_number", name="uq_audit_events_debate_seq"
        ),
    )

    op.create_table(
        "hallucination_flags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "debate_id",
            UUID(as_uuid=True),
            sa.ForeignKey("debates.id"),
            nullable=False,
        ),
        sa.Column(
            "audit_event_id",
            UUID(as_uuid=True),
            sa.ForeignKey("audit_events.id"),
            nullable=True,
        ),
        sa.Column("turn", sa.Integer, nullable=False),
        sa.Column("agent", sa.String(10), nullable=False),
        sa.Column("message_snippet", sa.Text, nullable=False),
        sa.Column(
            "flagged_by",
            UUID(as_uuid=True),
            sa.ForeignKey("user.id"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "audit_dlq",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("original_event", JSONB, nullable=False),
        sa.Column("error_message", sa.Text, nullable=False),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_hallucination_flags_status",
        "hallucination_flags",
        ["status"],
    )

    op.create_index(
        "ix_audit_dlq_retry_count",
        "audit_dlq",
        ["retry_count"],
    )

    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(
        sa.text(
            "CREATE INDEX CONCURRENTLY ix_audit_events_debate_created "
            "ON audit_events (debate_id, created_at)"
        )
    )
    conn.execute(
        sa.text(
            "CREATE INDEX CONCURRENTLY ix_audit_events_payload "
            "ON audit_events USING gin (payload)"
        )
    )

    conn.execute(
        sa.text(
            "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
            "SELECT gen_random_uuid(), id, 0, 'LEGACY_DEBATE_MIGRATION', 'system', "
            '\'{"note": "pre-audit"}\'::jsonb '
            "FROM debates d "
            "WHERE NOT EXISTS (SELECT 1 FROM audit_events ae WHERE ae.debate_id = d.id)"
        )
    )

    expected = {"ix_audit_events_debate_created", "ix_audit_events_payload"}
    result = conn.execute(
        sa.text("SELECT indexname FROM pg_indexes WHERE tablename = 'audit_events'")
    )
    created = {row[0] for row in result.fetchall()}
    missing = expected - created
    if missing:
        print(f"WARNING: migration indexes missing: {missing}")


def downgrade() -> None:
    op.drop_table("audit_dlq")
    op.drop_table("hallucination_flags")
    op.drop_table("audit_events")
