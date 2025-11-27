# Fluxo v4 — Portal (Private SaaS-ready) — S1 a S12

> Fluxo detalhado para o portal eControle 

---

## Visão geral da arquitetura

* **Stack**: FastAPI + PostgreSQL, **multi-tenancy por organização** (`org_id :: uuid`).
* **Segurança**: JWT HS256 (payload: `sub`, `org_id`, `email`, `role`, `iat`, `exp`).
* **Contexto de organização**: por request, `SET LOCAL app.current_org = :org_id` (GUC) + filtros por `org_id` em views/consultas.
* **Padrões de API**: paginação (`page`, `size<=100`), ordenação opcional (`sort`), busca normalizada (função `immutable_unaccent`).
* **Compatibilidade visual**: front atual **sem mudança de layout**; apenas troca da origem (planilha → API/views).

---

## S1 — Base de Dados (modelagem mínima + multi-tenancy) ✅ **CONCLUÍDO**

### 1) Schemas e extensões

* Schema principal: `public`.
* Extensões mínimas:

  * `CREATE EXTENSION IF NOT EXISTS unaccent;`
* Funções utilitárias:

  * `immutable_unaccent(text) RETURNS text` (envolve `unaccent` e é marcada `IMMUTABLE` para uso em índices).
* GUC opcional (se adotado): `app.current_org` (text/uuid) para escopo da org na sessão.

### 2) Tabelas principais (colunas chave)

> Abaixo estão os campos núcleo (não listando 100% dos legados textuais já conhecidos) e os **requisitos de tenancy/temporalidade**.

* **orgs**

  * `id uuid PK`, `name`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

* **users**

  * `id serial PK`, `org_id uuid FK → orgs(id) ON DELETE CASCADE`, `email`, `name`,
    `role user_role_enum NOT NULL DEFAULT 'OWNER'`, `is_active boolean DEFAULT true`,
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

* **empresas**

  * `id serial PK`, `org_id uuid FK`, `empresa`, `cnpj`, `municipio`,
    **legados**: `porte?`, `categoria?`, `ie?`, `im?`, `situacao?`, `debito?`, `certificado?`, `obs?`, …
  * `created_at timestamptz DEFAULT now()`, `updated_at date NOT NULL DEFAULT current_date` *(campo legado permanece `date`)*
  * `created_by? int FK users(id) ON DELETE SET NULL`, `updated_by? int FK users(id) ON DELETE SET NULL`

* **licencas**

  * `id serial PK`, `org_id uuid FK`, `empresa_id int FK empresas(id) ON DELETE CASCADE`,
    `tipo varchar NOT NULL`, `status varchar NOT NULL`, `validade date?`, `obs text?`,
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`,
    `created_by? int`, `updated_by? int`

* **taxas**

  * `id serial PK`, `org_id uuid FK`, `empresa_id int FK empresas(id) ON DELETE CASCADE`,
    `tipo varchar NOT NULL`, `status varchar NOT NULL`, `data_envio date?`, `vencimento_tpi date?`, `obs text?`,
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`,
    `created_by? int`, `updated_by? int`

* **processos**

  * `id serial PK`, `org_id uuid FK`, `empresa_id int FK empresas(id) ON DELETE CASCADE`,
    `tipo varchar NOT NULL`, `protocolo varchar?`, `data_solicitacao date?`,
    `situacao situacao_processo_enum NOT NULL`, `status_padrao varchar?`, `prazo date?`, `obs text?`,
    **enums auxiliares**: `operacao_diversos_enum?`, `orgao_diversos_enum?`, `alvara_funcionamento_enum?`, `servico_sanitario_enum?`, `notificacao_sanitaria_enum?`
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`,
    `created_by? int`, `updated_by? int`

* **processos_avulsos**

  * Similar a `processos`, mas com `documento varchar NOT NULL` e sem `empresa_id`.

* **certificados**

  * `id bigserial PK`, `org_id uuid NOT NULL`, `empresa_id int? FK empresas(id)`,
    **X.509**: `arquivo?`, `caminho?`, `serial?`, `sha1?`, `subject?`, `issuer?`, `valido_de? date`, `valido_ate? date`,
    `senha?`, `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

