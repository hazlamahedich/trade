"""add vote_debate_choice index

Revision ID: f1a2b3c4d5e6
Revises: e7a3b4c5d6f7
Create Date: 2026-04-13

"""

from typing import Sequence, Union

from alembic import op


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e7a3b4c5d6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_vote_debate_choice",
        "votes",
        ["debate_id", "choice"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_vote_debate_choice", table_name="votes")
