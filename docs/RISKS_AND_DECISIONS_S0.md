# Risks and Decisions (S0)

**Decisoes travadas no S0**
- Docker-first em toda a stack do eControle v2.
- Portas fixas do eControle v2: `5174` (frontend), `8020` (backend), `6381` (redis), `5433` (postgres) sem mexer no CertHub.
- Auth/RBAC no padrao CertHub (portal principal nao depende do CertHub responder).
- Aba Certificados sera espelho read-only, com operacoes no CertHub.
- Aba Uteis sem CRUD no eControle, apenas consumo dos exports do Scribere.
- Ingest inicial via JSON (sem planilhas).

**Riscos e mitigacoes**
- Auth unificado, cookies e CORS entre front e backend.
  Mitigacao: usar dominio/host padronizado via Docker + cookies com `SameSite` consistente e CORS restritivo.
- Espelho de certificados pode ficar stale/offline.
  Mitigacao: endpoint de health do mirror + agendamento de sync com logs e alertas.
- Seguranca no consumo de exports do Scribere.
  Mitigacao: service role somente no backend; frontend acessa via proxy autenticado.
- Dependencia do CertHub para detalhes/instalacao.
  Mitigacao: deep link claro e fallback para `/certificados` sem parametros.
