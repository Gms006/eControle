# S6 — Index de Documentação & Links

**Data:** 19 de fevereiro de 2026  
**Status:** 📑 Documentação Completa

---

## 📚 Guia de Leitura

### Para Gerentes/Stakeholders - Leia PRIMEIRO:
**Documento:** [S6_RESUMO_EXECUTIVO.md](S6_RESUMO_EXECUTIVO.md)  
**Tempo:** 5-10 min  
**Conteúdo:**
- ✅ Resumo executivo: estado atual, impacto, timeline
- ✅ Critérios de aceite mínimos
- ✅ Riscos + mitigações
- ✅ FAQ rápido

---

### Para Developers (Implementadores) - Leia SEGUNDO:
**Documento Principal:** [S6_PATCHES_E_CHECKLIST.md](S6_PATCHES_E_CHECKLIST.md)  
**Tempo:** 30-45 min  
**Conteúdo:**
- ✅ Patches detalhados arquivo-por-arquivo
- ✅ Código exato de cada arquivo novo (package.json, vite.config.js, client.js, etc)
- ✅ Checklist de implementação passo a passo
- ✅ Smoke tests e validação
- ✅ Troubleshooting comum

**Documento Complementar:** [S6_FRONTEND_REAPROVEITADO.md](S6_FRONTEND_REAPROVEITADO.md)  
**Tempo:** 20-30 min (leitura de referência)  
**Conteúdo:**
- ✅ Análise completa do estado atual (repo + backend)
- ✅ Mapa de reuso de código v1
- ✅ Tabelas de risco/impacto/validação por arquivo
- ✅ Estrutura de diretórios esperada

---

### Para Arquitetos/Tech Leads - Leia:
**Ordem:** S6_RESUMO_EXECUTIVO → S6_FRONTEND_REAPROVEITADO → PLANO_DESENVOLVIMENTO.md (S6)  
**Documentos Contextuais:**
- `docs/BASELINE_V1.md` — o que v1 faz (paridade alvo)
- `docs/REUSE_FRONTEND_MAP.md` — mapa de reuso (90% código v1)
- `docs/INTEGRATION_CONTRACTS.md` — contratos CertHub/Scribere (S8/S9)

---

## 📄 Documentos Gerados (S6)

### Novo no Repo (19 fev 2026)

| Arquivo | Tipo | Tamanho | Público | Alvo |
|---------|------|--------|---------|------|
| [docs/S6_FRONTEND_REAPROVEITADO.md](S6_FRONTEND_REAPROVEITADO.md) | Relatório | ~800 linhas | ✅ Sim | Devs + Tech Leads |
| [docs/S6_PATCHES_E_CHECKLIST.md](S6_PATCHES_E_CHECKLIST.md) | Guia Implementação | ~700 linhas | ✅ Sim | Devs (implementar) |
| [docs/S6_RESUMO_EXECUTIVO.md](S6_RESUMO_EXECUTIVO.md) | Resumo | ~300 linhas | ✅ Sim | All (overview rápido) |
| [docs/S6_INDEX.md](S6_INDEX.md) | Este arquivo | ~200 linhas | ✅ Sim | Navigation |

---

## 🎯 Checklist de Conclusão (S6 Planejamento)

