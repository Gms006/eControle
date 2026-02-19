# S6 — Patches Detalhados & Checklist de Implementação

**Status:** Planejamento  
**Data:** 19 de fevereiro de 2026

---

## 1. Patches Detalhados por Arquivo

### 1.1 Estrutura de Arquivos a Criar (Ordem Recomendada)

```
✅ [1] frontend/package.json              (deps base)
✅ [2] frontend/vite.config.js             (server + proxy)
✅ [3] frontend/.env.example               (template vars)
✅ [4] frontend/index.html                 (html entry)
✅ [5] frontend/src/main.jsx               (react entry)
✅ [6] frontend/src/App.jsx                (root component + auth)
✅ [7] frontend/src/api/client.js          (http client)
✅ [8] frontend/src/hooks/useAuth.js       (auth state)
✅ [9] frontend/src/screens/LoginScreen.jsx
✅ [10] frontend/src/screens/LoginScreen.module.css
✅ [11] frontend/src/index.css             (copy from v1)
✅ [12-∞] Copiar features/ do v1
```

---

### 1.2 Patch [1]: package.json

**Caminho:** `frontend/package.json`  
**Tipo:** Criar  
**Risco:** ✅ Baixo (novo arquivo, sem conflitos)

```json
{
  "name": "econtrole-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx",
    "format": "prettier --write \"src/**/*\""
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0",
    "eslint": "^8.50.0",
    "prettier": "^3.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Validação:**
```bash
cd frontend
npm install
# Esperado: node_modules criado, package-lock.json gerado
```

---

### 1.3 Patch [2]: vite.config.js

**Caminho:** `frontend/vite.config.js`  
**Tipo:** Criar  
**Risco:** 🟡 Médio (proxy pode ter conflitos se backend em porta local)

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 5174,
    host: '0.0.0.0',
    
    // Proxy para evitar CORS em dev
    proxy: {
      '/api': {
        target: 'http://localhost:8020',
        changeOrigin: true,
        rewrite: (path) => path,  // mantém path como está
      },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: false,  // true em dev se quiser debug
    minify: 'terser',
  },
  
  // Base URL para assets (se usar um CDN depois)
  base: '/',
})
```

**Validação:**
```bash
npm run dev
# Esperado: Server running at http://localhost:5174
```

---

### 1.4 Patch [3]: .env.example

**Caminho:** `frontend/.env.example`  
**Tipo:** Criar  
**Risco:** ✅ Baixo (template apenas)

```env
# API Backend (localhost em dev, dominio em prod)
VITE_API_BASE_URL=http://localhost:8020

# Apps externas (para deep links nas abas integradas)
VITE_CERTHUB_BASE_URL=http://localhost:3000
VITE_SCRIBERE_BASE_URL=http://localhost:3001

# Ambiente
VITE_APP_ENV=dev
VITE_DEBUG=true
```

**Uso:**
```bash
cp .env.example .env.local
# Editar .env.local com valores locais (depois de copiar)
```

---

### 1.5 Patch [4]: index.html

**Caminho:** `frontend/index.html`  
**Tipo:** Criar  
**Risco:** ✅ Baixo (boilerplate HTML padrão)

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>eControle v2</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

### 1.6 Patch [5]: src/main.jsx

**Caminho:** `frontend/src/main.jsx`  
**Tipo:** Criar  
**Risco:** ✅ Baixo (entry point padrão React)

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### 1.7 Patch [6]: src/App.jsx (Novo)

**Caminho:** `frontend/src/App.jsx`  
**Tipo:** Criar  
**Risco:** 🔴 Alto (componente raiz, bootstrap crítico)

```javascript
import { useAuth } from './hooks/useAuth'
import { LoginScreen } from './screens/LoginScreen'
import { MainApp } from './screens/MainApp'
import styles from './App.module.css'

function App() {
  const { user, loading, isAuthenticated, logout } = useAuth()

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>eControle — Carregando...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <MainApp user={user} onLogout={logout} />
}

export default App
```

**App.module.css:**
```css
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f5f5;
  font-size: 1.2rem;
  color: #666;
}
```

---

### 1.8 Patch [7]: src/api/client.js (Novo)

