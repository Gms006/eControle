# S6 — Frontend Reaproveitado (Migração Mínima)

**Status:** Planejamento  
**Data:** 19 de fevereiro de 2026  
**Responsável:** Implementação  
**Alinhamento:** PLANO_DESENVOLVIMENTO.md (S6)

---

## 1. Estado Atual do Frontend no Repo

### 1.1 Pasta Frontend

**Status:** ❌ **NÃO EXISTE**

Atualmente o repositório `eControle` **não possui mais uma pasta `frontend/`**. A estrutura contém apenas:
- `backend/` (S5 — API com auth/companies)
- `infra/` (Docker Compose)
- `docs/` (BASELINE_V1.md, REUSE_FRONTEND_MAP.md, etc.)
- `scripts/` (vazio)

**Implicação:** Frontend será **iniciado do zero** como um novo projeto Vite + React, reaproveita *código-fonte* do v1 (`eControle_v1/frontend/`), **não arquivos binários**.

---

### 1.2 Estrutura Alvo (S6)

```
eControle/
├─ backend/           (S5 atual — API 8020)
├─ frontend/          (S6 a criar — Vite+React 5174)
│  ├─ src/
│  │  ├─ App.jsx      (ajuste: auth real, bootstrap)
│  │  ├─ main.jsx     (reusar)
│  │  ├─ index.css    (reusar)
│  │  ├─ api/
│  │  │  └─ client.js (novo: baseURL=http://localhost:8020)
│  │  ├─ components/  (reusar HeaderMenuPro, badges, primitivos)
│  │  ├─ features/    (reusar painel, empresas, licencas, taxas, processos)
│  │  │              (ajuste: certificados, uteis)
│  │  ├─ lib/         (ajuste: api.js, status.js reused com novos endpoints)
│  │  ├─ providers/   (reusar ToastProvider)
│  │  └─ hooks/       (novo: useAuth, useOrgContext)
│  ├─ public/
│  ├─ package.json    (React 18, Vite, axios/fetch)
│  ├─ vite.config.js  (define porta 5174 + opcionalproxy /api → 8020)
│  ├─ .env.example    (VITE_API_BASE_URL=http://localhost:8020)
│  └─ .env.local      (desenvolvimento)
├─ infra/
├─ docs/
└─ (...)
```

---

### 1.3 API Base URL / Proxy / Envs

#### Configuração Alvo

**Vite + React** usará variáveis de ambiente:

| Env Var                  | Descrição                             | Dev localhost   | Prod           |
|--------------------------|---------------------------------------|-----------------|----------------|
| `VITE_API_BASE_URL`      | URL base da API                       | `http://localhost:8020` | `https://api.domain.com` |
| `VITE_APP_ENV`           | Ambiente (dev/test/prod)              | `dev`           | `prod`         |
| `VITE_CERTHUB_BASE_URL`  | URL base CertHub (para deep links)   | `http://localhost:3000` | `https://certhub.domain.com` |

**Arquivo `.env.local` (gitignorado):**
```env
VITE_API_BASE_URL=http://localhost:8020
VITE_APP_ENV=dev
VITE_CERTHUB_BASE_URL=http://localhost:3000
```

**Estratégia de Proxy no Vite (recomendado):**

```javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8020',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '/api')  // opcional
      }
    }
  }
}
```

**Benefício:** fetch direto para `/api/v1/...` é reescrito para `http://localhost:8020/api/v1/...`, **evita CORS** em dev.

---

#### Aplicação no Código Frontend

**Novo arquivo: `src/api/client.js`** (exemplo com fetch modernado):

```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8020';

export const apiClient = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Adiciona token se houver em localStorage (substituído depois por cookie)
    const token = localStorage.getItem('access_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok && response.status === 401) {
      // Disparar logout/refresh
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    
    return response.json();
  },
  
  get: (endpoint) => apiClient.request(endpoint),
  post: (endpoint, body) => apiClient.request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  patch: (endpoint, body) => apiClient.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
};
```

