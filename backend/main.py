from fastapi import FastAPI

app = FastAPI(title="eControle v2 API", version="0.1.0")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/api/v1/worker/health")
def worker_health():
    return {"status": "ok", "worker": "stub"}