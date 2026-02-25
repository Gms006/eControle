from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.seed import ensure_seed_data
from app.db.session import SessionLocal

configure_logging(settings.LOG_LEVEL)


def seed_dev_data():
    db = SessionLocal()
    try:
        ensure_seed_data(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_dev_data()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan,
    redoc_url=None,  # desabilita o /redoc padrão do FastAPI (que aponta para redoc@next)
)

app.include_router(api_router, prefix=settings.API_V1_STR)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for ReDoc
static_dir = Path(__file__).parent / "app" / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Custom ReDoc endpoint with self-hosted assets
# Check if assets are locally available, otherwise use CDN
redoc_assets_dir = Path(__file__).parent / "app" / "static" / "redoc"

@app.get("/redoc", response_class=HTMLResponse)
async def redoc_html():
    redoc_standalone_exists = (redoc_assets_dir / "redoc.standalone.js").exists()
    if redoc_standalone_exists:
        # Use locally hosted assets
        script_src = "/static/redoc/redoc.standalone.js"
    else:
        # Fallback to CDN with pinned stable version (not @next to avoid 404 errors)
        script_src = "https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js"
    
    return f"""
    <!DOCTYPE html>
    <html>
      <head>
        <title>ReDoc</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
        <style>
          body {{
            margin: 0;
            padding: 0;
          }}
        </style>
      </head>
      <body>
        <redoc spec-url='/openapi.json'></redoc>
        <script src="{script_src}"></script>
      </body>
    </html>
    """

@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/api/v1/worker/health")
def worker_health():
    return {"status": "ok", "worker": "stub"}

