import React from "react";
import dayjs from "dayjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItemFancy, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/Chip";
import ExportModal from "@/components/ExportModal";
import CompanyAvatar from "@/components/common/CompanyAvatar";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { ArrowDownAZ, ArrowUpZA, Clipboard, EllipsisVertical, ExternalLink, File, FileSpreadsheet, Mail, PencilLine, Phone, SlidersHorizontal } from "lucide-react";
import { TAXA_TYPE_KEYS } from "@/lib/constants";
import { buildCertificadoIndex, categorizeCertificadoSituacao, resolveEmpresaCertificadoSituacao } from "@/lib/certificados";
import { parseDateLike } from "@/lib/date";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { cn } from "@/lib/utils";
import { getStatusKey, hasPendingFraction, hasRelevantStatus, isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import { openCartaoCNPJ, onlyDigits, openPortalPrefeitura } from "@/lib/quickLinks";
import useCompanyOverview from "@/hooks/useCompanyOverview";
import CompanyOverviewDrawer from "@/components/companies/CompanyOverviewDrawer";

const VIEW_MODE_KEY = "econtrole.empresas.viewMode";

const resolveApiBaseUrl = () => {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (port === "5173") return `${protocol}//${hostname}:8000`;
  if (port === "5174") return `${protocol}//${hostname}:8020`;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
};
const API_BASE_URL = resolveApiBaseUrl();
const ensureAbsoluteUrl = (url) => {
  if (!url) return "";
  if (/^https?:/i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
};
const resolveEmpresaIdValue = (empresa, extractEmpresaId) =>
  extractEmpresaId?.(empresa) ??
  empresa?.empresa_id ??
  empresa?.empresaId ??
  empresa?.company_id ??
  empresa?.companyId ??
  empresa?.id;
const companyDocumentDigits = (item) =>
  onlyDigits(item?.cnpj ?? item?.company_cpf ?? item?.cnpj_empresa ?? item?.cnpjEmpresa ?? "");
const companyDocumentLabel = (item) => (item?.cnpj ? "CNPJ" : item?.company_cpf ? "CPF" : "Documento");
const companyDocumentValue = (item) => item?.cnpj || item?.company_cpf || "";
const findListByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId) || [];
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return [];
  for (const value of map?.values?.() || []) {
    const list = Array.isArray(value) ? value : [value];
    const matched = list.filter((entry) => companyDocumentDigits(entry) === target);
    if (matched.length > 0) return matched;
  }
  return [];
};
const findTaxaByEmpresa = (map, empresaId, empresaCnpj) => {
  if (empresaId && map?.has(empresaId)) return map.get(empresaId);
  const target = onlyDigits(empresaCnpj || "");
  if (!target) return undefined;
  for (const taxa of map?.values?.() || []) {
    if (companyDocumentDigits(taxa) === target) return taxa;
  }
  return undefined;
};

const isTaxaDebitoStatus = (status) => {
  const key = getStatusKey(status || "");
  if (!key) return false;
  if (key.includes("abert")) return true;
  if (!key.includes("parcelad")) return false;
  if (hasPendingFraction(status)) return true;
  return !key.includes("quitad") && !key.includes("pago");
};
const hasDebito = (taxa) => {
  if (!taxa) return false;
  return (
    TAXA_TYPE_KEYS.some((taxaKey) => isTaxaDebitoStatus(taxa?.[taxaKey])) ||
    isTaxaDebitoStatus(taxa?.status_taxas)
  );
};
const isDebitoLabel = (value) => {
  const key = getStatusKey(value || "");
  if (!key) return false;
  return key.includes("debito") || key.includes("debitos");
};
const resolveCompanyStatus = (empresa) => {
  const fromStatusEmpresa = empresa?.status_empresa ?? empresa?.statusEmpresa;
  if (fromStatusEmpresa && !isDebitoLabel(fromStatusEmpresa)) return fromStatusEmpresa;
  const fromSituacao = empresa?.situacao;
  if (fromSituacao && !isDebitoLabel(fromSituacao)) return fromSituacao;
  if (empresa?.is_active === false || empresa?.isActive === false) return "Inativa";
  return "Ativa";
};
const semCertificado = (empresa) => !getStatusKey(empresa?.certificado || "").includes("valid");
const hasValidCertificado = (empresa, certificadoIndex) => {
  const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
  return categorizeCertificadoSituacao(situacao) === "VÁLIDO";
};
const critico7dias = (lics) =>
  (lics || []).some((lic) => {
    const parsed = parseDateLike(lic?.validade || lic?.validade_br);
    if (!parsed) return false;
    const days = parsed.startOf("day").diff(dayjs().startOf("day"), "day");
    return days >= 0 && days <= 7;
  });
