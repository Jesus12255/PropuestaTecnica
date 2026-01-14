"""Add client_acronym manually

Revision ID: 686d9e889ae7
Revises: e0c9fc94dbcc
Create Date: 2026-01-13 23:08:23.087268

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '686d9e889ae7'
down_revision: Union[str, Sequence[str], None] = 'e0c9fc94dbcc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rfp_submissions', sa.Column('client_acronym', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    pass
