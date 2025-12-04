"""Normaliza tipos de licenças, padroniza CERCON e cria tabela licenca_tipos.

Revision ID: 20251104_01_licencas_table_fix_and_update
Revises: 20251212_02_cnds_add_cnpj
Create Date: 2025-11-04 01:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20251104_01_licencas_table_fix_and_update"
down_revision = "20251212_02_cnds_add_cnpj"
branch_labels = None
depends_on = None


def upgrade():
    """Aplica normalizações de tipos, cria licenca_tipos e adiciona tipo_codigo."""

    conn = op.get_bind()

    # 1) NORMALIZAÇÃO DOS TEXTOS EM licencas.tipo
    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo = 'ALVARÁ FUNCIONAMENTO'
            WHERE tipo LIKE 'ALVAR%FUNCIONAMENTO%';
            """
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo = 'ALVARÁ VIG SANITÁRIA'
            WHERE tipo LIKE 'ALVAR%VIG%SANIT%';
            """
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo = 'LICENÇA AMBIENTAL'
            WHERE tipo LIKE 'LICEN%A AMBIENTAL%';
            """
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo = 'CERTIDÃO USO DO SOLO'
            WHERE tipo LIKE 'CERTID%O USO DO SOLO%';
            """
        )
    )

    # 2) PADRONIZAÇÃO PARA CERCON
    conn.execute(
        sa.text(
            """
            DELETE FROM licencas l
            WHERE l.tipo = 'ALVARÁ BOMBEIROS'
              AND EXISTS (
                  SELECT 1
                  FROM licencas l2
                  WHERE l2.org_id = l.org_id
                    AND l2.empresa_id = l.empresa_id
                    AND l2.tipo = 'CERCON'
              );
            """
        )
    )

    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo = 'CERCON'
            WHERE tipo = 'ALVARÁ BOMBEIROS';
            """
        )
    )

    # 3) CRIAÇÃO DA TABELA licenca_tipos
    op.create_table(
        "licenca_tipos",
        sa.Column("codigo", sa.Text(), primary_key=True),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    licenca_tipos_table = sa.table(
        "licenca_tipos",
        sa.column("codigo", sa.Text()),
        sa.column("nome", sa.Text()),
        sa.column("descricao", sa.Text()),
        sa.column("ativo", sa.Boolean()),
    )

    op.bulk_insert(
        licenca_tipos_table,
        [
            {"codigo": "ALF", "nome": "ALVARÁ FUNCIONAMENTO", "descricao": None, "ativo": True},
            {"codigo": "AVS", "nome": "ALVARÁ VIG SANITÁRIA", "descricao": None, "ativo": True},
            {"codigo": "AMB", "nome": "LICENÇA AMBIENTAL", "descricao": None, "ativo": True},
            {"codigo": "CUSOLO", "nome": "CERTIDÃO USO DO SOLO", "descricao": None, "ativo": True},
            {"codigo": "CERCON", "nome": "ALVARÁ BOMBEIROS", "descricao": None, "ativo": True},
        ],
    )

    # 4) ADICIONA COLUNA tipo_codigo EM licencas
    op.add_column("licencas", sa.Column("tipo_codigo", sa.Text(), nullable=True))

    conn.execute(
        sa.text(
            """
            UPDATE licencas
            SET tipo_codigo = CASE
                WHEN tipo = 'ALVARÁ FUNCIONAMENTO' THEN 'ALF'
                WHEN tipo = 'ALVARÁ VIG SANITÁRIA' THEN 'AVS'
                WHEN tipo = 'LICENÇA AMBIENTAL'    THEN 'AMB'
                WHEN tipo = 'CERTIDÃO USO DO SOLO' THEN 'CUSOLO'
                WHEN tipo = 'CERCON'               THEN 'CERCON'
                ELSE NULL
            END;
            """
        )
    )

    # 5) CRIA CONSTRAINT DE FK licencas.tipo_codigo -> licenca_tipos.codigo
    op.create_foreign_key(
        "licencas_tipo_codigo_fkey",
        source_table="licencas",
        referent_table="licenca_tipos",
        local_cols=["tipo_codigo"],
        remote_cols=["codigo"],
    )


def downgrade():
    """Downgrade best-effort removendo estruturas criadas."""

    op.drop_constraint("licencas_tipo_codigo_fkey", "licencas", type_="foreignkey")
    op.drop_column("licencas", "tipo_codigo")
    op.drop_table("licenca_tipos")