const PLACEHOLDER_CNAE_CODE = "00.00-0-00";
const RISK_PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 3 };

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const normalizeRisk = (value) => String(value || "").trim().toUpperCase();

const getUsefulCnaes = (empresa) => {
  const all = [...(Array.isArray(empresa?.cnaes_principal) ? empresa.cnaes_principal : []), ...(Array.isArray(empresa?.cnaes_secundarios) ? empresa.cnaes_secundarios : [])];
  return all.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const code = normalizeCode(entry.code);
    return Boolean(code) && code !== PLACEHOLDER_CNAE_CODE;
  });
};

const formatRiskLabel = (value) => {
  const key = normalizeRisk(value);
  if (key === "HIGH") return "Alto";
  if (key === "MEDIUM") return "Médio";
  if (key === "LOW") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (status, hasUsefulCnae) => {
  const key = String(status || "").trim().toUpperCase();
  if (!hasUsefulCnae && (key === "NO_CNAE" || key === "UNMAPPED_CNAE")) return "Sem CNAE";
  if (key === "OK") return "OK";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
};

const riskChipVariant = (risk) => {
  const key = normalizeRisk(risk);
  if (key === "HIGH") return "danger";
  if (key === "MEDIUM") return "warning";
  if (key === "LOW") return "success";
  return "neutral";
};

const compareNullableScore = (a, b, direction) => {
  const an = Number.isFinite(a) ? a : null;
  const bn = Number.isFinite(b) ? b : null;
  if (an === null && bn === null) return 0;
  if (an === null) return 1;
  if (bn === null) return -1;
  return (an - bn) * (direction === "asc" ? 1 : -1);
};
const ORDER_OPTIONS = [
  { value: "score", label: "Score", defaultDir: "desc" },
  { value: "nome", label: "Empresa", defaultDir: "asc" },
  { value: "status", label: "Status", defaultDir: "asc" },
  { value: "risco", label: "Risco", defaultDir: "desc" },
];
const KPI_BUTTON_THEME = {
  debitos: "border-blue-300 bg-blue-100 text-blue-900",
  semCertificado: "border-indigo-300 bg-indigo-100 text-indigo-900",
  taxasPendentes: "border-sky-300 bg-sky-100 text-sky-900",
  licencasVencendo: "border-blue-400 bg-blue-50 text-blue-900",
  processosAndamento: "border-indigo-400 bg-indigo-50 text-indigo-900",
  criticos7dias: "border-slate-400 bg-slate-100 text-slate-900",
};

export default function EmpresasScreen({
  filteredEmpresas,
  empresas,
  certificados,
  soAlertas,
  canManageEmpresas,
  extractEmpresaId,
  licencasByEmpresa,
  taxasByEmpresa,
  processosByEmpresa,
  handleCopy,
  enqueueToast,
}) {
  const toast = (msg) => enqueueToast?.(msg);
  const [viewMode, setViewMode] = React.useState(() => (typeof window !== "undefined" && window.localStorage.getItem(VIEW_MODE_KEY) === "detailed" ? "detailed" : "compact"));
  const [openFilters, setOpenFilters] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);
  const [kpiFilter, setKpiFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ativa");
  const [riskFilter, setRiskFilter] = React.useState("todos");
  const [sortBy, setSortBy] = React.useState({ field: "score", direction: "desc" });
  const [cndCache, setCndCache] = React.useState({});
  const [openOverview, setOpenOverview] = React.useState(false);
  const [overviewCompany, setOverviewCompany] = React.useState(null);
  const cndRef = React.useRef(cndCache);
  const overviewState = useCompanyOverview(openOverview, overviewCompany?.id);

  React.useEffect(() => {
    cndRef.current = cndCache;
  }, [cndCache]);
  React.useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  const certificadoIndex = React.useMemo(
    () => buildCertificadoIndex(Array.isArray(certificados) ? certificados : []),
    [certificados],
  );

  const ensureCNDs = React.useCallback(async (cnpjRaw, { force = false } = {}) => {
    const digits = onlyDigits(cnpjRaw || "");
    if (!digits) return [];
    const cached = cndRef.current[digits];
    if (!force && cached?.items) return cached.items;
    setCndCache((prev) => ({ ...prev, [digits]: { ...(prev[digits] || {}), loading: true } }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/cnds/${digits}/list`);
      const items = response.ok ? await response.json() : [];
      setCndCache((prev) => ({ ...prev, [digits]: { items, loading: false } }));
      return items;
    } catch {
      setCndCache((prev) => ({ ...prev, [digits]: { items: [], loading: false, error: true } }));
      toast?.("Não foi possível verificar as CNDs desta empresa.");
      return [];
    }
  }, [toast]);

  const openEditEmpresa = React.useCallback((empresa) => {
    const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
    window.dispatchEvent(
      new CustomEvent("econtrole:open-company", {
        detail: {
          mode: "edit",
          companyId: empresaId || null,
          cnpj: empresa?.cnpj || null,
          cpf: empresa?.company_cpf || null,
        },
      })
    );
  }, [extractEmpresaId]);

  const openOverviewEmpresa = React.useCallback((empresa, empresaId) => {
    const resolvedId = empresaId || resolveEmpresaIdValue(empresa, extractEmpresaId);
    if (!resolvedId) {
      toast?.("Empresa sem identificador para abrir visão geral.");
      return;
    }
    setOverviewCompany({ ...(empresa || {}), id: String(resolvedId) });
    setOpenOverview(true);
  }, [extractEmpresaId, toast]);

  const rows = React.useMemo(() => filteredEmpresas.map((empresa) => {
    const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
    const document = companyDocumentValue(empresa);
    const lics = findListByEmpresa(licencasByEmpresa, empresaId, document);
    const processos = findListByEmpresa(processosByEmpresa, empresaId, document);
    const taxa = findTaxaByEmpresa(taxasByEmpresa, empresaId, document);
    const ativos = processos.filter((proc) => !isProcessStatusInactive(proc.status));
    const licSummary = lics.reduce((acc, lic) => {
      if (!hasRelevantStatus(lic.status)) return acc;
      const key = getStatusKey(lic.status);
      acc.total += 1;
      if (key.includes("vencid")) acc.vencidas += 1;
      else if (key.includes("vence")) acc.vencendo += 1;
      else acc.ativas += 1;
      return acc;
    }, { total: 0, ativas: 0, vencendo: 0, vencidas: 0 });
    const taxaPendencias = taxa ? TAXA_TYPE_KEYS.filter((key) => isAlertStatus(taxa?.[key])).length : 0;
    const certificadoValido = hasValidCertificado(empresa, certificadoIndex);
    const usefulCnaes = getUsefulCnaes(empresa);
    const riscoConsolidado = normalizeRisk(empresa?.risco_consolidado ?? empresa?.riscoConsolidado);
    const scoreUrgenciaRaw = empresa?.score_urgencia ?? empresa?.scoreUrgencia;
    const scoreUrgencia = Number.isFinite(scoreUrgenciaRaw) ? Number(scoreUrgenciaRaw) : null;
    const scoreStatus = String(empresa?.score_status ?? empresa?.scoreStatus ?? "").trim().toUpperCase() || null;
    const isCpfCompany = Boolean(empresa?.company_cpf) && !Boolean(empresa?.cnpj);
    return {
      empresa,
      empresaId: empresaId ? String(empresaId) : undefined,
      lics,
      licSummary,
      processos,
      ativos,
      taxaPendencias,
      scoreUrgencia,
      riscoConsolidado,
      scoreStatus,
      isCpfCompany,
      hasUsefulCnae: usefulCnaes.length > 0,
      certificadoValido,
      flags: {
        debitos: hasDebito(taxa),
        semCertificado: !certificadoValido,
        taxasPendentes: taxaPendencias > 0,
        licencasVencendo: licSummary.vencendo > 0 || licSummary.vencidas > 0,
        processosAndamento: ativos.length > 0,
        criticos7dias: critico7dias(lics),
      },
    };
  }), [certificadoIndex, extractEmpresaId, filteredEmpresas, licencasByEmpresa, processosByEmpresa, taxasByEmpresa]);

  const kpis = [
    { key: "debitos", label: "Com débitos" },
    { key: "semCertificado", label: "Sem certificado" },
    { key: "taxasPendentes", label: "Taxas pendentes" },
    { key: "licencasVencendo", label: "Licenças vencendo" },
    { key: "processosAndamento", label: "Processos em andamento" },
    { key: "criticos7dias", label: "Críticos (<=7 dias)" },
  ];
  const counts = Object.fromEntries(kpis.map((item) => [item.key, rows.filter((row) => row.flags[item.key]).length]));

  const filteredRows = React.useMemo(() => {
    const list = rows.filter((row) => {
      if (kpiFilter && !row.flags[kpiFilter]) return false;
      const statusKey = getStatusKey(resolveCompanyStatus(row.empresa) || "");
      const isActive = statusKey.includes("ativ") && !statusKey.includes("inativ");
      if (statusFilter === "ativa" && !isActive) return false;
      if (statusFilter === "inativa" && isActive) return false;
      if (riskFilter !== "todos" && normalizeRisk(row.riscoConsolidado) !== riskFilter) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy.field === "score") {
        return compareNullableScore(a.scoreUrgencia, b.scoreUrgencia, sortBy.direction);
      }
      if (sortBy.field === "risco") {
        const av = RISK_PRIORITY[normalizeRisk(a.riscoConsolidado)] || 0;
        const bv = RISK_PRIORITY[normalizeRisk(b.riscoConsolidado)] || 0;
        if (av === bv) return 0;
        return (av - bv) * (sortBy.direction === "asc" ? 1 : -1);
      }
      const av = sortBy.field === "status" ? getStatusKey(a.empresa?.situacao || "") : String(a.empresa?.empresa || "").toLowerCase();
      const bv = sortBy.field === "status" ? getStatusKey(b.empresa?.situacao || "") : String(b.empresa?.empresa || "").toLowerCase();
      return av.localeCompare(bv) * (sortBy.direction === "asc" ? 1 : -1);
    });
    return list;
  }, [kpiFilter, riskFilter, rows, sortBy.direction, sortBy.field, statusFilter]);

  const toggleSort = (field) =>
    setSortBy((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: field === "score" ? "desc" : "asc" }
    );

  return (
    <div className="space-y-3">
      <Card className="border-subtle bg-surface" data-testid="companies-summary">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted">{filteredRows.length} de {empresas.length} empresas exibidas</span>
            <div className="flex items-center gap-2">
              {soAlertas ? <Chip variant="warning">Modo alertas ativo</Chip> : null}
              <Button size="sm" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={() => setOpenExport(true)}>
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Exportar relatório
              </Button>
              <Button size="sm" variant="outline" className="border-slate-400 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setOpenFilters(true)}>
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Filtros avançados
              </Button>
              <div className="inline-flex items-center rounded-xl border border-indigo-300 bg-indigo-50 p-1">
                <button type="button" onClick={() => setViewMode("compact")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", viewMode === "compact" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Compacto</button>
                <button type="button" onClick={() => setViewMode("detailed")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", viewMode === "detailed" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")}>Detalhado</button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {kpis.map((item) => (
              <button key={item.key} type="button" onClick={() => setKpiFilter((prev) => (prev === item.key ? null : item.key))} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", kpiFilter === item.key ? "border-blue-300 bg-blue-100 text-blue-900" : KPI_BUTTON_THEME[item.key] || "border-slate-300 bg-slate-100 text-slate-700")}>
                {item.label} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px]">{counts[item.key] || 0}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-subtle bg-card">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</span>
          <div className="flex flex-wrap items-center gap-2">
            {ORDER_OPTIONS.map((option) => {
              const isActive = sortBy.field === option.value;
              const directionSymbol = isActive ? (sortBy.direction === "asc" ? "↑" : "↓") : null;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      setSortBy((prev) => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }));
                    } else {
                      setSortBy({ field: option.value, direction: option.defaultDir });
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition",
                    "border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100",
                    isActive ? "border-indigo-600 bg-indigo-700 text-white shadow-sm hover:bg-indigo-700" : "",
                  )}
                >
                  <span>{option.label}</span>
                  {directionSymbol ? <span className="text-xs">{directionSymbol}</span> : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {viewMode === "compact" ? (
        <Card className="overflow-hidden border-subtle bg-card" data-testid="companies-grid">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/70">
                <TableRow>
                  <TableHead>
                    <SortButton label="Nome" active={sortBy.field === "nome"} direction={sortBy.direction} onClick={() => toggleSort("nome")} />
                  </TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>
                    <SortButton label="Status" active={sortBy.field === "status"} direction={sortBy.direction} onClick={() => toggleSort("status")} />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="Score"
                      active={sortBy.field === "score"}
                      direction={sortBy.direction}
                      onClick={() => toggleSort("score")}
                      dataTestId="companies-sort-score"
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton label="Risco" active={sortBy.field === "risco"} direction={sortBy.direction} onClick={() => toggleSort("risco")} />
                  </TableHead>
                  <TableHead>Status score</TableHead>
                  <TableHead>Débitos</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.empresaId ?? row.empresa?.id ?? companyDocumentValue(row.empresa)}
                    className="hover:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]"
                    data-testid="company-card"
                  >
                    <TableCell className="font-medium text-slate-900">{row.empresa?.empresa || "—"}</TableCell>
                    <TableCell>{companyDocumentValue(row.empresa) || "—"}</TableCell>
                    <TableCell>{formatMunicipioDisplay(row.empresa?.municipio) || "—"}</TableCell>
                    <TableCell><StatusBadge status={resolveCompanyStatus(row.empresa)} /></TableCell>
                    <TableCell data-testid="company-score-value">{Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}</TableCell>
                    <TableCell data-testid="company-risk-badge"><Chip variant={riskChipVariant(row.riscoConsolidado)}>{formatRiskLabel(row.riscoConsolidado)}</Chip></TableCell>
                    <TableCell data-testid="company-score-status">{formatScoreStatusLabel(row.scoreStatus, row.hasUsefulCnae)}</TableCell>
                    <TableCell><Chip variant={row.flags.debitos ? "warning" : "success"}>{row.flags.debitos ? "Possui débitos" : "Sem débitos"}</Chip></TableCell>
                    <TableCell>
                      <Chip variant={row.certificadoValido ? "success" : "danger"}>
                        {row.certificadoValido ? "SIM" : "NÃO"}
                      </Chip>
                    </TableCell>
                    <TableCell><Chip variant={row.taxaPendencias > 0 ? "warning" : "neutral"}>{row.taxaPendencias}</Chip></TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="outline" className="border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200"><EllipsisVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
                          {canManageEmpresas ? (
                            <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(row.empresa)} />
                          ) : null}
                          {row.empresa?.cnpj ? (
                            <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} />
                          ) : null}
                          <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
                          {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
                          {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
                          {row.empresa?.cnpj ? (
                            <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2" data-testid="companies-grid">
          {filteredRows.map((row) => (
            <Card key={row.empresaId ?? row.empresa?.id ?? companyDocumentValue(row.empresa)} className="border-subtle bg-card transition hover:border-strong hover:shadow-card-hover focus-within:ring-2 focus-within:ring-blue-300" data-testid="company-card">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyAvatar name={row.empresa?.empresa} seed={row.empresa?.id ?? companyDocumentValue(row.empresa)} className="h-12 w-12 rounded-2xl text-sm" />
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate">
                          <CopyableCompanyName value={row.empresa?.empresa} onCopy={handleCopy} size="base" className="text-primary" />
                        </div>
                        <StatusBadge status={resolveCompanyStatus(row.empresa)} />
                        <Chip variant={row.flags.debitos ? "warning" : "success"}>
                          {row.flags.debitos ? "Possui débitos" : "Sem débitos"}
                        </Chip>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <CopyableIdentifier label={companyDocumentLabel(row.empresa)} value={companyDocumentValue(row.empresa)} onCopy={handleCopy} />
                        <span>•</span>
                        <CopyableIdentifier label="IE" value={row.empresa?.ie} onCopy={handleCopy} />
                        <span>•</span>
                        <CopyableIdentifier label="IM" value={row.empresa?.im} onCopy={handleCopy} />
                        <span>• {formatMunicipioDisplay(row.empresa?.municipio) || "—"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <Chip>Categoria: {row.empresa?.categoria || "—"}</Chip>
                        <Chip variant={row.certificadoValido ? "success" : "danger"}>
                          Certificado: {row.certificadoValido ? "SIM" : "NÃO"}
                        </Chip>
                        {row.empresa?.responsavelFiscal ? <Chip>Resp. fiscal: {row.empresa.responsavelFiscal}</Chip> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {row.empresa?.email ? <Button size="icon" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" title="Copiar e-mail" onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)}><Mail className="h-4 w-4" /></Button> : null}
                    {row.empresa?.telefone ? <Button size="icon" variant="outline" className="border-indigo-300 bg-indigo-100 text-indigo-900 hover:bg-indigo-200" title="Copiar telefone" onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)}><Phone className="h-4 w-4" /></Button> : null}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniCounter title="Licenças" main={row.licSummary.total} sub1={`Vencendo: ${row.licSummary.vencendo}`} sub2={`Vencidas: ${row.licSummary.vencidas}`} />
                  <MiniCounter title="Processos" main={row.processos.length} sub1={`Ativos: ${row.ativos.length}`} sub2={`Encerrados: ${row.processos.length - row.ativos.length}`} />
                  <MiniCounter title="Taxas" main={row.taxaPendencias} sub1="Pendências" sub2={row.taxaPendencias > 0 ? "Atenção" : "Em dia"} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Chip data-testid="company-score-value" variant="outline">Score: {Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}</Chip>
                  <Chip data-testid="company-risk-badge" variant={riskChipVariant(row.riscoConsolidado)}>Risco: {formatRiskLabel(row.riscoConsolidado)}</Chip>
                  <Chip data-testid="company-score-status" variant="neutral">Status: {formatScoreStatusLabel(row.scoreStatus, row.hasUsefulCnae)}</Chip>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="sm" className="bg-indigo-700 text-white hover:bg-indigo-800"><Clipboard className="mr-1.5 h-3.5 w-3.5" /> Ações rápidas</Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
                      {row.empresa?.cnpj ? (
                        <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} />
                      ) : null}
                      <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
                      {row.empresa?.cnpj ? (
                        <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} data-testid="company-open-button"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir</Button>
                  {canManageEmpresas ? (
                    <Button size="sm" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={() => openEditEmpresa(row.empresa)} data-testid="company-edit-button"><PencilLine className="mr-1.5 h-3.5 w-3.5" /> Editar</Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="border-indigo-300 bg-indigo-100 text-indigo-900 hover:bg-indigo-200"><File className="mr-1.5 h-3.5 w-3.5" /> Certidões</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      {row.empresa?.cnpj ? (
                        <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar CNDs no backend" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} />
                      ) : null}
                      {row.empresa?.cnpj ? (
                      <DropdownMenuItemFancy
                        icon={File}
                        title="Abrir última CND"
                        description="Abre o arquivo mais recente disponível"
                        onClick={async () => {
                          const cnpjDigits = onlyDigits(row.empresa?.cnpj || "");
                          const cached = cndRef.current?.[cnpjDigits]?.items;
                          const items = Array.isArray(cached) && cached.length > 0 ? cached : await ensureCNDs(row.empresa?.cnpj, { force: true });
                          const first = items?.[0];
                          if (first?.url) window.open(ensureAbsoluteUrl(first.url), "_blank", "noopener,noreferrer");
                          else toast?.("Nenhuma CND encontrada para esta empresa.");
                        }}
                      />
                      ) : null}
                      {row.empresa?.cnpj ? (
                      <DropdownMenuItemFancy
                        icon={File}
                        title="Abrir última CAE"
                        description="Somente quando houver arquivo CAE"
                        onClick={async () => {
                          const cnpjDigits = onlyDigits(row.empresa?.cnpj || "");
                          const cached = cndRef.current?.[cnpjDigits]?.items;
                          const items = Array.isArray(cached) && cached.length > 0 ? cached : await ensureCNDs(row.empresa?.cnpj, { force: true });
                          const cae = (items || []).find((item) => item?.name?.startsWith("CAE - "));
                          if (cae?.url) window.open(ensureAbsoluteUrl(cae.url), "_blank", "noopener,noreferrer");
                          else toast?.("Nenhuma CAE encontrada para esta empresa.");
                        }}
                      />
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <details className="rounded-xl border border-subtle bg-slate-50/80 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Mais Detalhes</summary>
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    <p><span className="font-semibold">Responsável Fiscal:</span> {row.empresa?.responsavel_fiscal || row.empresa?.responsavelFiscal || "—"}</p>
                    {!row.isCpfCompany ? (
                      <p><span className="font-semibold">Responsável Legal:</span> {row.empresa?.proprietario_principal || row.empresa?.responsavel_legal || row.empresa?.responsavelLegal || row.empresa?.representante || "—"}</p>
                    ) : null}
                    {!row.isCpfCompany ? (
                      <p><span className="font-semibold">CPF Responsável Legal:</span> {row.empresa?.cpf || row.empresa?.cpf_responsavel_legal || row.empresa?.cpfResponsavelLegal || "—"}</p>
                    ) : null}
                    <p><span className="font-semibold">Porte:</span> {row.empresa?.porte || "—"}</p>
                    {(row.empresa?.observacoes || "").trim() ? <p><span className="font-semibold">Observação:</span> {row.empresa.observacoes}</p> : null}
                    <p>
                      <span className="font-semibold">Classificação:</span>{" "}
                      {[
                        Boolean(row.empresa?.mei ?? row.empresa?.is_mei ?? row.empresa?.isMei) ? "MEI" : null,
                        Boolean(row.empresa?.holding) ? "Holding" : null,
                        Boolean(row.empresa?.endereco_fiscal ?? row.empresa?.enderecoFiscal) ? "Endereço Fiscal" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Não"}
                    </p>
                    {(Boolean(row.empresa?.endereco_fiscal ?? row.empresa?.enderecoFiscal) || Boolean(row.empresa?.holding) || Boolean(row.empresa?.mei ?? row.empresa?.is_mei ?? row.empresa?.isMei)) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {Boolean(row.empresa?.endereco_fiscal ?? row.empresa?.enderecoFiscal) ? <Chip variant="neutral">Endereço Fiscal</Chip> : null}
                        {Boolean(row.empresa?.holding) ? <Chip variant="neutral">Holding</Chip> : null}
                        {Boolean(row.empresa?.mei ?? row.empresa?.is_mei ?? row.empresa?.isMei) ? <Chip variant="neutral">MEI</Chip> : null}
                      </div>
                    ) : null}
                    {Array.isArray(row.empresa?.cnaes_principal) && row.empresa.cnaes_principal.filter((entry) => normalizeCode(entry?.code) && normalizeCode(entry?.code) !== PLACEHOLDER_CNAE_CODE).length > 0 ? <p><span className="font-semibold">CNAE principal:</span> {row.empresa.cnaes_principal.filter((entry) => normalizeCode(entry?.code) && normalizeCode(entry?.code) !== PLACEHOLDER_CNAE_CODE).map((entry) => [entry?.code, entry?.text].filter(Boolean).join(" - ")).join(" | ")}</p> : null}
                    {Array.isArray(row.empresa?.cnaes_secundarios) && row.empresa.cnaes_secundarios.filter((entry) => normalizeCode(entry?.code) && normalizeCode(entry?.code) !== PLACEHOLDER_CNAE_CODE).length > 0 ? <p><span className="font-semibold">CNAEs secundários:</span> {row.empresa.cnaes_secundarios.filter((entry) => normalizeCode(entry?.code) && normalizeCode(entry?.code) !== PLACEHOLDER_CNAE_CODE).map((entry) => [entry?.code, entry?.text].filter(Boolean).join(" - ")).join(" | ")}</p> : null}
                  </div>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <SideDrawer
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        subtitle="Empresas"
        title="Filtros avançados da aba"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={() => { setStatusFilter("ativa"); setRiskFilter("todos"); setKpiFilter(null); }}>Limpar</Button>
            <Button type="button" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => setOpenFilters(false)}>Aplicar</Button>
          </div>
        }
      >
        <SimpleFilterRow
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "ativa", label: "Ativas" },
            { value: "inativa", label: "Inativas" },
          ]}
        />
        <SimpleFilterRow
          label="Risco CNAE"
          value={riskFilter}
          onChange={setRiskFilter}
          testIdPrefix="companies-risk-filter"
          options={[
            { value: "todos", label: "Todos" },
            { value: "HIGH", label: "Alto" },
            { value: "MEDIUM", label: "Médio" },
            { value: "LOW", label: "Baixo" },
          ]}
        />
      </SideDrawer>
      <CompanyOverviewDrawer
        open={openOverview}
        onClose={() => {
          setOpenOverview(false);
          setOverviewCompany(null);
        }}
        company={overviewCompany}
        state={overviewState}
        onEditCompany={canManageEmpresas ? openEditEmpresa : undefined}
        onCopy={handleCopy}
      />
      <ExportModal open={openExport} onClose={() => setOpenExport(false)} enqueueToast={enqueueToast} />
    </div>
  );
}

function SimpleFilterRow({ label, value, onChange, options, testIdPrefix }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined} onClick={() => onChange(option.value)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", value === option.value ? "border-indigo-600 bg-indigo-700 text-white" : "border-indigo-300 bg-indigo-100 text-indigo-900 hover:bg-indigo-200")}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

function MiniCounter({ title, main, sub1, sub2 }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface px-2.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-1 text-xl font-semibold text-slate-900">{main}</div>
      <p className="text-[11px] text-slate-600">{sub1}</p>
      <p className="text-[11px] text-slate-600">{sub2}</p>
    </div>
  );
}

function SortButton({ label, active, direction, onClick, dataTestId }) {
  return (
    <button type="button" data-testid={dataTestId} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition", active ? "border-indigo-600 bg-indigo-700 text-white" : "border-indigo-300 bg-indigo-100 text-indigo-900 hover:bg-indigo-200")} onClick={onClick}>
      {label}
      {active ? (direction === "asc" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpZA className="h-3.5 w-3.5" />) : null}
    </button>
  );
}
