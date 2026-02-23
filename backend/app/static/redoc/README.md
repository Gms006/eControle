# ReDoc Assets

Este diretório contém os assets do ReDoc para self-hosting.

## Como popular este diretório

Se quiser usar assets auto-hospedados (sem depender de CDN):

```bash
cd backend
python download_redoc_assets.py
```

Isso fará download de `redoc.standalone.js` (~2MB) automaticamente.

## .gitignore

Os arquivos de assets são grandes e não devem ser versionados. Se você tiver executado o script de download, adicione a linha abaixo ao `.gitignore`:

```
backend/app/static/redoc/redoc.standalone.js
```

## Por que não incluir?

O arquivo `redoc.standalone.js` tem aproximadamente 2MB, o que aumenta significativamente o tamanho do repositório. A estratégia atual usa:

1. **CDN + versão pinada**: Por padrão, sem o arquivo local
2. **Self-hosting opcional**: Execute o script se quiser assets locais

Isso oferece flexibilidade: rápido na maioria dos casos, mas com opção de self-hosting completo.