**Caminho:** `frontend/src/api/client.js`  
**Tipo:** Criar  
**Risco:** 🟡 Médio (crítico para todas as requisições HTTP)

```javascript
/**
 * API Client — wrapper para fetch com baseURL, tokens e error handling
 * 
 * Uso:
 *   await apiClient.get('/api/v1/auth/me')
 *   await apiClient.post('/api/v1/auth/login', { email, password })
 *   await apiClient.patch('/api/v1/companies/1', { is_active: false })
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8020'

class ApiClient {
  async request(endpoint, options = {}) {
    // Monta URL final (suporta tanto paths quanto URLs completas)
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${API_BASE}${endpoint}`

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Adiciona token JWT se existir
    const token = localStorage.getItem('access_token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Logout automático em 401 (token inválido/expirou)
      if (response.status === 401) {
        this._handleUnauthorized()
        throw new Error('Unauthorized — logged out automatically')
      }

      // Parse JSON (mesmo para erros, para melhor error handling)
      let data
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      if (!response.ok) {
        const error = new Error(
          typeof data === 'object' ? data.detail || data.message : data
        )
        error.status = response.status
        error.data = data
        throw error
      }

      return data
    } catch (error) {
      console.error(`[API] ${options.method || 'GET'} ${url}:`, error)
      throw error
    }
  }

  _handleUnauthorized() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    // TODO: dispatch evento global de logout, ou redirecionar
    window.location.href = '/login'
  }

  // Métodos convenientes
  get(endpoint) {
    return this.request(endpoint)
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  }

  delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    })
  }

  // Upload de arquivo (exemplo para futuro)
  uploadFile(endpoint, file) {
    const formData = new FormData()
    formData.append('file', file)
    
    const headers = {}
    const token = localStorage.getItem('access_token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    }).then(r => r.json())
  }
}

export const apiClient = new ApiClient()
```

**Validação:**
```javascript
// Em devtools console
await apiClient.get('/api/v1/health')  // sem token
// Esperado: erro 403 ou simples {"status":"ok"}

// Após usar useAuth para login:
const me = await apiClient.get('/api/v1/auth/me')
console.log(me)  // { id, email, org_id, roles }
```

---

### 1.9 Patch [8]: src/hooks/useAuth.js (Novo)

**Caminho:** `frontend/src/hooks/useAuth.js`  
**Tipo:** Criar  
**Risco:** 🔴 Alto (lógica crítica de auth)

```javascript
import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../api/client'

/**
 * Hook de autenticação — gerencia login, logout, token persistence e bootstrap
 * 
 * Retorna: { user, loading, error, login, logout, refresh, isAuthenticated }
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Bootstrap: verifica se há token salvo e valida ao montar o componente
   */
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      validateToken()
    } else {
      setLoading(false)
    }
  }, [])  // Roda apenas uma vez ao montar

  /**
   * Valida token chamando /auth/me
   */
  const validateToken = async () => {
    try {
      const data = await apiClient.get('/api/v1/auth/me')
      setUser(data)
      setError(null)
    } catch (err) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Login com email/password
   * Salva tokens em localStorage e carrega dados do usuário
   */
  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.post('/api/v1/auth/login', {
        email,
        password,
      })

      // Salva tokens
      localStorage.setItem('access_token', response.access_token)
      localStorage.setItem('refresh_token', response.refresh_token)

      // Carrega dados do user
      await validateToken()
      
      return response
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Logout — limpa tokens e dados
   */
  const logout = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/auth/logout', {})
    } catch (err) {
      // Mesmo que falhe, limpar localmente
      console.warn('Logout error (cleanup anyway):', err)
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      setUser(null)
      setError(null)
    }
  }, [])

  /**
   * Refresh token — obtém novo access_token usando o refresh_token
   */
  const refresh = useCallback(async () => {
    const token = localStorage.getItem('refresh_token')
    if (!token) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await apiClient.post('/api/v1/auth/refresh', {
        refresh_token: token,
      })
      localStorage.setItem('access_token', response.access_token)
      return response
    } catch (err) {
      // Se refresh falhar, fazer logout completo
      await logout()
      throw err
    }
  }, [logout])

  return {
    user,
    loading,
    error,
    login,
    logout,
    refresh,
    isAuthenticated: !!user,
  }
}
```

---

### 1.10 Patch [9-10]: LoginScreen.jsx + CSS

**Caminho:** `frontend/src/screens/LoginScreen.jsx`  
**Tipo:** Criar  
**Risco:** 🟡 Médio (UX, validação simples)

```javascript
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginScreen.module.css'

