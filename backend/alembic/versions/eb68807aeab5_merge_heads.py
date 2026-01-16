"""merge_heads

Revision ID: eb68807aeab5
Revises: 686d9e889ae7, f1e2d3c4b5a6
Create Date: 2026-01-16 10:39:23.693593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'eb68807aeab5'
down_revision: Union[str, Sequence[str], None] = ('686d9e889ae7', 'f1e2d3c4b5a6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
