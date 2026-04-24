import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SideDrawer } from "@/components/ui/side-drawer";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import { Chip } from "@/components/Chip";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Clipboard,
  Clock,
  FileText,
  LayoutGrid,
  LayoutDashboard,
  List,
  MapPin,
  MoveRight,
  PanelRightClose,
  PencilLine,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatProcessDate, getDiversosOperacaoLabel, getProcessBaseType, normalizeProcessType } from "@/lib/process";
import { formatCanonicalLabel, normalizeIdentifier, normalizeText, removeDiacritics } from "@/lib/text";
import { maskCNPJ } from "@/lib/format";
import { formatStatusDisplay, isProcessStatusActiveOrPending, resolveStatusClass, getStatusKey } from "@/lib/status";
import { fetchJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatMunicipioDisplay } from "@/lib/normalization";
import { buildCertificadoIndex, categorizeCertificadoSituacao, resolveEmpresaCertificadoSituacao } from "@/lib/certificados";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { getPriorityTypeFields, getTypeFields } from "@/lib/processTypeFields";
import { getProcessUrgency, URGENCY_BUCKETS } from "@/lib/processUrgency";

const PROCESS_SUBNAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Clipboard },
  { key: "licencas", label: "Licenças", icon: ScrollText },
  { key: "taxas", label: "Taxas", icon: FileText },
  { key: "processos", label: "Processos", icon: Settings },
  { key: "certificados", label: "Certificados", icon: ShieldCheck },
];

const RISK_OPTIONS = [
  { key: "high", label: "Alto" },
  { key: "medium", label: "Médio" },
  { key: "low", label: "Baixo" },
  { key: "unmapped", label: "Sem mapeamento" },
];

const CERT_OPTIONS = [
  { key: "vencendo", label: "Vencendo" },
  { key: "vencido", label: "Vencido" },
  { key: "valido", label: "Válido" },
  { key: "sem_certificado", label: "Sem certificado" },
];

const PROCESS_TYPE_DISPLAY = {
  BOMBEIROS: "CERCON",
  FUNCIONAMENTO: "Funcionamento",
  DIVERSOS: "Diversos",
  USO_DO_SOLO: "Uso do Solo",
  SANITARIO: "Sanitário",
  ALVARA_SANITARIO: "Alvará Sanitário",
};

const PROCESS_TYPE_ICON = {
  BOMBEIROS: Settings,
  FUNCIONAMENTO: Settings,
  DIVERSOS: Settings,
  USO_DO_SOLO: MapPin,
  SANITARIO: Settings,
  ALVARA_SANITARIO: Settings,
};

const TABLE_COLUMNS = [
  { id: "tipoDisplay", label: "Tipo" },
  { id: "empresa", label: "Empresa" },
  { id: "protocolo", label: "Protocolo" },
  { id: "data_solicitacao", label: "Data solicitação", isDate: true },
  { id: "municipio", label: "Município" },
  { id: "situacao", label: "Situação", isStatus: true },
  { id: "detalhes", label: "Detalhes" },
  { id: "obs", label: "OBS" },
];

const SORT_OPTIONS = [
  { value: "urgencyScore", label: "Urgência", defaultDir: "desc", isNumber: true },
  { value: "data_solicitacao", label: "Data solicitação", defaultDir: "desc", isDate: true },
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "situacao", label: "Situação", defaultDir: "asc" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];
const SECONDARY_SORT = SORT_OPTIONS[1];

const normalizeTipoKey = (tipoBase) =>
  removeDiacritics(normalizeText(tipoBase ?? ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");

const normalizeKey = (value) =>
  removeDiacritics(String(value ?? "").toLowerCase()).replace(/\s+/g, "_").trim();

const parseCompanyIsActive = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === "string") {
    const normalized = normalizeKey(value);
    if (["true", "1", "ativo", "ativa"].includes(normalized)) return true;
    if (["false", "0", "inativo", "inativa"].includes(normalized)) return false;
  }
  return null;
};

const getCompanyStatusKey = (empresa) => {
  const isActive = parseCompanyIsActive(
    empresa?.is_active ??
      empresa?.isActive ??
      empresa?.status_empresas ??
      empresa?.statusEmpresa ??
      empresa?.status_empresa ??
      empresa?.status,
  );
  if (isActive === true) return "Ativas";
  if (isActive === false) return "Inativas";
  return "Todas";
};

const getCompanyRiskKey = (empresa) => {
  const key = normalizeKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado ?? empresa?.score_status ?? empresa?.scoreStatus);
  if (key.includes("high") || key.includes("alto")) return "high";
  if (key.includes("medium") || key.includes("medio")) return "medium";
  if (key.includes("low") || key.includes("baixo")) return "low";
  return "unmapped";
};

const getCertBucketKey = (situacao) => {
  const category = categorizeCertificadoSituacao(situacao);
  if (category.includes("VÁLIDO")) return "valido";
  if (category.includes("VENCE DENTRO")) return "vencendo";
  if (category.includes("VENCIDO")) return "vencido";
  return "sem_certificado";
};