---

### 1.4 Porta do Dev Server

**Alvo:** **5174** (definido em REUSE_FRONTEND_MAP.md e PLANO_DESENVOLVIMENTO.md)

#### Vite Config (`vite.config.js`)

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',  // ou '127.0.0.1' para dev
    proxy: {
      '/api': {
        target: 'http://localhost:8020',
        changeOrigin: true,
      }
    }
  },
})
```

#### Alteração Rápida

Se houver conflito, ajuste em:
1. **vite.config.js:** `server.port = 5174`
2. **docker-compose.yml:** (quando containerizado) mapeamento `5174:5174`
3. **Frontend URL em CORS do backend** (se necessário) em `backend/main.py`

---

### 1.5 Integração com `/api/v1/auth/login` e `/api/v1/auth/me`

#### Status Atual (Backend S3)

✅ **Endpoints já implementados e testados:**

| Endpoint            | Método | Status | Resposta |
|---------------------|--------|--------|----------|
| `/api/v1/auth/login` | POST | ✅ 200 | `{ access_token, refresh_token, token_type }` |
| `/api/v1/auth/me`   | GET  | ✅ 200 | `{ id, email, org_id, roles[] }` |
| `/api/v1/auth/refresh` | POST | ✅ 200 | `{ access_token, refresh_token }` |
| `/api/v1/auth/logout` | POST | ✅ 200 | `{ message: "Logged out" }` |

**Arquivo:** [backend/app/api/v1/endpoints/auth.py](../../backend/app/api/v1/endpoints/auth.py)

#### Fluxo de Auth no Frontend (S6)

**Novo componente: `src/hooks/useAuth.js`**

```javascript
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // bootstrap: checar se token existe em localStorage/localStorage
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      validateToken();
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      const data = await apiClient.get('/api/v1/auth/me');
      setUser(data);
    } catch (err) {
      localStorage.removeItem('access_token');
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    try {
      const data = await apiClient.post('/api/v1/auth/login', { email, password });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user || await apiClient.get('/api/v1/auth/me'));
      setError(null);
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout', {});
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  }, []);

  return { user, loading, error, login, logout, isAuthenticated: !!user };
}
```

**Uso em `App.jsx`:**

```javascript
import { useAuth } from './hooks/useAuth';

