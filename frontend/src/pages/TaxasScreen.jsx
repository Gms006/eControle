import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { Chip } from "@/components/Chip";
import TaxPortalSyncManager from "@/components/header/TaxPortalSyncManager";
import { useTaxPortalSync } from "@/hooks/useTaxPortalSync";
import { TAXA_ALERT_KEYS, TAXA_COLUMNS, TAXA_SEARCH_KEYS } from "@/lib/constants";
import { formatStatusDisplay, getStatusKey, hasRelevantStatus, isAlertStatus } from "@/lib/status";
import { ResumoTipoCardTaxa } from "@/components/ResumoTipoCard";
import { buildCertificadoIndex, categorizeCertificadoSituacao, resolveEmpresaCertificadoSituacao } from "@/lib/certificados";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FolderKanban,
  LayoutGrid,
  LayoutDashboard,
  Logs,
  PencilLine,
  Receipt,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  formatTaxOpenStatus,
  getDataEnvioDisplay,
  isEnvioPendente,
  isTaxStatusEmAberto,
  isTaxStatusPendente,
} from "@/lib/taxes";
import { isInstallmentInProgress } from "@/lib/installment";
import { removeDiacritics } from "@/lib/text";

const TAXA_ICON_COMPONENTS = {
  tpi: Receipt,
  taxa_funcionamento: FileCheck2,
  taxa_publicidade: BriefcaseBusiness,
};

const TAXA_ICON_COLORS = {
  tpi: "bg-indigo-100 text-indigo-700",
  taxa_funcionamento: "bg-blue-100 text-blue-700",
  taxa_publicidade: "bg-fuchsia-100 text-fuchsia-700",
  taxa_sanitaria: "bg-sky-100 text-sky-700",
  bombeiros: "bg-red-100 text-red-700",
  localizacao_instalacao: "bg-green-100 text-green-700",
  area_publica: "bg-yellow-100 text-yellow-700",
};

const WORK_QUEUE_ITEMS = [
  { key: "all", label: "Todas as filas" },
  { key: "em_aberto", label: "Em aberto" },
  { key: "vencidas", label: "Vencidas/Atrasadas" },
  { key: "vence_7_dias", label: "Vence em <=7 dias" },
  { key: "sem_status", label: "Sem status" },
  { key: "isentas", label: "Isentas" },
  { key: "parcelado_andamento", label: "Parcelado em andamento" },
  { key: "envio_pendente", label: "Envio pendente" },
];

const TAX_SORT_OPTIONS = [
  { value: "empresa_asc", label: "Empresa (A-Z)" },
  { value: "empresa_desc", label: "Empresa (Z-A)" },
  { value: "status_asc", label: "Status (A-Z)" },
  { value: "vencimento_asc", label: "Vencimento (mais pr\u00F3ximo)" },
  { value: "vencimento_desc", label: "Vencimento (mais distante)" },
  { value: "envio_desc", label: "\u00DAltimo envio (mais recente)" },
];

const TAX_EMPRESA_SORT_OPTIONS = [
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "municipio", label: "Munic\u00EDpio", defaultDir: "asc" },
  { value: "status_geral", label: "Status geral", defaultDir: "asc" },
  { value: "data_envio", label: "\u00DAltimo envio", defaultDir: "desc" },
];

const TAX_LINE_ITEMS = [
  { key: "func", label: "FUNC", cardLabel: "Funcionamento" },
  { key: "publicidade", label: "PUB", cardLabel: "Publicidade" },
  { key: "sanitaria", label: "SAN", cardLabel: "Vig. Sanit\u00E1ria" },
  { key: "localizacao_instalacao", label: "LOC", cardLabel: "Localiza\u00E7\u00E3o" },
  { key: "area_publica", label: "\u00C1REA", cardLabel: "\u00C1rea p\u00FAblica" },
  { key: "bombeiros", label: "BOMB", cardLabel: "Bombeiros" },
  { key: "tpi", label: "TPI", cardLabel: "TPI", getVencimento: (taxa) => getVencimentoTpi(taxa) },
];

const TAX_STATUS_FIELD_BY_LINE_KEY = {
  func: "taxa_funcionamento",
  publicidade: "taxa_publicidade",
  sanitaria: "taxa_vig_sanitaria",
  localizacao_instalacao: "taxa_localiz_instalacao",
  area_publica: "taxa_ocup_area_publica",
  bombeiros: "taxa_bombeiros",
  tpi: "tpi",
  iss: "iss",
};

const TAXAS_SUBNAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: BriefcaseBusiness },
  { key: "licencas", label: "Licen\u00E7as", icon: ScrollText },
  { key: "taxas", label: "Taxas", icon: Receipt },
  { key: "processos", label: "Processos", icon: FolderKanban },
  { key: "certificados", label: "Certificados", icon: ShieldCheck },
];

const DEFAULT_RISK_KEYS = ["high", "medium", "low", "unmapped"];
const DEFAULT_CERT_BUCKETS = ["valido", "vencendo", "vencido", "sem_certificado"];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "em_dia", label: "Em dia" },
  { value: "pendente", label: "Pendentes" },
  { value: "irregular", label: "Irregulares" },
];

const MATRIX_CELL_CLASSES = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-500",
};

