import React, { useCallback, useMemo } from "react";
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
import { TAXA_ALERT_KEYS, TAXA_COLUMNS } from "@/lib/constants";
import { formatStatusDisplay } from "@/lib/domain/status/display";
import { getStatusKey, hasRelevantStatus, isAlertStatus } from "@/lib/domain/status/common";
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
  Building2,
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
import DomainSubnav from "@/components/navigation/DomainSubnav";
import useTaxRows from "@/hooks/taxas/useTaxRows";
import TaxMatrix from "@/components/taxas/TaxMatrix";
import TaxFilterRail from "@/components/taxas/TaxFilterRail";
import useTaxFilters from "@/hooks/taxas/useTaxFilters";

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
  { value: "vencimento_asc", label: "Vencimento (mais próximo)" },
  { value: "vencimento_desc", label: "Vencimento (mais distante)" },
  { value: "envio_desc", label: "Último envio (mais recente)" },
];

const TAX_EMPRESA_SORT_OPTIONS = [
  { value: "empresa", label: "Empresa", defaultDir: "asc" },
  { value: "municipio", label: "Município", defaultDir: "asc" },
  { value: "status_geral", label: "Status geral", defaultDir: "asc" },
  { value: "data_envio", label: "Último envio", defaultDir: "desc" },
];

const TAX_LINE_ITEMS = [
  { key: "func", label: "FUNC", cardLabel: "Funcionamento" },
  { key: "publicidade", label: "PUB", cardLabel: "Publicidade" },
  { key: "sanitaria", label: "SAN", cardLabel: "Vig. Sanitária" },
  { key: "localizacao_instalacao", label: "LOC", cardLabel: "Localização" },
  { key: "area_publica", label: "ÁREA", cardLabel: "Área pública" },
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
            <span>{taxa.municipio || "—"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
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

  const filteredTaxas = useTaxRows({
    taxas,
    matchesMunicipioFilter,
    matchesQuery,
    resolveCompany,
    certificadoIndex,
    resolveEmpresaCertificadoSituacao,
    getCompanyStatusKey,
    getCompanyRiskKey,
    getCertBucketKey,
    getCompanyUrgencyScore,
    hasCompanyAlert,
  });

  const alertFilterActive = Boolean(modoFoco || soAlertas);

  const taxasGlobais = useMemo(() => {
    if (!alertFilterActive) return filteredTaxas;
    return filteredTaxas.filter((taxa) => TAXA_ALERT_KEYS.some((key) => isAlertStatus(taxa?.[key])));
  }, [alertFilterActive, filteredTaxas]);

  const {
    queueFilter,
    setQueueFilter,
    sortEmpresas,
    setSortEmpresas,
    viewMode,
    setViewMode,
    localSearch,
    setLocalSearch,
    summaryFilter,
    setSummaryFilter,
    railFilters,
    setRailFilters,
    municipioOptions,
    localSearchScoped,
    queueCounts,
    taxasVisiveisOrdenadas,
    resumoCards,
    activeFilterChips,
    railActiveCount,
    clearRailFilters,
    toggleRailFilter,
    chipClass,
  } = useTaxFilters({
    taxasGlobais,
    municipio,
    query,
    alertFilterActive,
    modoFoco,
    defaultRiskKeys: DEFAULT_RISK_KEYS,
    defaultCertBuckets: DEFAULT_CERT_BUCKETS,
    riskOptions: RISK_OPTIONS,
    certOptions: CERT_OPTIONS,
    statusFilterOptions: STATUS_FILTER_OPTIONS,
    workQueueItems: WORK_QUEUE_ITEMS,
    tipoKeys,
    matchLocalSearch,
    getResumoBucket,
    matchesQueueFilter,
    parseSortableDate,
    getDataEnvioDisplay,
  });

  const openEditTaxa = (taxa) => {
    const taxId = taxa?.id ?? taxa?.taxa_id;
    if (!taxId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-tax", {
        detail: { mode: "edit", taxId, taxa },
      }),
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <TaxFilterRail
        taxasGlobaisLength={taxasGlobais.length}
        railActiveCount={railActiveCount}
        RailFilterBlock={RailFilterBlock}
        STATUS_FILTER_OPTIONS={STATUS_FILTER_OPTIONS}
        WORK_QUEUE_ITEMS={WORK_QUEUE_ITEMS}
        summaryFilter={summaryFilter}
        setSummaryFilter={setSummaryFilter}
        queueFilter={queueFilter}
        setQueueFilter={setQueueFilter}
        localSearchScopedLength={localSearchScoped.length}
        queueCounts={queueCounts}
        chipClass={chipClass}
        railFilters={railFilters}
        setRailFilters={setRailFilters}
        DEFAULT_RISK_KEYS={DEFAULT_RISK_KEYS}
        RISK_OPTIONS={RISK_OPTIONS}
        toggleRailFilter={toggleRailFilter}
        DEFAULT_CERT_BUCKETS={DEFAULT_CERT_BUCKETS}
        CERT_OPTIONS={CERT_OPTIONS}
        municipioOptions={municipioOptions}
        clearRailFilters={clearRailFilters}
      />

      <section className="space-y-4">
        <DomainSubnav activeTab={activeTab} onTabChange={onTabChange} />

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
                {canManageTaxas ? (
                  <button
                    type="button"
                    onClick={() => void taxPortalSync.requestOpen()}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100"
                    title="Iniciar consulta bulk de taxas"
                    aria-label="Iniciar consulta bulk de taxas"
                    data-testid="tax-portal-sync-open"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                ) : null}
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

          <TaxMatrix
            taxasVisiveisOrdenadas={taxasVisiveisOrdenadas}
            viewMode={viewMode}
            emptyStateText="Nenhuma taxa correspondente ao filtro."
            resolveTaxaKey={resolveTaxaKey}
            TaxPrototypeCard={TaxPrototypeCard}
            handleCopy={handleCopy}
            openEditTaxa={openEditTaxa}
            TAX_LINE_ITEMS={TAX_LINE_ITEMS}
            MatrixCompanyCell={MatrixCompanyCell}
            getDisplayStatusForField={getDisplayStatusForField}
            MatrixCell={MatrixCell}
          />
        </div>

        <TaxPortalSyncManager sync={taxPortalSync} />
      </section>
    </div>
  );
}

export default TaxasScreen;
