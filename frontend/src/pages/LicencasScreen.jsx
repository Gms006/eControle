import React, { useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ArrowUpDown,
  BookDown,
  ChartBarIncreasing,
  ChevronDown,
  Clipboard,
  FileDown,
  FileMinus,
  Info,
  LayoutGrid,
  Logs,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { fetchJson } from "@/lib/api";
import { formatStatusDisplay } from "@/lib/domain/status/display";
import { resolveLicencaTipo } from "@/lib/domain/status/licencas";
import { getStatusKey, isAlertStatus } from "@/lib/domain/status/common";
import DomainSubnav from "@/components/navigation/DomainSubnav";
import LicenceUploadAssistDrawer from "@/components/licencas/LicenceUploadAssistDrawer";
import useLicenceRows from "@/hooks/licencas/useLicenceRows";
import LicenceFilterRail from "@/components/licencas/LicenceFilterRail";
import LicenceEditDrawer from "@/components/licencas/LicenceEditDrawer";
import LicenceMatrix from "@/components/licencas/LicenceMatrix";
import LicenceHeroCards from "@/components/licencas/LicenceHeroCards";
import useLicenceFilters from "@/hooks/licencas/useLicenceFilters";

const TIPOS = [
  { key: "SANITARIA", label: "Sanitária", field: "alvara_vig_sanitaria" },
  { key: "CERCON", label: "CERCON", field: "cercon" },
  { key: "FUNCIONAMENTO", label: "Funcionamento", field: "alvara_funcionamento" },
  { key: "USO_DO_SOLO", label: "Uso do Solo", field: "certidao_uso_solo" },
  { key: "AMBIENTAL", label: "Ambiental", field: "licenca_ambiental" },
];

const MATRIX_TIPOS = [
  { key: "SANITARIA", label: "Vig. Sanitária" },
  { key: "CERCON", label: "CERCON" },
  { key: "FUNCIONAMENTO", label: "Funcionamento" },
  { key: "AMBIENTAL", label: "Ambiental" },
  { key: "USO_DO_SOLO", label: "Uso do Solo" },
];

const STATUS_OPTIONS = [
  "possui",
  "definitivo",
  "vencido",
  "sujeito",
  "nao_possui",
  "nao_exigido",
  "isento",
  "aguardando_documento",
  "aguardando_vistoria",
  "aguardando_pagamento",
  "aguardando_regularizacao",
  "aguardando_liberacao",
  "em_analise",
  "notificacao",
  "ir_na_visa",
];
const MOTIVO_OPTIONS = [
  "atividade_nao_exige",
  "zoneamento_nao_aplica",
  "porte_dispensado",
  "fase_pre_operacional",
  "mei",
  "endereco_administrativo_fiscal",
  "outro",
];

const DETECT_KIND_OPTIONS = [
  { value: "ALVARA_BOMBEIROS", label: "Alvará Bombeiros" },
  { value: "ALVARA_VIG_SANITARIA", label: "Alvará Vig Sanitária" },
  { value: "DISPENSA_SANITARIA", label: "Dispensa Sanitária" },
  { value: "ALVARA_FUNCIONAMENTO_DEFINITIVO", label: "Alvará Funcionamento - Definitivo" },
  { value: "ALVARA_FUNCIONAMENTO_CONDICIONADO", label: "Alvará Funcionamento - Condicionado" },
  { value: "ALVARA_FUNCIONAMENTO_PROVISORIO", label: "Alvará Funcionamento - Provisório" },
  { value: "USO_DO_SOLO", label: "Uso do Solo" },
  { value: "LICENCA_AMBIENTAL", label: "Licença Ambiental" },
  { value: "DISPENSA_AMBIENTAL", label: "Dispensa Ambiental" },
];

const ALVARA_FUNCIONAMENTO_KIND_OPTIONS = [
  { value: "DEFINITIVO", label: "Definitivo" },
  { value: "CONDICIONADO", label: "Condicionado" },
  { value: "PROVISORIO", label: "Provisório" },
  { value: "PENDENTE_REVISAO", label: "Pendente revisão" },
];

const formatAlvaraKindLabel = (value) =>
  ALVARA_FUNCIONAMENTO_KIND_OPTIONS.find((item) => item.value === value)?.label || "Pendente revisão";

const SCORE_RISK_OPTIONS = [
  { value: "todos", label: "Todos riscos" },
  { value: "HIGH", label: "Risco alto" },
  { value: "MEDIUM", label: "Risco médio" },
  { value: "LOW", label: "Risco baixo" },
  { value: "__none__", label: "Sem risco" },
];

const SCORE_STATUS_OPTIONS = [
  { value: "todos", label: "Todos score status" },
  { value: "OK", label: "OK" },
  { value: "OK_DEFINITIVE", label: "OK - Definitivo" },
  { value: "DEFINITIVE_INVALIDATED", label: "Definitivo invalidado" },
  { value: "NO_CNAE", label: "Sem CNAE" },
  { value: "UNMAPPED_CNAE", label: "CNAE não mapeado" },
  { value: "NO_LICENCE", label: "Sem licença datada" },
  { value: "__none__", label: "Sem score status" },
];

const normalizeScoreRisk = (value) => String(value || "").trim().toLowerCase();
const normalizeScoreStatus = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

const formatScoreRiskLabel = (value) => {
  const key = normalizeScoreRisk(value);
  if (key === "high") return "Alto";
  if (key === "medium") return "Médio";
  if (key === "low") return "Baixo";
  return "—";
};

const formatScoreStatusLabel = (value) => {
  const key = normalizeScoreStatus(value);
  if (key === "OK") return "OK";
  if (key === "OK_DEFINITIVE") return "OK - Definitivo";
  if (key === "DEFINITIVE_INVALIDATED") return "Definitivo invalidado";
  if (key === "NO_CNAE") return "Sem CNAE";
  if (key === "UNMAPPED_CNAE") return "CNAE não mapeado";
  if (key === "NO_LICENCE") return "Sem licença datada";
  return "—";
};

const normalizeSanitaryComplexity = (value) => String(value || "").trim().toUpperCase();

const formatSanitaryComplexityLabel = (value) => {
  const key = normalizeSanitaryComplexity(value);
  if (!key) return "—";
  if (key === "PENDENTE_REVISAO") return "Pendente revisão";
  if (key === "NAO_APLICAVEL") return "Não aplicável";
  return key
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const SORT_OPTIONS = [
  { value: "score_urgencia", label: "Score", defaultDir: "desc", isNumber: true },
  { value: "dias_para_vencer", label: "Vencimento", defaultDir: "asc", isNumber: true },
  { value: "empresa_display", label: "Empresa", defaultDir: "asc" },
  { value: "tipo", label: "Tipo", defaultDir: "asc" },
];

const DEFAULT_SORT = SORT_OPTIONS[0];
const LICENCAS_MATRIX_VIEW_MODE_KEY = "licencas_matrix_view_mode";
const compareWithSort = (a, b, option, direction) => {
  const dir = direction === "desc" ? -1 : 1;
  const field = option?.value;
  if (!field) return 0;
  if (option?.isNumber) {
    const av = Number.isFinite(a?.[field]) ? Number(a[field]) : null;
    const bv = Number.isFinite(b?.[field]) ? Number(b[field]) : null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  }
  const at = String(a?.[field] || "").trim();
  const bt = String(b?.[field] || "").trim();
  if (!at && !bt) return 0;
  if (!at) return 1;
  if (!bt) return -1;
  return at.localeCompare(bt, "pt-BR", { sensitivity: "base" }) * dir;
};

function ScoreLegendInfo() {
  return (
    <span className="relative inline-flex items-center group">
      <Info className="h-3.5 w-3.5 text-slate-500" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-[11px] leading-snug text-slate-700 opacity-0 shadow-md transition group-hover:opacity-100">
        Score = maior peso CNAE + peso de vencimento.
        <br />
        Vencida: +50, até 7 dias: +40, até 30 dias: +25, até 60 dias: +10.
      </span>
    </span>
  );
}

const toUploadLicenceType = (kind, isDefinitive) => {
  const key = String(kind || "").trim().toUpperCase();
  if (!isDefinitive) return key;
  if (key === "DISPENSA_SANITARIA") return "DISPENSA_SANITARIA_DEFINITIVO";
  if (key === "DISPENSA_AMBIENTAL") return "DISPENSA_AMBIENTAL_DEFINITIVO";
  return key;
};

const normalizeTipo = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseDias = (item) => {
  const parts = parseStatusParts(item);
  const ref = item?.valid_until || parts.validadeIso || parts.validadeBr || item?.validade || item?.validade_br;
  if (!ref) return null;
  const iso = toIsoDate(ref);
  if (!iso) return null;
  const date = dayjs(iso, "YYYY-MM-DD", true);
  if (!date.isValid()) return null;
  return date.startOf("day").diff(dayjs().startOf("day"), "day");
};

const toBrDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[1]}/${brMatch[2]}/${brMatch[3]}`;
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const parsed = dayjs(text, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!parsed.isValid()) return null;
  return parsed.format("DD/MM/YYYY");
};

const toIsoDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const parsed = dayjs(text, ["YYYY-MM-DD", "DD/MM/YYYY"], true);
  if (!parsed.isValid()) return null;
  return parsed.format("YYYY-MM-DD");
};

const parseStatusParts = (item) => {
  const rawStatus = String(item?.status || "").trim();
  const validUntilBr = toBrDate(item?.valid_until);
  const validUntilIso = item?.valid_until && /^\d{4}-\d{2}-\d{2}$/.test(String(item?.valid_until))
    ? String(item?.valid_until)
    : null;
  const match = rawStatus
    .toLowerCase()
    .match(/([a-z_]+?)(?:_val(?:idade)?_)?(\d{1,2})[._/-](\d{1,2})[._/-](\d{2,4})/i);

  if (match) {
    const day = String(match[2]).padStart(2, "0");
    const month = String(match[3]).padStart(2, "0");
    const year = String(match[4]).length === 2 ? `20${match[4]}` : String(match[4]);
    let baseStatus = formatStatusDisplay(match[1]);
    const validadeIso = `${year}-${month}-${day}`;
    const isDefinitive = getStatusKey(baseStatus).includes("definitiv");
    const dias = dayjs(validadeIso, "YYYY-MM-DD", true).startOf("day").diff(dayjs().startOf("day"), "day");
    if (!isDefinitive && Number.isFinite(dias) && dias < 0) {
      baseStatus = "Vencido";
    }
    return {
      baseStatus,
      validadeBr: isDefinitive ? null : `${day}/${month}/${year}`,
      validadeIso: isDefinitive ? null : validadeIso,
    };
  }

  const statusWithoutTrailingDate = rawStatus.replace(/\s*[-–]?\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s*$/u, "").trim();
  let baseStatus = formatStatusDisplay(statusWithoutTrailingDate || rawStatus || item?.status_key || "—");
  const statusDateMatch = rawStatus.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  const statusDateBr = statusDateMatch
    ? `${String(statusDateMatch[1]).padStart(2, "0")}/${String(statusDateMatch[2]).padStart(2, "0")}/${String(
        statusDateMatch[3],
      ).length === 2 ? `20${statusDateMatch[3]}` : statusDateMatch[3]}`
    : null;
  const validadeBr = validUntilBr || statusDateBr || toBrDate(item?.validade_br || item?.validade);
  const validadeIso = validUntilIso || toIsoDate(validadeBr);
  const isDefinitive = getStatusKey(baseStatus).includes("definitiv");
  if (!isDefinitive && validadeIso) {
    const dias = dayjs(validadeIso, "YYYY-MM-DD", true).startOf("day").diff(dayjs().startOf("day"), "day");
    if (Number.isFinite(dias) && dias < 0) {
      baseStatus = "Vencido";
    }
  }
  return { baseStatus, validadeBr: isDefinitive ? null : validadeBr, validadeIso: isDefinitive ? null : validadeIso };
};

const formatStatusWithDate = (item) => {
  const parts = parseStatusParts(item);
  const sourceRaw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const sourceKind = String(sourceRaw?.[`source_kind_${item?.licence_field}`] || "").toLowerCase();
  if (sourceKind === "definitivo" && getStatusKey(parts.baseStatus) === "possui") {
    return "Possui - Definitivo";
  }
  if (getStatusKey(parts.baseStatus) === "definitivo") {
    return "Possui - Definitivo";
  }
  const fallbackDate =
    toBrDate(item?.valid_until) || parts.validadeBr || toBrDate(item?.validade_br || item?.validade) || item?.validade_br_display;
  if (fallbackDate && !getStatusKey(parts.baseStatus).includes("definitiv")) {
    return `${parts.baseStatus} - ${fallbackDate}`;
  }
  return parts.baseStatus;
};

const formatMatrixStatus = (item) => parseStatusParts(item).baseStatus || "Sem status";

const toCanonicalStatusKey = (value) => getStatusKey(value).replace(/\s+/g, "_");

const displayEmpresa = (item) => {
  if (item?.company_razao_social) return item.company_razao_social;
  if (item?.empresa) return item.empresa;
  if (item?.company_name) return item.company_name;
  if (item?.cnpj) return item.cnpj;
  if (item?.empresa_id || item?.company_id) {
    return `Empresa não vinculada (ID ${item?.empresa_id || item?.company_id})`;
  }
  return "Empresa não vinculada";
};

const classify = (item) => {
  const key = item?.status_key_canonical || toCanonicalStatusKey(parseStatusParts(item).baseStatus);
  const dias = parseDias(item);
  if (!key || key === "sem_status") return "sem_status";
  if (key === "nao_possui") return "nao_possui";
  if (key.includes("vencido") || (typeof dias === "number" && dias < 0)) return "vencido";
  if (typeof dias === "number" && dias <= 7) return "ate7";
  if (typeof dias === "number" && dias <= 15) return "ate15";
  if (typeof dias === "number" && dias <= 30) return "ate30";
  return null;
};

const groupConfig = [
  { key: "vencido", label: "Vencido", variant: "danger" },
  { key: "ate7", label: "Vence em <=7 dias", variant: "danger" },
  { key: "ate15", label: "Vence em <=15 dias", variant: "warning" },
  { key: "ate30", label: "Vence em <=30 dias", variant: "warning" },
  { key: "nao_possui", label: "Não possui (obrigatório/urgente)", variant: "danger" },
  { key: "sem_status", label: "Sem status (backlog)", variant: "warning" },
];

const parseIsActiveFlag = (company) => {
  const raw = company?.is_active ?? company?.isActive;
  if (raw === true || raw === 1) return true;
  if (raw === false || raw === 0) return false;
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return null;
  if (["t", "true", "1", "yes", "y", "sim", "ativo", "ativa"].includes(key)) return true;
  if (["f", "false", "0", "no", "n", "nao", "não", "inativo", "inativa"].includes(key)) return false;
  return null;
};

const resolveCompanyCertBucket = (value) => {
  const key = getStatusKey(value || "");
  if (!key || key === "nao_possui") return "sem_certificado";
  if (key.includes("vencid")) return "vencido";
  if (key.includes("venc") || key.includes("alert")) return "vencendo";
  if (key.includes("valid") || key.includes("ok")) return "valido";
  return "sem_certificado";
};

export default function LicencasScreen({
  licencas,
  filteredLicencas,
  empresas,
  modoFoco,
  canManageLicencas,
  handleCopy,
  enqueueToast,
  onRefreshData,
  panelPreset,
  activeTab = "licencas",
  onTabChange,
}) {
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "renovacoes";
    try {
      const stored = localStorage.getItem("licencas_active_view");
      return stored && ["renovacoes", "matriz", "tipos"].includes(stored) ? stored : "renovacoes";
    } catch {
      return "renovacoes";
    }
  });
  const [openRailMobile, setOpenRailMobile] = useState(false);
  const [matrixViewMode, setMatrixViewMode] = useState(() => {
    if (typeof window === "undefined") return "cards";
    try {
      const stored = localStorage.getItem(LICENCAS_MATRIX_VIEW_MODE_KEY);
      return stored && ["table", "cards"].includes(stored) ? stored : "cards";
    } catch {
      return "cards";
    }
  });
  const [drawerItem, setDrawerItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [uploadDraft, setUploadDraft] = useState({ companyId: "", items: [] });
  const fileInputRef = useRef(null);
  const appendUploadSelectionRef = useRef(false);
  const openCompanyCadastro = React.useCallback((item) => {
    window.dispatchEvent(
      new CustomEvent("econtrole:open-company", {
        detail: {
          mode: "edit",
          companyId: String(item?.company_id || item?.empresa_id || "").trim() || null,
          cnpj: item?.cnpj || item?.company_cnpj || null,
          initialTab: "cadastro",
        },
      }),
    );
  }, []);

  // Persistir estado da aba no localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem("licencas_active_view", view);
    } catch {
      // Silenciosamente ignorar erros de localStorage
    }
  }, [view]);

  React.useEffect(() => {
    try {
      localStorage.setItem(LICENCAS_MATRIX_VIEW_MODE_KEY, matrixViewMode);
    } catch {
      // Silenciosamente ignorar erros de localStorage
    }
  }, [matrixViewMode]);

  const base = useMemo(
    () => (modoFoco ? (filteredLicencas || []).filter((item) => isAlertStatus(item?.status)) : filteredLicencas || []),
    [filteredLicencas, modoFoco],
  );

  const rows = useLicenceRows({
    base,
    empresas,
    normalizeDigits,
    normalizeTipo,
    parseStatusParts,
    parseDias,
    toCanonicalStatusKey,
    normalizeScoreRisk,
    normalizeScoreStatus,
    parseIsActiveFlag,
    resolveCompanyCertBucket,
    normalizeSanitaryComplexity,
    displayEmpresa,
    toBrDate,
    classify,
  });

  const {
    searchTerm,
    setSearchTerm,
    quickMunicipio,
    setQuickMunicipio,
    quickTipo,
    setQuickTipo,
    quickStatus,
    setQuickStatus,
    quickScoreRisk,
    setQuickScoreRisk,
    quickScoreStatus,
    setQuickScoreStatus,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    somenteAlertasLocal,
    setSomenteAlertasLocal,
    kpiFilter,
    setKpiFilter,
    priorityGroup,
    setPriorityGroup,
    railStatusFilter,
    setRailStatusFilter,
    railRiskFilters,
    setRailRiskFilters,
    railCertFilters,
    setRailCertFilters,
    railMunicipioFilters,
    setRailMunicipioFilters,
    railSanitaryComplexityFilter,
    setRailSanitaryComplexityFilter,
    railUrgencyMin,
    setRailUrgencyMin,
    railUrgencyMax,
    setRailUrgencyMax,
    municipios,
    railMunicipioOptions,
    railSanitaryComplexityOptions,
    filteredBase,
    sortedFiltered,
    grouped,
    renovacoesNotificacaoCount,
    empresasMatriz,
    matrizCards,
    kpis,
    heroKpis,
    activeFilterBadges,
    railActiveCount,
    toggleRailFilter,
    clearSharedRailFilters,
    clearContextFilters,
  } = useLicenceFilters({
    rows,
    groupConfig,
    sortOptions: SORT_OPTIONS,
    defaultSort: DEFAULT_SORT,
    tipos: TIPOS,
    scoreRiskOptions: SCORE_RISK_OPTIONS,
    scoreStatusOptions: SCORE_STATUS_OPTIONS,
    formatStatusDisplay,
    formatStatusWithDate,
    formatSanitaryComplexityLabel,
  });

  React.useEffect(() => {
    const preset = panelPreset?.preset;
    if (!preset || panelPreset?.tab !== "licencas") return;
    setView("renovacoes");
    setSearchTerm("");
    setSomenteAlertasLocal(false);
    setQuickMunicipio("todos");
    setQuickTipo("todos");
    setQuickStatus("todos");
    setQuickScoreRisk("todos");
    setQuickScoreStatus("todos");
    setSortField(DEFAULT_SORT.value);
    setSortDir(DEFAULT_SORT.defaultDir);
    setKpiFilter("todos");
    setPriorityGroup(preset?.group || "todos");
  }, [
    panelPreset,
    setKpiFilter,
    setPriorityGroup,
    setQuickMunicipio,
    setQuickScoreRisk,
    setQuickScoreStatus,
    setQuickStatus,
    setQuickTipo,
    setSearchTerm,
    setSomenteAlertasLocal,
    setSortDir,
    setSortField,
  ]);

  const companyOptions = useMemo(
    () =>
      (empresas || [])
        .filter((item) => item?.id)
        .map((item) => ({
          id: String(item.id),
          razao_social: item?.razao_social || item?.empresa || "",
          cnpj: item?.cnpj || "",
        }))
        .sort((a, b) => (a.razao_social || "").localeCompare(b.razao_social || "")),
    [empresas],
  );

  const triggerUpload = () => {
    if (!canManageLicencas || uploading) return;
    appendUploadSelectionRef.current = false;
    fileInputRef.current?.click();
  };

  const triggerAddUploadFiles = () => {
    if (!canManageLicencas || uploading) return;
    appendUploadSelectionRef.current = true;
    fileInputRef.current?.click();
  };

  const triggerScanFull = async () => {
    if (!canManageLicencas || scanRunning) return;
    setScanRunning(true);
    try {
      const response = await fetchJson("/api/v1/licencas/scan-full", { method: "POST" });
      const runId = response?.run_id;
      enqueueToast?.(`Scan completo iniciado${runId ? ` (run ${runId})` : ""}.`);
      if (!runId) {
        await onRefreshData?.();
        return;
      }
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const statusPayload = await fetchJson(`/api/v1/worker/jobs/${runId}`);
        const status = String(statusPayload?.status || "").toLowerCase();
        if (status === "done") {
          enqueueToast?.("Scan completo concluído.");
          await onRefreshData?.();
          return;
        }
        if (status === "error") {
          const reason = statusPayload?.errors?.[0]?.error;
          enqueueToast?.(reason ? `Scan completo com erro: ${reason}` : "Scan completo com erro.");
          await onRefreshData?.();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      enqueueToast?.("Scan completo em andamento. Consulte o status novamente em instantes.");
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao iniciar scan completo.");
    } finally {
      setScanRunning(false);
    }
  };

  const detectUploadItems = async (files) => {
    try {
      const detectForm = new FormData();
      files.forEach((file) => detectForm.append("items", file));
      const detectResponse = await fetchJson("/api/v1/licencas/detect", {
        method: "POST",
        body: detectForm,
      });
      const detectedItems = Array.isArray(detectResponse?.results) ? detectResponse.results : [];
      return files.map((file, index) => {
        const detected = detectedItems[index] || {};
        return {
          file,
          originalFilename: file.name,
          kind: detected.suggested_document_kind || "",
          expiresAt: detected.suggested_expires_at || "",
          isDefinitive: Boolean(detected.is_definitive),
          confidence: Number(detected.confidence || 0),
          warnings: Array.isArray(detected.warnings) ? detected.warnings : [],
          canonicalFilename: detected.canonical_filename || null,
        };
      });
    } catch (error) {
      enqueueToast?.(error?.message || "Falha ao detectar licenças.");
      return [];
    }
  };

  const onSelectFiles = async (event) => {
    if (!canManageLicencas) return;
    const files = Array.from(event?.target?.files || []);
    event.target.value = "";
    if (!files.length) return;
    const detectedItems = await detectUploadItems(files);
    if (!detectedItems.length) {
      appendUploadSelectionRef.current = false;
      return;
    }

    const shouldAppend = appendUploadSelectionRef.current;
    appendUploadSelectionRef.current = false;
    if (shouldAppend) {
      setUploadDraft((prev) => ({
        companyId: prev.companyId || "",
        items: [...(prev.items || []), ...detectedItems],
      }));
    } else {
      setUploadDraft({
        companyId: "",
        items: detectedItems,
      });
    }
    setUploadDrawerOpen(true);
  };

  const submitAssistedUpload = async () => {
    if (!canManageLicencas || uploading) return;
    if (!uploadDraft.companyId?.trim()) {
      enqueueToast?.("Informe o company_id.");
      return;
    }
    for (const item of uploadDraft.items) {
      const kind = String(item.kind || "").trim();
      if (!kind) {
        enqueueToast?.(`Defina o tipo para ${item.originalFilename}.`);
        return;
      }
      const requiresExpiry = !item.isDefinitive && !String(kind).includes("DEFINITIVO");
      if (requiresExpiry && !item.expiresAt) {
        enqueueToast?.(`Defina a validade para ${item.originalFilename}.`);
        return;
      }
    }

    const formData = new FormData();
    formData.append("company_id", uploadDraft.companyId.trim());
    uploadDraft.items.forEach((item) => {
      formData.append("items", item.file);
      formData.append("licence_type", toUploadLicenceType(item.kind, item.isDefinitive));
      formData.append("expires_at", item.isDefinitive ? "" : (item.expiresAt || ""));
    });

    setUploading(true);
    try {
      const response = await fetchJson("/api/v1/licencas/upload-bulk", {
        method: "POST",
        body: formData,
      });
      const okCount = Number(response?.saved_count || 0);
      const total = Array.isArray(response?.results) ? response.results.length : uploadDraft.items.length;
      enqueueToast?.(`Upload concluído: ${okCount}/${total} arquivos salvos.`);
      setUploadDrawerOpen(false);
      await onRefreshData?.();
    } catch (error) {
      enqueueToast?.(error?.message || "Falha no upload de licenças.");
    } finally {
      setUploading(false);
    }
  };

  const rail = (
    <LicenceFilterRail
      filteredBaseLength={filteredBase.length}
      railActiveCount={railActiveCount}
      kpis={kpis}
      setKpiFilter={setKpiFilter}
      kpiFilter={kpiFilter}
      setPriorityGroup={setPriorityGroup}
      priorityGroup={priorityGroup}
      groupConfig={groupConfig}
      railStatusFilter={railStatusFilter}
      setRailStatusFilter={setRailStatusFilter}
      setRailRiskFilters={setRailRiskFilters}
      railRiskFilters={railRiskFilters}
      toggleRailFilter={toggleRailFilter}
      railCertFilters={railCertFilters}
      setRailCertFilters={setRailCertFilters}
      railMunicipioOptions={railMunicipioOptions}
      railMunicipioFilters={railMunicipioFilters}
      setRailMunicipioFilters={setRailMunicipioFilters}
      railSanitaryComplexityFilter={railSanitaryComplexityFilter}
      setRailSanitaryComplexityFilter={setRailSanitaryComplexityFilter}
      railSanitaryComplexityOptions={railSanitaryComplexityOptions}
      formatSanitaryComplexityLabel={formatSanitaryComplexityLabel}
      railUrgencyMin={railUrgencyMin}
      railUrgencyMax={railUrgencyMax}
      setRailUrgencyMin={setRailUrgencyMin}
      setRailUrgencyMax={setRailUrgencyMax}
      clearSharedRailFilters={clearSharedRailFilters}
    />
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden xl:block">{rail}</div>
        <section className="space-y-4">
          <DomainSubnav activeTab={activeTab} onTabChange={onTabChange} />

          <div className="flex flex-wrap gap-2">
            {activeFilterBadges.map((badge) => (
              <button
                key={badge.key}
                type="button"
                onClick={badge.onClear}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                title="Remover filtro"
              >
                {badge.label}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
            {activeFilterBadges.length === 0 ? (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                Sem filtros adicionais ativos
              </span>
            ) : null}
          </div>

          <LicenceHeroCards items={heroKpis} />

          <Card className="border-subtle bg-card">
            <CardContent className="space-y-3 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Grupo Matriz por empresa */}
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={view === "matriz" ? "default" : "ghost"} className={view === "matriz" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("matriz")}>
                      Visão Geral
                    </Button>
                  </div>

                  <Button size="sm" variant={view === "tipos" ? "default" : "ghost"} className={view === "tipos" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("tipos")}>
                    Por Tipo
                  </Button>

                  <div className="relative">
                    <Button size="sm" variant={view === "renovacoes" ? "default" : "ghost"} className={view === "renovacoes" ? "bg-slate-900 text-white hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"} onClick={() => setView("renovacoes")}>
                      Renovações
                    </Button>
                    {renovacoesNotificacaoCount > 0 && <span className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{renovacoesNotificacaoCount}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {view === "matriz" ? (
                    <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
                      <button type="button" onClick={() => setMatrixViewMode("table")} className={`rounded-md p-2 transition ${matrixViewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} title="Visualização em tabela"><Logs className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setMatrixViewMode("cards")} className={`rounded-md p-2 transition ${matrixViewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} title="Visualização em cards"><LayoutGrid className="h-4 w-4" /></button>
                    </div>
                  ) : null}
                  <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 xl:hidden" onClick={() => setOpenRailMobile(true)}>
                    <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Filtros avançados
                  </Button>
                  {canManageLicencas && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" data-testid="licencas-upload-action" disabled={uploading || scanRunning}>
                          {uploading ? "Enviando..." : (scanRunning ? "Escaneando..." : "Atualizar licenças")}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={triggerUpload} data-testid="licencas-action-new"><FileDown className="mr-2 h-4 w-4" />Nova Licença</DropdownMenuItem>
                        <DropdownMenuItem onClick={triggerScanFull} data-testid="licencas-action-scan-full"><BookDown className="mr-2 h-4 w-4" />Scan completo</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por empresa, CNPJ, tipo ou município" className="h-9 border-slate-200 bg-slate-50 xl:col-span-2" />
                <Select value={quickMunicipio} onValueChange={setQuickMunicipio}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><MapPin className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Município" /></SelectTrigger>
                  <SelectContent>{municipios.map((m) => <SelectItem key={m} value={m}>{m === "todos" ? "Todos municípios" : m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickTipo} onValueChange={setQuickTipo}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><FileMinus className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos tipos</SelectItem>{TIPOS.map((tipo) => <SelectItem key={tipo.key} value={tipo.key}>{tipo.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickStatus} onValueChange={setQuickStatus}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50"><Clipboard className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent><SelectItem value="todos">Todos status</SelectItem>{STATUS_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{formatStatusDisplay(opt)}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickScoreRisk} onValueChange={setQuickScoreRisk}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50" data-testid="licencas-score-risk-filter"><ChartBarIncreasing className="h-4 w-4 text-slate-500" /><SelectValue placeholder="Risco score" /></SelectTrigger>
                  <SelectContent>{SCORE_RISK_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={quickScoreStatus} onValueChange={setQuickScoreStatus}>
                  <SelectTrigger className="h-9 border-slate-200 bg-slate-50" data-testid="licencas-score-status-filter"><SelectValue placeholder="Status do score" /></SelectTrigger>
                  <SelectContent>{SCORE_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant={somenteAlertasLocal ? "default" : "outline"} className={somenteAlertasLocal ? "bg-slate-900 text-white hover:bg-slate-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"} onClick={() => setSomenteAlertasLocal((value) => !value)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Somente alertas</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><ArrowUpDown className="mr-1 h-3.5 w-3.5" />{SORT_OPTIONS.find((item) => item.value === sortField)?.label || "Score"}<span className="ml-1 text-xs text-blue-700">{sortDir === "asc" ? "↑" : "↓"}</span><ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-2">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</p>
                      <div className="space-y-1">
                        {SORT_OPTIONS.map((option) => {
                          const isActive = sortField === option.value;
                          return <button key={option.value} type="button" onClick={() => { if (isActive) { setSortDir((prev) => (prev === "asc" ? "desc" : "asc")); } else { setSortField(option.value); setSortDir(option.defaultDir); } }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm ${isActive ? "bg-slate-100 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}><span>{option.label}</span><span className="text-xs text-slate-500">{isActive ? (sortDir === "asc" ? "Crescente" : "Decrescente") : ""}</span></button>;
                        })}
                      </div>
                      <div className="mt-2 border-t border-slate-200 pt-2"><Button size="sm" variant="outline" className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}>Direção: {sortDir === "asc" ? "Crescente" : "Decrescente"}</Button></div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Select value={priorityGroup} onValueChange={setPriorityGroup}><SelectTrigger className="h-9 w-[220px] border-slate-200 bg-slate-50"><SelectValue placeholder="Criticidade" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas criticidades</SelectItem>{groupConfig.map((cfg) => <SelectItem key={cfg.key} value={cfg.key}>{cfg.label}</SelectItem>)}</SelectContent></Select>
                  <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearContextFilters}>Limpar filtros da aba</Button>
                </div>
                <span className="text-sm text-slate-500">{sortedFiltered.length} registros exibidos</span>
              </div>

              <input ref={fileInputRef} className="hidden" type="file" multiple accept=".pdf,.jpg,.png" onChange={onSelectFiles} />
            </CardContent>
          </Card>

          {view === "renovacoes" && (
            <div className="space-y-3">
              {groupConfig.map((cfg) => {
                const list = grouped.get(cfg.key) || [];
                return (
                  <Card key={cfg.key} className="overflow-hidden border-subtle bg-card">
                    <CardHeader className={`pb-2 ${cfg.variant === "danger" ? "bg-rose-50/60" : "bg-amber-50/60"}`}><CardTitle className="flex items-center gap-2 text-base">{cfg.label}<span className="inline-flex min-w-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{list.length}</span></CardTitle></CardHeader>
                    <CardContent className="space-y-2 p-3">
                      {list.length === 0 && <p className="text-sm text-slate-500">Sem itens neste grupo.</p>}
                      {list.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} onClick={() => openCompanyCadastro(item)} size="base" />
                                {item.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Sem vínculo</span> : null}
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{resolveLicencaTipo(item.tipo).label}</span>
                                {item?.licence_field === "alvara_funcionamento" ? (
                                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    {formatAlvaraKindLabel(item?.alvara_funcionamento_kind)}
                                  </span>
                                ) : null}
                                <StatusBadge status={formatStatusWithDate(item)} />
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-urgencia">Score: {Number.isFinite(item?.score_urgencia) ? item.score_urgencia : "—"} <ScoreLegendInfo /></span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-risk">Risco: {formatScoreRiskLabel(item?.risco_consolidado)}</span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1" data-testid="licencas-score-status">Status score: {formatScoreStatusLabel(item?.score_status)}</span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1">Município: {item?.municipio || "—"}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setDrawerItem(item)}>Detalhes</Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">Ações <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56"><DropdownMenuItem onClick={() => enqueueToast?.("Processo iniciado (atalho).")}>Iniciar processo</DropdownMenuItem><DropdownMenuItem onClick={() => enqueueToast?.("Contato registrado (atalho).")}>Registrar contato</DropdownMenuItem>{item?.cnpj && handleCopy ? <DropdownMenuItem onClick={() => handleCopy(item.cnpj, `CNPJ copiado: ${item.cnpj}`)}>Copiar CNPJ</DropdownMenuItem> : null}</DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {view === "matriz" && (
            <LicenceMatrix
              matrixViewMode={matrixViewMode}
              MATRIX_TIPOS={MATRIX_TIPOS}
              TIPOS={TIPOS}
              empresasMatriz={empresasMatriz}
              matrizCards={matrizCards}
              setDrawerItem={setDrawerItem}
              enqueueToast={enqueueToast}
              formatMatrixStatus={formatMatrixStatus}
              formatStatusWithDate={formatStatusWithDate}
            />
          )}

          {view === "tipos" && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-5">
                {kpis.map((kpi) => (
                  <button key={kpi.key} type="button" onClick={() => setKpiFilter((current) => (current === kpi.key ? "todos" : kpi.key))} className={`rounded-xl border p-3 text-left transition ${kpiFilter === kpi.key ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"}`}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</div><div className="mt-1 text-2xl font-semibold">{kpi.value}</div>
                  </button>
                ))}
              </div>
              <Card className="overflow-hidden border-subtle bg-card">
                <CardHeader><CardTitle>Tabela por tipo</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[560px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur"><TableRow><TableHead>Empresa</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead><TableHead>Município</TableHead><TableHead>Score</TableHead><TableHead>Risco</TableHead><TableHead>Status score</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sortedFiltered.map((item, idx) => (
                          <TableRow key={`${item.id}-${idx}`}>
                            <TableCell><div className="flex items-center gap-2"><CopyableCompanyName value={item.empresa_display} onCopy={handleCopy} onClick={() => openCompanyCadastro(item)} size="base" />{item.sem_vinculo ? <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Sem vínculo</span> : null}</div></TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">{resolveLicencaTipo(item.tipo).label}</span>
                                {item?.licence_field === "alvara_funcionamento" ? (
                                  <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    {formatAlvaraKindLabel(item?.alvara_funcionamento_kind)}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell><StatusBadge status={item.status_label} /></TableCell>
                            <TableCell>{item.validade_br_display || "—"}</TableCell>
                            <TableCell>{item.municipio || "—"}</TableCell>
                            <TableCell>{Number.isFinite(item?.score_urgencia) ? item.score_urgencia : "—"}</TableCell>
                            <TableCell><span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700" data-testid="licencas-score-risk">{formatScoreRiskLabel(item?.risco_consolidado)}</span></TableCell>
                            <TableCell><span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700" data-testid="licencas-score-status">{formatScoreStatusLabel(item?.score_status)}</span></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </section>
      </div>


      <SideDrawer
        open={openRailMobile}
        onClose={() => setOpenRailMobile(false)}
        subtitle="Licenças"
        title="Rail de filtros"
      >
        {rail}
      </SideDrawer>

      <LicenceEditDrawer
        open={Boolean(drawerItem)}
        item={drawerItem}
        onClose={() => setDrawerItem(null)}
        onSaved={onRefreshData}
        enqueueToast={enqueueToast}
        fetchJson={fetchJson}
        getStatusKey={getStatusKey}
        formatStatusDisplay={formatStatusDisplay}
        displayEmpresa={displayEmpresa}
        formatAlvaraKindLabel={formatAlvaraKindLabel}
        statusOptions={STATUS_OPTIONS}
        alvaraFuncionamentoKindOptions={ALVARA_FUNCIONAMENTO_KIND_OPTIONS}
        motivoOptions={MOTIVO_OPTIONS}
      />
      <LicenceUploadAssistDrawer
        open={uploadDrawerOpen}
        onClose={() => setUploadDrawerOpen(false)}
        draft={uploadDraft}
        setDraft={setUploadDraft}
        onConfirm={submitAssistedUpload}
        onAddFiles={triggerAddUploadFiles}
        uploading={uploading}
        companyOptions={companyOptions}
        detectKindOptions={DETECT_KIND_OPTIONS}
      />
    </div>
  );
}