function App() {
  const { user, loading, isAuthenticated, login, logout } = useAuth();

  if (loading) return <div>Carregando...</div>;
  if (!isAuthenticated) return <LoginScreen onLogin={login} />;
  
  return <MainApp user={user} onLogout={logout} />;
}
```

---

## 2. Documentos de Referência

### 2.1 REUSE_FRONTEND_MAP.md

**Leitura:** [docs/REUSE_FRONTEND_MAP.md](REUSE_FRONTEND_MAP.md)

#### Resumo: Telas/Abas must-have para S6

| Aba         | Componente Principal | Status Reuso | Mudanças Mínimas |
|-------------|----------------------|--------------|------------------|
| **Painel**  | `PainelScreen.jsx`   | ✅ reusar    | Bootstrap de dados com auth real |
| **Empresas** | `EmpresasScreen.jsx` | ✅ reusar    | Nenhuma (CRUD já ok no backend) |
| **Licenças** | `LicencasScreen.jsx` | ✅ reusar    | Apenas endpoints (backend ainda não tem) |
| **Taxas**    | `TaxasScreen.jsx`    | ✅ reusar    | Apenas endpoints (backend ainda não tem) |
| **Processos** | `ProcessosScreen.jsx` | ✅ reusar    | Apenas endpoints (backend ainda não tem) |
| **Certificados** | `CertificadosScreen.jsx` | 🟡 ajuste | Mudar para cards read-only, botão "Instalar" → CertHub |
| **Úteis**    | `UteisScreen.jsx`    | 🟡 ajuste   | Trocar fonte: não mais `GET /uteis`, mas `GET /integracoes/scribere/exports` (S9) |

#### Checklist de Reuso

- ✅ Componentes primitivos UI (`Chip.jsx`, `BadgeStatus.jsx`, etc.)
- ✅ Provider de toasts (`ToastProvider.jsx`)
- ✅ Menu principal (`HeaderMenuPro.jsx`)
- ✅ Lógica de normalizacao de status/dados (`lib/status.js`, `lib/api.js`)
- 🟡 `App.jsx` — ajuste de auth + bootstrap de dados
- 🟡 Aba Certificados — apenas layout/botão "Instalar"
- 🟡 Aba Úteis — apenas fonte de dados (sera S9)

---

### 2.2 BASELINE_V1.md

**Leitura:** [docs/BASELINE_V1.md](BASELINE_V1.md)

#### Resumo: Fluxos Críticos Mantidos

| Fluxo                  | S6 Alvo | Notas |
|------------------------|---------|-------|
| **Auth (sem tela login)** | ❌ MUDA | S6 adiciona tela de login real |
| **Bootstrap paralelo** | ✅ MANTÉM | `GET /companies`, `/licenses` (após endpoints implementados) |
| **Filtros globais**    | ✅ MANTÉM | Campo busca, municipio, "Somente alertas", "Modo foco" |
| **Atalhos teclado**    | ✅ MANTÉM | Alt+1..7, Alt+↑, Ctrl/Cmd+K |
| **Paginação in-memory** | ✅ MANTÉM | Mesmo padrão (se dados < 10k linhas) |
| **Badges status**      | ✅ MANTÉM | Cores/rótulos iguais |

---

### 2.3 Alterações Mínimas Já Previstas

**De acordo com REUSE_FRONTEND_MAP.md:**

1. **Porta:** 5174 ✅
2. **BaseURL:** para `http://localhost:8020` ✅
3. **Auth:** substituir `VITE_DEV_TOKEN` por login real ✅
4. **Abas Certificados/Úteis:** ajuste de layout (S6), endpoints (S8/S9) 🟡
5. **Endpoints novos:** certificados/uteis (S8/S9) — não no S6
6. **Proxy Vite:** `POST http://localhost:8020` esperado ✅

---

## 3. Pontos de Patch

### 3.1 Arquivos a Criar/Modificar no Frontend

#### A) Inicialização Vite + React (do zero)

| Arquivo | Tipo | Risco | Impacto | Validação |
|---------|------|-------|---------|-----------|
| `frontend/package.json` | Criar | ✅ baixo | npm install | `npm --version && node --version` |
| `frontend/vite.config.js` | Criar | ✅ baixo | porta 5174 + proxy | `npm run dev` → acessa `localhost:5174` |
| `frontend/.env.example` | Criar | ✅ baixo | template env | `cat .env.example` |
| `frontend/src/main.jsx` | Criar | ✅ baixo | entry point React | devtools abrem |

**Risco:** nenhum — novo projeto  
**Impacto:** estrutura mínima para receber código v1  
**Validação:** `npm install && npm run dev` deve subir sem erros

---

#### B) Reaproveitar Código v1

| Arquivo | Tipo | Risco | Impacto | Validação |
|---------|------|-------|---------|-----------|
| `src/components/**` | Copiar v1 | ✅ baixo | sem logout em v1 | grep "VITE_" → confirma hardcodes removidos |
| `src/features/**` | Copiar v1 | 🟡 médio | imports não removidos | Executar cada tela isolada |
| `src/lib/status.js` | Copiar v1 | ✅ baixo | normalizacao ok | exports testadas |
| `src/lib/api.js` | **Reescrever** | 🔴 alto | substituir todo fetch | todas as rotas apontam para `/api/v1` |
| `src/lib/constants.js` | Copiar v1 | ✅ baixo | atalhos ok | grep "VITE_" nada |
| `src/index.css` | Copiar v1 | ✅ baixo | tema ok | visual intacto |

**Tabela de Risco:**
- ✅ Baixo: copiar é-direto, sem dependências de auth
- 🟡 Médio: componentes podem ter import hardcoded ou console.log de dev
- 🔴 Alto: `api.js` precisa ser reescrito por completo (nova estratégia de auth+baseURL)