* **cnds** (legado utilitário)

  * `id serial PK`, `org_id uuid FK`, `empresa_id int FK`, `esfera varchar NOT NULL`, `orgao varchar NOT NULL`,
    `status varchar NOT NULL`, `url text?`, `data_emissao date?`, `validade date?`,
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz`

* **agendamentos**

  * `id bigserial PK`, `org_id uuid NOT NULL FK orgs(id) ON DELETE CASCADE`,
    `empresa_id int? FK empresas(id)`, `titulo varchar NOT NULL`, `descricao text?`,
    `inicio timestamptz NOT NULL`, `fim timestamptz?`, `tipo?`, `situacao?`,
    `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

### 3) Tabelas de staging (ingestão)

* `stg_empresas`, `stg_licencas`, `stg_taxas`, `stg_processos`, `stg_processos_avulsos`, `stg_certificados`, `stg_certificados_agendamentos`
* Padrão:
  `id serial PK`, `run_id varchar NOT NULL`, `file_source varchar NOT NULL`,
  `row_number int NOT NULL`, `row_hash varchar NOT NULL`, `payload jsonb NOT NULL`,
  `ingested_at timestamptz DEFAULT now()`, **`org_id uuid NOT NULL` (quando aplicável)**.

### 4) Enums (já criados)

* `user_role_enum`: `OWNER, ADMIN, STAFF, VIEWER`
* `situacao_processo_enum`: `PENDENTE, EM ANÁLISE, CONCLUÍDO, ... (+ intermediárias usadas no legado)`
* Auxiliares: `operacao_diversos_enum`, `orgao_diversos_enum`, `alvara_funcionamento_enum`, `servico_sanitario_enum`, `notificacao_sanitaria_enum`, `categoria_contato_enum`

### 5) Integridade referencial e triggers

* FKs com `ON DELETE CASCADE` (org e relacionamentos principais) e `ON DELETE SET NULL` para `created_by/updated_by`.
* **Triggers de `updated_at`** (ver S3 – Úteis): função `set_updated_at()` e `BEFORE UPDATE` em tabelas selecionadas.

---

## S2 — Camada de Consulta (views + índices + normalização) ✅ **CONCLUÍDO**

### 1) Funções & extensões

* `unaccent` habilitado.
* `immutable_unaccent(text)` para uso em **índices funcionais** e em **buscas normalizadas** do front/API.

### 2) Views consolidadas (todas operando por `org_id`)

* Operacionais/KPI:

  * `v_empresas` (contagens por empresa, status, datas)
  * `v_licencas_status` (inclui `dias_para_vencer`)
  * `v_taxas_status` (inclui `esta_pago`, `vencimento_tpi`)
  * `v_processos_resumo` (status e prazos)
  * `v_alertas_vencendo_30d` (janela de 30 dias)
  * `v_grupos_kpis` (resumos globais)
* Apoio:

  * `v_taxas_tpi` (TPI com `vencimento_ddmm`)
  * `v_certificados_status` (dias restantes + situação)
* Úteis (compatibilidade com UI):

  * **`v_contatos_uteis`**: expõe `contato AS nome`, `email`, `telefone`, `categoria`, `org_id`, `created_at`, `updated_at`, `municipio`, `whatsapp`
  * **`v_modelos_uteis`**: expõe `modelo AS titulo`, `descricao AS conteudo`, `utilizacao AS categoria`, `org_id`, timestamps

> Todas selecionam apenas registros da **org** corrente (por cláusulas explícitas ou pelo contexto de execução da conexão).

### 3) Índices (núcleo de performance e unicidade)

* **empresas**

  * `ix_empresas_org_id (org_id)`
  * `ix_empresas_org_cnpj (org_id, cnpj)` **UNIQUE** (por organização)
  * Texto normalizado:
    `ix_empresas_org_empresa_norm (org_id, lower(immutable_unaccent(empresa)))`
    `ix_empresas_org_municipio_norm (org_id, lower(immutable_unaccent(municipio)))`
* **licencas**

  * `ix_licencas_org_validade (org_id, validade)`
  * `uq_licencas_org_empresa_tipo (org_id, empresa_id, tipo)` **UNIQUE**
* **taxas**

  * `ix_taxas_org_vencimento_tpi (org_id, vencimento_tpi)`
  * `uq_taxas_org_empresa_tipo (org_id, empresa_id, tipo)` **UNIQUE**
