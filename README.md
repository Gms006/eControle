# eControle

Sistema de gestão de empresas, licenças, taxas e processos com interface React e backend Python/FastAPI que gerencia arquivos Excel (.xlsm) preservando macros VBA.

## Estrutura do Projeto

```
econtrole/
├── backend/
│   ├── api.py
│   ├── repo_excel.py
│   ├── models.py
│   ├── services.py
│   ├── config.yaml
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   └── ui/
│   │   │       ├── badge.tsx
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── scroll-area.tsx
│   │   │       ├── select.tsx
│   │   │       ├── separator.tsx
│   │   │       ├── switch.tsx
│   │   │       ├── table.tsx
│   │   │       └── tabs.tsx
│   │   └── lib/
│   │       └── utils.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── postcss.config.js
├── data/
│   └── arquivo.xlsm
├── tests/
│   ├── test_api.py
│   ├── test_repo.py
│   └── test_services.py
├── .gitignore
├── docker-compose.yml
├── ESTRUTURA_PROJETO.md
├── GUIA_SETUP.md
└── README.md
```

## Setup Rápido

### 1. Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Configurar ambiente
cp .env.example .env
# Edite .env e configure EXCEL_PATH

# Executar
python api.py
```

Backend estará em: [http://localhost:8000](http://localhost:8000)

### 2. Frontend

```bash
cd frontend

# Instalar dependências base
npm install

# TypeScript
npm i -D typescript @types/react @types/react-dom

# shadcn/ui (primeira vez)
npx shadcn-ui@latest init
npx shadcn-ui@latest add card button input select tabs switch scroll-area separator badge label

# Bibliotecas adicionais
npm install lucide-react recharts clsx tailwind-merge

# Gerar arquivos de config
npx tailwindcss init -p

# Executar
npm run dev
```

> Dicas:
>
> * Configure o alias `@` em `vite.config.ts` para `src/`.
> * Inclua `@tailwind base; @tailwind components; @tailwind utilities;` em `src/index.css`.
> * Atualize `tailwind.config.ts` para escanear `./src/**/*.{ts,tsx}`.

````

Frontend estará em: [http://localhost:5173](http://localhost:5173)

## Endpoints da API

| Método | Endpoint             | Descrição                                      |
| ------ | -------------------- | ---------------------------------------------- |
| GET    | `/`                  | Info da API                                    |
| GET    | `/health`            | Healthcheck                                    |
| GET    | `/api/empresas`      | Lista empresas (query, municipio, so\_alertas) |
| GET    | `/api/empresas/{id}` | Detalhes + métricas de empresa                 |
| GET    | `/api/licencas`      | Lista licenças normalizadas                    |
| GET    | `/api/taxas`         | Lista taxas agrupadas por empresa              |
| GET    | `/api/processos`     | Lista processos (tipo, apenas\_ativos)         |
| GET    | `/api/kpis`          | KPIs do painel                                 |
| GET    | `/api/municipios`    | Lista municípios únicos                        |
| POST   | `/api/refresh`       | Recarrega dados do Excel                       |

## Configuração do Excel

O arquivo Excel deve ter as seguintes abas:

- **EMPRESAS**: Cadastro principal (ID, EMPRESA, CNPJ, MUNICÍPIO, etc.)
- **LICENÇAS**: Status por tipo (estrutura "larga" - uma coluna por tipo de licença)
- **TAXAS**: Status por tipo (estrutura "larga" - uma coluna por tipo de taxa)
- **Diversos**: Processos diversos (exemplo de aba de processos)

**Importante**: A linha de cabeçalho deve estar na linha 2. O backend usa heurística para detectar, mas assume linha 2 como padrão.

## Desenvolvimento

### Verificar mapeamento de colunas

```bash
cd backend
python repo_excel.py
````

### Testar API

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/kpis
```

### Build para produção

```bash
cd frontend
npm run build
# Arquivos estáticos em dist/
```

## Troubleshooting

**Backend não inicia**:

* Verifique se o caminho do Excel no `.env` está correto
* Verifique se o arquivo Excel existe e não está aberto
* Verifique permissões de leitura/escrita

**CORS error no frontend**:

* Verifique se o backend está rodando em localhost:8000
* Verifique `CORS_ORIGINS` no `.env` do backend

**Dados não carregam no frontend**:

* Abra o console do navegador (F12) e verifique erros
* Teste os endpoints manualmente: `curl http://localhost:8000/api/empresas`
* Verifique se o Excel tem dados nas abas corretas

**Componentes shadcn/ui não encontrados**:

```bash
cd frontend
npx shadcn-ui@latest add card button input select tabs switch scroll-area separator badge label
```

## Próximos Passos

* [x] Estrutura de diretórios ajustada para TypeScript no frontend
* [x] Inclusão dos componentes `badge` e `label` no shadcn/ui
* [x] Adição de `src/index.css` com Tailwind
* [x] Alias `@` no Vite (frontend)
* [ ] Implementar endpoint `/api/diagnostico` (mapeamento de colunas/abas)
* [ ] Adicionar `portalocker` e estratégia de lock no `repo_excel.py`
* [ ] Testes unitários mínimos: `test_repo.py`, `test_services.py`, `test_api.py`
* [ ] Autenticação (JWT) e CORS configuráveis via `.env`
* [ ] Docker Compose para dev/prod

## Licença

Propriedade privada - Uso interno apenas.

Propriedade privada - Uso interno apenas.

---

## ATUALIZAÇÃO — Estrutura (TypeScript no frontend)

```
econtrole/
├── backend/
│   ├── api.py · repo_excel.py · models.py · services.py · config.yaml · requirements.txt · .env
├── frontend/
│   ├── src/
│   │   ├── App.tsx · main.tsx · index.css
│   │   ├── components/ui/{badge,button,card,input,label,scroll-area,select,separator,switch,table,tabs}.tsx
│   │   └── lib/utils.ts
│   ├── package.json · tsconfig.json · vite.config.ts · tailwind.config.ts · postcss.config.js · index.html
├── data/arquivo.xlsm
├── tests/{test_api.py,test_repo.py,test_services.py}
└── .gitignore · docker-compose.yml · README.md
```

### Ajustes de Config

**vite.config.ts** (alias `@` → `src/`), **tailwind.config.ts** (content `./src/**/*.{ts,tsx}`), inclusão de `src/index.css` com `@tailwind` e migração dos componentes UI para `.tsx`.

### package.json (devDependencies — principais)

```json
{
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.4.0",
    "vite": "^5.0.0"
  }
}
```