"""add vote counts to debates

Revision ID: d5b2f3a4e5c6
Revises: c4a1f2d3e4b5
Create Date: 2026-04-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5b2f3a4e5c6"
down_revision: Union[str, None] = "c4a1f2d3e4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("debates", sa.Column("vote_bull", sa.Integer(), nullable=True))
    op.add_column("debates", sa.Column("vote_bear", sa.Integer(), nullable=True))
    op.add_column("debates", sa.Column("vote_undecided", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("debates", "vote_undecided")
    op.drop_column("debates", "vote_bear")
    op.drop_column("debates", "vote_bull")