const extractDateValue = (value) => {
  const normalized = normalizeText(value).trim();
  if (!normalized) return null;
  const parsed = dayjs(normalized, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (parsed.isValid()) return parsed.valueOf();
  const fallback = dayjs(normalized);
  return fallback.isValid() ? fallback.valueOf() : null;
};

const compareProcessos = (a, b, field, direction, meta = {}) => {
  const dir = direction === "desc" ? -1 : 1;
  if (meta.isDate) {
    const aValue = extractDateValue(a?.[field]);
    const bValue = extractDateValue(b?.[field]);
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return (aValue - bValue) * dir;
  }
  if (meta.isNumber) {
    const aValue = Number(a?.[field] ?? 0);
    const bValue = Number(b?.[field] ?? 0);
    return (aValue - bValue) * dir;
  }
  const aText = normalizeText(a?.[field] ?? "").trim();
  const bText = normalizeText(b?.[field] ?? "").trim();
  if (!aText && !bText) return 0;
  if (!aText) return 1;
  if (!bText) return -1;
  return aText.localeCompare(bText, "pt-BR", { sensitivity: "base" }) * dir;
};

const formatDateTime = (value) => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "—";
  return parsed.format("DD/MM/YYYY HH:mm");
};

const resolveProcessId = (proc) =>
  normalizeText(proc?.id ?? proc?.process_id ?? proc?.processId ?? proc?.processo_id).trim();

const formatMunicipio = (proc) => formatMunicipioDisplay(proc?.municipio_exibicao || proc?.municipio);

const getTipoDisplay = (tipoBase) => {
  const key = normalizeTipoKey(tipoBase);
  return PROCESS_TYPE_DISPLAY[key] ?? tipoBase ?? "Processo";
};

const resolveTipoFromProcess = (proc) => {
  const tipoNormalizado = normalizeProcessType(proc);
  const tipoBase = getProcessBaseType(tipoNormalizado);
  return { tipoBase, tipoKey: normalizeTipoKey(tipoBase), tipoDisplay: getTipoDisplay(tipoBase) };
};

const getProcessKey = (proc, index) => {
  const tipoKey = proc?.tipoKey || normalizeTipoKey(proc?.tipo);
  const parts = [proc?.id, proc?.protocolo, proc?.cnpj, proc?.empresa]
    .map((value) => normalizeText(value).trim())
    .filter(Boolean);
  const suffix = parts.length > 0 ? parts.join("-") : String(index);
  return [tipoKey, suffix].filter(Boolean).join("-");
};

const EXCLUDED_URGENT_STATUS_KEYWORDS = [
  "concluido",
  "licenciado",
  "indeferido",
  "cancelado",
];
const isUrgentByStatus = (proc) => {
  const statusKey = removeDiacritics(
    normalizeText(proc?.situacao || proc?.status || "").toLowerCase(),
  ).trim();
  if (!statusKey) return true;
  return !EXCLUDED_URGENT_STATUS_KEYWORDS.some((keyword) => statusKey.includes(keyword));
};

const renderStatus = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  return <StatusBadge status={text} />;
};

const renderObsSnippet = (value) => {
  const text = normalizeText(value).trim();
  if (!text) return "—";
  const snippet = text.length > 80 ? `${text.slice(0, 77)}...` : text;
  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-600" title={text}>
      <FileText className="h-3.5 w-3.5 text-slate-400" />
      <span className="line-clamp-1 text-left leading-snug">{snippet}</span>
    </div>
  );
};

const renderFieldValue = (field) => {
  if (field.isStatus) return renderStatus(field.rawValue);
  const text = normalizeText(field.value).trim();
  if (!text || text === "—") return "—";
  return (
    <Chip variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
      {text}
    </Chip>
  );
};

const PROCESS_STATUS_ABBREVIATIONS = {
  aguardando_documento: "Ag. documento",
  aguardando_vistoria: "Ag. vistoria",
  aguardando_pagamento: "Ag. pagamento",
  aguardando_regularizacao: "Ag. regularização",
  aguardando_liberacao: "Ag. liberação",
  em_analise: "Em análise",
};

const abbreviateProcessStatus = (rawStatus) => {
  const key = getStatusKey(rawStatus);
  const formatted = formatStatusDisplay(rawStatus);
  const base = PROCESS_STATUS_ABBREVIATIONS[key] || formatted;
  if (base.length <= 22) return base;
  return `${base.slice(0, 21)}…`;
};

const normalizeStatusKey = (value) =>
  removeDiacritics(normalizeText(value ?? "").toLowerCase()).trim();

