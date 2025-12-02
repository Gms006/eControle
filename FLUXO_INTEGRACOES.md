# Fluxo v4 — Portal (Private SaaS-ready) — S1 a S12

> Fluxo detalhado para o portal eControle 

---

## Visão geral da arquitetura

* **Stack**: FastAPI + PostgreSQL, **multi-tenancy por organização** (`org_id :: uuid`).
* **Segurança**: JWT HS256 (payload: `sub`, `org_id`, `email`, `role`, `iat`, `exp`) carregado de `JWT_SECRET`/`JWT_ALG` via `.env`.
* **Contexto de organização**: por request, `SET LOCAL app.current_org = :org_id` (GUC) + filtros por `org_id` em views/consultas.
* **Padrões de API**: paginação (`page`, `size<=100`), ordenação opcional (`sort`), busca normalizada (função `immutable_unaccent`).
* **Compatibilidade visual**: front atual **sem mudança de layout**; apenas troca da origem (planilha → API/views).

---

## S1 — Base de Dados (modelagem mínima + multi-tenancy) ✅ **CONCLUÍDO**

### 1) Schemas e extensões

* Schema principal: `public`.
* Extensões mínimas (entregues via Alembic):

  * `CREATE EXTENSION IF NOT EXISTS unaccent;` (`20251207_01_unaccent_extension_indexes`).
* Funções utilitárias (também criadas pela migration `20251207_01_unaccent_extension_indexes`):

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
    **legados**: `porte?`, `categoria?`, `inscricao_estadual?`, `inscricao_municipal?`, `situacao?`, `debito?`, `certificado?`,
    `responsavel_legal?`, `cpf_responsavel_legal?`, `responsavel_fiscal?`, `obs?`, …
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

* `unaccent` habilitado via Alembic (`20251207_01_unaccent_extension_indexes`).
* `immutable_unaccent(text)` criada na mesma migration para uso em **índices funcionais** e em **buscas normalizadas** do front/API.

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
* **úteis (S3 reforçou via Alembic)**

  * `idx_contatos_org_nome (org_id, lower(immutable_unaccent(contato)))`
  * `idx_modelos_org_titulo (org_id, lower(immutable_unaccent(modelo)))`
  * *(opcional S4+)* UNIQUE parcial por nome/título normalizado dentro da org.

---

## S3 — API / Segurança / Front (contrato) ✅ **CONCLUÍDO**

### 1) Segurança e contexto

* **JWT (HS256)**; secret e algoritmo via `.env` (`JWT_SECRET` obrigatório).
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
* `GET /municipios` (distintos por org, para combos/filtros)
* **Stub**: `GET /agendamentos` retorna `{items: [], total: 0, page, size}` para evitar 404 até modelagem completa.

### 3) Úteis (S3 somente leitura)

* Backend expõe **apenas** `GET /api/v1/uteis`, combinando contatos e modelos.
* Fonte dos dados: views criadas em S3 (`v_contatos_uteis` e `v_modelos_uteis`) que normalizam campos esperados pelo front; `v_licencas_api` e `v_taxas_tpi` servem às listas de licenças/TPI com status/validade/dias_para_vencer normalizados.
* **Não existem** `POST/PUT/PATCH/DELETE` em `/uteis/contatos` ou `/uteis/modelos` nesta fase.

### 4) Migrations (Alembic) da S3

* `20251112_01_certificados_agendamentos`: cria `certificados`, `agendamentos` e a view `v_certificados_status` com cálculo de `dias_restantes`/`situacao`.
* `20251130_01_schema_sync`: adiciona colunas fiscais/jurídicas em `empresas` (`inscricao_municipal`, `inscricao_estadual`, `responsavel_legal`, `cpf_responsavel_legal`, `responsavel_fiscal`), cria `empresas_backup_categoria`, `cnds` (com índice `idx_cnds_org_empresa`), funções `clean_status_label`/`extract_first_br_date` e views `v_contatos_uteis`, `v_modelos_uteis`, `v_licencas_api`, `v_taxas_tpi`.
* `20251207_01_unaccent_extension_indexes`: garante extensão `unaccent`, função `immutable_unaccent` e os índices funcionais de busca (`ix_empresas_org_empresa_norm`, `ix_empresas_org_municipio_norm`, `idx_contatos_org_nome`, `idx_modelos_org_titulo`).
* Resultado: qualquer banco novo com `alembic upgrade head` já nasce com colunas extras em `empresas`, tabela `cnds`, views de Úteis/licenças/taxas e índices de busca normalizada multi-tenant.

