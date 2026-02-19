# S6 — Resumo Executivo & Guia de Execução Rápido

**Data:** 19 de fevereiro de 2026  
**Status:** ✅ Planejamento Completo  
**Próximo:** Implementação S6 (Estimado: 2-3 dias para 1 dev)

---

## 📋 Resumo Executivo

### Estado Atual (S5)
✅ Backend funcionando em **8020** com auth real (login/me/refresh/logout)  
✅ Postgres + Redis subidos via Docker em portas **5434** e **6381**  
❌ **Frontend NÃO EXISTE** — será criado do zero reaproveita código v1

### Entrrega S6
- ✅ Frontend Vite+React em **5174**
- ✅ Autenticação real (sem VITE_DEV_TOKEN)
- ✅ Todas as **7 abas** renderizando (mesmo que alguns endpoints faltando)
- ✅ Integração com auth do backend
- ✅ Login/Logout/Session funcional

### Impacto
- 🕐 Tempo estimado: **2-3 dias** (1 dev)
- 📦 Novos arquivos: **~15-20** (client.js, useAuth, LoginScreen, etc)
- ♻️ Código reutilizado: **~90%** (copiar features do v1)
- 🔄 Mudanças necessárias: **~10%** (remover hardcodes, ajustar imports)

---

## 🚀 Guia de Execução (Passo a Passo)

### Pre-requisitos
```bash
# Backend rodando
curl http://localhost:8020/healthz
# Esperado: {"status":"ok"}

# Banco de dados
docker compose -f infra/docker-compose.yml up -d
```

---

### Passo 1: Criar Estrutura Vite (5-10 min)

```bash
# De g:\PMA\SCRIPTS\eControle\
mkdir frontend
cd frontend

# Option A: Usar npm create vite (recomendado)
npm create vite@latest . -- --template react

# Option B: Copiar arquivo package.json do doc S6_PATCHES_E_CHECKLIST.md
# e rodar npm install
```

---

### Passo 2: Copiar/Criar Arquivos Críticos (10-15 min)

**De [docs/S6_PATCHES_E_CHECKLIST.md](S6_PATCHES_E_CHECKLIST.md) copiar exatamente:**

1. `vite.config.js` (com proxy para :8020)
2. `.env.example` (vars de ambiente)
3. `src/main.jsx` (entry point)
4. `src/api/client.js` (HTTP client)
5. `src/hooks/useAuth.js` (auth hook)
6. `src/screens/LoginScreen.jsx` + `.module.css`
7. `src/App.jsx` + `.module.css` (novo App com auth flow)

---

### Passo 3: Reaproveitar Código v1 (20-30 min)

**Copiar integralmente de `eControle_v1/frontend/src/`:**

```bash
# Quando tiver acesso ao repo v1:

# Copiar estrutura de features
cp -r eControle_v1/frontend/src/features/* frontend/src/features/

# Copiar componentes (exceto App.jsx que será novo)
cp -r eControle_v1/frontend/src/components/* frontend/src/components/

# Copiar libs
cp eControle_v1/frontend/src/lib/*.js frontend/src/lib/

# Copiar providers
cp -r eControle_v1/frontend/src/providers/* frontend/src/providers/

# Copiar CSS
cp eControle_v1/frontend/src/index.css frontend/src/

# Copiar tipos/utils
cp eControle_v1/frontend/src/utils/* frontend/src/utils/ 2>/dev/null || true
```

**Validação pós-cópia:**
```bash
# Verificar se há hardcodes que precisam remover
grep -r "VITE_DEV_TOKEN" frontend/src/  # deve retornar NADA
grep -r "localStorage.jwt" frontend/src/ # migrar para useAuth hook

# Listar imports que podem estar quebrados
grep -r "^import.*from '\./components" frontend/src/features/*.jsx
# esperado: importsan importam de '../../components' (paths relativos)
```

---

### Passo 4: Setup & Teste (5-10 min)

```bash
cd frontend
npm install  # instalar dependências

# Criar .env.local (copy de .env.example com ajustes)
cp .env.example .env.local
# Editar se necessário (localhost:8020 deve estar correto)

# Subir dev server
npm run dev
# Esperado: Server running at http://localhost:5174

# Em outro terminal, verificar requests
curl http://localhost:5174/  # retorna HTML (redirect to /login)
```

---

### Passo 5: Validação Manual (5-10 min)

1. **Abrir navegador**: http://localhost:5174
   - ✅ LoginScreen renderiza com email/password