const InfoItem = ({ label, children, className = "" }) => (
  <div className={cn("space-y-1 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5", className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="text-sm text-slate-800">{children ?? "—"}</div>
  </div>
);

const SummaryCard = ({ label, value, icon: Icon, helper = "", tone = "default" }) => {
  const toneClasses =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "warn"
        ? "bg-amber-50 text-amber-600"
        : "bg-indigo-50 text-indigo-600";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-[2rem] font-semibold leading-none tracking-tight text-slate-950">{value}</p>
          {helper ? <p className={cn("text-sm font-medium", tone === "warn" ? "text-amber-600" : "text-slate-500")}>{helper}</p> : null}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneClasses)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const RailFilterBlock = ({ label, children }) => (
  <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">{label}</p>
    {children}
  </div>
);

const railChipClass = (active) => `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
  active
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
}`;

export default function ProcessosScreen({
  processosNormalizados,
  empresas,
  certificados,
  modoFoco,
  soAlertas,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
  panelPreset,
  activeTab = "processos",
  onTabChange,
  query = "",
  onQueryChange,
  municipio = "Todos",
  searchField = "all",
  canManageProcessos = false,
}) {
  const empresasList = Array.isArray(empresas) ? empresas : [];
  const certificadosList = Array.isArray(certificados) ? certificados : [];
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    return localStorage.getItem("processos.viewMode") || "cards";
  });
  const [sortField, setSortField] = useState(DEFAULT_SORT.value);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT.defaultDir);
  const [selectedTipo, setSelectedTipo] = useState("TODOS");
  const [queueMode, setQueueMode] = useState("all");
  const [selectedUrgencyBucket, setSelectedUrgencyBucket] = useState("all");
  const [companyStatusFilters, setCompanyStatusFilters] = useState(["Ativas"]);
  const [riskFilters, setRiskFilters] = useState(["high", "medium", "low", "unmapped"]);
  const [certFilters, setCertFilters] = useState(["vencendo", "vencido", "valido", "sem_certificado"]);
  const [municipioFilters, setMunicipioFilters] = useState([]);
  const [urgencyMin, setUrgencyMin] = useState(0);
  const [urgencyMax, setUrgencyMax] = useState(100);
  const [expandedObs, setExpandedObs] = useState({});
  const [obsDrawer, setObsDrawer] = useState({ open: false, processo: null });
  const [obsDraft, setObsDraft] = useState("");
  const [obsHistory, setObsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingObs, setSavingObs] = useState(false);
  const [obsOverrides, setObsOverrides] = useState({});
  const [historyError, setHistoryError] = useState(null);
  const [detailsDrawer, setDetailsDrawer] = useState({ open: false, processo: null });

  useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "processos") return;
    setSelectedTipo("TODOS");
    setQueueMode("urgent");
    setViewMode("cards");
    setSelectedUrgencyBucket(preset?.bucket || "all");
    setSortField(DEFAULT_SORT.value);
    setSortDir(DEFAULT_SORT.defaultDir);
  }, [panelPreset]);

  const openEditProcesso = useCallback((processId) => {
    if (!processId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-process", {
        detail: { mode: "edit", processId },
      }),
    );
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("processos.viewMode", viewMode);
    }
  }, [viewMode]);

  const companyIndex = useMemo(() => {
    const byId = new Map();
    const byCnpj = new Map();
    empresasList.forEach((empresa) => {
      const id = String(empresa?.empresa_id ?? empresa?.empresaId ?? empresa?.company_id ?? empresa?.companyId ?? empresa?.id ?? "").trim();
      const cnpj = String(empresa?.cnpj ?? "").replace(/\D/g, "").trim();
      if (id) byId.set(id, empresa);
      if (cnpj) byCnpj.set(cnpj, empresa);
    });
    return { byId, byCnpj };
  }, [empresasList]);

  const certificadoIndex = useMemo(
    () => buildCertificadoIndex(certificadosList),
    [certificadosList],
  );

  const processosVisiveis = useMemo(() => {
    return processosNormalizados.filter((proc) => {
      const matchesMunicipio = matchesMunicipioFilter(proc);
      const matchesBusca = matchesQuery(
        [
          proc.empresa,
          proc.tipo,
          proc.tipoNormalizado,
          proc.status,
          proc.situacao,
          proc.status_padrao,
          proc.obs,
          proc.protocolo,
          proc.cnpj,
          proc.data_solicitacao,
          proc.prazo,
          proc.operacao,
          proc.orgao,
          proc.alvara,
          proc.inscricao_imobiliaria,
          proc.servico,
          proc.taxa,
          proc.notificacao,
          proc.data_val,
          proc.municipio,
          proc.tpi,
          proc.area_m2,
          proc.projeto,
          proc.tpi_sync_status,
          proc.taxa_bombeiros_sync_status,
          proc.taxa_sanitaria_sync_status,
          proc.alvara_sanitario_status,
        ],
        {
          nome: [proc.empresa],
          razao: [proc.empresa],
          cnpj: [proc.cnpj],
        },
      );

      const matchesFoco = modoFoco ? isProcessStatusActiveOrPending(proc.status) : true;
      const statusKey = removeDiacritics(normalizeText(proc?.situacao || proc?.status).toLowerCase());
      const blockedByAlertMode =
        soAlertas &&
        ["pendente", "concluido", "licenciado"].some((keyword) => statusKey.includes(keyword));

      return matchesMunicipio && matchesBusca && matchesFoco && !blockedByAlertMode;
    });
  }, [matchesMunicipioFilter, matchesQuery, modoFoco, processosNormalizados, soAlertas]);

  const fetchObsHistory = useCallback(async (processoId) => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await fetchJson(`/api/v1/processos/${processoId}/obs-history`);
      setObsHistory(Array.isArray(history) ? history : []);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao carregar histórico.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const openObsDrawer = useCallback(
    (processo) => {
      const processId = resolveProcessId(processo);
      if (!processId) return;
      setObsDrawer({ open: true, processo });
      setObsDraft(obsOverrides[processId] ?? processo.obs ?? "");
      fetchObsHistory(processId);
    },
    [fetchObsHistory, obsOverrides],
  );

  const closeObsDrawer = useCallback(() => {
    setObsDrawer({ open: false, processo: null });
    setObsHistory([]);
    setHistoryError(null);
  }, []);

  const saveObs = useCallback(async () => {
    const processId = resolveProcessId(obsDrawer?.processo);
    if (!processId) return;
    setSavingObs(true);
    try {
      await fetchJson(`/api/v1/processos/${processId}/obs`, {
        method: "PATCH",
        body: { obs: obsDraft },
      });
      setObsOverrides((prev) => ({ ...prev, [processId]: obsDraft }));
      await fetchObsHistory(processId);
    } catch (error) {
      setHistoryError(error?.message || "Erro ao salvar OBS.");
    } finally {
      setSavingObs(false);
    }
  }, [fetchObsHistory, obsDraft, obsDrawer?.processo]);

  const resolveObsValue = useCallback(
    (proc) => obsOverrides[resolveProcessId(proc)] ?? proc?.obs,
    [obsOverrides],
  );

  const processosEnriquecidos = useMemo(() => {
    return processosVisiveis.map((proc) => {
      const { tipoBase, tipoKey, tipoDisplay } = resolveTipoFromProcess(proc);
      const diversosOperacaoLabel = tipoBase === "Diversos" ? getDiversosOperacaoLabel(proc.operacao) : undefined;
      const companyId = String(proc?.empresa_id ?? proc?.empresaId ?? proc?.company_id ?? proc?.companyId ?? "").trim();
      const cnpjKey = String(proc?.cnpj ?? "").replace(/\D/g, "").trim();
      const company =
        (companyId && companyIndex.byId.get(companyId)) ||
        (cnpjKey && companyIndex.byCnpj.get(cnpjKey)) ||
        null;
      const companyStatus = getCompanyStatusKey(company);
      const companyRisk = getCompanyRiskKey(company);
      const certSituacao = company ? resolveEmpresaCertificadoSituacao(company, certificadoIndex) : company?.certificado;
      const certBucket = getCertBucketKey(certSituacao || company?.certificado);
      const merged = {
        ...proc,
        tipoBase,
        tipoKey,
        tipoDisplay,
        diversosOperacaoLabel,
        company,
        companyStatus,
        companyRisk,
        certBucket,
      };
      const urgency = getProcessUrgency(merged);
      const rawScore = urgency.score;
      return {
        ...merged,
        urgencyScore: Number.isFinite(rawScore)
          ? Math.max(0, Math.min(100, rawScore))
          : rawScore,
        urgencyScoreRaw: rawScore,
        urgencyBuckets: urgency.buckets,
        urgencyMeta: urgency,
      };
    });
  }, [certificadoIndex, companyIndex.byCnpj, companyIndex.byId, processosVisiveis]);

  const situacaoResumo = useMemo(() => {
    return processosEnriquecidos.reduce(
      (acc, proc) => {
        const statusKey = normalizeStatusKey(proc?.situacao || proc?.status);
        acc.total += 1;
        if (
          statusKey.includes("em analise") ||
          statusKey.includes("em andamento") ||
          statusKey.includes("aguardando documento") ||
          statusKey.includes("aguardando vistoria")
        ) {
          acc.emAnalise += 1;
        }
        if (
          statusKey.includes("pendente") ||
          statusKey.includes("aguardando pagamento") ||
          statusKey.includes("aguardando regularizacao") ||
          statusKey.includes("aguardando liberacao")
        ) {
          acc.pendentes += 1;
        }
        if (
          statusKey.includes("deferido") ||
          statusKey.includes("concluido") ||
          statusKey.includes("licenciado")
        ) {
          acc.deferidos += 1;
        }
        return acc;
      },
      { total: 0, emAnalise: 0, pendentes: 0, deferidos: 0 },
    );
  }, [processosEnriquecidos]);

  const tiposDisponiveis = useMemo(() => {
    const groups = new Map();
    processosEnriquecidos.forEach((proc) => {
      const entry = groups.get(proc.tipoKey) || {
        key: proc.tipoKey,
        display: proc.tipoDisplay,
        count: 0,
      };
      entry.count += 1;
      groups.set(proc.tipoKey, entry);
    });

    return [
      { key: "TODOS", display: "Todos", count: processosEnriquecidos.length },
      ...Array.from(groups.values()).sort((a, b) => a.display.localeCompare(b.display)),
    ];
  }, [processosEnriquecidos]);

  const municipiosDisponiveis = useMemo(() => {
    return Array.from(
      new Set(
        processosEnriquecidos
          .map((proc) => formatMunicipio(proc))
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [processosEnriquecidos]);

  const processosPorTipo = useMemo(
    () =>
      selectedTipo === "TODOS"
        ? processosEnriquecidos
        : processosEnriquecidos.filter((proc) => proc.tipoKey === selectedTipo),
    [processosEnriquecidos, selectedTipo],
  );

  const processosRailFiltrados = useMemo(() => {
    return processosPorTipo.filter((proc) => {
      if (!companyStatusFilters.includes("Todas") && !companyStatusFilters.includes(proc.companyStatus || "Todas")) return false;
      if (!riskFilters.includes(proc.companyRisk || "unmapped")) return false;
      if (!certFilters.includes(proc.certBucket || "sem_certificado")) return false;
      const municipioLabel = formatMunicipio(proc);
      if (municipioFilters.length > 0 && !municipioFilters.includes(municipioLabel)) return false;
      if (Number.isFinite(proc.urgencyScore)) {
        if (proc.urgencyScore < urgencyMin || proc.urgencyScore > urgencyMax) return false;
      }
      return true;
    });
  }, [certFilters, companyStatusFilters, municipioFilters, processosPorTipo, riskFilters, urgencyMax, urgencyMin]);

  const urgencyCounts = useMemo(() => {
    const counts = {
      all: processosRailFiltrados.filter((proc) => isUrgentByStatus(proc)).length,
    };
    URGENCY_BUCKETS.forEach((bucket) => {
      if (bucket.key === "all") return;
      counts[bucket.key] = processosRailFiltrados.filter((proc) =>
        isUrgentByStatus(proc) && proc.urgencyBuckets.includes(bucket.key),
      ).length;
    });
    return counts;
  }, [processosRailFiltrados]);

  const processosFiltradosQueue = useMemo(() => {
    if (queueMode !== "urgent") return processosRailFiltrados;
    const urgentOnly = processosRailFiltrados.filter((proc) => isUrgentByStatus(proc));
    if (selectedUrgencyBucket === "all") return urgentOnly;
    return urgentOnly.filter((proc) => proc.urgencyBuckets.includes(selectedUrgencyBucket));
  }, [processosRailFiltrados, queueMode, selectedUrgencyBucket]);

  const columnMetaMap = useMemo(() => {
    return TABLE_COLUMNS.reduce((acc, column) => {
      acc[column.id] = column;
      return acc;
    }, {});
  }, []);

  const processosOrdenados = useMemo(() => {
    const comparator = (a, b) => {
      const normalizedSortField = sortField === "urgencyScore" ? "urgencyScoreRaw" : sortField;
      const meta = SORT_OPTIONS.find((option) => option.value === sortField) || columnMetaMap[sortField] || {};
      const primary = compareProcessos(a, b, normalizedSortField, sortDir, meta);
      if (primary !== 0) return primary;

      const byUrgency = compareProcessos(a, b, DEFAULT_SORT.value, DEFAULT_SORT.defaultDir, DEFAULT_SORT);
      if (byUrgency !== 0) return byUrgency;

      const byDate = compareProcessos(a, b, SECONDARY_SORT.value, SECONDARY_SORT.defaultDir, SECONDARY_SORT);
      if (byDate !== 0) return byDate;

      return compareProcessos(a, b, "empresa", "asc");
    };
    return [...processosFiltradosQueue].sort(comparator);
  }, [columnMetaMap, processosFiltradosQueue, sortDir, sortField]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (municipio && municipio !== "Todos") chips.push(`Município: ${municipio}`);
    if (searchField && searchField !== "all") {
      const labels = { nome: "Empresa", cnpj: "CNPJ", protocolo: "Protocolo" };
      chips.push(`Busca: ${labels[searchField] || searchField}`);
    }
    if (soAlertas) chips.push("Status: Alertas");
    if (modoFoco) chips.push("Status: Ativas");
    return chips;
  }, [modoFoco, municipio, searchField, soAlertas]);

  const railActiveCount = useMemo(() => {
    let count = 0;
    if (!(companyStatusFilters.length === 1 && companyStatusFilters[0] === "Ativas")) count += 1;
    if (riskFilters.length !== RISK_OPTIONS.length) count += 1;
    if (certFilters.length !== CERT_OPTIONS.length) count += 1;
    if (municipioFilters.length > 0) count += 1;
    if (urgencyMin > 0 || urgencyMax < 100) count += 1;
    return count;
  }, [certFilters.length, companyStatusFilters, municipioFilters.length, riskFilters.length, urgencyMax, urgencyMin]);

  const resolveDefaultSortDir = useCallback(
    (field) => SORT_OPTIONS.find((option) => option.value === field)?.defaultDir ?? "asc",
    [],
  );

  const handleSortClick = (field, preferDefaultFirst = false) => {
    const defaultDir = resolveDefaultSortDir(field);
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
        return;
      }
      if (sortDir === "desc") {
        setSortField(DEFAULT_SORT.value);
        setSortDir(DEFAULT_SORT.defaultDir);
        return;
      }
      setSortDir("asc");
      return;
    }
    setSortField(field);
    setSortDir(preferDefaultFirst ? defaultDir : "asc");
  };

  const toggleObsExpanded = (key) => {
    setExpandedObs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openDetailsDrawer = useCallback((processo) => {
    setDetailsDrawer({ open: true, processo });
  }, []);

  const detailsFields = useMemo(
    () => (detailsDrawer.processo ? getTypeFields(detailsDrawer.processo) : []),
    [detailsDrawer.processo],
  );

  const toggleArrayFilter = (value, values, setValues, allValues) => {
    setValues((prev) => {
      const exists = prev.includes(value);
      if (exists) {
        const next = prev.filter((item) => item !== value);
        return next.length > 0 ? next : [value];
      }
      const next = [...prev, value];
      return allValues.every((item) => next.includes(item)) ? [...allValues] : next;
    });
  };

  const toggleCompanyStatusFilter = (value) => {
    setCompanyStatusFilters((prev) => {
      if (value === "Todas") return ["Todas"];
      const base = prev.includes("Todas") ? [] : prev;
      const exists = base.includes(value);
      const next = exists ? base.filter((item) => item !== value) : [...base, value];
      return next.length > 0 ? next : ["Todas"];
    });
  };

  const clearRailFilters = () => {
    setCompanyStatusFilters(["Ativas"]);
    setRiskFilters(RISK_OPTIONS.map((item) => item.key));
    setCertFilters(CERT_OPTIONS.map((item) => item.key));
    setMunicipioFilters([]);
    setUrgencyMin(0);
    setUrgencyMax(100);
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden xl:block xl:self-start xl:sticky xl:top-0 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
          <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
                <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
                <p className="text-xs text-slate-500">Registros no recorte: {processosRailFiltrados.length}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
                <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
                <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
              </div>
            </div>

            <div className="space-y-3">
              <RailFilterBlock label="Filtros rápidos">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setQueueMode("all"); setSelectedUrgencyBucket("all"); }} className={railChipClass(queueMode === "all")}>
                    Todos <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{processosRailFiltrados.length}</span>
                  </button>
                  <button type="button" onClick={() => setQueueMode("urgent")} className={railChipClass(queueMode === "urgent")}>
                    Urgentes <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{urgencyCounts.all || 0}</span>
                  </button>
                </div>
                {queueMode === "urgent" ? (
                  <div className="flex flex-wrap gap-2">
                    {URGENCY_BUCKETS.map((bucket) => (
                      <button key={bucket.key} type="button" onClick={() => setSelectedUrgencyBucket(bucket.key)} className={railChipClass(selectedUrgencyBucket === bucket.key)}>
                        {bucket.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{bucket.key === "all" ? urgencyCounts.all || 0 : urgencyCounts[bucket.key] || 0}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </RailFilterBlock>

              <RailFilterBlock label="Status da empresa">
                <div className="flex flex-wrap gap-2">
                  {["Ativas", "Inativas", "Todas"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleCompanyStatusFilter(option)}
                      className={railChipClass(companyStatusFilters.includes(option))}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </RailFilterBlock>

              <RailFilterBlock label="Risco CNAE">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRiskFilters(RISK_OPTIONS.map((item) => item.key))}
                    className={railChipClass(riskFilters.length === RISK_OPTIONS.length)}
                  >
                    Todos
                  </button>
                  {RISK_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleArrayFilter(option.key, riskFilters, setRiskFilters, RISK_OPTIONS.map((item) => item.key))}
                      className={railChipClass(riskFilters.includes(option.key))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </RailFilterBlock>

              <RailFilterBlock label="Certificado">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setCertFilters(CERT_OPTIONS.map((item) => item.key))}
                    className={railChipClass(certFilters.length === CERT_OPTIONS.length)}
                  >
                    Todos
                  </button>
                  {CERT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleArrayFilter(option.key, certFilters, setCertFilters, CERT_OPTIONS.map((item) => item.key))}
                      className={railChipClass(certFilters.includes(option.key))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </RailFilterBlock>

              <RailFilterBlock label="Município">
                {municipiosDisponiveis.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {municipiosDisponiveis.map((option) => (
                    <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
                      <input
                        type="checkbox"
                        checked={municipioFilters.includes(option)}
                        onChange={() =>
                          setMunicipioFilters((prev) =>
                            prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
                          )
                        }
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </RailFilterBlock>

              <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
                <div className="relative h-6">
                  <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
                  <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${urgencyMin}%`, width: `${Math.max(0, urgencyMax - urgencyMin)}%` }} />
                  <input type="range" min={0} max={100} value={urgencyMin} onChange={(event) => setUrgencyMin(Math.min(Number(event.target.value), urgencyMax))} className="ec-urgency-range" aria-label="Score de urgência mínimo" />
                  <input type="range" min={0} max={100} value={urgencyMax} onChange={(event) => setUrgencyMax(Math.max(Number(event.target.value), urgencyMin))} className="ec-urgency-range" aria-label="Score de urgência máximo" />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{urgencyMin}</span><span>{urgencyMax}</span></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={clearRailFilters}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="space-y-4 min-w-0">
        <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {PROCESS_SUBNAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange?.(item.key)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {activeFilterChips.length > 0 ? (
            activeFilterChips.map((chip) => (
              <span key={chip} className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                {chip}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
              Sem filtros persistentes ativos
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total de processos" value={situacaoResumo.total} icon={Clipboard} />
          <SummaryCard label="Em análise" value={situacaoResumo.emAnalise} icon={FileText} />
          <SummaryCard label="Pendentes" value={situacaoResumo.pendentes} icon={Clock} helper="Requer ação" tone="warn" />
          <SummaryCard label="Deferidos" value={situacaoResumo.deferidos} icon={ShieldCheck} tone="ok" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {tiposDisponiveis.map((tipo) => {
                const isActive = selectedTipo === tipo.key;
                const Icon = PROCESS_TYPE_ICON[tipo.key] || Settings;
                return (
                  <button
                    key={tipo.key}
                    type="button"
                    onClick={() => setSelectedTipo(tipo.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {tipo.key !== "TODOS" ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
                    <span>{tipo.display}</span>
                    {tipo.key === "TODOS" ? (
                      <span className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                        {tipo.count}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">{tipo.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn("rounded-md p-2 transition", viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}
                  title="Visualização em tabela"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn("rounded-md p-2 transition", viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}
                  title="Visualização em cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Fila operacional
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQueueMode("all");
                  setSelectedUrgencyBucket("all");
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  queueMode === "all"
                    ? "border-slate-200 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setQueueMode("urgent")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-1 py-1 text-sm font-medium transition",
                  queueMode === "urgent"
                    ? "border-transparent bg-transparent text-slate-700"
                    : "border-transparent bg-transparent text-slate-600 hover:text-slate-800",
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Urgentes
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">
                  {urgencyCounts.all || 0}
                </span>
              </button>
            </div>
          </div>

          {queueMode === "urgent" && (
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {URGENCY_BUCKETS.map((bucket) => {
                  const isActive = selectedUrgencyBucket === bucket.key;
                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      onClick={() => setSelectedUrgencyBucket(bucket.key)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span>{bucket.label}</span>
                      <InlineBadge variant="outline" className="bg-white text-slate-600">
                        {bucket.key === "all" ? urgencyCounts.all || 0 : urgencyCounts[bucket.key] || 0}
                      </InlineBadge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Ordenar por</span>
              <div className="flex flex-wrap items-center gap-2">
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortField === option.value;
                  const directionSymbol = isActive ? (sortDir === "asc" ? "↑" : "↓") : null;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSortClick(option.value, true)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                        "border-transparent bg-transparent text-slate-600 hover:text-slate-900",
                        isActive && "border-slate-900 bg-slate-900 text-white shadow-sm",
                      )}
                    >
                      <span>{option.label}</span>
                      {directionSymbol && <span className="text-xs">{directionSymbol}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <span className="text-sm text-slate-400">{processosOrdenados.length} resultados</span>
          </div>
        </div>

        {processosOrdenados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nenhum processo correspondente ao filtro.
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="max-h-[calc(100vh-280px)] overflow-auto overflow-x-auto">
              <Table className="min-w-[1180px]">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                  <TableRow>
                    {TABLE_COLUMNS.map((column) => {
                      const isSortable = column.id !== "detalhes" && column.id !== "obs";
                      const isActive = sortField === column.id;
                      const icon = !isActive ? (
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      ) : sortDir === "asc" ? (
                        <ArrowUp className="h-3.5 w-3.5 text-brand-navy" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-brand-navy" />
                      );
                      return (
                        <TableHead
                          key={column.id}
                          className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                        >
                          {isSortable ? (
                            <button
                              type="button"
                              onClick={() => handleSortClick(column.id)}
                              className="flex w-full items-center gap-2 text-left text-slate-700 transition hover:text-slate-900"
                            >
                              <span className="cursor-pointer select-none">{column.label}</span>
                              {icon}
                            </button>
                          ) : (
                            <span>{column.label}</span>
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosOrdenados.map((proc, index) => {
                    const municipio = formatMunicipio(proc);
                    const obsValue = resolveObsValue(proc);
                    const maskedCnpj = maskCNPJ(proc?.cnpj);
                    const detailChips = getPriorityTypeFields(proc, 3);
                    return (
                      <TableRow
                        key={getProcessKey(proc, index)}
                        className="border-b border-slate-100 hover:bg-slate-50/60"
                      >
                        {TABLE_COLUMNS.map((column) => {
                          let content = normalizeText(proc?.[column.id]).trim() || "—";
                          if (column.id === "tipoDisplay") {
                            content = proc.tipoDisplay;
                          } else if (column.id === "empresa") {
                            content = (
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold leading-tight text-slate-800">
                                  {proc?.empresa || "—"}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const value = maskCNPJ(proc?.cnpj);
                                    if (value && value !== "—") handleCopy(value, `CNPJ copiado: ${value}`);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-navy transition hover:text-brand-navy-700"
                                >
                                  {maskedCnpj || "—"}
                                  <Clipboard className="h-3 w-3" aria-hidden="true" />
                                </button>
                              </div>
                            );
                          } else if (column.id === "protocolo") {
                            content = normalizeIdentifier(proc?.protocolo) || "—";
                          } else if (column.id === "data_solicitacao") {
                            content = formatProcessDate(proc?.data_solicitacao);
                          } else if (column.id === "municipio") {
                            content = municipio || "—";
                          } else if (column.id === "situacao") {
                            content = renderStatus(proc?.situacao || proc?.status);
                          } else if (column.id === "detalhes") {
                            content = (
                              <div className="flex min-w-[260px] flex-wrap items-center gap-2">
                                {detailChips.length > 0 ? (
                                  detailChips.map((field) => (
                                    <Chip key={field.key} variant="neutral" className="border-slate-200 bg-slate-100 text-[11px] text-slate-700">
                                      {field.label}: {field.value}
                                    </Chip>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-500">Sem campos do tipo.</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openDetailsDrawer(proc)}
                                  className="text-[11px] font-semibold text-brand-navy underline-offset-2 hover:underline"
                                >
                                  Ver todos
                                </button>
                              </div>
                            );
                          } else if (column.id === "obs") {
                            content = (
                              <div className="flex max-w-xs items-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditProcesso(resolveProcessId(proc))}
                                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                                  title="Editar processo"
                                >
                                  <PencilLine className="h-4 w-4" />
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openObsDrawer(proc)}
                                  className="inline-flex min-w-0 flex-1 items-start gap-2 text-left text-slate-700 transition-colors hover:text-slate-900"
                                >
                                  {renderObsSnippet(obsValue)}
                                </button>
                              </div>
                            );
                          }
                          return (
                            <TableCell key={column.id} className="min-w-[140px] align-top px-4 py-3 text-xs text-slate-700">
                              {content}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {processosOrdenados.map((proc, index) => {
              const obsValue = resolveObsValue(proc);
              const obsText = normalizeText(obsValue).trim();
              const processId = resolveProcessId(proc);
              const municipio = formatMunicipio(proc);
              const protocoloDisplay = normalizeIdentifier(proc?.protocolo) || "—";
              const cnpjDisplay = maskCNPJ(proc?.cnpj) || "—";
              const dataAbertura = formatProcessDate(proc?.data_solicitacao);
              const statusRaw = normalizeText(proc?.situacao || proc?.status).trim() || "Situação";
              const statusLabel = abbreviateProcessStatus(statusRaw);
              const statusResolved = resolveStatusClass(statusRaw);
              const statusVariant = typeof statusResolved === "string" ? statusResolved : statusResolved?.variant;
              const statusClassName = typeof statusResolved === "object" ? statusResolved?.className : "";
              const operationLabel = proc.diversosOperacaoLabel || formatCanonicalLabel(proc?.operacao, "");

              return (
                <Card
                  key={getProcessKey(proc, index)}
                  onClick={() => openEditProcesso(processId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEditProcesso(processId);
                    }
                  }}
                  className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold leading-tight text-slate-950">
                        <CopyableCompanyName value={proc?.empresa} onCopy={handleCopy} size="base" />
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {proc.tipoDisplay}
                        {operationLabel ? ` · ${operationLabel}` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (cnpjDisplay !== "—") handleCopy(cnpjDisplay, `CNPJ copiado: ${cnpjDisplay}`);
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                        title="Copiar CNPJ"
                      >
                        CNPJ: {cnpjDisplay}
                      </button>
                    </div>
                    <Chip
                      variant={statusVariant || "neutral"}
                      className={cn("max-w-[140px] shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold", statusClassName)}
                      title={formatStatusDisplay(statusRaw)}
                    >
                      {statusLabel}
                    </Chip>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-400">Protocolo</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (protocoloDisplay !== "—") handleCopy(protocoloDisplay, `Protocolo copiado: ${protocoloDisplay}`);
                          }}
                          className="font-mono font-semibold text-slate-800 transition hover:text-slate-950"
                          title="Copiar protocolo"
                        >
                          {protocoloDisplay}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-slate-400">Data de abertura</span>
                        <span className="font-mono font-semibold text-slate-800">{dataAbertura}</span>
                      </div>
                    </div>

                    {municipio ? (
                      <div className="rounded-lg bg-slate-100 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>Município</span>
                          </span>
                          <span className="font-semibold text-slate-800">{municipio}</span>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openObsDrawer(proc);
                      }}
                      className="w-full rounded-lg bg-slate-100 px-3 py-3 text-left transition hover:bg-slate-200/70"
                      title="Editar observação"
                    >
                      <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {obsText || "Nenhuma observação registrada."}
                      </p>
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>

      <SideDrawer
        open={detailsDrawer.open}
        onClose={() => setDetailsDrawer({ open: false, processo: null })}
        title={detailsDrawer?.processo?.empresa || "Campos do tipo"}
        subtitle={detailsDrawer?.processo ? `Campos do tipo: ${detailsDrawer.processo.tipoDisplay || detailsDrawer.processo.tipo || "Processo"}` : "Campos do tipo"}
      >
        {detailsDrawer.processo ? (
          <div className="space-y-3">
            {detailsFields.length > 0 ? (
              detailsFields.map((field) => (
                <InfoItem key={field.key} label={field.label}>
                  {renderFieldValue(field)}
                </InfoItem>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Tipo sem campos específicos configurados.
              </div>
            )}
          </div>
        ) : null}
      </SideDrawer>

      {obsDrawer.open && obsDrawer.processo && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeObsDrawer}
            className="flex-1 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-navy">Observações</p>
                <p className="text-base font-semibold leading-tight text-slate-900">
                  {obsDrawer.processo.empresa || "Empresa"}
                </p>
                <p className="text-xs text-slate-500">
                  {getTipoDisplay(obsDrawer.processo.tipo)} • Protocolo {obsDrawer.processo.protocolo || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeObsDrawer}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-800">OBS</label>
                  {savingObs && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                </div>
                <textarea
                  rows={5}
                  value={obsDraft}
                  onChange={(event) => setObsDraft(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-brand-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy-soft"
                  placeholder="Adicionar observação"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeObsDrawer}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveObs}
                    disabled={savingObs}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-brand-navy-foreground shadow-sm transition-colors hover:bg-brand-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <PanelRightClose className="h-4 w-4" /> Salvar
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-semibold text-slate-800">Histórico</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {loadingHistory && <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />}
                    <button
                      type="button"
                      onClick={() => {
                        const processId = resolveProcessId(obsDrawer.processo);
                        if (processId) fetchObsHistory(processId);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>

                {historyError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    {historyError}
                  </div>
                ) : obsHistory.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    Nenhuma alteração registrada para este processo.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {obsHistory.map((entry) => (
                      <div
                        key={entry.id || `${entry.changed_at || entry.timestamp}-${(entry.old_obs || entry.old_value || "").length}`}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-inner"
                      >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatDateTime(entry.changed_at || entry.timestamp)}</span>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-3">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Anterior</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.old_obs || entry.old_value || "—"}>
                              {normalizeText(entry.old_obs || entry.old_value).trim() || "—"}
                            </p>
                          </div>
                          <div className="hidden items-center justify-center md:flex">
                            <MoveRight className="h-4 w-4 text-slate-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Atual</p>
                            <p className="line-clamp-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white/80 p-2 leading-relaxed shadow-sm" title={entry.new_obs || entry.new_value || "—"}>
                              {normalizeText(entry.new_obs || entry.new_value).trim() || "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


