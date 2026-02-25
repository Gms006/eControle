from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine_kwargs: dict = {"pool_pre_ping": True}
connect_args: dict = {}

# --- UTF-8 hardening (Windows/console safety)
# Postgres is UTF8 on server, but we also force client_encoding to avoid mojibake
# when running ingestion or admin tasks from Windows terminals.
try:
    url = make_url(settings.DATABASE_URL)
    if url.get_backend_name() in {"postgresql", "postgres"}:
        # psycopg2/libpq option flag
        connect_args.setdefault("options", "-c client_encoding=UTF8")
except Exception:
    # Keep defaults if URL parsing fails; app will raise later on connect.
    pass

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {**connect_args, "check_same_thread": False}
    if ":memory:" in settings.DATABASE_URL:
        engine_kwargs["poolclass"] = StaticPool

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
