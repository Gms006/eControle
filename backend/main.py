from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.security import hash_password, verify_password
from app.db.session import SessionLocal
from app.models.org import Org
from app.models.role import Role
from app.models.user import User

configure_logging(settings.LOG_LEVEL)


def _slugify(value: str) -> str:
    slug = []
    last_was_dash = False
    for char in value.strip().lower():
        if char.isalnum():
            slug.append(char)
            last_was_dash = False
        else:
            if not last_was_dash:
                slug.append("-")
                last_was_dash = True
    text = "".join(slug).strip("-")
    return text or "org"


def seed_dev_data():
    if not settings.SEED_ENABLED:
        return

    db = SessionLocal()
    try:
        role_names = ["DEV", "ADMIN", "VIEW"]
        for role_name in role_names:
            exists = db.query(Role).filter(Role.name == role_name).first()
            if not exists:
                db.add(Role(name=role_name))
        db.commit()

        org = db.query(Org).filter(Org.name == settings.SEED_ORG_NAME).first()
        if not org:
            org = Org(
                name=settings.SEED_ORG_NAME,
                slug=_slugify(settings.SEED_ORG_NAME),
            )
            db.add(org)
            db.commit()
            db.refresh(org)
        elif not org.slug:
            org.slug = _slugify(org.name)
            db.commit()

        user = db.query(User).filter(User.email == settings.MASTER_EMAIL).first()
        if not user:
            user = User(
                email=settings.MASTER_EMAIL,
                hashed_password=hash_password(settings.MASTER_PASSWORD),
                org_id=org.id,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if not verify_password(settings.MASTER_PASSWORD, user.hashed_password):
                user.hashed_password = hash_password(settings.MASTER_PASSWORD)
                db.commit()
            db.refresh(user)

        master_roles = [
            role.strip().upper()
            for role in settings.MASTER_ROLES.split(",")
            if role.strip()
        ]
        roles = db.query(Role).filter(Role.name.in_(master_roles)).all()
        existing = {role.name for role in user.roles}
        for role in roles:
            if role.name not in existing:
                user.roles.append(role)
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_dev_data()
    yield


app = FastAPI(title=settings.PROJECT_NAME, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/api/v1/worker/health")
def worker_health():
    return {"status": "ok", "worker": "stub"}