* **processos / processos_avulsos**

  * Unicidades condicionais:

    * `uq_proc_org_protocolo_tipo (org_id, protocolo, tipo) WHERE protocolo IS NOT NULL`
    * `uq_proc_org_empresa_tipo_data (org_id, empresa_id, tipo, data_solicitacao) WHERE protocolo IS NULL AND data_solicitacao IS NOT NULL`
    * `uq_proc_org_empresa_tipo_sem_data (org_id, empresa_id, tipo) WHERE protocolo IS NULL AND data_solicitacao IS NULL`
  * Para avulsos, mesmas regras substituindo `empresa_id` por `documento`.
* **certificados**

  * `uq_certificados_org_serial (org_id, serial)` **UNIQUE**
* **úteis (S3 reforçou)**

  * `idx_contatos_org_nome (org_id, lower(immutable_unaccent(contato)))`
  * `idx_contatos_org_email (org_id, lower(email))`
  * `idx_modelos_org_titulo (org_id, lower(immutable_unaccent(modelo)))`
  * *(opcional S4+)* UNIQUE parcial por nome/título normalizado dentro da org.

---

## S3 — API / Segurança / Front (contrato) ⚠️ **EM ANDAMENTO (backend OK; front finalizando)**

### 1) Segurança e contexto

* **JWT (HS256)**; secret e algoritmo via `.env`.
* Em cada request: validar token, extrair `org_id`, e **escopar a conexão** (`SET LOCAL app.current_org = :org_id`).
* **Pydantic**: `org_id` **serializado como string**; datas em ISO; paginação consistente.

### 2) Endpoints estáveis (GET — prontos e em uso)

**Base**: `/api/v1`

* `GET /empresas?municipio=&q=&page=&size=&sort=`
* `GET /licencas?...`
* `GET /taxas?...`
* `GET /processos?...`
* `GET /alertas`
* `GET /grupos/kpis`
* **Apoio**:

  * `GET /municipios` (distintos por org, para combos/filtros)

### 3) Úteis (backend concluído; front em fase final)

* **Contatos**

  * `GET /uteis/contatos?search=&categoria=&page=&size=`
  * `POST /uteis/contatos`
  * `PUT/PATCH /uteis/contatos/{id}`
  * `DELETE /uteis/contatos/{id}`
* **Modelos**

  * `GET /uteis/modelos?search=&categoria=&page=&size=`
  * `POST /uteis/modelos`
  * `PUT/PATCH /uteis/modelos/{id}`
  * `DELETE /uteis/modelos/{id}`
* **Notas**:

  * Views **`v_contatos_uteis`** e **`v_modelos_uteis`** garantem compat com o layout já existente.
  * **Triggers**:

    * `CREATE FUNCTION set_updated_at() RETURNS trigger ...`
    * `CREATE TRIGGER tg_upd_contatos BEFORE UPDATE ON contatos FOR EACH ROW EXECUTE FUNCTION set_updated_at();`
    * `CREATE TRIGGER tg_upd_modelos  BEFORE UPDATE ON modelos  FOR EACH ROW EXECUTE FUNCTION set_updated_at();`

### 4) Stubs/minimização de 404 (ativos)

* `GET /agendamentos` — responde vazio paginado com shape final (até o model real da S4).

### 5) Migrations (Alembic)

* Cadeia única **head** (ex.: `9bb2edce4fb5` + `be2b8ef49772`).
* Inclui: extensão `unaccent`, função `immutable_unaccent`, índices multi-tenant, views de apoio, FKs novas (ex.: `agendamentos.org_id`), índices/trigger de Úteis.

### 6) Impacto no front (status)

* **Cliente HTTP**: injeta Bearer; `VITE_API_BASE_URL`; trata 404 → coleção vazia.
* **Páginas atuais** (Empresas/Licenças/Taxas/Processos/KPIs/Alertas): OK.
* **Aba “Úteis”**: listagem e filtros prontos; **CRUD** em finalização (componentes e handlers).
* **Sem alteração de layout**: apenas novas chamadas e mapeamentos já compatíveis.

---

# S4 — Certificados & CNDs (ingestão direta + watcher + alertas + API/Front) ▶️ **PLANEJADO (dividido)**

> Integra integração de **certificados (.pfx)** e **CNDs (PDF/HTML/Imagem)** direto no banco, com watcher de diretório, staging, deduplicação, KPIs e alertas.

## S4.1 — Certificados (.pfx) — Ingestão direta

**Back-end**