const SUMMARY_CARD_STYLES = {
  total: { icon: Receipt, iconClass: "bg-slate-100 text-slate-700" },
  em_dia: { icon: CheckCircle2, iconClass: "bg-emerald-100 text-emerald-700" },
  pendente: { icon: Clock3, iconClass: "bg-amber-100 text-amber-700" },
  irregular: { icon: AlertTriangle, iconClass: "bg-rose-100 text-rose-700" },
};

const RISK_OPTIONS = [
  { key: "high", label: "Alto" },
  { key: "medium", label: "Médio" },
  { key: "low", label: "Baixo" },
  { key: "unmapped", label: "Sem mapeamento" },
];

const CERT_OPTIONS = [
  { key: "valido", label: "Válido" },
  { key: "vencendo", label: "Vencendo" },
  { key: "vencido", label: "Vencido" },
  { key: "sem_certificado", label: "Sem certificado" },
];

const normalizeKey = (value) => removeDiacritics(String(value ?? "").toLowerCase()).replace(/\s+/g, "_").trim();
const resolveCompanyId = (item) => String(item?.empresa_id ?? item?.empresaId ?? item?.company_id ?? item?.companyId ?? item?.id ?? "").trim() || undefined;
const resolveCnpjKey = (value) => String(value ?? "").replace(/\D/g, "").trim() || undefined;

const getCompanyRiskKey = (empresa) => {
  const key = normalizeKey(empresa?.risco_consolidado ?? empresa?.riscoConsolidado ?? empresa?.score_status ?? empresa?.scoreStatus);
  if (key.includes("high") || key.includes("alto")) return "high";
  if (key.includes("medium") || key.includes("medio")) return "medium";
  if (key.includes("low") || key.includes("baixo")) return "low";
  return "unmapped";
};

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
  const isActive = parseCompanyIsActive(empresa?.is_active);
  if (isActive === true) return "Ativas";
  if (isActive === false) return "Inativas";
  return "Todas";
};

const getCompanyUrgencyScore = (empresa, companyHasAlert) => {
  const explicit = Number(empresa?.score_urgencia ?? empresa?.scoreUrgencia ?? empresa?.profile?.score_urgencia ?? empresa?.profile?.scoreUrgencia);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const riskKey = getCompanyRiskKey(empresa);
  const riskBase = riskKey === "high" ? 74 : riskKey === "medium" ? 58 : riskKey === "low" ? 36 : 48;
  return Math.max(0, Math.min(100, riskBase + (companyHasAlert(empresa) ? 18 : 0)));
};

const getCertBucketKey = (situacao) => {
  const category = categorizeCertificadoSituacao(situacao);
  if (category.includes("VÁLIDO")) return "valido";
  if (category.includes("VENCE DENTRO")) return "vencendo";
  if (category.includes("VENCIDO")) return "vencido";
  return "sem_certificado";
};

const parseSortableDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const normalizedYear = year ? Number(year) : new Date().getFullYear();
      return new Date(normalizedYear, Number(month) - 1, Number(day)).getTime();
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