2. **Fazer login**:
   - Email: `admin@example.com`
   - Password: `admin123`
   - ✅ Botão "Entrar" fica disabled enquanto processa
   - ✅ Redireciona para MainApp (abas visíveis)

3. **Verificar dados**:
   - ✅ Painel carrega (se houver empresas no DB)
   - ✅ Aba Empresas lista (GET /companies no backend)
   - ✅ Menu lateral com 7 abas (painel, empresas, licencas, etc)

4. **Testar logout**:
   - Clicar em "Logout" ou botão de exit no menu
   - ✅ Redireciona para LoginScreen
   - ✅ localStorage vazio (F12 → Application → Storage)

5. **Testar persistência**:
   - F5 (refresh página)
   - ✅ Mantém session (não volta para login)
   - ✅ Dados carregam de novo

---

### Passo 6: DevTools Network Validation (5 min)

```
F12 → Network tab → Fazer login

Esperado:
1. POST /api/v1/auth/login
   → Status: 200
   → Response: { access_token, refresh_token, ... }

2. GET /api/v1/auth/me
   → Status: 200
   → Response: { id, email, org_id, roles[] }

3. GET /api/v1/companies (e demais screens)
   → Headers: [Authorization: Bearer <token>]
   → Status: 200 (se backend tem dados)
   → Status: 200 [] vazio (se não tem dados)
```

---

## 📊 Tabelado Comparativo: v1 → v2

| Aspecto | v1 | S6 (v2) | Mudança |
|---------|----|---------|---------| 
| **Framework** | React 18 | React 18 | Mesma |
| **Build/Dev** | Vite | Vite | Mesma |
| **Porta Frontend** | 5173 | **5174** | Nova (sem conflito) |
| **Porta Backend** | 8000 | **8020** | Nova (sem conflito CertHub) |
| **Auth** | `VITE_DEV_TOKEN` em .env local | Login real com `POST /auth/login` | **Nova** |
| **Token Storage** | localStorage.jwt | localStorage.access_token + refresh_token | **Nova** |
| **API Base** | VITE_API_BASE_URL | Proxy `/api` → :8020 | Proxy recomendado |
| **Abas** | 7 (painel, empresas, ...) | 7 (iguais) | Mesma |
| **Componentes** | ~80 components | ~80 reutilizados | Reusar 90% |

---

## 🎯 Critérios de Aceite Mínimos (S6)

### Must-Have (sem estes, falha S6)
- ✅ Frontend sobe em 5174 sem erros críticos no console
- ✅ LoginScreen renderiza (user vê formulário)
- ✅ Login com credenciais corretas (admin@example.com/admin123) funciona
- ✅ `POST /api/v1/auth/login` retorna `access_token` + `refresh_token`
- ✅ `GET /api/v1/auth/me` retorna dados do user autenticado
- ✅ Token é enviado em header `Authorization: Bearer <token>` em todas as requisições
- ✅ MainApp renderiza após login sem erros
- ✅ Logout funciona (limpa tokens + redireciona)
- ✅ Refresh de página mantém session (sem voltar para login)

### Nice-to-Have (podem ter em S11)
- 🟡 Visual refinado (cores, fonts, responsive)
- 🟡 Loading spinners em requisições
- 🟡 Validação de form (email format, password strength)
- 🟡 Error handling visual (barra de erros, toasts)

---

## 🔴 Riscos Conhecidos & Mitigações

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| Código v1 tem hardcodes `VITE_*` | 🟡 Médio | Procurar e remover antes de usar; usar variáveis env dinâmicas |
| Endpoints faltando (licencas, taxas, processos) | 🟡 Médio | Normal em S6; back entrega em S7; front gracefully degrades |
| Token não persiste após F5 | 🔴 Alto | Testar useEffect em App.jsx; validar localStorage sendo salvo em LoginScreen |
| Proxy Vite não ativo = CORS bloqueado | 🟡 Médio | Testar `curl localhost:5174/api/v1/health`; check vite.config.js |
| CSS/Toasts quebrados após copiar | 🟡 Médio | Validar index.css copiado; ToastProvider importado em App.jsx |

---

## 📝 Estrutura de Documentação (Referência Rápida)

| Documento | Conteúdo | Lê |
|-----------|---------|-----|
| **S6_FRONTEND_REAPROVEITADO.md** | Relatório completo: estado atual, docs ref, pontos de patch, validation | Análise completa |
| **S6_PATCHES_E_CHECKLIST.md** | Patches detalhados arquivo-por-arquivo + checklist implementação | Implementar |
| **S6_RESUMO_EXECUTIVO.md** (este) | Quick start + checklist aceite + troubleshooting | Overview rápido |

