from alembic import op
import sqlalchemy as sa


revision = "20260304_0016"
down_revision = "20260303_0015"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "certificate_mirror",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "company_id",
            sa.String(length=36),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("cert_id", sa.String(length=80), nullable=True),
        sa.Column("sha1_fingerprint", sa.String(length=60), nullable=True),
        sa.Column("serial_number", sa.String(length=120), nullable=True),
        sa.Column("name", sa.String(length=240), nullable=True),
        sa.Column("cn", sa.String(length=240), nullable=True),
        sa.Column("issuer_cn", sa.String(length=240), nullable=True),
        sa.Column("document_type", sa.String(length=16), nullable=True),
        sa.Column("document_digits", sa.String(length=32), nullable=True),
        sa.Column("document_masked", sa.String(length=32), nullable=True),
        sa.Column("parse_ok", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("not_before", sa.DateTime(timezone=True), nullable=True),
        sa.Column("not_after", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_ingested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_unique_constraint("uq_certificate_mirror_org_sha1", "certificate_mirror", ["org_id", "sha1_fingerprint"])
    op.create_index("ix_certificate_mirror_org_not_after", "certificate_mirror", ["org_id", "not_after"])
    op.create_index("ix_certificate_mirror_org_document_digits", "certificate_mirror", ["org_id", "document_digits"])
    op.create_index("ix_certificate_mirror_org_company_id", "certificate_mirror", ["org_id", "company_id"])


def downgrade():
    op.drop_index("ix_certificate_mirror_org_company_id", table_name="certificate_mirror")
    op.drop_index("ix_certificate_mirror_org_document_digits", table_name="certificate_mirror")
    op.drop_index("ix_certificate_mirror_org_not_after", table_name="certificate_mirror")
    op.drop_constraint("uq_certificate_mirror_org_sha1", "certificate_mirror", type_="unique")
    op.drop_table("certificate_mirror")