* Extrator (Python `cryptography`/OpenSSL) → coleta: `serial`, `sha1`, `subject`, `issuer`, `valido_de`, `valido_ate`, `arquivo`, `caminho`; match de empresa por `cnpj` (nome do arquivo/planilha de referência ou mapeamento).
* Upsert em `certificados`; chave: **`uq_certificados_org_serial (org_id, serial)`**.

**Schema/Índices**

* Já existentes (ver S1/S2). Complementares: `ix_certificados_org_id`, `ix_certificados_valido_ate`.

**Qualidade**

* Log estruturado, retentativa (3x), quarentena.

**Front**

* Sem mudar layout; cards/tabelas usam `v_certificados_status`.

---

## S4.2 — Watcher de diretórios + fila (Certificados & CNDs)

**Back-end**

* `watchdog` monitora (paths configuráveis por `.env`):

  * `G:\Certificados Digitais\**\*.pfx`
  * `G:\CNDs\**\*.(pdf|html|png|jpg|jpeg)`
* Enfileira (Redis) → workers com backoff; métricas por org/dia.

**Front**

* (Opcional) badge “Sincronizado às HH:MM” em Certificados e CNDs/Alertas.

---

## S4.3 — Regras de alerta e KPIs (unificado)

**Back-end**

* Consolidar na `v_alertas_vencendo_30d` **Certificados + Licenças + CNDs**:

  * `tipo_alerta`: `CERTIFICADO`, `LICENCA`, `CND`
  * `descricao`, `validade`, `dias_restantes`
* Jobs diários (pg_cron/APScheduler) para envio de e-mails/notificações.

**Front**

* Tabela **Alertas** já exibe (filtrar por tipo).

---

## S4.4 — Endpoints (Certificados)

**API**

* `GET /certificados?empresa=&serial=&page=&size=&sort=`
* `POST /certificados/ingest` (upload único ou apontar caminho)
* (Opc) `POST /certificados/reindex`

**Front**

* (Opc) modal de upload; caso contrário somente leitura.

---

## S4.5 — **CNDs (diretório + OCR + alertas + API/Front)**

### S4.5.1 — Fontes & naming

