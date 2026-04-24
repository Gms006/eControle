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
import CopyableIdentifier from "@/components/CopyableIdentifier";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { ArrowUpDown, Building2, ChevronDown, ChevronRight, CircleAlert, CircleCheckBig, CircleX, Clipboard, ExternalLink, File, FileSpreadsheet, FileText, Hash, LayoutGrid, Logs, Mail, MapPin, PencilLine, Phone, ShieldAlert, SlidersHorizontal, TrendingUp } from "lucide-react";
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
const ALL_RISK_FILTERS = ["high", "medium", "low", "unmapped"];
const ALL_CERT_FILTERS = ["valido", "vencendo", "vencido", "sem_certificado"];
const RISK_PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 3, UNMAPPED: 4 };
const BASE_SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "nome", label: "Empresa" },
  { value: "status", label: "Status" },
  { value: "risco", label: "Risco" },
];
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
const parseIsActiveFlag = (empresa) => {
  const raw = empresa?.is_active ?? empresa?.isActive;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["t", "true", "1", "yes", "y", "sim", "ativo", "ativa"].includes(normalized)) return true;
  if (["f", "false", "0", "no", "n", "nao", "não", "inativo", "inativa"].includes(normalized)) return false;
  return null;
};
const resolveCompanyStatus = (empresa) => {
  const byFlag = parseIsActiveFlag(empresa);
  if (byFlag === true) return "Ativa";
  if (byFlag === false) return "Inativa";
  const fromStatusEmpresa = empresa?.status_empresa ?? empresa?.statusEmpresa;
  if (fromStatusEmpresa && !isDebitoLabel(fromStatusEmpresa)) return fromStatusEmpresa;
  const fromSituacao = empresa?.situacao;
  if (fromSituacao && !isDebitoLabel(fromSituacao)) return fromSituacao;
  if (empresa?.is_active === false || empresa?.isActive === false) return "Inativa";
  return "Ativa";
};
const hasValidCertificado = (empresa, certificadoIndex) => {
  const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
  return categorizeCertificadoSituacao(situacao) === "VALIDO";
};
const critico7dias = (lics) =>
  (lics || []).some((lic) => {
    const parsed = parseDateLike(lic?.validade || lic?.validade_br);
    if (!parsed) return false;
    const days = parsed.startOf("day").diff(dayjs().startOf("day"), "day");
    return days >= 0 && days <= 7;
  });
const PLACEHOLDER_CNAE_CODE = "00.00-0-00";

const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const normalizeRisk = (value) => String(value || "").trim().toLowerCase();
const normalizeTextToken = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getUsefulCnaes = (empresa) => {
  const all = [...(Array.isArray(empresa?.cnaes_principal) ? empresa.cnaes_principal : []), ...(Array.isArray(empresa?.cnaes_secundarios) ? empresa.cnaes_secundarios : [])];
  return all.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const code = normalizeCode(entry.code);
    return Boolean(code) && code !== PLACEHOLDER_CNAE_CODE;
  });
};
const getRiskKey = (risk) => {
  const key = normalizeRisk(risk);
  if (key === "high" || key === "medium" || key === "low") return key;
  return "unmapped";
};