---

#### C) Implementar Auth Real (S6 novo)

| Arquivo | Tipo | Risco | Impacto | Validação |
|---------|------|-------|---------|-----------|
| `src/api/client.js` | Criar | 🟡 médio | substituir all fetches | todos GET/POST/PATCH passam por aqui |
| `src/hooks/useAuth.js` | Criar | 🟡 médio | bootstrap + login | login com admin@example.com funciona |
| `src/screens/LoginScreen.jsx` | Criar | 🟡 médio | nova tela de login | tela renderiza, form submete |
| `src/App.jsx` | Reescrever | 🔴 alto | bootstrap com auth | app só renderiza se autenticado |
| `src/components/ProtectedRoute.jsx` | Criar | ✅ baixo | guard para rotas | acessar rota sem token redireciona |

**Risco por arquivo:**
- `client.js`: novo padrão fetch, requer testes de toda rota
- `useAuth.js`: lógica critica, falha = sem acesso
- `LoginScreen.jsx`: UX importante, ajuste fino pode ser necessário
- `App.jsx`: bootstrap bom é critico, ordem de chamadas importa
- `ProtectedRoute.jsx`: simples, baixíssimorisco

---

#### D) Proxy Vite (opcional, recomendado)

| Arquivo | Tipo | Risco | Impacto | Validação |
|---------|------|-------|---------|-----------|
| `vite.config.js` | Criar | ✅ baixo | CORS evitado em dev | `curl localhost:5174/api/v1/auth/me` redireciona |

**Risco:** config simples  
**Impacto:** dev sem CORS warnings  
**Validação:** proxy ativo = requests `/api` chegam em `8020`

---

### 3.2 Checklist de Arquivos Alvo

```
✅ frontend/package.json
   → deps: react@18, vite, axios (op), zustand (op)
   → scripts: dev, build, preview

✅ frontend/vite.config.js
   → port: 5174
   → proxy: '/api' → http://localhost:8020
   → base: '/'

✅ frontend/.env.example
   → VITE_API_BASE_URL=http://localhost:8020
   → VITE_CERTHUB_BASE_URL=http://localhost:3000

✅ frontend/src/main.jsx
   → ReactDOM.render(<App>, #root)

✅ frontend/src/App.jsx (NOVA VERSÃO)
   → useAuth para bootstrap
   → <LoginScreen /> se not authenticated
   → <MainApp /> se authenticated
   → ErrorBoundary e ToastProvider

✅ frontend/src/api/client.js (NOVO)
   → apiClient.get/post/patch
   → manipulacao de token em Authorization header
   → logout em 401

✅ frontend/src/hooks/useAuth.js (NOVO)
   → estado user/loading/error
   → login(email, password)
   → logout()
   → validateToken() on mount

✅ frontend/src/screens/LoginScreen.jsx (NOVA)
   → form email/password
   → submit → login hook
   → validacao basica
   → erro display

✅ frontend/src/components/ProtectedRoute.jsx (NOVO)
   → <Navigate to="/login" if not authenticated />

✅ frontend/src/components/HeaderMenuPro.jsx (REUSAR com ajustes)
   → remover hardcodes VITE_*
   → manter atalhos teclado/filtros

✅ frontend/src/features/ (REUSAR)
   → painel/
   → empresas/
   → licencas/
   → taxas/
   → processos/
   → certificados/ (ajuste: read-only + "Instalar")
   → uteis/ (sera ajustado em S9)

✅ frontend/src/lib/status.js (REUSAR)
✅ frontend/src/lib/constants.js (REUSAR)
✅ frontend/src/index.css (REUSAR)
```

---

## 4. Patches Propostos

### 4.1 Código Mínimo (Scaffolding Vite)

**Arquivo: `frontend/package.json`**

```json
{
  "name": "econtrole-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0"
  }
}
```