* Diretório base configurável: **`G:\CNDs\`** (ou múltiplos por org).
* Aceitos: **PDF/HTML/Imagem** (`.pdf`, `.html`, `.htm`, `.png`, `.jpg`, `.jpeg`).
* Convenções úteis (não obrigatórias, mas recomendadas):

  * `CNPJ_ORGAO_ESFERA_DDMMYYYY.pdf` (ex.: `01987654000123_RFB_FEDERAL_31012026.pdf`)
  * Variedades: tolerar nomes livres e **extrair metadados por OCR/HTML**.

### S4.5.2 — Pipeline de ingestão

**Back-end**

1. **Descoberta** (watcher) → fila por arquivo.
2. **Parser**:

   * PDF: `pdfminer.six`/`pypdf`; se bloqueado, converte página para imagem e aplica **Tesseract OCR**.
   * HTML: `BeautifulSoup` (metatags e texto).
   * Imagem: Tesseract OCR direto.
3. **Extração de metadados**:

   * `cnpj` (regex robusto), `orgao` (e.g., RFB, PGFN, SEFAZ-UF, PREFEITURA, PROCON, TRABALHISTA), `esfera` (`FEDERAL`, `ESTADUAL`, `MUNICIPAL`),
     `data_emissao?`, **`validade?`**, `status` (`REGULAR`, `IRREGULAR`, `EMITIDA`, etc.), `url?` (se capturado de HTML).
4. **Matching de empresa**:

   * via `cnpj` extraído; fallback por **mapa CNPJ ↔ pasta** (ex.: `G:\CNDs\{CNPJ}\*`).
5. **Deduplicação**:

   * `row_hash` do conteúdo + `org_id` + `empresa_id` + `orgao` + `esfera` + `validade`.
   * Regras de sobreposição: mantém **mais recente por `validade`**.
6. **Upsert** em `cnds`:

   * chave natural para evitar duplicatas funcionais: `(org_id, empresa_id, orgao, esfera, validade)`; se não houver validade, usar `(org_id, empresa_id, orgao, esfera, data_emissao)` como fallback.
   * Preencher `created_at`, `updated_at`.

**Staging**

* `stg_cnds` (separada, caso ainda não exista):

  * `id serial PK`, `org_id uuid NOT NULL`, `run_id varchar NOT NULL`, `file_source varchar NOT NULL`,
  * `row_number int NOT NULL`, `row_hash varchar NOT NULL`,
  * `payload jsonb NOT NULL` (texto OCR + metadados brutos),
  * `ingested_at timestamptz DEFAULT now()`
* Índices: `idx_stg_cnds_run_id (run_id)`, `idx_stg_cnds_org (org_id)`.

### S4.5.3 — Schema/índices (tabela `cnds`)

**Tabela já existente** (S1): `cnds(id, org_id, empresa_id, esfera, orgao, status, url?, data_emissao?, validade?, created_at, updated_at)`

* **FKs**:

  * `org_id → orgs(id) ON DELETE CASCADE`
  * `empresa_id → empresas(id) ON DELETE CASCADE`
* **Índices recomendados**:

  * `idx_cnds_org_empresa (org_id, empresa_id)`
  * `ix_cnds_org_validade (org_id, validade)`
  * `ix_cnds_org_orgao_esfera (org_id, orgao, esfera)`
  * (Opcional) **UNIQUE parcial**:

    * `uq_cnds_org_emp_orgao_esfera_valid (org_id, empresa_id, orgao, esfera, validade) WHERE validade IS NOT NULL`
* **Triggers**:

  * `BEFORE UPDATE` → `set_updated_at()` (mesma função usada em contatos/modelos).

### S4.5.4 — Views e alertas

* **`v_alertas_vencendo_30d`** passa a considerar CNDs:

  * `tipo_alerta='CND'`, `descricao` com `orgao/esfera`, `validade`, `dias_restantes`.
* (Opc) **`v_cnds_status`**:

  * Campos: `empresa`, `cnpj`, `orgao`, `esfera`, `status`, `validade`, `dias_restantes`, `situacao` (`Vencida`, `Vence em ≤7d`, `Vence em ≤30d`, `OK`), `url?`.
  * Índices materiais (se virar MV) conforme demanda.

### S4.5.5 — API (CNDs)

**Endpoints**

* `GET /cnds?empresa=&orgao=&esfera=&status=&vencendo=&page=&size=&sort=`

  * `vencendo`: `7` | `30` | `EXPIRADAS` | `OK`
* `POST /cnds/ingest` (adm): upload ou apontar caminho (processa 1..N arquivos).
* (Opc) `POST /cnds/reindex` — reprocessa staging/quarentena.
* Respostas sempre **escopadas por `org_id`**.

### S4.5.6 — Front-end

* **Listagem CNDs** (nova rota ou dentro de “Licenças/CNDs”):

  * Colunas: Empresa, CNPJ, Órgão, Esfera, Status, **Validade**, **Dias restantes**, Ações (abrir arquivo local / copiar URL).
  * Filtros: `orgao`, `esfera`, `status`, `vencendo (≤7/≤30/expiradas)`, busca por empresa/CNPJ.
  * **Abertura de arquivo local**: apenas metadado/caminho exibido; a abertura é no **cliente** (SO do usuário).
* **Alertas**: já aparecem em “Alertas” (com filtro por tipo).
* **Sem alteração de layout** global; só adiciona rota/tabela se você desejar deixar explícito no menu.

### S4.5.7 — Qualidade & logs

* Registro por arquivo: `arquivo`, `cnpj_detectado`, `empresa_id`, `orgao`, `esfera`, `validade`, `hash`, `status`.
* Relatório de falhas comuns: **OCR vazio**, **CNPJ não encontrado**, **validade não detectada**, **múltiplas validades no documento**.
* Modo “teste” (dry-run) que não grava, apenas reporta parsing e matches.

---

## DoD (Definition of Done) S4

* **S4.1**: `.pfx` ingerindo/atualizando `certificados` com `v_certificados_status` refletindo **dias_restantes**.
* **S4.2**: watcher + fila funcionando em **certificados** e **CNDs** (dois coletores).
* **S4.3**: `v_alertas_vencendo_30d` unificado (**CERTIFICADO / LICENCA / CND**); job diário ativo.
* **S4.4**: endpoints de certificados; (opc) reindex.
* **S4.5**: ingestão CNDs com OCR/HTML, **GET /cnds** paginado com filtros, e tabela no front (ou incorporado em “Licenças/CNDs”), sem quebrar layout.

---

## S5 — Regras do VBA → serviço/SQL

**Objetivo:** migrar lógicas do Excel para backend/BD com rastreabilidade.

**Back-end:**

* Implementar regras (licenças/taxas/processos) como **services + functions SQL/PLpgSQL**; usar VIEW/MVIEW p/ resumos pesados.
* **Jobs** (pg_cron/APScheduler) p/ recálculo e alertas; **golden tests** confrontando amostras do Excel vs BD.

**Impacto no Front:**

* Nenhuma mudança visual.
* Expor apenas novos campos de resumos se necessário (mantendo compat).
* Caso adicionemos badges/cores adicionais, só mapear no mesmo grid existente.

---

## S6 — Edição no portal (CRUD completo)

**Objetivo:** editar no portal com trilha de auditoria.

**Back-end:**

* Completar CRUDs (POST/PUT/DELETE) para: `empresas`, `licencas`, `taxas`, `processos`, **`contatos` e `modelos`** (Úteis) — agora com `org_id` real.
* Auditar `created_by/updated_by` via JWT.

**Impacto no Front:**

* Habilitar botões **Novo/Editar/Excluir** nas telas existentes (inclusive **Aba Úteis**).
* **Validações de formulário**: CNPJ/CPF/datas; feedback otimista e rollback de erro.

---

## S7 — Exports (CSV/XLSX)

**Back-end:**

* Endpoints de export baseados nas views; **masking de PII** por `role` (ex.: máscara em CPF/E-mail para `VIEWER`).

**Impacto no Front:**

* Botão **Exportar** já nas tabelas, mantendo filtros atuais na querystring para o export.

---

## S8 — Desligamento do Excel (read-only)

**Back-end/Operação:**

* Congelar planilha; snapshot + `pg_dump`; playbook de rollback; validar restore.

**Impacto no Front:**

* Nenhum. Apenas remover referências internas a caminhos de planilha (se existirem tooltips/links).

---

## S9 — Auth & Perfis (Supabase/SSO) — *Private SaaS-ready*

**Back-end:**

* Validar JWT Supabase (JWKS); tabela `profiles(user_id, full_name, role, created_at)`; popular `created_by/updated_by`.

**Impacto no Front:**

* Fluxos `/login`, `/forgot`, `/verify`, `/profile`.
* Persistência do token (guardas de rota).
* Esconder ações não permitidas por `role`.

---

## S10 — Organizações & RLS (multi-tenancy)

**Back-end:**

* `organizations`, `memberships` e **RLS** por membership em todas as tabelas de negócio.
* Tuning de índices `unique (org_id, *)` onde necessário.

**Impacto no Front:**

* **Switcher de organização** (se o usuário pertencer a mais de uma).
* Escopar buscas/combos ao `org_id` atual automaticamente (já respeitado via JWT).

---

## S11 — Convites & e-mails transacionais

**Back-end/Infra:**

* Fluxo convite por e-mail (token → aceite → membership).
* Templates (verificação, reset, convite, mudança de papel) com domínio autenticado (SPF/DKIM/DMARC).

**Impacto no Front:**

* Telas simples de **Convidar** e **Aceitar convite**; estados de sucesso/erro.

---

## S12 — Go-Live (domínio, CI/CD, observabilidade, backups)

**Back-end/Infra:**

* Domínio + TLS (`app.`/`api.`); **Private SaaS** com Cloudflare Tunnel + Access.
* Deploy (Vercel + Render ou Docker Compose); pipeline CI/CD com `alembic upgrade` + smoke tests.
* Observabilidade (logs/métricas/alertas); **backups diários** com teste de restore; rate limit, CORS estrito e rotação de segredos.

**Impacto no Front:**

* Ajustar `VITE_API_BASE_URL` para o domínio final; telas de erro amigáveis para manutenção/janela de deploy.

---

## Anotações finais

* **Aba “Úteis”** já está pronta para listar/filtrar **Contatos** e **Modelos** via `/uteis` com as novas *views* e colunas padronizadas — quando avançarmos para o S6, adicionamos os formulários de criação/edição.
* **Certificados**: a leitura direta do `.pfx` e alertas automáticos entram no S4; a UI atual já comporta indicadores de situação (views existentes).
* O documento de fluxo original foi preservado e expandido com o status real (S1–S3 concluídos) e com o impacto de frontend por stage. 