function formatVencimentoCurto(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, , month, day] = isoMatch;
      return `${day}/${month}`;
    }
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/);
    if (slashMatch) {
      const [, day, month] = slashMatch;
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function formatVencimentoDisplay(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      if (!year) return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${String(year).padStart(4, "20")}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`;
}

const getVencimentoTpi = (taxa) =>
  taxa?.vencimento_tpi ?? taxa?.vencimentoTpi ?? taxa?.tpi_vencimento ?? taxa?.vencimento;

const resolveTaxaKey = (taxa, index) =>
  taxa?.id ?? taxa?.taxa_id ?? taxa?.empresa_id ?? taxa?.empresa ?? index;

const getQueueStatusFields = (taxa) => [
  taxa?.tpi,
  taxa?.func,
  taxa?.publicidade,
  taxa?.sanitaria,
  taxa?.localizacao_instalacao,
  taxa?.area_publica,
  taxa?.bombeiros,
  taxa?.iss,
  taxa?.taxa_funcionamento,
  taxa?.taxa_publicidade,
  taxa?.taxa_vig_sanitaria,
  taxa?.taxa_localiz_instalacao,
  taxa?.taxa_ocup_area_publica,
  taxa?.taxa_bombeiros,
];

const hasAnyStatus = (taxa, tipoKeys) => tipoKeys.some((key) => hasRelevantStatus(taxa?.[key]));
const hasAnyEmAberto = (taxa) => getQueueStatusFields(taxa).some((value) => isTaxStatusEmAberto(value));
const hasAnyIsenta = (taxa) => getQueueStatusFields(taxa).some((value) => getStatusKey(value) === "isento");
const hasAnyInstallmentInProgress = (taxa) =>
  getQueueStatusFields(taxa).some((value) => isInstallmentInProgress(value));

const isParceladoEmAndamento = (status) => {
  const key = getStatusKey(status || "");
  if (!key.includes("parcel")) return false;
  if (isInstallmentInProgress(status)) return true;
  if (key.includes("andament")) return true;
  return !key.includes("quitad") && !key.includes("pago");
};

const isTaxaIrregular = (taxa) =>
  getQueueStatusFields(taxa).some((value) => isTaxStatusEmAberto(value) || isParceladoEmAndamento(value));

const getTpiDiffDays = (taxa) => {
  const ts = parseSortableDate(getVencimentoTpi(taxa));
  if (ts === null) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.floor((ts - base) / 86400000);
};

const matchesQueueFilter = (taxa, queueFilter, tipoKeys) => {
  if (!queueFilter || queueFilter === "all") return true;
  if (queueFilter === "em_aberto") return hasAnyEmAberto(taxa);
  if (queueFilter === "vencidas") {
    const diff = getTpiDiffDays(taxa);
    return typeof diff === "number" && diff < 0;
  }
  if (queueFilter === "vence_7_dias") {
    const diff = getTpiDiffDays(taxa);
    return typeof diff === "number" && diff >= 0 && diff <= 7;
  }
  if (queueFilter === "sem_status") return !hasAnyStatus(taxa, tipoKeys);
  if (queueFilter === "isentas") return hasAnyIsenta(taxa);
  if (queueFilter === "parcelado_andamento") return hasAnyInstallmentInProgress(taxa);
  if (queueFilter === "envio_pendente") return Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  return true;
};

const getOpenYearsRawForField = (taxa, fieldKey) => {
  const raw = taxa?.raw;
  if (!raw || typeof raw !== "object") return null;
  const canonicalField = TAX_STATUS_FIELD_BY_LINE_KEY[fieldKey] || fieldKey;
  const canonicalYears = raw?.[`${canonicalField}_anos_em_aberto`];
  if (canonicalYears !== undefined && canonicalYears !== null) return canonicalYears;
  return raw?.[`${fieldKey}_anos_em_aberto`] ?? null;
};

const getDisplayStatusForField = (taxa, fieldKey) => {
  const rawStatus = taxa?.[fieldKey];
  const openYearsRaw = getOpenYearsRawForField(taxa, fieldKey);
  return formatTaxOpenStatus(rawStatus, openYearsRaw);
};

const matchLocalSearch = (taxa, search) => {
  const normalized = String(search || "").trim().toLowerCase();
  if (!normalized) return true;
  return [taxa?.empresa, taxa?.cnpj, taxa?.municipio]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
};

const getResumoBucket = (taxa) => {
  const statusKey = getStatusKey(taxa?.status_geral || taxa?.status_taxas || "");
  const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  if (statusKey.includes("irregular") || isTaxaIrregular(taxa)) return "irregular";
  if (statusKey.includes("pend") || envioPendente) return "pendente";
  return "em_dia";
};

const getMatrixCellVisual = (status) => {
  const visual = getTaxStatusVisual(status);
  return { tone: visual.matrixTone, label: visual.label };
};

function SummaryCard({ label, value, cardKey, helper }) {
  const Icon = SUMMARY_CARD_STYLES[cardKey].icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${SUMMARY_CARD_STYLES[cardKey].iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RailFilterBlock({ label, chips = [], children }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-300 bg-slate-200/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">{label}</p>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={`${label}-${chip.label}`}
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
                chip.active
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600"
              } ${chip.muted ? "opacity-70" : ""}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const getTaxStatusVisual = (status) => {
  const key = getStatusKey(status || "");
  const label = formatStatusDisplay(status || "");
  if (!key) {
    return {
      variant: "outline",
      className: "min-w-[98px] justify-center border-slate-300 bg-slate-100 px-3 text-slate-700",
      label: "Sem status",
      matrixTone: "neutral",
    };
  }
  if (isTaxStatusEmAberto(status)) {
    return {
      variant: "danger",
      className: "min-w-[98px] justify-center border-rose-300 bg-rose-100 px-3 text-rose-900",
      label: "Em aberto",
      matrixTone: "danger",
    };
  }
  if (isInstallmentInProgress(status)) {
    return {
      variant: "warning",
      className: "min-w-[98px] justify-center border-amber-300 bg-amber-100 px-3 text-amber-900",
      label,
      matrixTone: "warn",
    };
  }
  if (isTaxStatusPendente(status) || key.includes("aguard") || key.includes("analise")) {
    return {
      variant: "warning",
      className: "min-w-[98px] justify-center border-amber-300 bg-amber-100 px-3 text-amber-900",
      label: label === "—" ? "Pendente" : label,
      matrixTone: "warn",
    };
  }
  if (key.includes("isento")) {
    return {
      variant: "teal",
      className: "min-w-[98px] justify-center border-teal-300 bg-teal-100 px-3 text-teal-900",
      label: "Isento",
      matrixTone: "neutral",
    };
  }
  if (key.includes("nao_aplicavel") || key.includes("nao_exigido") || key.includes("nao_se_aplica") || key === "n_a") {
    return {
      variant: "outline",
      className: "min-w-[98px] justify-center border-slate-300 bg-slate-100 px-3 text-slate-700",
      label: "N/A",
      matrixTone: "neutral",
    };
  }
  if (key.includes("pago") || key.includes("regular") || key.includes("em_dia") || key.includes("quitado") || key === "ok") {
    return {
      variant: "success",
      className: "min-w-[98px] justify-center border-emerald-300 bg-emerald-100 px-3 text-emerald-900",
      label: key.includes("em_dia") ? "Em dia" : label,
      matrixTone: "ok",
    };
  }
  return {
    variant: "warning",
    className: "min-w-[98px] justify-center border-amber-300 bg-amber-100 px-3 text-amber-900",
    label: label === "—" ? "Revisar" : label,
    matrixTone: "warn",
  };
};

function TaxStatusBadge({ status }) {
  const visual = getTaxStatusVisual(status);
  return (
    <Chip variant={visual.variant} className={visual.className}>
      {visual.label}
    </Chip>
  );
}

function CompactTaxStatusBadge({ status }) {
  const visual = getTaxStatusVisual(status);
  const toneClass =
    visual.matrixTone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : visual.matrixTone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : visual.matrixTone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-indigo-100 bg-indigo-50 text-indigo-700";
  return <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}>{visual.label}</span>;
}

function MatrixCell({ status, statusDisplay, vencimento }) {
  const visual = getMatrixCellVisual(statusDisplay ?? status);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`inline-flex min-h-9 min-w-[92px] items-center justify-center rounded-md border px-3 text-[10px] font-semibold uppercase tracking-wide ${
          MATRIX_CELL_CLASSES[visual.tone]
        }`}
        title={statusDisplay || status || "Sem status"}
      >
        {visual.label}
      </div>
      {vencimento ? <span className="text-[10px] font-medium text-slate-400">{formatVencimentoCurto(vencimento)}</span> : null}
    </div>
  );
}

function MatrixCompanyCell({ taxa, handleCopy, onEdit }) {
  const envio = getDataEnvioDisplay(taxa?.data_envio);
  const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  const resumoBucket = getResumoBucket(taxa);
  const resumoLabel = resumoBucket === "irregular" ? "Irregular" : resumoBucket === "pendente" ? "Pendente" : "Em dia";
  const resumoVariant = resumoBucket === "irregular" ? "danger" : resumoBucket === "pendente" ? "warning" : "success";
  const vencimentoTpi = formatVencimentoDisplay(getVencimentoTpi(taxa));

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CopyableCompanyName value={taxa.empresa} onCopy={handleCopy} size="base" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taxa.cnpj && handleCopy ? (
              <CopyableIdentifier label="CNPJ" value={taxa.cnpj} onCopy={handleCopy} />
            ) : null}
            <span>{taxa.municipio || "\u2014"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
              {`\u00DAltimo envio: ${envio.date || "\u2014"}`}
            </span>
            <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
              {envio.methodLabel || "Sem m\u00E9todo"}
            </span>
            {vencimentoTpi ? (
              <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                {`Venc. TPI: ${vencimentoTpi}`}
              </span>
            ) : null}
            {envioPendente ? (
              <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                Envio pendente
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Chip variant={resumoVariant} className="min-w-[92px] justify-center px-3">
            {resumoLabel}
          </Chip>
          <button
            type="button"
            onClick={onEdit}
            data-testid="tax-edit-button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <PencilLine className="h-3 w-3" />
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}

function TaxCompanyCard({ taxa, handleCopy, onEdit }) {
  const envio = getDataEnvioDisplay(taxa?.data_envio);
  const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  const resumoBucket = getResumoBucket(taxa);
  const resumoLabel = resumoBucket === "irregular" ? "Irregular" : resumoBucket === "pendente" ? "Pendente" : "Em dia";
  const resumoVariant = resumoBucket === "irregular" ? "danger" : resumoBucket === "pendente" ? "warning" : "success";
  const vencimentoTpi = formatVencimentoDisplay(getVencimentoTpi(taxa));

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CopyableCompanyName value={taxa.empresa} onCopy={handleCopy} size="base" className="w-full justify-start text-left text-slate-900" />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {taxa.cnpj && handleCopy ? (
              <CopyableIdentifier label="CNPJ" value={taxa.cnpj} onCopy={handleCopy} />
            ) : null}
            <span>{taxa.municipio || "—"}</span>
          </div>
        </div>
        <Chip variant={resumoVariant} className="min-w-[92px] justify-center px-3">
          {resumoLabel}
        </Chip>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
          {`Último envio: ${envio.date || "—"}`}
        </span>
        <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
          {envio.methodLabel || "Sem método"}
        </span>
        {vencimentoTpi ? (
          <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
            {`Venc. TPI: ${vencimentoTpi}`}
          </span>
        ) : null}
        {envioPendente ? (
          <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
            Envio pendente
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
        {TAX_LINE_ITEMS.map((item) => {
          const rawStatus = taxa?.[item.key];
          const statusDisplay = getDisplayStatusForField(taxa, item.key);
          const vencimento = item.getVencimento ? item.getVencimento(taxa) : null;
          return (
            <div key={`${resolveTaxaKey(taxa, item.key)}-${item.key}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</span>
                {vencimento ? <span className="text-[10px] font-medium text-slate-400">{formatVencimentoCurto(vencimento)}</span> : null}
              </div>
              <div className="mt-2">
                {hasRelevantStatus(rawStatus) ? <TaxStatusBadge status={statusDisplay ?? rawStatus} /> : <Chip variant="outline">Sem status</Chip>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onEdit}
          data-testid="tax-edit-button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <PencilLine className="h-3 w-3" />
          Editar
        </button>
      </div>
    </article>
  );
}