**Arquivo: `frontend/vite.config.js`**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8020',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})
```

**Arquivo: `frontend/.env.example`**

```env
# API Backend
VITE_API_BASE_URL=http://localhost:8020

# Apps externas (para deep links)
VITE_CERTHUB_BASE_URL=http://localhost:3000
VITE_SCRIBERE_BASE_URL=http://localhost:3001

# App env
VITE_APP_ENV=dev
```

---

### 4.2 Auth Client (Novo)

**Arquivo: `frontend/src/api/client.js`**

```javascript
/**
 * API Client — wrapper para fetch com baseURL dinâmica
 * e manipulacao de tokens (localStorage + Authorization header)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8020';

export const apiClient = {
  /**
   * Requisicao genérica com headers padrao
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${API_BASE}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Adiciona token se existir
    const token = localStorage.getItem('access_token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // Logout automático em 401
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Poderia disparar evento global de logout aqui
        throw new Error('Unauthorized');
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      console.error(`[API] ${options.method || 'GET'} ${url}:`, error);
      throw error;
    }
  },

  get: (endpoint) => apiClient.request(endpoint),
  
  post: (endpoint, body) => apiClient.request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  
  patch: (endpoint, body) => apiClient.request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }),
  
  delete: (endpoint) => apiClient.request(endpoint, {
    method: 'DELETE',
  }),
};
```

---

### 4.3 Auth Hook

**Arquivo: `frontend/src/hooks/useAuth.js`**

```javascript
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bootstrap: validar token ao montar
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      validateToken();
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async () => {
    try {
      const data = await apiClient.get('/api/v1/auth/me');
      setUser(data);
      setError(null);
    } catch (err) {
      localStorage.removeItem('access_token');
      setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/v1/auth/login', { email, password });
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      
      // Valida e carrega user
      await validateToken();
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout', {});
    } catch (err) {
      console.warn('Logout error (cleanup anyway):', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem('refresh_token');
    if (!token) throw new Error('No refresh token');
    
    try {
      const response = await apiClient.post('/api/v1/auth/refresh', { 
        refresh_token: token 
      });
      localStorage.setItem('access_token', response.access_token);
      return response;
    } catch (err) {
      await logout();
      throw err;
    }
  }, [logout]);

  return { 
    user, 
    loading, 
    error, 
    login, 
    logout, 
    refresh,
    isAuthenticated: !!user 
  };
}
```

---

### 4.4 Login Screen (Mínima)

**Arquivo: `frontend/src/screens/LoginScreen.jsx`**

```javascript
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (err) {
      // erro já exibido no state
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>eControle v2</h1>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Senha:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Arquivo: `frontend/src/screens/LoginScreen.module.css`**

```css
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.card h1 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
}

.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.field input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.field input:disabled {
  background-color: #f9f9f9;
}

.error {
  color: #d32f2f;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background-color: #ffebee;
  border-radius: 4px;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #1565c0;
}

button:disabled {
  background-color: #90caf9;
  cursor: not-allowed;
}
```

---

### 4.5 App.jsx (Novo Bootstrap)

**Arquivo: `frontend/src/App.jsx`**

```javascript
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './screens/LoginScreen';
import { MainApp } from './screens/MainApp'; // reusar com ajustes
import styles from './App.module.css';

function App() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp user={user} />;
}

export default App;
```

---

## 5. Estrutura de Diretórios S6

```
frontend/
├── src/
│   ├── api/
│   │   └── client.js              (novo)
│   ├── screens/
│   │   ├── LoginScreen.jsx        (novo)
│   │   ├── LoginScreen.module.css (novo)
│   │   ├── MainApp.jsx            (reusar como App.jsx do v1)
│   │   └── (painel/, empresas/, ...) (reusar do v1)
│   ├── hooks/
│   │   └── useAuth.js             (novo)
│   ├── components/
│   │   ├── HeaderMenuPro.jsx      (reusar do v1)
│   │   ├── ProtectedRoute.jsx     (novo)
│   │   └── (badges, primitivos)   (reusar do v1)
│   ├── features/
│   │   ├── painel/
│   │   ├── empresas/
│   │   ├── licencas/
│   │   ├── taxas/
│   │   ├── processos/
│   │   ├── certificados/          (reusar com ajuste: read-only + Instalar)
│   │   └── uteis/                 (será ajustado em S9)
│   ├── lib/
│   │   ├── status.js              (reusar do v1)
│   │   ├── constants.js           (reusar do v1)
│   │   ├── api.js                 (atualizar para usar client.js)
│   │   └── process.js             (reusar do v1)
│   ├── providers/
│   │   └── ToastProvider.jsx      (reusar do v1)
│   ├── App.jsx                    (novo, com auth)
│   ├── App.module.css             (novo)
│   ├── main.jsx                   (novo, entry point)
│   └── index.css                  (reusar do v1)
├── public/
│   └── favicon.ico
├── index.html
├── package.json                   (novo)
├── vite.config.js                 (novo)
├── .env.example                   (novo)
├── .env.local                     (gitignored, dev only)
└── .gitignore
```

---

## 6. Riscos, Impactos e Validação

### 6.1 Riscos por Componente

| Componente | Risco | Descrição | Mitigação |
|------------|-------|-----------|-----------|
| `client.js` | 🟡 médio | Token não persistido corretamente | Validar localStorage em devtools |
| `useAuth.js` | 🔴 alto | Loop infinito em validateToken | Adicionar guard de dependency |
| `LoginScreen.jsx` | ✅ baixo | UX ruim | Copiar design melhorado do v1 após S6 |
| `App.jsx` | 🔴 alto | Bootstrap quebra bootstrap | Testar sequência: validateToken → setUser → render |
| Código v1 copiado | 🟡 médio | Hardcodes VITE_* ainda presentes | grep -r "VITE_DEV_TOKEN" |
| Proxy Vite | ✅ baixo | Config errada | Testar `curl localhost:5174/api/v1/health` |

---

### 6.2 Validação por Etapa

#### Pós-Setup Vite
```bash
cd frontend
npm install
npm run dev
# Esperado: http://localhost:5174 abre
```

#### Pós-Auth Setup
```bash
# 1. LoginScreen renderiza
# 2. Digita admin@example.com / admin123
# 3. Submete form
# 4. Redirecionado para MainApp
```

#### Pós-Bootstrap de Dados
```bash
# 1. Painel carrega KPIs
# 2. Empresas carrega lista
# 3. Filtros workam (busca, municipio)
# 4. Não há console warnings de endpoints faltando
```

---

### 6.3 Checklist de Validação (S6)

- ◻️ `npm install` sucesso sem warnings criticos
- ◻️ `npm run dev` subir em 5174
- ◻️ LoginScreen renderiza (forma email/password visível)
- ◻️ Login com `admin@example.com` / `admin123` funciona
- ◻️ Redirect para MainApp após login
- ◻️ `GET /api/v1/auth/me` retorna user autenticado
- ◻️ Logout limpa localStorage + redirecta para LoginScreen
- ◻️ Refresh de página mantém session se token válido
- ◻️ Painel carrega com KPIs (if empresas > 0 no backend)
- ◻️ Aba Empresas lista e permite CRUD
- ◻️ Menu lateral (abas) renderiza correto
- ◻️ No console: nenhum erro de import/undefined
- ◻️ DevTools: request headers contém `Authorization: Bearer <token>`

---

## 7. Diff Proposto (Exemplo Simplificado)

### 7.1 Resumo de Mudanças por Arquivo

```diff
# Novos arquivos (estrutura S6)
A frontend/package.json
A frontend/vite.config.js
A frontend/.env.example
A frontend/src/main.jsx
A frontend/src/App.jsx
A frontend/src/api/client.js
A frontend/src/hooks/useAuth.js
A frontend/src/screens/LoginScreen.jsx
A frontend/src/screens/LoginScreen.module.css

# Cópias do v1 com ajustes mínimos
M frontend/src/components/HeaderMenuPro.jsx (remover VITE_DEV_TOKEN)
M frontend/src/lib/api.js (usar client.js para requisições)

# Cópias diretas do v1 (sem mudanças)
A frontend/src/components/ProtectedRoute.jsx
A frontend/src/features/painel/PainelScreen.jsx
A frontend/src/features/empresas/EmpresasScreen.jsx
... (demais features)
A frontend/src/lib/status.js
A frontend/src/lib/constants.js
A frontend/src/index.css
A frontend/src/providers/ToastProvider.jsx
```

---

## 8. Checklist de Aceite do S6

Alinhado a PLANO_DESENVOLVIMENTO.md:

### Entregas

- ✅ Front v1 reaproveitado (features/telas) — estrutura criada
- ✅ Ajuste de porta 5174 — vite.config.js
- ✅ Ajuste API base 8020 — client.js + .env
- ✅ Fluxo de login real — useAuth + LoginScreen
- ✅ AppShell coerente — App.jsx

### Critérios de Aceite

- ✅ Tela inicial (LoginScreen) renderiza
- ✅ Login com credenciais válidas funciona
- ✅ Sessão persiste em refresh de página
- ✅ Logout limpa tokens + redirecta
- ✅ MainApp (painel + abas) renderiza se autenticado
- ✅ Nenhum 404/5xx de endpoints faltando (se backend tem CRUD)
- ✅ Tokens enviados em Authorization header
- ✅ CORS não bloqueia em localhost (proxy ativo)

### Smoke Tests (PowerShell ou curl)

```bash
# 1. Frontend subiu
curl http://localhost:5174/

# 2. Backend respondendo
curl http://localhost:8020/healthz

# 3. Login funciona
curl -X POST http://localhost:8020/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# 4. /me funciona com token
TOKEN=<access_token_da_resposta_anterior>
curl http://localhost:8020/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 5. Companies lista
curl http://localhost:8020/api/v1/companies \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. Próximos Passos (S7+)

1. **S7** — Ingest JSON: popular banco com empresas/licenças/taxas/processos  
2. **S8** — CertHub mirror: aba Certificados read-only + "Instalar"  
3. **S9** — Scribere exports: aba Úteis com data do Scribere  
4. **S10** — Workers: jobs de notificação, sync  
5. **S11** — Polimento: filtros, índices, UX  
6. **S12** — Hardening: testes, runbooks, go-live  

---

## Apêndice A: Comando de Inicialização Rápida (S6)

```bash
# 1. Criar pasta frontend
mkdir frontend
cd frontend

# 2. Criar estrutura mínima
npm create vite@latest . -- --template react

# 3. Copiar arquivos críticos deste doc
# (client.js, useAuth.js, LoginScreen.jsx, vite.config.js corrigido, etc.)

# 4. Instalar deps
npm install

# 5. Subir dev server
npm run dev

# 6. Testar em localhost:5174
open http://localhost:5174
```

---

## Apêndice B: Variáveis de Ambiente

### `.env.local` (dev, nunca commitar)

```env
# Backend API
VITE_API_BASE_URL=http://localhost:8020

# External apps (para deep links S8/S9)
VITE_CERTHUB_BASE_URL=http://localhost:3000
VITE_SCRIBERE_BASE_URL=http://localhost:3001

# Ambiente
VITE_APP_ENV=dev
VITE_DEBUG=true
```

### `.env.production` (build prod)

```env
VITE_API_BASE_URL=https://api.econtrole.example.com
VITE_CERTHUB_BASE_URL=https://certhub.example.com
VITE_SCRIBERE_BASE_URL=https://scribere.example.com
VITE_APP_ENV=production
VITE_DEBUG=false
```

---

**Fim do Relatório S6**

---

*Gerado em 19 de fevereiro de 2026*  
*Alinhado a: PLANO_DESENVOLVIMENTO.md, BASELINE_V1.md, REUSE_FRONTEND_MAP.md*
