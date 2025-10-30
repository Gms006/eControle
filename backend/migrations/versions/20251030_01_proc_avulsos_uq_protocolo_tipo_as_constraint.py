"""Convert unique index (protocolo,tipo) into a UNIQUE CONSTRAINT.

- Dedup by (protocolo,tipo) keeping the most recent (by updated_at, then id)
- Drop unique index if exists
- Add UNIQUE CONSTRAINT uq_proc_avulso_protocolo_tipo on (protocolo,tipo)
"""

from alembic import op

# ajuste os ponteiros conforme sua head atual
revision = "20251030_01_proc_avulsos_uq_protocolo_tipo_as_constraint"
down_revision = "20251029_04_add_bombeiros_area_projeto"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Deduplicar (protocolo,tipo) quando protocolo não for NULL
    # Mantém a linha "mais nova": maior updated_at; em caso de empate, maior id
    op.execute(
        """
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY protocolo, tipo
              ORDER BY COALESCE(updated_at, '1970-01-01'::timestamptz) DESC, id DESC
            ) AS rn
          FROM processos_avulsos
          WHERE protocolo IS NOT NULL
        )
        DELETE FROM processos_avulsos p
        USING ranked r
        WHERE p.id = r.id
          AND r.rn > 1;
        """
    )

    # 2) Dropar o índice único antigo, se existir (ele não é uma constraint)
    op.execute("DROP INDEX IF EXISTS uq_proc_avulso_protocolo_tipo;")

    # 3) Criar a UNIQUE CONSTRAINT com o mesmo nome
    op.execute(
        """
        ALTER TABLE processos_avulsos
        ADD CONSTRAINT uq_proc_avulso_protocolo_tipo
        UNIQUE (protocolo, tipo);
        """
    )


def downgrade() -> None:
    # Reverter: remover a constraint e recriar como índice único
    op.execute(
        """
        ALTER TABLE processos_avulsos
        DROP CONSTRAINT IF EXISTS uq_proc_avulso_protocolo_tipo;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_proc_avulso_protocolo_tipo
        ON processos_avulsos (protocolo, tipo);
        """
    )
