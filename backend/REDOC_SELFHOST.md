# ReDoc Self-Hosting Fix

## Problema
O redoc@next passou a retornar 404 em alguns cenários, causando falha ao carregar a documentação da API.

## Solução
Implementado endpoint customizado `/redoc` que:
1. **Primeiro**: Tenta usar assets locais (self-hosted) se disponíveis
2. **Fallback**: Usa CDN com versão pinada `@2.1.5` (em vez de `@next`)

## Como usar

### Opção 1: Usar apenas CDN com versão estável (recomendado para começar)
A solução atual já está ativa. Basta iniciar o servidor:
```bash
python -m uvicorn main:app --reload
```

O endpoint `/redoc` estará disponível com a versão estável do ReDoc.

### Opção 2: Self-host completo (sem dependência de CDN)
Se quiser fazer download dos assets para verdadeiro self-hosting:

```bash
cd backend
python download_redoc_assets.py
```

Isso fará download do arquivo `redoc.standalone.js` (~2MB) para `app/static/redoc/`.

Após isso, o servidor automaticamente usará os assets locais em vez do CDN.

## Arquivos modificados
- `main.py`: Adicionado endpoint `/redoc` customizado com suporte a self-hosting
- `download_redoc_assets.py`: Script para download dos assets
- `app/static/redoc/`: Diretório para assets locais (criado, vazio até executar download)

## Versão do ReDoc
- **Atual (pinada)**: `2.1.5` - versão estável e confiável
- **Anterior**: `@next` - era a fonte do problema (404 errors)

## Endpoints
- `/redoc` - Documentação customizada (novo)
- `/docs` - Swagger UI (padrão do FastAPI, mantido)
- `/openapi.json` - Schema OpenAPI (padrão do FastAPI)