export function LoginScreen() {
  const { login, loading, error } = useAuth()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('admin123')
  const [localError, setLocalError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    if (!email || !password) {
      setLocalError('Email e senha obrigatórios')
      return
    }

    try {
      await login(email, password)
      // useAuth redireciona ou app re-renderiza
    } catch (err) {
      setLocalError(err.message || 'Erro ao fazer login')
    }
  }

  const displayError = localError || error

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>eControle v2</h1>
        <p className={styles.subtitle}>Portal de Gestão Integrada</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Senha:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              required
            />
          </div>

          {displayError && (
            <div className={styles.error} role="alert">
              {displayError}
            </div>
          )}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.hint}>
          Demo: admin@example.com / admin123
        </p>
      </div>
    </div>
  )
}
```

**Caminho:** `frontend/src/screens/LoginScreen.module.css`

```css
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

.card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
}

.title {
  text-align: center;
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 2rem;
  font-weight: 700;
}

.subtitle {
  text-align: center;
  margin: 0 0 2rem 0;
  color: #999;
  font-size: 0.9rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-weight: 600;
  color: #555;
  font-size: 0.95rem;
}

.field input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.field input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.error {
  padding: 0.75rem;
  background-color: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 6px;
  color: #d32f2f;
  font-size: 0.9rem;
  font-weight: 500;
}