### 5) Impacto no front (status)

* **Cliente HTTP**: injeta Bearer automaticamente, usa `VITE_API_BASE_URL` e trata `404` como coleção vazia para listas.
* **Páginas atuais** (Empresas/Licenças/Taxas/Processos/KPIs/Alertas): OK.
* **Aba “Úteis”**: em produção, lista contatos/modelos via `GET /uteis`, com filtros/busca/copiar; **sem** formulários de criação/edição/remoção (CRUD fica para S6).
* **Sem alteração de layout**: apenas novas chamadas e mapeamentos já compatíveis.

---

# S4 — Certificados & Licenças (ingestão direta + watcher + alertas + API/Front) ▶️ **PLANEJADO (dividido)**

> Integra **certificados (.pfx)** e **licenças** (Alvarás, Licenças Ambientais, Uso do Solo, dispensas, etc.) direto no banco, com watcher de diretório, staging, deduplicação, KPIs e alertas. A carga de CNDs passa para etapa posterior (S5 ou específica).

## S4.1 — Certificados (.pfx) — Ingestão direta

**Back-end**

* Extrator (Python `cryptography`/OpenSSL) → coleta: `serial`, `sha1`, `subject`, `issuer`, `valido_de`, `valido_ate`, `arquivo`, `caminho`; match de empresa por `cnpj` (nome do arquivo/planilha de referência ou mapeamento).
* Upsert em `certificados`; chave: **`uq_certificados_org_serial (org_id, serial)`**; `v_certificados_status` calcula `dias_restantes`/`situacao` para o front.

**Schema/Índices**

* Já existentes (ver S1/S2). Complementares: `ix_certificados_org_id`, `ix_certificados_valido_ate`.

**Qualidade**

* Log estruturado, retentativa (3x), quarentena.

**Front**

* Sem mudar layout; cards/tabelas usam `v_certificados_status`.

---

## S4.2 — Ingestão em lote de LICENÇAS (a partir dos diretórios)

**Back-end**

* Serviço de ingestão que replica a lógica do legado `consulta_alvarás.py`, lendo a árvore `G:\EMPRESAS\<EMPRESA_NORMALIZADA>\Societário\Alvarás e Certidões\<Município>`.
* Detecta documentos por **padrões de nome** herdados (ex.: **ALVARÁ BOMBEIROS**, **ALVARÁ VIG SANITÁRIA** — definitivo/provisório, **ALVARÁ FUNCIONAMENTO** — definitivo/provisório/condicionado, **LICENÇA AMBIENTAL**, **USO DO SOLO**, **DISPENSAS** sanitária/ambiental/mista).
* Persiste em tabela(s)/views de licenças campos como: `org_id`, `empresa_id`, `municipio`, `categoria`, `tipo_documento` (Definitivo, Provisório, Dispensa…), `data_validade`, `status_bruto_arquivo` (ex.: "Possui. Val dd/mm/aaaa", "Vencido. Val dd/mm/aaaa"), `fonte` (`ARQUIVO` ou `PROCESSO`), `created_at/updated_at`.
* **Hierarquia Arquivo > Processos > Sujeito**:

  * Se houver arquivo definitivo/dispensa/possui/vencido, ele define o status da licença.
  * Se não houver arquivo, usa `processos.situacao` mapeada para **Possui** / **Sujeito** / status normalizado.
  * Regras de não sobrescrever `'*'` ou `'NÃO'` permanecem na escrita para o banco.

**DoD parcial (S4.2)**

* Executar o serviço manualmente preenche o banco de licenças espelhando o comportamento da planilha legado (`consulta_alvarás.py`).

---

## S4.3 — Watcher de diretórios + fila (Certificados & LICENÇAS)

**Back-end**

