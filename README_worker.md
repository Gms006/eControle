# Worker e watchers (S4.3)

Este documento resume como operar o stack de fila/watchers/worker.

## Dependências
- Redis (URL configurável via `REDIS_URL`, padrão `redis://localhost:6379/0`).
- Python com dependências do backend (`rq`, `redis`, `watchdog`).

## Iniciando o Redis localmente

```bash
# Via Docker
docker run --name redis-econtrole -p 6379:6379 -d redis:7

# Ou via podman
podman run --name redis-econtrole -p 6379:6379 -d docker.io/redis:7
```

## Executando o worker RQ

```bash
cd backend
python -m app.worker.worker_main
```

O worker registra os jobs disponíveis e inicia o consumo da fila configurada
(`RQ_QUEUE_NAME`, padrão `econtrole`).

## Iniciando os watchers

```bash
cd backend
python - <<'PY'
from app.worker.watchers import start_certificados_watcher, start_licencas_watcher

# Ajuste caminhos e org_id conforme o ambiente
start_certificados_watcher(
    org_id="${ORG_ID_DEFAULT}",
    certificados_root=r"${CERTIFICADOS_ROOT}",
)
PY
```

Para licenças:

```bash
cd backend
python - <<'PY'
from app.worker.watchers import start_licencas_watcher

start_licencas_watcher(
    org_id="${ORG_ID_DEFAULT}",
    licencas_root=r"${LICENCAS_ROOT}",
)
PY
```

Variáveis úteis:
- `CERTIFICADOS_ROOT` (alias de `ECONTROLE_CERTIFICADOS_DIR`).
- `LICENCAS_ROOT` (alias de `EMPRESAS_ROOT_DIR`).
- `ORG_ID_DEFAULT` (org padrão para ambientes single-org).
- `WATCHER_DEBOUNCE_SECONDS` (padrão 3s).
- `WATCHER_MAX_EVENTS_PER_MINUTE` (rate limit opcional).

## Testando via API (fila)

Certificados:
```bash
curl -X POST http://localhost:8000/api/v1/certificados/ingest \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```

Licenças:
```bash
curl -X POST "http://localhost:8000/api/v1/licencas/ingest-from-fs" \
  -H "Authorization: Bearer <token>"
```

Status do worker:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/worker/health
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/worker/jobs/<job_id>
```

Os endpoints retornam `job_id` para acompanhamento.