function TaxPrototypeCard({ taxa, handleCopy, onEdit }) {
  const envio = getDataEnvioDisplay(taxa?.data_envio);
  const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  const resumoBucket = getResumoBucket(taxa);
  const resumoLabel = resumoBucket === "irregular" ? "Irregular" : resumoBucket === "pendente" ? "Pendente" : "Em dia";
  const resumoClass =
    resumoBucket === "irregular"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : resumoBucket === "pendente"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CopyableCompanyName value={taxa.empresa} onCopy={handleCopy} size="base" className="w-full justify-start text-left text-slate-900" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {taxa.cnpj && handleCopy ? (
              <CopyableIdentifier label="CNPJ" value={taxa.cnpj} onCopy={handleCopy} />
            ) : null}
            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
              {`Último envio: ${envio.date || "—"}`}
            </span>
            {envio.methodLabel ? (
              <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                {envio.methodLabel}
              </span>
            ) : null}
            {envioPendente ? (
              <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                Pendente envio
              </span>
            ) : null}
          </div>
        </div>
        <span className={`inline-flex rounded-md border px-3 py-1 text-xs font-medium ${resumoClass}`}>
          {resumoLabel}
        </span>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-2">
        {TAX_LINE_ITEMS.map((item) => {
          const rawStatus = taxa?.[item.key];
          const statusDisplay = getDisplayStatusForField(taxa, item.key);
          const vencimento = item.getVencimento ? item.getVencimento(taxa) : null;
          return (
            <div key={`${resolveTaxaKey(taxa, item.key)}-${item.key}`} className="flex items-center justify-between gap-3 border-t border-slate-100 py-2.5 first:border-t-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{item.cardLabel || item.label}</span>
              <div className="flex items-center gap-2">
                {vencimento ? (
                  <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                    {`Venc.: ${formatVencimentoCurto(vencimento)}`}
                  </span>
                ) : null}
                {hasRelevantStatus(rawStatus) ? (
                  <CompactTaxStatusBadge status={statusDisplay ?? rawStatus} />
                ) : (
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                    Sem status
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onEdit}
          data-testid="tax-edit-button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <PencilLine className="h-3 w-3" />
          Editar
        </button>
      </div>
    </article>
  );
}

function TaxasScreen({
  taxas,
  empresas,
  certificados,
  modoFoco,
  soAlertas,
  matchesMunicipioFilter,
  matchesQuery,
  handleCopy,
  canManageTaxas = false,
  companyHasAlert,
  activeTab = "taxas",
  onTabChange,
  municipio = "Todos",
  query = "",
}) {
  const empresasList = Array.isArray(empresas) ? empresas : [];
  const certificadosList = Array.isArray(certificados) ? certificados : [];
  const hasCompanyAlert = useCallback((empresa) => (typeof companyHasAlert === "function" ? companyHasAlert(empresa) : false), [companyHasAlert]);
  const [queueFilter, setQueueFilter] = useState("all");
  const [sortEmpresas, setSortEmpresas] = useState({ field: "empresa", direction: "asc" });
  const [viewMode, setViewMode] = useState("table");
  const [localSearch, setLocalSearch] = useState("");
  const [summaryFilter, setSummaryFilter] = useState("all");
  const [railFilters, setRailFilters] = useState({
    companyStatus: "Ativas",
    riskKeys: [...DEFAULT_RISK_KEYS],
    certBuckets: [...DEFAULT_CERT_BUCKETS],
    municipio: [],
    urgencyMin: 0,
    urgencyMax: 100,
  });

  const handleTaxPortalSyncRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent("econtrole:refresh-data", { detail: { source: "tax-portal-sync" } }));
  }, []);

  const taxPortalSync = useTaxPortalSync({
    canManage: canManageTaxas,
    onRefresh: handleTaxPortalSyncRefresh,
  });

  const taxaTipos = useMemo(() => TAXA_COLUMNS.filter((column) => column.key !== "status_geral"), []);
  const tipoKeys = useMemo(() => taxaTipos.map((tipo) => tipo.key), [taxaTipos]);
  const companyIndexes = useMemo(() => {
    const byId = new Map();
    const byCnpj = new Map();
    empresasList.forEach((empresa) => {
      const id = resolveCompanyId(empresa);
      if (id) byId.set(id, empresa);
      const cnpj = resolveCnpjKey(empresa?.cnpj);
      if (cnpj) byCnpj.set(cnpj, empresa);
    });
    return { byId, byCnpj };
  }, [empresasList]);
  const certificadoIndex = useMemo(() => buildCertificadoIndex(certificadosList), [certificadosList]);
  const resolveCompany = useCallback((item) => {
    const id = resolveCompanyId(item);
    if (id && companyIndexes.byId.has(id)) return companyIndexes.byId.get(id);
    const cnpj = resolveCnpjKey(item?.cnpj ?? item?.company_cnpj);
    if (cnpj && companyIndexes.byCnpj.has(cnpj)) return companyIndexes.byCnpj.get(cnpj);
    return null;
  }, [companyIndexes]);

  const filteredTaxas = useMemo(
    () =>
      taxas.filter((taxa) => {
        if (!matchesMunicipioFilter(taxa)) return false;
        const camposPesquisa = [taxa.empresa, taxa.cnpj, ...TAXA_SEARCH_KEYS.map((key) => taxa?.[key])];
        return matchesQuery(camposPesquisa, {
          nome: [taxa.empresa],
          razao: [taxa.empresa],
          cnpj: [taxa.cnpj],
        });
      }).map((taxa) => {
        const company = resolveCompany(taxa);
        const certificadoSituacao = company ? resolveEmpresaCertificadoSituacao(company, certificadoIndex) : "";
        return {
          ...taxa,
          __company: company,
          __companyStatusKey: getCompanyStatusKey(company),
          __riskKey: getCompanyRiskKey(company),
          __certBucket: getCertBucketKey(certificadoSituacao || company?.certificado),
          __certificadoSituacao: certificadoSituacao || company?.certificado || "",
          __urgencyScore: getCompanyUrgencyScore(company, hasCompanyAlert),
        };
      }),
    [certificadoIndex, hasCompanyAlert, matchesMunicipioFilter, matchesQuery, resolveCompany, taxas],
  );

  const alertFilterActive = Boolean(modoFoco || soAlertas);

  const taxasGlobais = useMemo(() => {
    if (!alertFilterActive) return filteredTaxas;
    return filteredTaxas.filter((taxa) => TAXA_ALERT_KEYS.some((key) => isAlertStatus(taxa?.[key])));
  }, [alertFilterActive, filteredTaxas]);

  const municipioOptions = useMemo(
    () => Array.from(new Set(taxasGlobais.map((taxa) => String(taxa?.municipio || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" })),
    [taxasGlobais],
  );

  const railScopedTaxas = useMemo(
    () => {
      const result = taxasGlobais.filter((taxa) => {
        if (railFilters.companyStatus !== "Todas" && taxa.__companyStatusKey !== railFilters.companyStatus) return false;
        if (!railFilters.riskKeys.includes(taxa.__riskKey)) return false;
        if (!railFilters.certBuckets.includes(taxa.__certBucket)) return false;
        if (railFilters.municipio.length > 0 && !railFilters.municipio.includes(String(taxa?.municipio || "").trim())) return false;
        if (taxa.__urgencyScore < railFilters.urgencyMin || taxa.__urgencyScore > railFilters.urgencyMax) return false;
        return true;
      });
      return result;
    },
    [railFilters, taxasGlobais],
  );

  const localSearchScoped = useMemo(
    () => {
      return railScopedTaxas.filter((taxa) => matchLocalSearch(taxa, localSearch));
    },
    [localSearch, railScopedTaxas],
  );

  const summaryScoped = useMemo(() => {
    return summaryFilter === "all" ? localSearchScoped : localSearchScoped.filter((taxa) => getResumoBucket(taxa) === summaryFilter);
  }, [localSearchScoped, summaryFilter]);

  const queueCounts = useMemo(
    () =>
      Object.fromEntries(
        WORK_QUEUE_ITEMS.filter((item) => item.key !== "all").map((item) => [
          item.key,
          localSearchScoped.filter((taxa) => matchesQueueFilter(taxa, item.key, tipoKeys)).length,
        ]),
      ),
    [localSearchScoped, tipoKeys],
  );

  const taxasVisiveis = useMemo(
    () => {
      return summaryScoped.filter((taxa) => matchesQueueFilter(taxa, queueFilter, tipoKeys));
    },
    [queueFilter, summaryScoped, tipoKeys],
  );

  const resumoCards = useMemo(() => {
    const source = localSearchScoped;
    return {
      total: source.length,
      em_dia: source.filter((taxa) => getResumoBucket(taxa) === "em_dia").length,
      pendente: source.filter((taxa) => getResumoBucket(taxa) === "pendente").length,
      irregular: source.filter((taxa) => getResumoBucket(taxa) === "irregular").length,
    };
  }, [localSearchScoped]);

  const taxasVisiveisOrdenadas = useMemo(() => {
    const list = [...taxasVisiveis];
    const factor = sortEmpresas.direction === "desc" ? -1 : 1;
    list.sort((a, b) => {
      if (sortEmpresas.field === "data_envio") {
        const av = parseSortableDate(getDataEnvioDisplay(a?.data_envio).date) ?? 0;
        const bv = parseSortableDate(getDataEnvioDisplay(b?.data_envio).date) ?? 0;
        if (av === bv) return 0;
        return (av - bv) * factor;
      }
      if (sortEmpresas.field === "status_geral") {
        return getResumoBucket(a).localeCompare(getResumoBucket(b), "pt-BR", { sensitivity: "base" }) * factor;
      }
      const av = String(a?.[sortEmpresas.field] || "").trim();
      const bv = String(b?.[sortEmpresas.field] || "").trim();
      return av.localeCompare(bv, "pt-BR", { sensitivity: "base" }) * factor;
    });
    return list;
  }, [sortEmpresas.direction, sortEmpresas.field, taxasVisiveis]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (municipio && municipio !== "Todos") chips.push(`Munic\u00EDpio: ${municipio}`);
    if (query.trim()) chips.push(`Busca global: ${query.trim()}`);
    if (alertFilterActive) chips.push("Somente alertas");
    if (modoFoco) chips.push("Modo foco");
    if (railFilters.companyStatus !== "Ativas") chips.push(`Status da empresa: ${railFilters.companyStatus}`);
    if (railFilters.riskKeys.length !== DEFAULT_RISK_KEYS.length) chips.push(`Risco CNAE: ${railFilters.riskKeys.map((key) => RISK_OPTIONS.find((option) => option.key === key)?.label || key).join(", ")}`);
    if (railFilters.certBuckets.length !== DEFAULT_CERT_BUCKETS.length) chips.push(`Certificado: ${railFilters.certBuckets.map((key) => CERT_OPTIONS.find((option) => option.key === key)?.label || key).join(", ")}`);
    if (railFilters.municipio.length > 0) chips.push(`Município local: ${railFilters.municipio.join(", ")}`);
    if (railFilters.urgencyMin !== 0 || railFilters.urgencyMax !== 100) chips.push(`Score de urgência: ${railFilters.urgencyMin}-${railFilters.urgencyMax}`);
    if (localSearch.trim()) chips.push(`Busca local: ${localSearch.trim()}`);
    if (summaryFilter !== "all") {
      const option = STATUS_FILTER_OPTIONS.find((item) => item.value === summaryFilter);
      if (option) chips.push(`Status: ${option.label}`);
    }
    if (queueFilter !== "all") {
      const option = WORK_QUEUE_ITEMS.find((item) => item.key === queueFilter);
      if (option) chips.push(`Fila: ${option.label}`);
    }
    if (viewMode === "cards") chips.push("Visualização: Cards");
    return chips;
  }, [alertFilterActive, localSearch, modoFoco, municipio, query, queueFilter, railFilters, summaryFilter, viewMode]);

  const openEditTaxa = (taxa) => {
    const taxId = taxa?.id ?? taxa?.taxa_id;
    if (!taxId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-tax", {
        detail: { mode: "edit", taxId, taxa },
      }),
    );
  };

  const railActiveCount = useMemo(() => {
    let count = 0;
    if (railFilters.companyStatus !== "Ativas") count += 1;
    if (railFilters.riskKeys.length !== DEFAULT_RISK_KEYS.length) count += 1;
    if (railFilters.certBuckets.length !== DEFAULT_CERT_BUCKETS.length) count += 1;
    if (railFilters.municipio.length > 0) count += 1;
    if (railFilters.urgencyMin > 0 || railFilters.urgencyMax < 100) count += 1;
    return count;
  }, [railFilters]);

  const clearRailFilters = () => {
    setRailFilters({
      companyStatus: "Ativas",
      riskKeys: [...DEFAULT_RISK_KEYS],
      certBuckets: [...DEFAULT_CERT_BUCKETS],
      municipio: [],
      urgencyMin: 0,
      urgencyMax: 100,
    });
  };

  const toggleRailFilter = (key, field, defaults) => {
    setRailFilters((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      const next = current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
      return { ...prev, [field]: next.length ? next : [...defaults] };
    });
  };

  const chipClass = (active) => `rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
    active
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
  }`;

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden xl:block xl:self-start xl:sticky xl:top-0 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto">
        <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contexto</p>
              <h3 className="text-sm font-semibold text-slate-900">Filtros persistentes</h3>
              <p className="text-xs text-slate-500">Registros no recorte: {taxasGlobais.length}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-center">
              <div className="text-sm font-semibold leading-4 text-blue-700">{railActiveCount}</div>
              <div className="mt-1 text-[11px] font-medium leading-3 text-blue-700">{railActiveCount === 1 ? "ativo" : "ativos"}</div>
            </div>
          </div>

          <div className="space-y-3">
            <RailFilterBlock label="Filtros rápidos">
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setSummaryFilter(option.value)} className={chipClass(summaryFilter === option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {WORK_QUEUE_ITEMS.map((item) => (
                  <button key={item.key} type="button" onClick={() => setQueueFilter(item.key)} className={chipClass(queueFilter === item.key)}>
                    {item.label} <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px]">{item.key === "all" ? localSearchScoped.length : queueCounts[item.key] || 0}</span>
                  </button>
                ))}
              </div>
            </RailFilterBlock>

            <RailFilterBlock label="Status da empresa">
              <div className="flex flex-wrap gap-2">
                {["Ativas", "Inativas", "Todas"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRailFilters((prev) => ({ ...prev, companyStatus: value }))}
                    className={chipClass(railFilters.companyStatus === value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </RailFilterBlock>
            <RailFilterBlock label="Risco CNAE">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setRailFilters((prev) => ({ ...prev, riskKeys: [...DEFAULT_RISK_KEYS] }))} className={chipClass(railFilters.riskKeys.length === DEFAULT_RISK_KEYS.length)}>
                  Todos
                </button>
                {RISK_OPTIONS.map((option) => {
                  const active = railFilters.riskKeys.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleRailFilter(option.key, "riskKeys", DEFAULT_RISK_KEYS)}
                      className={chipClass(active)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </RailFilterBlock>
            <RailFilterBlock label="Certificado">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setRailFilters((prev) => ({ ...prev, certBuckets: [...DEFAULT_CERT_BUCKETS] }))} className={chipClass(railFilters.certBuckets.length === DEFAULT_CERT_BUCKETS.length)}>
                  Todos
                </button>
                {CERT_OPTIONS.map((option) => {
                  const active = railFilters.certBuckets.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => toggleRailFilter(option.key, "certBuckets", DEFAULT_CERT_BUCKETS)}
                      className={chipClass(active)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </RailFilterBlock>
            <RailFilterBlock label="Município">
              {municipioOptions.length === 0 ? <p className="text-xs text-slate-500">Sem municípios no recorte atual.</p> : null}
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {municipioOptions.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-700 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={railFilters.municipio.includes(item)}
                      onChange={() =>
                        setRailFilters((prev) => ({
                          ...prev,
                          municipio: prev.municipio.includes(item)
                            ? prev.municipio.filter((entry) => entry !== item)
                            : [...prev.municipio, item],
                        }))
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </RailFilterBlock>
            <div className="space-y-2.5 rounded-xl border border-slate-300 bg-slate-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">Score de urgência</p>
              <div className="relative h-6">
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-100" />
                <div className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-300" style={{ left: `${railFilters.urgencyMin}%`, width: `${Math.max(0, railFilters.urgencyMax - railFilters.urgencyMin)}%` }} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={railFilters.urgencyMin}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setRailFilters((prev) => ({ ...prev, urgencyMin: Math.min(value, prev.urgencyMax) }));
                  }}
                  className="ec-urgency-range"
                  aria-label="Score de urgência mínimo"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={railFilters.urgencyMax}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setRailFilters((prev) => ({ ...prev, urgencyMax: Math.max(value, prev.urgencyMin) }));
                  }}
                  className="ec-urgency-range"
                  aria-label="Score de urgência máximo"
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500"><span>{railFilters.urgencyMin}</span><span>{railFilters.urgencyMax}</span></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={clearRailFilters}>
                Limpar
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {TAXAS_SUBNAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onTabChange?.(item.key)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeFilterChips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
            >
              {chip}
            </span>
          ))}
          {activeFilterChips.length === 0 ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
              Sem filtros adicionais ativos
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total de registros" value={resumoCards.total} cardKey="total" />
          <SummaryCard label="Em dia" value={resumoCards.em_dia} cardKey="em_dia" />
          <SummaryCard label="Pendentes" value={resumoCards.pendente} cardKey="pendente" />
          <SummaryCard label="Irregulares" value={resumoCards.irregular} cardKey="irregular" helper="A\u00E7\u00E3o necess\u00E1ria" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Buscar por empresa..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center">
              <Select value={summaryFilter} onValueChange={setSummaryFilter}>
                <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Status geral" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={queueFilter} onValueChange={setQueueFilter}>
                <SelectTrigger className="h-11 min-w-[210px] rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Fila operacional" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_QUEUE_ITEMS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.key === "all"
                        ? option.label
                        : `${option.label} (${queueCounts[option.key] || 0})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={`${sortEmpresas.field}:${sortEmpresas.direction}`}
                onValueChange={(value) => {
                  const [field, direction] = value.split(":");
                  setSortEmpresas({ field, direction });
                }}
              >
                <SelectTrigger className="h-11 min-w-[220px] rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Ordena\u00E7\u00E3o" />
                </SelectTrigger>
                <SelectContent>
                  {TAX_EMPRESA_SORT_OPTIONS.flatMap((option) => [
                    <SelectItem key={`${option.value}:asc`} value={`${option.value}:asc`}>
                      {`${option.label} (${option.value === "data_envio" ? "mais antigo" : "A-Z"})`}
                    </SelectItem>,
                    <SelectItem key={`${option.value}:desc`} value={`${option.value}:desc`}>
                      {`${option.label} (${option.value === "data_envio" ? "mais recente" : "Z-A"})`}
                    </SelectItem>,
                  ])}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                {canManageTaxas ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="tax-portal-sync-open"
                    className="h-11 rounded-xl"
                    onClick={() => void taxPortalSync.requestOpen()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Taxas Bulk Sync
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Taxas</p>
                <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {viewMode === "cards" ? "Visão em cards por empresa" : "Matriz semafórica por empresa"}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`rounded-md p-2 transition ${viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                    title="Visualização em tabela"
                  >
                    <Logs className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`rounded-md p-2 transition ${viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
                    title="Visualização em cards"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
                <span className="inline-flex rounded-md px-2.5 py-1 text-sm font-medium text-slate-600">
                  {`${taxasVisiveisOrdenadas.length} resultados`}
                </span>
              </div>
            </div>
          </div>

          {taxasVisiveisOrdenadas.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma taxa correspondente ao filtro.</div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
              {taxasVisiveisOrdenadas.map((taxa, index) => (
                <TaxPrototypeCard
                  key={resolveTaxaKey(taxa, index)}
                  taxa={taxa}
                  handleCopy={handleCopy}
                  onEdit={() => openEditTaxa(taxa)}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="w-[420px] border-b border-slate-200 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Empresa
                    </th>
                    {TAX_LINE_ITEMS.map((item) => (
                      <th
                        key={`head-${item.key}`}
                        className="border-b border-slate-200 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                      >
                        {item.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {taxasVisiveisOrdenadas.map((taxa, index) => {
                    const taxaKey = resolveTaxaKey(taxa, index);
                    return (
                      <tr key={taxaKey} className="align-top hover:bg-slate-50/70">
                        <td className="border-b border-slate-200 px-4 py-4">
                          <MatrixCompanyCell taxa={taxa} handleCopy={handleCopy} onEdit={() => openEditTaxa(taxa)} />
                        </td>
                        {TAX_LINE_ITEMS.map((item) => {
                          const rawStatus = taxa?.[item.key];
                          const statusDisplay = getDisplayStatusForField(taxa, item.key);
                          return (
                            <td key={`${taxaKey}-${item.key}`} className="border-b border-slate-200 px-3 py-4 text-center">
                              <MatrixCell
                                status={rawStatus}
                                statusDisplay={statusDisplay}
                                vencimento={item.getVencimento ? item.getVencimento(taxa) : null}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <TaxPortalSyncManager sync={taxPortalSync} />
      </section>
    </div>
  );
}

export default TaxasScreen;