* `watchdog` monitora (paths configuráveis por `.env`):

  * **Certificados**: `G:\Certificados Digitais\**\*.pfx`
  * **Licenças**: `G:\EMPRESAS\<EMPRESA_NORMALIZADA>\Societário\Alvarás e Certidões\**\*.(pdf|png|jpg|jpeg)`
* Ao detectar criação/alteração, enfileira (Redis ou equivalente) jobs para reprocessar o certificado ou as licenças daquela empresa/município.
* Alimenta os mesmos pipelines de **S4.1** (certificados) e **S4.2** (licenças) de forma contínua.
* A ingestão de **CNDs** fica para etapa posterior (S5 ou específica), não mais neste estágio.

**Front**

* (Opcional) badge “Sincronizado às HH:MM” em Certificados e Licenças/Alertas.

---

## S4.4 — Regras de alerta e KPIs (CERTIFICADO / LICENÇA)

**Back-end**

* `v_alertas_vencendo_30d` unifica **Certificados + Licenças**:

  * `tipo_alerta`: `CERTIFICADO`, `LICENCA`
  * `descricao`, `validade`, `dias_restantes`
* `v_licencas_status` (nova) espelha os campos de alertas para licenças: `org_id`, `empresa_id`, `empresa`, `cnpj`, `categoria`, `descricao_status`, `validade`, `dias_restantes`, `situacao_resumida` (`VENCIDA`, `VENCE EM 7 DIAS`, `VÁLIDA`, `SUJEITO`, etc.).
* Jobs diários (pg_cron/APScheduler) para envio de e-mails/notificações de vencimentos críticos.

**Front**

* Tabela **Alertas** exibe e permite filtrar por tipo (CERTIFICADO/LICENCA).

---

## S4.5 — OCR de licenças (ou ponte para S5 — CNDs)

* Complementa o reconhecimento por nome de arquivo para **licenças** (PDF imagem/foto), aplicando OCR quando necessário.
* Em alternativa, pode servir de ponte para um **S5 dedicado a CNDs**, mantendo S4 focado apenas em Certificados + Licenças.

## DoD (Definition of Done) S4

* **S4.1**: `.pfx` ingerindo/atualizando `certificados` com `v_certificados_status` refletindo **dias_restantes**.
* **S4.2**: ingestão em lote de **licenças** (regras espelhando `consulta_alvarás.py`) populando tabelas/views no PostgreSQL.
* **S4.3**: watcher + fila funcionando em **certificados** e **licenças** em produção.
* **S4.4**: `v_alertas_vencendo_30d` unificado (**CERTIFICADO / LICENCA**) + job diário ativo.
* **S4.5**: OCR de licenças ou ponte clara para S5 de CNDs, mantendo S4 focado em Certificados + Licenças.

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
* Incluir `POST/PUT/PATCH/DELETE` específicos para `/api/v1/uteis/contatos` e `/api/v1/uteis/modelos`, persistindo em `contatos` e `modelos` e reutilizando as views para leitura.
* Auditar `created_by/updated_by` via JWT.

**Impacto no Front:**

* Habilitar botões **Novo/Editar/Excluir** nas telas existentes (inclusive **Aba Úteis**, com formulários/modais de contatos/modelos).
* **Validações de formulário**: CNPJ/CPF/datas; feedback otimista e rollback de erro.

---

## S7 — Exports (CSV/XLSX)

**Back-end:**

* Endpoints de export baseados nas views; **masking de PII** por `role` (ex.: máscara em CPF/E-mail para `VIEWER`).

**Impacto no Front:**

* Botão **Exportar** já nas tabelas, mantendo filtros atuais na querystring para o export.

---

## S8 — Desligamento do Excel (read-only) ✅ **CONCLUÍDO**

**Back-end/Operação:**

* STATUS: CONCLUÍDO — backend FastAPI + PostgreSQL é a fonte primária; não há rotinas core lendo planilhas para alimentar o portal (apenas scripts de migração/export legados quando necessário).
* Congelar planilha; snapshot + `pg_dump`; playbook de rollback; validar restore. Excel permanece apenas como consulta/exportação legada.

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