---

## 🗂️ Árvore Final (S6 Implementado)

```
eControle/
├─ backend/        (S5 atual — API :8020)
├─ frontend/       ← NOVO (S6) :5174
│  ├─ src/
│  │  ├─ api/
│  │  │  └─ client.js              ← HTTP client novo
│  │  ├─ hooks/
│  │  │  └─ useAuth.js             ← Auth hook novo
│  │  ├─ screens/
│  │  │  ├─ LoginScreen.jsx        ← Login novo
│  │  │  └─ MainApp.jsx            ← App.jsx do v1 adaptado
│  │  │  └─ painel/, empresas/, ... ← Copy v1
│  │  ├─ components/                ← Copy v1
│  │  ├─ features/                  ← Copy v1
│  │  ├─ lib/                       ← Copy v1
│  │  ├─ providers/                 ← Copy v1
│  │  ├─ App.jsx                   ← Novo (com auth)
│  │  ├─ main.jsx                  ← Novo (entry)
│  │  └─ index.css                 ← Copy v1
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ .env.example
│  └─ .env.local                   ← Gitignored
├─ infra/          (Docker Compose)
├─ docs/
│  ├─ BASELINE_V1.md
│  ├─ REUSE_FRONTEND_MAP.md
│  ├─ S6_FRONTEND_REAPROVEITADO.md    ← Relatório novo
│  ├─ S6_PATCHES_E_CHECKLIST.md       ← Patches novo
│  └─ S6_RESUMO_EXECUTIVO.md          ← Este doc
└─ PLANO_DESENVOLVIMENTO.md (S6 checked)
```

---

## ⚡ Comandos Rápidos (Copy-Paste)

```bash
# Setup inicial
mkdir frontend && cd frontend
npm create vite@latest . -- --template react
npm install

# Dev server
npm run dev          # localhost:5174

# Build
npm build

# Cleanup (se problema)
rm -rf node_modules package-lock.json
npm install

# Debug
# Terminal 1: npm run dev
# Terminal 2: curl http://localhost:5174/api/v1/health
# Terminal 3: F12 devtools em localhost:5174
```

---

## 📞 Q&A Rápido (FAQ)

**P: Posso copiar todo o código v1 de uma vez?**  
R: Sim, com um grep depois para remover hardcodes VITE_* e ajustar imports de path.

**P: E se o backend não tiver um endpoint que o v1 tem?**  
R: Normal em S6. Fronten gracefully degrades (mostra loading, depois vazio, ou pode bloquear aba). Endpoint entra em S7.

**P: Como atualizar token expirado?**  
R: Implementado em `useAuth.refresh()`. Chamar quando receber 401 (não está em S6, dexa para S11).

**P: Preciso de cookies ou localStorage é ok?**  
R: localStorage ok para S6 (+ seguro depois em S12 com HttpOnly cookies).

**P: E produção?** 
R: Só em S12. S6 é local/dev. Arquivo `vite.config.js` tem flag `base: '/'` que precisa ajusto se subdominio.

---

## 🎓 Recursos de Aprendizado (já no repo)

- [BASELINE_V1.md](BASELINE_V1.md) — o que v1 fez, v2 deve manter
- [REUSE_FRONTEND_MAP.md](REUSE_FRONTEND_MAP.md) — mapping exato de files v1→v2
- [PLANO_DESENVOLVIMENTO.md](PLANO_DESENVOLVIMENTO.md#s6) — roadmap oficial
- [INTEGRATION_CONTRACTS.md](INTEGRATION_CONTRACTS.md) — contatos com CertHub/Scribere (S8/S9)

---

## ✅ Checklist Pré-Go (Execute antes de chamar pronto)

```
□ npm install sucesso (sem warnings criticos)
□ npm run dev subir sem erro
□ localhost:5174 abre (LoginScreen renderiza)
□ Login funciona (credenciais corretas)
□ MainApp renderiza pós login
□ Devtools mostra Authorization header em requests
□ Logout funciona
□ F5 mantém session
□ 0 erros críticos em console.error
□ No console: nenhuma mensagem de undefined imports
```

---

**Fim do Resumo Executivo**

*Para implementação detalhada, ver [S6_PATCHES_E_CHECKLIST.md](S6_PATCHES_E_CHECKLIST.md)*

*Para análise completa, ver [S6_FRONTEND_REAPROVEITADO.md](S6_FRONTEND_REAPROVEITADO.md)*
