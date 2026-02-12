# eControle v2 (Rebuild)

Portal interno da Neto Contabilidade para acompanhamento de **empresas, licenças/certidões, taxas e processos**,
com integrações com:
- **CertHub** (certificados digitais) — eControle exibe um **espelho (read-only)** em cards e redireciona ações operacionais para o CertHub.
- **Scribere** (notas/snippets) — eControle exibe apenas exports selecionados no Scribere (read-only).

## Objetivo do Rebuild
Recriar o eControle do zero no **padrão de organização do CertHub**, voltando ao **mesmo ponto funcional do v1**
com correções de arquitetura/organização e mudanças combinadas:
- Docker-first (DX e paridade ambiente)
- Auth/RBAC no padrão CertHub (portal principal independente)
- Certificados = espelho do CertHub + “Instalar → abre CertHub”
- Úteis = exports do Scribere (notas/snippets) + “Abrir Scribere”
- Ingest inicial via **JSON** (não planilha)

---

## Portas (sem conflito com CertHub)
- Frontend (Vite): **5174**
- API (FastAPI): **8020**
- Redis (host → container): **6381 → 6379**
- Postgres (host → container): **5433 → 5432**

---

## Rodar local (Docker-first)

### 1) Subir infraestrutura (Postgres + Redis)
```bash
docker compose -f infra/docker-compose.yml up -d
````

### 2) Subir Backend (API)

```bash
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8020
```

Testar healthchecks:
bash +curl http://localhost:8020/healthz +curl http://localhost:8020/api/v1/worker/health +

> Se o backend for rodado via docker-compose no futuro (recomendado), este README será atualizado com o serviço api.

### 3) Subir Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Arquitetura (alto nível)

* `backend/` — FastAPI (padrão CertHub): `app/core`, `app/api/v1`, `app/db`, `app/models`, `app/schemas`, `app/services`, `app/workers`
* `frontend/` — React/Vite (reaproveita v1 ao máximo)
* `infra/` — docker-compose (Postgres + Redis)
* `docs/` — baseline do v1, contratos de integração, riscos/decisões e checklist

---

## Integrações

### CertHub (Certificados)

* eControle mantém tabelas espelho (read-model) com metadados.
* Sincronização via job/endpoint de sync.
* UI em cards “como no CertHub”.
* Botão “Instalar” sempre redireciona para o CertHub.

### Scribere (Úteis)

* No Scribere, usuário marca quais notas/snippets devem aparecer no eControle (exports).
* eControle consome e exibe conteúdo (read-only), com visualizador.
* Botão “Abrir Scribere” para editar/configurar exports.

---

## Documentação essencial

* `docs/BASELINE_V1.md` — ponto alvo de paridade (v1)
* `docs/REUSE_FRONTEND_MAP.md` — o que reaproveitar do frontend
* `docs/INTEGRATION_CONTRACTS.md` — contratos CertHub/Scribere
* `docs/RISKS_AND_DECISIONS_S0.md` — decisões travadas e riscos
* `docs/S0_CHECKLIST.md` — checklist do S0

---

## Segurança & Governança

* Espelho do CertHub não armazena PFX/senhas.
* Exports do Scribere são read-only no eControle.
* Multi-tenant por `org_id` em todas entidades do domínio.

---

## Licença

Uso interno (Neto Contabilidade).
