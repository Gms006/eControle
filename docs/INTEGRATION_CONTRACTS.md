# Integration Contracts (S0)

**Objetivo**
Definir contratos de integracao do eControle v2 com CertHub (espelho de certificados) e Scribere (exports). Sem implementacao neste stage.

**CertHub (espelho de certificados)**
Referencias existentes
- Layout de cards: `CertHub/frontend/src/pages/Certificates.tsx`.
- Rotas do portal CertHub: `CertHub/frontend/src/App.tsx` (ex.: `/certificados`).
- Campos referencia para mirror: `CertHub/backend/app/schemas/certificate.py` (`CertificatePortalRead`).

Contratos propostos no eControle v2
- `POST /api/v1/integracoes/certhub/sync` -> dispara sincronizacao (server-to-server).
- `GET /api/v1/certificados` -> lista read-only do mirror.
- `GET /api/v1/certificados/{cert_id}` -> detalhe read-only (sem material sensivel).
- `GET /api/v1/certificados/health` -> status do espelho (ultima sync, contagem).

Campos minimos no mirror (sem PFX/senhas)
- `cert_id` (UUID do CertHub).
- `org_id`.
- `name`.
- `cn`, `issuer_cn`.
- `document_type`, `document_masked`, `document_unmasked` (opcional).
- `serial_number`, `sha1_fingerprint`.
- `parse_ok`, `parse_error`.
- `not_before`, `not_after`.
- `last_ingested_at`, `last_error_at`, `created_at`.

Regra do botao "Instalar"
- Caminho do portal configuravel: `CERTHUB_BASE_URL` + `CERTHUB_CERTS_PATH`.
- Deep link: `${CERTHUB_BASE_URL}${CERTHUB_CERTS_PATH}?install=<identificador>`.
- Identificador: preferir `sha1_fingerprint` (thumbprint) quando disponivel; fallback para `cert_id` (UUID do CertHub).
- Fallback se nao suportado: abrir apenas `${CERTHUB_BASE_URL}${CERTHUB_CERTS_PATH}`.

Governanca
- Sync executa no backend do eControle usando credenciais de servico do CertHub (nunca no frontend).
- Espelho e read-only; operacoes (install, export, detalhes tecnicos) pertencem ao CertHub.
- Sem armazenar arquivo, senha ou PFX no eControle v2.

**Scribere (exports = notes/snippets)**
Contratos propostos no eControle v2
- `GET /api/v1/integracoes/scribere/exports` -> lista notes/snippets visiveis.
- `GET /api/v1/integracoes/scribere/exports/{export_id}` -> detalhe (conteudo).
- `POST /api/v1/integracoes/scribere/sync` -> opcional, se existir cache espelhado no eControle.

Estrutura de dados recomendada (campos minimos)
- `export_id`.
- `note_id` (id da nota no Scribere).
- `export_type`: `note` | `snippet`.
- `scope`: `private` | `org`.
- `category` (string).
- `tags` (string[]).
- `title` (string).
- `content_format`: `markdown` | `html` | `tiptap_json`.
- `content_preview` (string, opcional).
- `updated_at`.
- `open_url` (deep link para abrir no Scribere).
- Identidade: `org_id` obrigatorio para escopo `org`, `user_id` obrigatorio para escopo `private`.

Regras de governanca
- Somente o que foi marcado no Scribere aparece no eControle.
- eControle e read-only (nao edita).
- Escopo `private` so aparece para o mesmo `user_id`.
- Escopo `org` aparece para todos do `org_id`.
- Sanitizacao obrigatoria ao renderizar `html`/`markdown` (evitar XSS).

UX na aba Uteis (v2)
- Lista de notes/snippets com filtros simples e viewer inline.
- Botao "Abrir Scribere" abre o portal principal (base URL do Scribere).