const formatRiskLabel = (value) => {
  const key = getRiskKey(value);
  if (key === "high") return "Alto";
  if (key === "medium") return "Médio";
  if (key === "low") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (status, hasUsefulCnae) => {
  const key = String(status || "").trim().toUpperCase();
  if (!hasUsefulCnae && (key === "NO_CNAE" || key === "UNMAPPED_CNAE")) return "Sem CNAE";
  if (key === "OK") return "OK";
  if (key === "OK_DEFINITIVE") return "OK - Definitivo";
  if (key === "DEFINITIVE_INVALIDATED") return "Definitivo invalidado";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
};

const riskChipVariant = (risk) => {
  const key = getRiskKey(risk);
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

const resolveCertBucket = (empresa, certificadoIndex) => {
  const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
  const key = normalizeTextToken(categorizeCertificadoSituacao(situacao) || situacao || empresa?.certificado);
  if (!key || key === "nao_possui") return "sem_certificado";
  if (key.includes("vencid")) return "vencido";
  if (key.includes("vence") || key.includes("alert")) return "vencendo";
  if (key.includes("valid") || key.includes("ok")) return "valido";
  return "sem_certificado";
};

const certBucketLabel = (bucket) => {
  if (bucket === "valido") return "Válido";
  if (bucket === "vencendo") return "Vencendo";
  if (bucket === "vencido") return "Vencido";
  return "Sem certificado";
};

const certBucketChipVariant = (bucket) => {
  if (bucket === "valido") return "success";
  if (bucket === "vencendo") return "warning";
  if (bucket === "vencido") return "danger";
  return "neutral";
};
const CertificadoIcon = ({ bucket }) => {
  if (bucket === "valido") return <CircleCheckBig className="h-4 w-4 text-emerald-600" title="Válido" aria-label="Válido" />;
  if (bucket === "vencendo") return <CircleAlert className="h-4 w-4 text-orange-500" title="Vencendo" aria-label="Vencendo" />;
  return <CircleX className="h-4 w-4 text-rose-600" title="Sem certificado" aria-label="Sem certificado" />;
};

const isCompanyActive = (empresa) => {
  const byFlag = parseIsActiveFlag(empresa);
  if (byFlag !== null) return byFlag;
  const statusKey = getStatusKey(resolveCompanyStatus(empresa) || "");
  return statusKey.includes("ativ") && !statusKey.includes("inativ");
};
const formatDocumentMasked = (value) => {
  const digits = onlyDigits(value || "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value || "—";
};
const resolveCompanyLegalName = (empresa) => String(empresa?.razao_social || empresa?.empresa || "—").trim() || "—";
const resolveCompanyTradeName = (empresa) => {
  const legal = resolveCompanyLegalName(empresa);
  const trade = String(empresa?.nome_fantasia || empresa?.empresa || "").trim();
  return trade && trade !== legal ? trade : "";
};
const statusChipClass = (isActive) => {
  if (!isActive) return "rounded-md border-blue-300 bg-blue-100 text-blue-900";
  return "rounded-md border-emerald-300 bg-emerald-100 text-emerald-900";
};
const valueChipClass = "rounded-md border";

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
  const [openRailMobile, setOpenRailMobile] = React.useState(false);
  const [openExport, setOpenExport] = React.useState(false);
  const [kpiFilter, setKpiFilter] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ativas");
  const [riskFilters, setRiskFilters] = React.useState([...ALL_RISK_FILTERS]);
  const [certFilters, setCertFilters] = React.useState([...ALL_CERT_FILTERS]);
  const [municipioFilters, setMunicípioFilters] = React.useState([]);
  const [urgencyMin, setUrgencyMin] = React.useState(0);
  const [urgencyMax, setUrgencyMax] = React.useState(100);
  const [porteFilters, setPorteFilters] = React.useState([]);
  const [responsavelFilters, setResponsavelFilters] = React.useState([]);
  const [sortBy, setSortBy] = React.useState({ field: "nome", direction: "asc" });
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

  const rows = React.useMemo(() => {
    const result = filteredEmpresas.map((empresa, index) => {
    const empresaId = resolveEmpresaIdValue(empresa, extractEmpresaId);
    const document = companyDocumentValue(empresa);
    const documentDigits = companyDocumentDigits(empresa);
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
    const certificadoVálido = hasValidCertificado(empresa, certificadoIndex);
    const usefulCnaes = getUsefulCnaes(empresa);
    const riscoConsolidado = getRiskKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado);
    const scoreUrgenciaRaw = empresa?.score_urgencia ?? empresa?.scoreUrgencia;
    const scoreUrgencia = Number.isFinite(Number(scoreUrgenciaRaw)) ? Math.max(0, Math.min(100, Number(scoreUrgenciaRaw))): null;
    const scoreStatus = String(empresa?.score_status ?? empresa?.scoreStatus ?? "").trim().toUpperCase() || null;
    const isCpfCompany = Boolean(empresa?.company_cpf) && !Boolean(empresa?.cnpj);
    const rowKey = [
      String(empresaId ?? "").trim() || "sem_id",
      documentDigits || "sem_doc",
      String(empresa?.razao_social ?? empresa?.empresa ?? empresa?.nome_fantasia ?? "").trim().toLowerCase() || "sem_nome",
      String(index),
    ].join("::");
    return {
      rowKey,
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
      certificadoVálido,
      certBucket: resolveCertBucket(empresa, certificadoIndex),
      municipioNormalized: formatMunicipioDisplay(empresa?.municipio) || "-",
      porte: String(empresa?.porte || "").trim() || "-",
      responsavelFiscal: String(empresa?.responsavel_fiscal ?? empresa?.responsavelFiscal ?? "").trim(),
      flags: {
        debitos: hasDebito(taxa),
        semCertificado: !certificadoVálido,
        taxasPendentes: taxaPendencias > 0,
        licencasVencendo: licSummary.vencendo > 0 || licSummary.vencidas > 0,
        processosAndamento: ativos.length > 0,
        criticos7dias: critico7dias(lics),
      },
    };
    });
    return result;
  }, [certificadoIndex, extractEmpresaId, filteredEmpresas, licencasByEmpresa, processosByEmpresa, taxasByEmpresa]);
  const kpis = [
    { key: "debitos", label: "Com débitos" },
    { key: "semCertificado", label: "Sem certificado" },
    { key: "taxasPendentes", label: "Taxas pendentes" },
    { key: "licencasVencendo", label: "Licenças vencendo" },
    { key: "processosAndamento", label: "Processos em andamento" },
    { key: "criticos7dias", label: "Críticos (<=7 dias)" },
  ];
  const counts = Object.fromEntries(kpis.map((item) => [item.key, rows.filter((row) => row.flags[item.key]).length]));
  const kpiCards = React.useMemo(() => {
    const activeCompanies = rows.filter((row) => isCompanyActive(row.empresa)).length;
    const highRisk = rows.filter((row) => row.riscoConsolidado === "HIGH").length;
    const scoreRows = rows.filter((row) => Number.isFinite(row.scoreUrgencia));
    const avgScore = scoreRows.length > 0 ? Math.round(scoreRows.reduce((acc, row) => acc + Number(row.scoreUrgencia || 0), 0) / scoreRows.length) : null;
    return [
      {
        key: "total",
        label: "Total de empresas",
        value: rows.length,
        subtitle: `${rows.length} no recorte atual`,
        icon: Building2,
      },
      {
        key: "ativas",
        label: "Empresas ativas",
        value: activeCompanies,
        subtitle: `${rows.length - activeCompanies} inativas`,
        icon: TrendingUp,
      },
      {
        key: "riscoAlto",
        label: "Risco alto",
        value: highRisk,
        subtitle: `${rows.length ? Math.round((highRisk / rows.length) * 100) : 0}% da base`,
        icon: ShieldAlert,
      },
      {
        key: "score",
        label: "Score médio",
        value: avgScore ?? "—",
        subtitle: scoreRows.length > 0 ? `${scoreRows.length} empresas com score` : "Sem score calculado",
        icon: TrendingUp,
      },
    ];
  }, [rows]);

  const municipioOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.municipioNormalized).filter((item) => item && item !== "-"))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const porteOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.porte).filter((item) => item && item !== "-"))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const responsavelOptions = React.useMemo(
    () => Array.from(new Set(rows.map((row) => row.responsavelFiscal).filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, 12),
    [rows],
  );
  const sortOptions = React.useMemo(() => {
    const options = [...BASE_SORT_OPTIONS];
    if (municipioOptions.length > 1) options.push({ value: "municipio", label: "Município" });
    if (porteOptions.length > 1) options.push({ value: "porte", label: "Porte" });
    return options;
  }, [municipioOptions.length, porteOptions.length]);

  const filteredRows = React.useMemo(() => {
    const list = rows.filter((row) => {
      if (kpiFilter && !row.flags[kpiFilter]) return false;
      const active = isCompanyActive(row.empresa);
      if (statusFilter === "ativas" && !active) return false;
      if (statusFilter === "inativas" && active) return false;
      if (!riskFilters.includes(row.riscoConsolidado)) return false;
      if (!certFilters.includes(row.certBucket)) return false;
      if (municipioFilters.length > 0 && !municipioFilters.includes(row.municipioNormalized)) return false;
      if (porteFilters.length > 0 && !porteFilters.includes(row.porte)) return false;
      if (responsavelFilters.length > 0 && !responsavelFilters.includes(row.responsavelFiscal)) return false;
      if (Number.isFinite(row.scoreUrgencia) && (row.scoreUrgencia < urgencyMin || row.scoreUrgencia > urgencyMax)) return false;
      return true;
    });
    const compareByField = (field, a, b) => {
      if (field === "score") return compareNullableScore(a.scoreUrgencia, b.scoreUrgencia, sortBy.direction);
      if (field === "risco") {
        const av = RISK_PRIORITY[a.riscoConsolidado] || 0;
        const bv = RISK_PRIORITY[b.riscoConsolidado] || 0;
        return (av - bv) * (sortBy.direction === "asc" ? 1 : -1);
      }
      if (field === "status") {
        const av = getStatusKey(resolveCompanyStatus(a.empresa) || "");
        const bv = getStatusKey(resolveCompanyStatus(b.empresa) || "");
        return av.localeCompare(bv) * (sortBy.direction === "asc" ? 1 : -1);
      }
      if (field === "municipio") return String(a.municipioNormalized).localeCompare(String(b.municipioNormalized)) * (sortBy.direction === "asc" ? 1 : -1);
      if (field === "porte") return String(a.porte).localeCompare(String(b.porte)) * (sortBy.direction === "asc" ? 1 : -1);
      return String(a.empresa?.empresa || "").toLowerCase().localeCompare(String(b.empresa?.empresa || "").toLowerCase()) * (sortBy.direction === "asc" ? 1 : -1);
    };
    list.sort((a, b) => {
      return compareByField(sortBy.field, a, b);
    });
    return list;
  }, [certFilters, kpiFilter, municipioFilters, porteFilters, responsavelFilters, riskFilters, rows, sortBy.direction, sortBy.field, statusFilter, urgencyMax, urgencyMin]);

  const toggleMultiFilter = (setter, value) => {
    setter((prev) => {
      const exists = prev.includes(value);
      return exists ? prev.filter((entry) => entry !== value) : [...prev, value];
    });
  };
  const handleRiskFilterClick = (value) => {
    setRiskFilters((prev) => {
      if (prev.length > 1) return [value];
      if (prev[0] === value) return [...ALL_RISK_FILTERS];
      return [value];
    });
  };
  const setSortField = (field) => setSortBy((prev) => (prev.field === field ? { field, direction: prev.direction === "asc" ? "desc" : "asc" } : { field, direction: field === "score" ? "desc" : "asc" }));
  const toggleSortDirection = () => setSortBy((prev) => ({ ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }));
  const handleScoreSortQuickToggle = () => {
    setSortBy((prev) => {
      if (prev.field === "score") return { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { field: "score", direction: "desc" };
    });
  };
  const clearRailFilters = React.useCallback(() => {
    setStatusFilter("ativas");
    setRiskFilters([...ALL_RISK_FILTERS]);
    setCertFilters([...ALL_CERT_FILTERS]);
    setMunicípioFilters([]);
    setUrgencyMin(0);
    setUrgencyMax(100);
    setPorteFilters([]);
    setResponsavelFilters([]);
    setKpiFilter(null);
  }, []);

  const activeFilterBadges = React.useMemo(() => {
    const list = [];
    if (statusFilter !== "ativas") list.push({ key: "status", label: `Status: ${statusFilter}` });
    if (riskFilters.length !== ALL_RISK_FILTERS.length) list.push({ key: "risco", label: `Risco: ${riskFilters.length}` });
    if (certFilters.length !== ALL_CERT_FILTERS.length) list.push({ key: "cert", label: `Certificado: ${certFilters.length}` });
    if (municipioFilters.length > 0) list.push({ key: "municipio", label: `Município: ${municipioFilters.length}` });
    if (porteFilters.length > 0) list.push({ key: "porte", label: `Porte: ${porteFilters.length}` });
    if (responsavelFilters.length > 0) list.push({ key: "responsavel", label: `Responsável fiscal: ${responsavelFilters.length}` });
    if (urgencyMin > 0 || urgencyMax < 100) list.push({ key: "score", label: `Score: ${urgencyMin}-${urgencyMax}` });
    if (kpiFilter) list.push({ key: "kpi", label: `KPI: ${kpiFilter}` });
    return list;
  }, [certFilters.length, kpiFilter, municipioFilters.length, porteFilters.length, responsavelFilters.length, riskFilters.length, statusFilter, urgencyMax, urgencyMin]);

  const rail = (
    <EmpresasRail
      rowsCount={filteredRows.length}
      statusFilter={statusFilter}
      setStatusFilter={setStatusFilter}
      riskFilters={riskFilters}
      setRiskFilters={setRiskFilters}
      certFilters={certFilters}
      setCertFilters={setCertFilters}
      municipioFilters={municipioFilters}
      setMunicípioFilters={setMunicípioFilters}
      municipioOptions={municipioOptions}
      urgencyMin={urgencyMin}
      urgencyMax={urgencyMax}
      setUrgencyMin={setUrgencyMin}
      setUrgencyMax={setUrgencyMax}
      porteFilters={porteFilters}
      setPorteFilters={setPorteFilters}
      porteOptions={porteOptions}
      responsavelFilters={responsavelFilters}
      setResponsavelFilters={setResponsavelFilters}
      responsavelOptions={responsavelOptions}
      clearRailFilters={clearRailFilters}
      toggleMultiFilter={toggleMultiFilter}
      onRiskFilterClick={handleRiskFilterClick}
      activeCount={activeFilterBadges.length}
      kpis={kpis}
      counts={counts}
      kpiFilter={kpiFilter}
      setKpiFilter={setKpiFilter}
      includeRiskTestIds={false}
    />
  );

  return (
    <div className="space-y-4" data-testid="companies-summary">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden xl:block">{rail}</div>
        <section className="space-y-3">
          <Card className="border-subtle bg-surface">
            <CardContent className="p-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {kpiCards.map((card) => {
                  const Icon = card.icon;
                  const iconTone =
                    card.key === "ativas"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : card.key === "riscoAlto"
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : card.key === "score"
                          ? "border-amber-200 bg-amber-50 text-amber-600"
                          : "border-blue-200 bg-blue-50 text-blue-600";
                  const subtitleTone =
                    card.key === "riscoAlto"
                      ? "text-amber-600"
                      : "text-slate-500";
                  return (
                    <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                          <p className="mt-2 text-2xl font-semibold leading-none">{card.value}</p>
                          <p className={cn("mt-2 text-xs", subtitleTone)}>{card.subtitle}</p>
                        </div>
                        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl border", iconTone)}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-muted">{filteredRows.length} de {empresas.length} empresas exibidas</span>
                {soAlertas ? <Chip variant="warning">Modo alertas ativo</Chip> : null}
              </div>
              {activeFilterBadges.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeFilterBadges.map((badge) => (
                    <span key={badge.key} className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-subtle bg-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                      <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                      {sortOptions.find((item) => item.value === sortBy.field)?.label || "Nome fantasia"}
                      <span className="ml-1 text-xs text-blue-700">{sortBy.direction === "asc" ? "↑" : "↓"}</span>
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 p-2">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</p>
                    <div className="space-y-1">
                      {sortOptions.map((option) => {
                        const isActive = sortBy.field === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSortField(option.value)}
                            className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm", isActive ? "bg-slate-100 text-blue-700" : "text-slate-700 hover:bg-slate-50")}
                          >
                            <span>{option.label}</span>
                            <span className="text-xs text-slate-500">{isActive ? (sortBy.direction === "asc" ? "A-Z / Menor" : "Z-A / Maior") : ""}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 border-t border-slate-200 pt-2">
                      <Button size="sm" variant="outline" className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={toggleSortDirection}>
                        Direção: {sortBy.direction === "asc" ? "Crescente" : "Decrescente"}
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  data-testid="companies-sort-score"
                  onClick={handleScoreSortQuickToggle}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Score {sortBy.field === "score" ? (sortBy.direction === "asc" ? "↑" : "↓") : ""}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setOpenRailMobile(true)}>
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Filtros avançados
                </Button>
                <Button size="sm" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={() => setOpenExport(true)}>
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Exportar relatório
                </Button>
                <div className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 p-1">
                  <button type="button" onClick={() => setViewMode("compact")} className={cn("rounded-md p-2 transition", viewMode === "compact" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")} title="Modo lista"><Logs className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setViewMode("detailed")} className={cn("rounded-md p-2 transition", viewMode === "detailed" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")} title="Modo cards"><LayoutGrid className="h-4 w-4" /></button>
                </div>
              </div>
            </CardContent>
          </Card>

          {viewMode === "compact" ? (
            <Card className="overflow-hidden border-subtle bg-card" data-testid="companies-grid">
              <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 text-center backdrop-blur">Empresa</TableHead>
                      <TableHead className="sticky top-0 z-10 w-[180px] whitespace-nowrap bg-slate-100/95 backdrop-blur">Documento</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Município</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Porte</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Status</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Risco</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Score</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Certificado</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Pendências</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-slate-100/95 text-right backdrop-blur">Ações</TableHead>
                      <TableHead className="sticky top-0 z-10 w-10 bg-slate-100/95 text-right backdrop-blur">Abrir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.rowKey} className="hover:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]" data-testid="company-card">
                        <TableCell className="min-w-[290px] text-left align-top">
                          <div className="space-y-1 text-left">
                            <CopyableCompanyName value={resolveCompanyLegalName(row.empresa)} onCopy={handleCopy} size="sm" className="w-full justify-start text-left text-primary" />
                            {resolveCompanyTradeName(row.empresa) ? <p className="text-xs text-slate-400">{resolveCompanyTradeName(row.empresa)}</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="w-[180px] whitespace-nowrap">
                          <CopyOnlyValue value={companyDocumentValue(row.empresa)} onCopy={handleCopy} />
                        </TableCell>
                        <TableCell><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{row.municipioNormalized}</span></TableCell>
                        <TableCell>{row.porte || "-"}</TableCell>
                        <TableCell>
                          <Chip className={statusChipClass(isCompanyActive(row.empresa))}>
                            {isCompanyActive(row.empresa) ? "Ativa" : "Inativa"}
                          </Chip>
                        </TableCell>
                        <TableCell data-testid="company-risk-badge"><Chip className={valueChipClass} variant={riskChipVariant(row.riscoConsolidado)}>{formatRiskLabel(row.riscoConsolidado)}</Chip></TableCell>
                        <TableCell data-testid="company-score-value">
                          <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-sm font-semibold text-white">
                            {Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}
                          </div>
                          <div data-testid="company-score-status" className="mt-1 text-[11px] text-slate-500">{formatScoreStatusLabel(row.scoreStatus, row.hasUsefulCnae)}</div>
                        </TableCell>
                        <TableCell><span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1"><CertificadoIcon bucket={row.certBucket} /></span></TableCell>
                        <TableCell><Chip className={valueChipClass} variant={row.taxaPendencias > 0 ? "warning" : "neutral"}>{row.taxaPendencias}</Chip></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                                Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
                              {canManageEmpresas ? <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(row.empresa)} /> : null}
                              {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} /> : null}
                              <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
                              {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
                              {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
                              {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} /> : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} data-testid="company-open-button" title="Abrir central">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="companies-grid">
              {filteredRows.map((row) => (
                <Card
                  key={row.rowKey}
                  className="overflow-hidden border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-card-hover"
                  data-testid="company-card"
                >
                  <CardContent
                    className="space-y-3 p-4"
                    role="button"
                    tabIndex={0}
                    onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openOverviewEmpresa(row.empresa, row.empresaId);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <CompanyAvatar name={resolveCompanyLegalName(row.empresa)} seed={row.empresa?.id ?? companyDocumentValue(row.empresa)} className="h-10 w-10 rounded-xl text-sm" />
                        <div className="min-w-0">
                          <div
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <CopyableCompanyName value={resolveCompanyLegalName(row.empresa)} onCopy={handleCopy} size="base" className="w-full justify-start text-left text-primary" />
                          </div>
                          <p className="truncate text-xs text-slate-400">{resolveCompanyTradeName(row.empresa) || resolveCompanyLegalName(row.empresa)}</p>
                        </div>
                      </div>
                      <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-sm font-semibold text-white" data-testid="company-score-value">
                        {Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <InfoTile title="CNPJ" icon={FileText} value={<CopyOnlyValue value={companyDocumentValue(row.empresa)} onCopy={handleCopy} />} />
                      <InfoTile title="Município" icon={MapPin} value={row.municipioNormalized} />
                      <InfoTile title="Inscrição Estadual" icon={Hash} value={<CopyInlineValue value={row.empresa?.ie} onCopy={handleCopy} />} />
                      <InfoTile title="Inscrição Municipal" icon={Hash} value={<CopyInlineValue value={row.empresa?.im} onCopy={handleCopy} />} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      {row.empresa?.telefone ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                          title="Copiar telefone"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`);
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {row.empresa.telefone}
                        </button>
                      ) : null}
                      {row.empresa?.email ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-slate-900"
                          title="Copiar e-mail"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`);
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {row.empresa.email}
                        </button>
                      ) : null}
                      {canManageEmpresas ? (
                        <Button
                          size="icon"
                          variant="outline"
                          className="ml-auto h-7 w-7 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          title="Editar empresa"
                          data-testid="company-edit-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditEmpresa(row.empresa);
                          }}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-md border-slate-800 bg-slate-900 px-2.5 text-xs text-white hover:bg-slate-800"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Ações
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
                          {canManageEmpresas ? <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(row.empresa)} /> : null}
                          {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} /> : null}
                          <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
                          {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
                          {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
                          {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} /> : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="flex items-center gap-2">
                        <Chip data-testid="company-risk-badge" className={valueChipClass} variant={riskChipVariant(row.riscoConsolidado)}>
                          Risco {formatRiskLabel(row.riscoConsolidado)}
                        </Chip>
                        <Chip className={statusChipClass(isCompanyActive(row.empresa))}>
                          {isCompanyActive(row.empresa) ? "Ativa" : "Inativa"}
                        </Chip>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          data-testid="company-open-button"
                          title="Abrir central"
                          onClick={(event) => {
                            event.stopPropagation();
                            openOverviewEmpresa(row.empresa, row.empresaId);
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <SideDrawer open={openRailMobile} onClose={() => setOpenRailMobile(false)} subtitle="Empresas" title="Rail de filtros" footer={<div className="flex justify-end gap-2"><Button type="button" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={clearRailFilters}>Limpar</Button><Button type="button" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => setOpenRailMobile(false)}>Aplicar</Button></div>}>
        <EmpresasRail
          rowsCount={filteredRows.length}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          riskFilters={riskFilters}
          setRiskFilters={setRiskFilters}
          certFilters={certFilters}
          setCertFilters={setCertFilters}
          municipioFilters={municipioFilters}
          setMunicípioFilters={setMunicípioFilters}
          municipioOptions={municipioOptions}
          urgencyMin={urgencyMin}
          urgencyMax={urgencyMax}
          setUrgencyMin={setUrgencyMin}
          setUrgencyMax={setUrgencyMax}
          porteFilters={porteFilters}
          setPorteFilters={setPorteFilters}
          porteOptions={porteOptions}
          responsavelFilters={responsavelFilters}
          setResponsavelFilters={setResponsavelFilters}
          responsavelOptions={responsavelOptions}
          clearRailFilters={clearRailFilters}
          toggleMultiFilter={toggleMultiFilter}
          onRiskFilterClick={handleRiskFilterClick}
          activeCount={activeFilterBadges.length}
          kpis={kpis}
          counts={counts}
          kpiFilter={kpiFilter}
          setKpiFilter={setKpiFilter}
          includeRiskTestIds
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
function EmpresasRail({
  rowsCount,
  statusFilter,
  setStatusFilter,
  riskFilters,
  setRiskFilters,
  certFilters,
  setCertFilters,
  municipioFilters,
  setMunicípioFilters,
  municipioOptions,
  urgencyMin,
  urgencyMax,
  setUrgencyMin,
  setUrgencyMax,
  porteFilters,
  setPorteFilters,
  porteOptions,
  responsavelFilters,
  setResponsavelFilters,
  responsavelOptions,
  clearRailFilters,
  toggleMultiFilter,
  onRiskFilterClick,
  activeCount,
  kpis,
  counts,
  kpiFilter,
  setKpiFilter,
  includeRiskTestIds = false,
}) {
  const chipClass = (active) =>
    cn(
      "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
      active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white",
    );

  return (
    <aside className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
          <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
          <p className="text-xs text-slate-500">Empresas no recorte: {rowsCount}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
          <div className="text-sm font-semibold leading-4 text-blue-700">{activeCount}</div>
          <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{activeCount === 1 ? "ativo" : "ativos"}</div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Filtros rápidos</p>
        <div className="flex flex-wrap gap-2">
          {kpis.map((item) => {
            const active = kpiFilter === item.key;
            return (
              <button key={item.key} type="button" onClick={() => setKpiFilter((prev) => (prev === item.key ? null : item.key))} className={chipClass(active)}>
                {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{counts[item.key] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Status da empresa</p>
        <div className="flex flex-wrap gap-2">
          {["ativas", "inativas", "todas"].map((value) => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)} className={chipClass(statusFilter === value)}>
              {value === "ativas" ? "Ativas" : value === "inativas" ? "Inativas" : "Todas"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Risco CNAE</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid={includeRiskTestIds ? "companies-risk-filter-todos" : undefined}
            onClick={() => setRiskFilters([...ALL_RISK_FILTERS])}
            className={chipClass(riskFilters.length === ALL_RISK_FILTERS.length)}
          >
            Todos
          </button>
          {[{ key: "HIGH", label: "Alto" }, { key: "MEDIUM", label: "Médio" }, { key: "LOW", label: "Baixo" }, { key: "UNMAPPED", label: "Sem mapeamento" }].map((option) => {
            const active = riskFilters.includes(option.key);
            return <button key={option.key} type="button" data-testid={includeRiskTestIds ? `companies-risk-filter-${option.key}` : undefined} onClick={() => onRiskFilterClick(option.key)} className={chipClass(active)}>{option.label}</button>;
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Certificado</p>
        <div className="flex flex-wrap gap-2">
          {[{ key: "valido", label: "Válido" }, { key: "vencendo", label: "Vencendo" }, { key: "vencido", label: "Vencido" }, { key: "sem_certificado", label: "Sem certificado" }].map((option) => {
            const active = certFilters.includes(option.key);
            return <button key={option.key} type="button" onClick={() => toggleMultiFilter(setCertFilters, option.key)} className={chipClass(active)}>{option.label}</button>;
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Município</p>
        {municipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
        <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
          {municipioOptions.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white"><input type="checkbox" checked={municipioFilters.includes(item)} onChange={() => toggleMultiFilter(setMunicípioFilters, item)} /><span>{item}</span></label>)}
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
        <div className="relative h-6">
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
          <div
            className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300"
            style={{ left: `${urgencyMin}%`, width: `${Math.max(0, urgencyMax - urgencyMin)}%` }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={urgencyMin}
            onChange={(event) => setUrgencyMin(Math.min(Number(event.target.value), urgencyMax))}
            className="ec-urgency-range"
            aria-label="Score de urgência mínimo"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={urgencyMax}
            onChange={(event) => setUrgencyMax(Math.max(Number(event.target.value), urgencyMin))}
            className="ec-urgency-range"
            aria-label="Score de urgência máximo"
          />
        </div>
        <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{urgencyMin}</span><span>{urgencyMax}</span></div>
      </div>

      {porteOptions.length > 0 ? <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Porte</p><div className="flex flex-wrap gap-2">{porteOptions.map((item) => <button key={item} type="button" onClick={() => toggleMultiFilter(setPorteFilters, item)} className={chipClass(porteFilters.includes(item))}>{item}</button>)}</div></div> : null}
      {responsavelOptions.length > 0 ? <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Responsável fiscal</p><div className="max-h-40 space-y-1 overflow-y-auto pr-1">{responsavelOptions.map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white"><input type="checkbox" checked={responsavelFilters.includes(item)} onChange={() => toggleMultiFilter(setResponsavelFilters, item)} /><span className="truncate">{item}</span></label>)}</div></div> : null}

      <div className="flex justify-end gap-2 pt-1"><Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearRailFilters}>Limpar</Button></div>
    </aside>
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

function InfoTile({ title, value, icon: Icon }) {
  return (
    <div className="rounded-lg bg-slate-100/80 p-2.5">
      <p className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{title}</span>
      </p>
      <div className="mt-1 text-sm font-medium text-slate-800">{value || "-"}</div>
    </div>
  );
}

function CopyInlineValue({ value, onCopy }) {
  const text = String(value || "").trim();
  if (!text) return <span>-</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onCopy?.(text, `${text} copiado`);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center text-sm font-medium text-slate-800 transition hover:text-slate-900"
      title="Copiar valor"
    >
      {text}
    </button>
  );
}

function CopyOnlyValue({ value, onCopy }) {
  const text = String(value || "").trim();
  const formatted = formatDocumentMasked(text);
  const digits = onlyDigits(text);
  const isDocument = digits.length === 11 || digits.length === 14;
  if (!text) return <span className="text-xs text-slate-500">—</span>;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        const isCtrlClick = event.ctrlKey || event.metaKey;
        if (isDocument && isCtrlClick) {
          onCopy?.(digits, `${digits} copiado (sem máscara)`);
          return;
        }
        const toCopy = isDocument ? formatted : text;
        onCopy?.(toCopy, `${toCopy} copiado`);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center whitespace-nowrap px-0 py-0 text-xs font-medium text-slate-700 transition hover:text-slate-900"
      title={isDocument ? "Copiar valor (Ctrl+clique sem máscara)" : "Copiar valor"}
    >
      {formatted}
    </button>
  );
}