- ✅ Estado atual mapeado (frontend não existe, reusar v1)
- ✅ Documentos de referência resumidos (BASELINE_V1, REUSE_FRONTEND_MAP)
- ✅ Pontos de patch detalhados (vite.config, client.js, useAuth, LoginScreen, etc)
- ✅ Patches propostos com código exato
- ✅ Estrutura de diretórios definida
- ✅ Risco/Impacto/Validação tabelado
- ✅ Checklist de implementação + smoke tests
- ✅ Troubleshooting documentado
- ✅ Integração com backend validada (/api/v1/auth/*)

**Faltando:** Implementação real (S6 executar)

---

## 📊 Snapshot: S6 em Números

| Métrica | Valor | Notas |
|---------|-------|-------|
| **Novos Arquivos** | ~15-20 | vite, app, auth, login |
| **Arquivos Reutilizados** | ~80 | copy integral do v1 |
| **Código Novo** | ~10% | client.js, useAuth, LoginScreen, |
| **Código Reutilizado** | ~90% | features, components, libs |
| **Tempo Estimado** | 2-3 dias | 1 dev, copy + ajustes |
| **Linhas de Código (novas)** | ~800-1000 | auth infrastructure |
| **Linhas Copiadas do v1** | ~5000+ | features, components, utils |

---

## 🔄 Fluxo de Frontend (S6)

**Diagrama de Fluxo:**

```
User abre localhost:5174
        ↓
[App.jsx monta] → useAuth() faz bootstrap
        ↓
Há access_token em localStorage?
  ├─ SIM → Valida com GET /api/v1/auth/me
  │        ├─ Sucesso → Renderiza MainApp
  │        └─ Falha (401) → Renderiza LoginScreen
  └─ NÃO → Renderiza LoginScreen
        ↓
        LoginScreen (email, password)
        ↓
User submete form
        ↓
POST /api/v1/auth/login (email, password)
        ↓
Recebe: access_token, refresh_token
        ↓
Salva em localStorage
        ↓
Chama validateToken → GET /api/v1/auth/me
        ↓
Renderiza MainApp (7 abas)
        ↓
Cada aba chama GET /api/v1/{resource}
  (baseURL proxy localhost:5174/api → localhost:8020)
        ↓
Token enviado em Authorization header
        ↓
user clicks Logout
        ↓
POST /api/v1/auth/logout
        ↓
useAuth.logout() limpa localStorage
        ↓
Renderiza LoginScreen
```

---

## 🌳 Estrutura de Pastas (S6 Alvo)

**Antes (S5):**
```
eControle/
├─ backend/
├─ infra/
├─ docs/
└─ ...
```

**Depois (S6):**
```
eControle/
├─ backend/          (S5, mantém igual)
├─ frontend/         ← NOVO
│  ├─ src/
│  │  ├─ api/
│  │  │  └─ client.js                    (novo)
│  │  ├─ hooks/
│  │  │  └─ useAuth.js                   (novo)
│  │  ├─ screens/
│  │  │  ├─ LoginScreen.jsx              (novo)
│  │  │  ├─ LoginScreen.module.css       (novo)
│  │  │  └─ MainApp.jsx                  (reusar App.jsx v1)
│  │  ├─ features/                       (copiar v1)
│  │  ├─ components/                     (copiar v1)
│  │  ├─ lib/                            (copiar v1)
│  │  ├─ providers/                      (copiar v1)
│  │  ├─ App.jsx                         (novo)
│  │  ├─ main.jsx                        (novo)
│  │  └─ index.css                       (copiar v1)
│  ├─ package.json                       (novo)
│  ├─ vite.config.js                     (novo)
│  ├─ .env.example                       (novo)
│  └─ .env.local                         (gitignored)
├─ infra/            (igual)
├─ docs/
│  ├─ BASELINE_V1.md
│  ├─ REUSE_FRONTEND_MAP.md
│  ├─ S6_FRONTEND_REAPROVEITADO.md       (novo)
│  ├─ S6_PATCHES_E_CHECKLIST.md          (novo)
│  ├─ S6_RESUMO_EXECUTIVO.md             (novo)
│  └─ S6_INDEX.md                        (novo — este)
└─ PLANO_DESENVOLVIMENTO.md              (update S6 done)
```

---

## 🚀 Timeline Recomendado (S6 Execução)

```
DIA 1 (Setup + Auth)
├─ [2h]  Setup Vite, package.json, vite.config.js
├─ [1h]  Implementar client.js + useAuth.js
├─ [1.5h] Implementar LoginScreen + App.jsx
├─ [1.5h] Validação: login funciona + token persiste
└─ EOD: Frontend sobe, login ok

DIA 2 (Features Copy + Validation)
├─ [4h]  Copy features/, components/, lib/, providers/ do v1
├─ [1.5h] Ajustar imports path + remover hardcodes VITE_*
├─ [1h]  Validação: abas renderizam, dados carregam
├─ [30m] Devtools network validation
└─ EOD: MainApp completo, todos endpoints testados

DIA 3 (QA + Documentação)
├─ [2h]  Smoke tests (login/logout/refresh/persistence)
├─ [1h]  Ajustes finais (CSS, error handling)
├─ [1h]  Documentação (README update, env setup)
└─ EOD: S6 aceito completo
```

---

## ✅ Checklist Pré-Implementação

- ✅ Eread S6_RESUMO_EXECUTIVO.md (5 min)
- ✅ Read S6_PATCHES_E_CHECKLIST.md (30 min)
- ✅ Ter Node.js 18+ instalado
- ✅ Ter `npm` ou `pnpm` disponível
- ✅ Backend S5 rodando em localhost:8020
- ✅ Docker com Postgres + Redis up
- ✅ Acesso ao código eControle_v1/frontend/
- ✅ Entender estrutura React 18 + Hooks
- ✅ Entender Vite + proxy config

---

## 🔗 Links de Contexto

**Já no Repo:**
- [PLANO_DESENVOLVIMENTO.md#s6](../PLANO_DESENVOLVIMENTO.md) — Roadmap oficial
- [BASELINE_V1.md](BASELINE_V1.md) — O que v1 faz (baseline)
- [REUSE_FRONTEND_MAP.md](REUSE_FRONTEND_MAP.md) — Mapa de reuso
- [INTEGRATION_CONTRACTS.md](INTEGRATION_CONTRACTS.md) — Contatos CertHub/Scribere
- [RISKS_AND_DECISIONS_S0.md](RISKS_AND_DECISIONS_S0.md) — Decisões S0

**Backend Atual:**
- [backend/app/api/v1/endpoints/auth.py](../../backend/app/api/v1/endpoints/auth.py) — endpoints de auth
- [backend/app/core/security.py](../../backend/app/core/security.py) — JWT logic
- [backend/main.py](../../backend/main.py) — app setup

**Frontend Reutilizar:**
- `eControle_v1/frontend/src/` — código inteiro do v1 para copiar

---

## 🎓 Conceitos Chave (S6)

### Auth Flow
1. User visits localhost:5174 (vazio)
2. useAuth bootstrap → tenta GET /auth/me com token antigo
3. Se falha → LoginScreen
4. User digita email/password
5. POST /auth/login → recebe access_token
6. Salva em localStorage
7. GET /auth/me → carrega user data
8. App renderiza MainApp

### Token Management
- **Storage:** localStorage (JavaScript acessível)
- **Alternitiva S12:** HttpOnly Cookie (mais seguro, não acessível JS)
- **Duração access_token:** default 60 min (PLANO)
- **Duração refresh_token:** default 14 dias

### HTTP Client
- **Proxy:** Vite proxy `/api` → `http://localhost:8020`
- **Headers:** automaticamente adiciona `Authorization: Bearer <token>`
- **Erro 401:** automaticamente logout + redireciona
- **CORS:** proxy evita em dev, backend CORS config em prod

---

## 🎯 Definição de Pronto (Definition of Done) — S6

**Code:**
- ✅ Todos os 15-20 arquivos novos criados
- ✅ Código v1 copiado (features, components, libs)
- ✅ Nenhum hardcode VITE_* restante
- ✅ Nenhum erro crítico em console.error

**Testing:**
- ✅ npm install sem warnings críticos
- ✅ npm run dev sobe sem erros
- ✅ LoginScreen renderiza
- ✅ Login funciona (credenciais admin@example.com/admin123)
- ✅ MainApp renderiza com todas as 7 abas
- ✅ Logout limpa tokens + redireciona
- ✅ Refresh de página mantém sessão
- ✅ Devtools Network mostra Authorization headers
- ✅ 0 erros críticos no console

**Documentation:**
- ✅ README.md update (como rodar frontend)
- ✅ docs/ documentação completa
- ✅ .env.example com vars necessárias

---

## 📞 Contato/Dúvidas

**Se tiver questão sobre:**
- **Timeline/Impacto:** Ler S6_RESUMO_EXECUTIVO.md
- **Como implementar:** Ler S6_PATCHES_E_CHECKLIST.md
- **Contexto completo:** Ler S6_FRONTEND_REAPROVEITADO.md
- **Backend/API:** Ver [backend/app/api/v1/](../../backend/app/api/v1/)
- **Fluxo geral:** Ver PLANO_DESENVOLVIMENTO.md

---

**Fim do Index S6**

*Atualizar este arquivo conforme progresso de S6*

---

### Mudanças de Referência

**Arquivos Novos Criados (19 fev 2026)**
```diff
A docs/S6_FRONTEND_REAPROVEITADO.md
A docs/S6_PATCHES_E_CHECKLIST.md
A docs/S6_RESUMO_EXECUTIVO.md
A docs/S6_INDEX.md (este arquivo)
```

**Próximas Mudanças (S6 Implementar)**
```diff
A frontend/
A frontend/package.json
A frontend/vite.config.js
A frontend/.env.example
A frontend/index.html
A frontend/src/main.jsx
A frontend/src/App.jsx
A frontend/src/api/client.js
A frontend/src/hooks/useAuth.js
A frontend/src/screens/LoginScreen.jsx
A frontend/src/screens/MainApp.jsx
... (copy features/)
```

---
