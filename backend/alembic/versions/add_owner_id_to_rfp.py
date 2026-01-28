"""add owner_id to rfp_submissions

Revision ID: add_owner_id_rfp
Revises: eb68807aeab5
Create Date: 2026-01-19

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'add_owner_id_rfp'
down_revision: Union[str, Sequence[str], None] = 'da43202f3006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add owner_id column to rfp_submissions."""
    # Primero agregamos la columna como nullable
    op.add_column(
        'rfp_submissions',
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    
    # Crear índice
    op.create_index('idx_rfp_owner', 'rfp_submissions', ['owner_id'])
    
    # Obtenemos el primer usuario para asignar los RFPs existentes
    # (o creamos un usuario por defecto si no hay ninguno)
    connection = op.get_bind()
    
    # Buscar el primer usuario
    result = connection.execute(
        sa.text("SELECT id FROM users LIMIT 1")
    )
    first_user = result.fetchone()
    
    if first_user:
        default_user_id = first_user[0]
        # Actualizar todos los RFPs existentes con este usuario
        connection.execute(
            sa.text(f"UPDATE rfp_submissions SET owner_id = :user_id WHERE owner_id IS NULL"),
            {"user_id": default_user_id}
        )
    else:
        # Si no hay usuarios, eliminamos los RFPs huérfanos (si los hay)
        connection.execute(
            sa.text("DELETE FROM rfp_submissions WHERE owner_id IS NULL")
        )
    
    # Ahora hacemos la columna NOT NULL
    op.alter_column(
        'rfp_submissions',
        'owner_id',
        nullable=False
    )
    
    # Agregar foreign key
    op.create_foreign_key(
        'fk_rfp_owner',
        'rfp_submissions',
        'users',
        ['owner_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Remove owner_id column from rfp_submissions."""
    op.drop_constraint('fk_rfp_owner', 'rfp_submissions', type_='foreignkey')
    op.drop_index('idx_rfp_owner', table_name='rfp_submissions')
    op.drop_column('rfp_submissions', 'owner_id')
