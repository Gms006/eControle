from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, ProgrammingError, IntegrityError

from app.core.config import settings
from app.core.security import hash_password
from app.models.org import Org
from app.models.role import Role
from app.models.user import User


def ensure_seed_data(db: Session) -> None:
    """
    Seed idempotente para DEV/TEST quando SEED_ENABLED=true.
    Necessário porque os testes usam SQLite in-memory e recriam o schema a cada teste.
    """
    if not getattr(settings, "SEED_ENABLED", False):
        return

    # If tables are not ready yet (common in SQLite in-memory tests), exit silently.
    try:
        db.query(Role).limit(1).all()
    except (OperationalError, ProgrammingError):
        return

    # 1) Roles
    role_names = ["DEV", "ADMIN", "VIEW"]
    roles: dict[str, Role] = {}
    for name in role_names:
        role = db.query(Role).filter(Role.name == name).first()
        if not role:
            role = Role(name=name)
            db.add(role)
            db.flush()
        roles[name] = role

    # 2) Org padrão
    # tenta usar slug configurado; fallback seguro
    default_slug = getattr(settings, "SEED_ORG_SLUG", None) or "neto-contabilidade"
    org = db.query(Org).filter(Org.slug == default_slug).first()
    if not org:
        org = Org(name="Neto Contabilidade", slug=default_slug)
        db.add(org)
        db.flush()

    # 3) Users seed:
    # - In tests, helpers often create users with fixed emails; seeding them here can cause UNIQUE conflicts.
    # - Strategy:
    #   a) Always seed roles + org.
    #   b) If a known seed user already exists, ensure required roles.
    #   c) Only create seed users if there are NO users at all (local dev convenience).

    seeds = [
        ("dev@example.com", "dev123", ["DEV"]),
        ("admin@example.com", "admin123", ["ADMIN", "DEV"]),  # admin should also have DEV for convenience/tests
    ]

    any_user = db.query(User).limit(1).first()

    for email, password, user_roles in seeds:
        user = db.query(User).filter(User.email == email).first()

        if not user:
            # Only create if database has no users at all (avoid test fixture conflicts)
            if any_user:
                continue
            user = User(
                email=email,
                hashed_password=hash_password(password),
                org_id=org.id,
                is_active=True,
            )
            db.add(user)
            try:
                db.flush()
            except IntegrityError:
                db.rollback()
                user = db.query(User).filter(User.email == email).first()
                if not user:
                    raise

        # Ensure org_id and roles for existing/created user
        if user.org_id != org.id:
            user.org_id = org.id
        existing = {r.name for r in user.roles}
        for rname in user_roles:
            if rname not in existing:
                user.roles.append(roles[rname])

    db.commit()