.button {
  padding: 0.875rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.button:active:not(:disabled) {
  transform: translateY(0);
}

.button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.hint {
  text-align: center;
  margin: 2rem 0 -1rem 0;
  color: #999;
  font-size: 0.85rem;
}
```

---

### 1.11 Patch [11]: src/index.css

**Caminho:** `frontend/src/index.css`  
**Tipo:** Copiar de `eControle_v1/frontend/src/index.css`  
**Risco:** ✅ Muito baixo (estilos puros, sem lógica)

```css
/* Copiar integral do v1 — estilos, temas, CSS variables */
/* 
 * Exemplos esperados:
 *   - Reset CSS
 *   - Variáveis CSS de cores (--color-primary, --color-danger, etc)
 *   - Fontes
 *   - Estilos globais de tags (a, button, inputs)
 *   - Media queries
 */
```

---

## 2. Checklist de Implementação (Passo a Passo)

### Fase 1: Setup Vite + Estrutura Mínima

```markdown
Tempo estimado: 15-20 minutos

□ [1] Criar pasta frontend na raiz
□ [2] npm create vite@latest . -- --template react (ou manual)
□ [3] Implementar package.json com scripts corretos
□ [4] Implementar vite.config.js com porta 5174 + proxy
□ [5] Implementar .env.example
□ [6] npm install
□ [7] Testar: npm run dev deve abrir localhost:5174
```

**Validação Pós-Fase 1:**
```bash
cd frontend
npm run dev
# Esperado: Server running at http://localhost:5174/
```

---

### Fase 2: Auth Infrastructure

```markdown
Tempo estimado: 20-25 minutos

□ [7] Criar src/api/client.js (HTTP client com tokens)
□ [8] Criar src/hooks/useAuth.js (auth state + bootstrap)
□ [9-10] Criar LoginScreen.jsx + CSS
□ [6] Atualizar App.jsx para usar useAuth + renderizar LoginScreen
□ Testar login manual em localhost:5174
```

**Validação Pós-Fase 2:**
```bash
# 1. Navegar para localhost:5174
# 2. Ver LoginScreen com campos email/password
# 3. Digitar admin@example.com / admin123
# 4. Clicar "Entrar"
# 5. Esperado: redireciona para MainApp (ainda não existe, erro esperado)
```

---

### Fase 3: Reaproveitar Código v1

```markdown
Tempo estimado: 30-45 minutos

□ [11] Copiar src/index.css do v1
□ [12] Copiar src/components/* do v1 (exceto imports rotos)
□ [13] Copiar src/features/ do v1 (painel, empresas, licencas, etc)
□ [14] Copiar src/lib/*.js do v1 (status.js, constants.js, etc)
□ [15] Copiar src/providers/ do v1 (ToastProvider)
□ [16] Criar src/screens/MainApp.jsx a partir de App.jsx do v1
□ [17] Ajustar imports em features para nova estrutura
□ [18] Validar: grep -r "VITE_DEV_TOKEN" src/ (remover hardcodes)
□ [19] Validar: grep -r "localStorage.jwt" src/ (usar useAuth)
```

**Validação Pós-Fase 3:**
```bash
npm run dev
# Esperado: sem erros de import no console
# Esperado: após login, MainApp renderiza com abas visíveis
```

---

### Fase 4: Integração com Backend

```markdown
Tempo estimado: 15-20 minutos

□ [20] Validar endpoints no backend atual (S5):
         GET /api/v1/auth/me
         GET /api/v1/companies
□ [21] Ajustar src/lib/api.js para usar client.js ao invés de fetch direto
□ [22] Testar cada aba (painel, empresas, licencas, etc)
         → se backend não tem endpoint, erro esperado
         → documento esperado em PLANO_DESENVOLVIMENTO.md (S7+)
□ [23] Validar devtools:
         → requests têm header Authorization
         → responses são JSON válido
         → 401 dispara logout
```

**Validação Pós-Fase 4:**
```bash
curl http://localhost:5174  # Redireciona para login
curl -X POST http://localhost:5174/api/v1/auth/login \
  -d '{"email":"admin@example.com","password":"admin123"}'  # Funciona (via proxy de 5174)
```

---

### Fase 5: Smoke Tests Finais

```markdown
Tempo estimado: 10-15 minutos

□ [24] Teste de Login Completo
         1. Abrir http://localhost:5174
         2. Ver LoginScreen
         3. Digitar credenciais corretas
         4. Enviar
         5. Erro esperado: MainApp falha se algumas features precisam endpoints S7+
         6. Sucesso: Se empresas têm dados no DB, painel carrega

□ [25] Teste de Logout
         1. Fazer login com sucesso
         2. Clicar em Logout (em HeaderMenuPro)
         3. Redireciona para LoginScreen
         4. localStorage vazio

□ [26] Teste de Refresh de Página
         1. Fazer login
         2. F5 (refresh)
         3. Esperado: mantém session (não volta para login)
         4. SE token expirado: volta para login

□ [27] Teste de Network (DevTools F12)
         1. Abrir Network tab
         2. Fazer login
         3. Ver requisição POST a /api/v1/auth/login
         4. Response contém access_token + refresh_token
         5. Ver requisição GET a /api/v1/auth/me
         6. Response contém user data
         7. Próximas requisições têm Authorization header

□ [28] Teste de Error Handling
         1. Logout
         2. Copiar access_token manualmente no devtools console: localStorage.access_token
         3. Expirar token manualmente (remover de localStorage)
         4. Fazer requisição GET /api/v1/auth/me sem token
         5. Esperado: 401 → redireciona para login
```

---

## 3. Estrutura Final (S6 Completo)

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   └── client.js                    ← HTTP client + auth header
│   ├── hooks/
│   │   └── useAuth.js                   ← Auth state + bootstrap
│   ├── screens/
│   │   ├── LoginScreen.jsx              ← Nova tela de login
│   │   ├── LoginScreen.module.css
│   │   ├── MainApp.jsx                  ← App.jsx do v1 adaptado
│   │   ├── painel/                      ← Copiar do v1
│   │   ├── empresas/
│   │   ├── licencas/
│   │   ├── taxas/
│   │   ├── processos/
│   │   ├── certificados/                ← Ajustar em S8
│   │   └── uteis/                       ← Ajustar em S9
│   ├── components/
│   │   ├── HeaderMenuPro.jsx            ← Copiar do v1 (remover hardcodes)
│   │   ├── ProtectedRoute.jsx           ← Guard para rotas
│   │   ├── Chip.jsx
│   │   ├── BadgeStatus.jsx
│   │   ├── ... (demais primítivos)
│   ├── lib/
│   │   ├── status.js                    ← Copiar do v1
│   │   ├── constants.js                 ← Copiar do v1
│   │   ├── api.js                       ← Atualizar para usar client.js
│   │   ├── process.js                   ← Copiar do v1
│   │   └── ... (demais utils)
│   ├── providers/
│   │   └── ToastProvider.jsx            ← Copiar do v1
│   ├── App.jsx                          ← Nova versão com auth
│   ├── App.module.css
│   ├── main.jsx                         ← Entry point
│   └── index.css                        ← Copiar do v1
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .env.local                           ← (gitignored)
└── .gitignore
```

---

## 4. Diff Resumido (Mudanças do v1 → v2)

```diff
# Estrutura de diretórios
A frontend/                           (nova pasta)

# Vite + módulos
A frontend/package.json               
A frontend/vite.config.js             
A frontend/index.html                 

# Entry point
A frontend/src/main.jsx               (novo, entry React)

# Auth
A frontend/src/api/client.js          (novo, HTTP client)
A frontend/src/hooks/useAuth.js       (novo, state auth)
A frontend/src/screens/LoginScreen.jsx (novo, login UI)

# App root
M frontend/src/App.jsx                (novo, com auth flow)
A frontend/src/App.module.css

# Do v1 → v2 (reusar/ajustar)
C frontend/src/components/            (copiar do v1)
C frontend/src/features/              (copiar do v1, ajustar cert/uteis)
C frontend/src/lib/                   (copiar do v1)
C frontend/src/providers/             (copiar do v1)
C frontend/src/index.css              (copiar do v1)

# Config
A frontend/.env.example               (novo, template env)
A frontend/.env.local                 (novo, gitignored)
```

---

## 5. Troubleshooting Comum

| Problema | Causa | Solução |
|----------|-------|---------|
| CORS error ao fazer login | Proxy Vite não ativo | Verificar vite.config.js, testar `curl localhost:5174/api/v1/health` |
| Token não salva | useAuth não chama login corretamente | Verificar localStorage em DevTools, validar estrutura da response |
| Reload perde session | validateToken não chamado ao montar | Verificar useEffect em App.jsx com token |
| 404 ao acessar abas (licencas, taxas) | Backend S5 não tem endpoints | Normal, implemenar em S7; por enquanto usar GET /companies para testar |
| "Cannot find module 'components/...'" | Import path errado após copiar v1 | Procurar por imports relativos quebrados, ajustar para nova estrutura |
| Devtools mostra erro de CSS | index.css não copiado ou importado | Verificar `import './index.css'` em main.jsx |

---

## 6. Comandos Úteis

```bash
# Setup rápido (primeira vez)
cd frontend
npm create vite@latest . -- --template react
npm install
cp .env.example .env.local

# Desenvolvimento
npm run dev              # Abre localhost:5174

# Build
npm run build            # Gera frontend/dist/

# Preview de build
npm run preview          # Testa build localmente

# Linting (se instalado)
npm run lint

# Debug
# F12 em localhost:5174 → Console → localStorage.access_token
```

---

## 7. Checklist Final de Aceite (S6)

### Critérios Obrigatórios (S6 Completo)

- ✅ Frontend sobe em localhost:5174 sem erros críticos
- ✅ LoginScreen renderiza (email, password, botão "Entrar")
- ✅ Login com `admin@example.com` / `admin123` funciona
- ✅ POST /api/v1/auth/login retorna access_token
- ✅ GET /api/v1/auth/me retorna dados do usuário autenticado
- ✅ Token enviado em Authorization header em requisições
- ✅ MainApp (com abas) renderiza após login
- ✅ Logout limpa tokens + redireciona para LoginScreen
- ✅ Refresh de página mantém sessão (se token válido)
- ✅ Proxy Vite ativo (requisições para /api vão para :8020)

### Critérios Nice-to-Have (podem ficar para S11)

- 🟡 CSS refinado (cores, spacing, responsive)
- 🟡 Feedback visual de loading em requests
- 🟡 Validação de form em LoginScreen
- 🟡 Senha reset / signup (pode ser futuro)

---

**Fim do Documento de Patches & Checklist**

*Gerado em 19 de fevereiro de 2026*  
*Complementa: docs/S6_FRONTEND_REAPROVEITADO.md*
