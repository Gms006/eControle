import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronDown, CircleX, FileText, Import, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  FieldRow,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
} from "@/components/forms/DrawerFormPrimitives";
import {
  extractPrimaryPhoneDigits,
  formatMunicipioDisplay,
  normalizeEmail,
  normalizeMunicipio,
  normalizeTitleCase,
} from "@/lib/normalization";
import { toCanonicalIsoDate } from "@/lib/date";
import {
  TAX_DATA_ENVIO_METHOD_OPTIONS,
  formatDataEnvio,
  parseDataEnvio,
  toDateInputFromDataEnvio,
} from "@/lib/taxes";
import { formatStatusDisplay } from "@/lib/status";
import {
  deriveStatusFromInstallment,
  formatInstallment,
  normalizeInstallmentInput,
  parseInstallment,
  validateInstallmentInput,
} from "@/lib/installment";
import {
  cancelReceitaWSBulkSync,
  getActiveReceitaWSBulkSyncRun,
  getReceitaWSBulkSyncStatus,
  startReceitaWSBulkSync,
} from "@/services/receitawsBulkSync";

const EVT_OPEN_COMPANY = "econtrole:open-company";
const EVT_OPEN_PROCESS = "econtrole:open-process";
const EVT_OPEN_TAX = "econtrole:open-tax";
const EVT_REFRESH_DATA = "econtrole:refresh-data";
const BULK_SYNC_POLL_MS = 3000;
const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled"]);

const PROCESS_SITUACAO_LABELS = {
  pendente: "Pendente",
  em_analise: "Em análise",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  aguardando_vistoria: "Aguardando vistoria",
  aguardando_pagamento: "Aguardando pagamento",
  aguardando_regularizacao: "Aguardando regularização",
  aguardando_liberacao: "Aguardando liberação",
  concluido: "Concluído",
  licenciado: "Licenciado",
  notificacao: "Notificação",
  indeferido: "Indeferido",
  cancelado: "Cancelado",
};

const DEFAULT_DIVERSOS_OPERACOES = [
  { value: "abertura", label: "Abertura" },
  { value: "renovacao", label: "Renovação" },
  { value: "alteracao", label: "Alteração" },
  { value: "baixa", label: "Baixa" },
];

const DEFAULT_ORGAOS_OPTIONS = [
  { value: "prefeitura", label: "Prefeitura" },
  { value: "bombeiros", label: "Bombeiros" },
  { value: "vigilancia_sanitaria", label: "Vigilância Sanitária" },
];

const DEFAULT_ALVARA_OPTIONS = [
  { value: "sujeito", label: "Sujeito" },
  { value: "isento", label: "Isento" },
  { value: "nao_possui", label: "Não possui" },
];

const DEFAULT_SANITARIO_SERVICOS = [
  { value: "licenciamento", label: "Licenciamento" },
  { value: "renovacao", label: "Renovação" },
  { value: "vistoria", label: "Vistoria" },
];

const DEFAULT_SANITARIO_NOTIFICACOES = [
  { value: "sem_notificacao", label: "Sem Notificação" },
  { value: "notificado", label: "Notificado" },
  { value: "auto_infracao", label: "Auto de Infração" },
];

const DEFAULT_PROCESS_SITUACOES = Object.entries(PROCESS_SITUACAO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function normalizeEnumOptions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item.value === "string" && typeof item.label === "string")
    .map((item) => ({ value: item.value, label: item.label }));
}

function apiBase() {
  return (
    (import.meta.env?.VITE_API_BASE || import.meta.env?.VITE_API_BASE_URL || "")
      .replace(/\/$/, "")
  );
}

async function apiJson(endpoint, options = {}) {
  const base = apiBase();
  const url = endpoint.startsWith("http") ? endpoint : `${base}${endpoint}`;
  const token = localStorage.getItem("access_token");
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${txt}`.trim());
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : null;
}

function OverlayModal({ open, title, onClose, children, footer }) {
    // trava scroll do body enquanto modal estiver aberto
    useEffect(() => {
      if (!open) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }, [open]);

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
        <div className="w-full max-w-4xl my-6 rounded-xl bg-white shadow-xl max-h-[calc(100vh-3rem)] flex flex-col">
          <div className="flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-white z-10">
            <div className="text-sm font-semibold">{title}</div>
            <button
              className="rounded-md px-2 py-1 text-sm hover:bg-gray-100"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <div className="overflow-auto p-4">{children}</div>
          {footer ? (
            <div className="border-t px-4 py-3 sticky bottom-0 bg-white">
              {footer}
            </div>
          ) : null}
        </div>
      </div>,
      document.body
    );
  }

function SideDrawerForm({
  open,
  title,
  onClose,
  onSave,
  isDirty = false,
  isSaving = false,
  children,
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isDirty && !window.confirm("Existem alterações não salvas. Deseja fechar mesmo assim?")) return;
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirty, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const requestClose = () => {
    if (isDirty && !window.confirm("Existem alterações não salvas. Deseja fechar mesmo assim?")) return;
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex">
      <button
        type="button"
        aria-label="Fechar drawer"
        className="flex-1 bg-slate-900/40 backdrop-blur-sm"
        onClick={requestClose}
      />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl md:w-[45vw] md:max-w-[520px]">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Cadastro</p>
              <p className="text-base font-semibold leading-tight text-slate-900">{title}</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              onClick={requestClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
              onClick={requestClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0e2659] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#22489c] disabled:cursor-not-allowed disabled:opacity-70"
              onClick={onSave}
            >
              Salvar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function normalizeDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeFsDirname(v) {
  return String(v || "").trim();
}

function hasInvalidFsDirname(v) {
  const value = normalizeFsDirname(v);
  if (!value) return false;
  return value.includes("..") || value.includes("/") || value.includes("\\") || value.includes(":");
}

function maskCnpj(v) {
  const d = normalizeDigits(v).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function maskCpf(v) {
  const d = normalizeDigits(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

function maskPhone(v) {
  const d = normalizeDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  return d;
}

function normalizePorteSigla(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized === "ME" || normalized === "EPP" || normalized === "MEI") return normalized;
  if (normalized.includes("MICRO") || normalized.includes("MICROEMPRESA")) return "ME";
  if (normalized.includes("PEQUENO PORTE") || normalized.includes("PEQUENA")) return "EPP";
  if (normalized.includes("MEI")) return "MEI";
  return normalized.replace(/[^A-Z]/g, "");
}

const COMPANY_FIELD_CLASS =
  "mt-1 w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";
const COMPANY_FIELD_INLINE_CLASS =
  "w-full rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";
const COMPANY_FIELD_BUTTON_CLASS =
  "flex w-full items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-left text-sm text-slate-900 shadow-inner transition hover:bg-white focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";

const TAX_STATUS_OPTIONS = ["", "em_aberto", "parcelado", "pago", "isento", "nao_aplicavel", "pendente"];
const TAX_STATUS_OPTION_ITEMS = TAX_STATUS_OPTIONS.map((value) => ({
  value,
  label: value ? formatStatusDisplay(value) : "—",
}));

const TAX_STATUS_FIELDS = [
  ["taxa_funcionamento", "Funcionamento"],
  ["taxa_publicidade", "Publicidade"],
  ["taxa_vig_sanitaria", "Vigilância Sanitária"],
  ["taxa_localiz_instalacao", "Localização/Instalação"],
  ["taxa_ocup_area_publica", "Área Pública"],
  ["taxa_bombeiros", "Bombeiros"],
  ["tpi", "TPI"],
  ["iss", "ISS"],
];

const pendingObservationFieldKey = (field) => `${field}_observacao_pendente`;

const EMPTY_COMPANY_FORM = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  fs_dirname: "",
  inscricao_municipal: "",
  inscricao_estadual: "",
  porte: "",
  municipio: "",
  uf: "",
  categoria: "",
  is_active: true,
  mei: false,
  endereco_fiscal: false,
  representante: "",
  cpf: "",
  email: "",
  telefone: "",
  observacoes: "",
  cnaes_principal: [],
  cnaes_secundarios: [],
  add_licences: false,
  add_taxes: false,
  licences: {
    alvara_sanitario: false,
    alvara_funcionamento: false,
    cercon: false,
    licenca_ambiental: false,
    certidao_uso_solo: false,
    nao_necessita: false,
  },
  taxes: {
    funcionamento: false,
    publicidade: false,
    vigilancia_sanitaria: false,
    localizacao_instalacao: false,
    ocupacao_area_publica: false,
    tpi: false,
    vencimento_tpi: "",
  },
};

const EMPTY_TAX_FORM = {
  id: "",
  company_id: "",
  empresa: "",
  municipio: "",
  data_envio: "",
  taxa_funcionamento: "",
  taxa_publicidade: "",
  taxa_vig_sanitaria: "",
  taxa_localiz_instalacao: "",
  taxa_ocup_area_publica: "",
  taxa_bombeiros: "",
  tpi: "",
  vencimento_tpi: "",
  iss: "",
  raw: {},
};

const EMPTY_PROCESS_FORM = {
  company_id: "",
  empresa_nao_cadastrada: false,
  company_cnpj: "",
  company_razao_social: "",
  process_type: "DIVERSOS",
  protocolo: "",
  municipio: "",
  data_solicitacao: "",
  situacao: "",
  obs: "",
  extra: {},
};

export default function HeaderMenuPro() {
  const auth = useAuth();
  const [currentUserRoles, setCurrentUserRoles] = useState([]);
  const rolesRaw = auth?.user?.roles || currentUserRoles;
  const roleNames = Array.isArray(rolesRaw)
    ? rolesRaw.map((r) => String(typeof r === "string" ? r : r?.name || "").toUpperCase()).filter(Boolean)
    : [];
  const isDevUser = roleNames.includes("DEV");
  const canWrite = useMemo(() => {
    return roleNames.includes("ADMIN") || roleNames.includes("DEV");
  }, [roleNames]);

  const [companyModal, setCompanyModal] = useState({ open: false, mode: "create", companyId: null });
  const [processModal, setProcessModal] = useState({ open: false, mode: "create", processId: null });
  const [taxModal, setTaxModal] = useState({ open: false, mode: "edit", taxId: null });
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM);
  const [taxForm, setTaxForm] = useState(EMPTY_TAX_FORM);
  const [taxStatusModeDraft, setTaxStatusModeDraft] = useState({});
  const [taxInstallmentDraft, setTaxInstallmentDraft] = useState({});
  const [taxInstallmentError, setTaxInstallmentError] = useState({});
  const [taxPendingObservationDraft, setTaxPendingObservationDraft] = useState({});
  const [taxEnvioDateDraft, setTaxEnvioDateDraft] = useState("");
  const [taxEnvioMethodsDraft, setTaxEnvioMethodsDraft] = useState([]);
  const [processSituacoes, setProcessSituacoes] = useState(DEFAULT_PROCESS_SITUACOES);
  const [processOperacoes, setProcessOperacoes] = useState(DEFAULT_DIVERSOS_OPERACOES);
  const [processOrgaos, setProcessOrgaos] = useState(DEFAULT_ORGAOS_OPTIONS);
  const [processAlvaras, setProcessAlvaras] = useState(DEFAULT_ALVARA_OPTIONS);
  const [processServicos, setProcessServicos] = useState(DEFAULT_SANITARIO_SERVICOS);
  const [processNotificacoes, setProcessNotificacoes] = useState(DEFAULT_SANITARIO_NOTIFICACOES);
  const [companyInitialForm, setCompanyInitialForm] = useState(EMPTY_COMPANY_FORM);
  const [companySaving, setCompanySaving] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [bulkSyncModalOpen, setBulkSyncModalOpen] = useState(false);
  const [bulkRunModalOpen, setBulkRunModalOpen] = useState(false);
  const [bulkRunMinimized, setBulkRunMinimized] = useState(false);
  const [bulkRunDetailsOpen, setBulkRunDetailsOpen] = useState(false);
  const [bulkSyncPassword, setBulkSyncPassword] = useState("");
  const [bulkDryRun, setBulkDryRun] = useState(true);
  const [bulkOnlyMissing, setBulkOnlyMissing] = useState(true);
  const [bulkSyncStarting, setBulkSyncStarting] = useState(false);
  const [bulkSyncError, setBulkSyncError] = useState("");
  const [bulkRunId, setBulkRunId] = useState("");
  const [bulkRunStatus, setBulkRunStatus] = useState(null);
  const [bulkToastMessage, setBulkToastMessage] = useState("");

  const closeCompanyModal = () => setCompanyModal({ open: false, mode: "create", companyId: null });
  const closeProcessModal = () => setProcessModal({ open: false, mode: "create", processId: null });
  const closeTaxModal = () => {
    setTaxModal({ open: false, mode: "edit", taxId: null });
    setTaxStatusModeDraft({});
    setTaxInstallmentDraft({});
    setTaxInstallmentError({});
    setTaxPendingObservationDraft({});
    setTaxEnvioDateDraft("");
    setTaxEnvioMethodsDraft([]);
  };
  const closeBulkSyncModal = () => {
    if (bulkSyncStarting) return;
    setBulkSyncModalOpen(false);
    setBulkSyncError("");
    setBulkSyncPassword("");
  };

  useEffect(() => {
    if (!auth?.accessToken) {
      setCurrentUserRoles([]);
      return;
    }
    apiJson("/api/v1/auth/me")
      .then((data) => {
        const nextRoles = Array.isArray(data?.roles) ? data.roles : [];
        setCurrentUserRoles(nextRoles);
      })
      .catch(() => setCurrentUserRoles([]));
  }, [auth?.accessToken]);

  useEffect(() => {
    if (!bulkToastMessage) return;
    const timer = setTimeout(() => setBulkToastMessage(""), 3200);
    return () => clearTimeout(timer);
  }, [bulkToastMessage]);

  const humanizeSituacao = (value) => PROCESS_SITUACAO_LABELS[value] || String(value || "");

  const companyIsDirty = useMemo(
    () => JSON.stringify(companyForm) !== JSON.stringify(companyInitialForm),
    [companyForm, companyInitialForm]
  );

  const updateProcessExtra = (key, value) => {
    setProcessForm((prev) => ({ ...prev, extra: { ...(prev.extra || {}), [key]: value } }));
  };

  const loadCompanyOptions = async () => {
    const data = await apiJson("/api/v1/companies?limit=1000");
    setCompanyOptions(Array.isArray(data) ? data : []);
  };

  const openCompany = async ({ mode, companyId, cnpj }) => {
    let resolvedCompanyId = companyId || null;
    if (mode === "edit" && !resolvedCompanyId) {
      const digits = normalizeDigits(cnpj);
      if (digits.length === 14) {
        const dataByCnpj = await apiJson(`/api/v1/companies?cnpj=${digits}&limit=1`);
        if (Array.isArray(dataByCnpj) && dataByCnpj[0]?.id) {
          resolvedCompanyId = dataByCnpj[0].id;
        }
      }
    }

    setCompanyModal({ open: true, mode, companyId: resolvedCompanyId });
    if (mode === "edit") {
      if (!resolvedCompanyId) {
        throw new Error("Não foi possível localizar a empresa selecionada para edição.");
      }
      const data = await apiJson(`/api/v1/companies/${resolvedCompanyId}`);
      const form = {
        ...EMPTY_COMPANY_FORM,
        cnpj: maskCnpj(data?.cnpj || ""),
        razao_social: data?.razao_social || "",
        nome_fantasia: data?.nome_fantasia || "",
        fs_dirname: data?.fs_dirname || "",
        inscricao_municipal: data?.inscricao_municipal || "",
        inscricao_estadual: data?.inscricao_estadual || "",
        porte: normalizePorteSigla(data?.porte || ""),
        municipio: formatMunicipioDisplay(data?.municipio || ""),
        uf: data?.uf || "",
        categoria: data?.categoria || "",
        is_active: data?.is_active !== false,
        mei: data?.mei === true,
        endereco_fiscal: data?.endereco_fiscal === true,
        representante: data?.proprietario_principal || "",
        cpf: maskCpf(data?.cpf || ""),
        email: data?.email || "",
        telefone: maskPhone(data?.telefone || ""),
        observacoes: data?.observacoes || "",
        cnaes_principal: Array.isArray(data?.cnaes_principal) ? data.cnaes_principal : [],
        cnaes_secundarios: Array.isArray(data?.cnaes_secundarios) ? data.cnaes_secundarios : [],
      };
      setCompanyForm(form);
      setCompanyInitialForm(form);
      return;
    }
    setCompanyForm(EMPTY_COMPANY_FORM);
    setCompanyInitialForm(EMPTY_COMPANY_FORM);
  };

  const openProcess = async ({ mode, processId }) => {
    await loadCompanyOptions();
    setProcessModal({ open: true, mode, processId: processId || null });
    if (mode === "edit" && processId) {
      const data = await apiJson(`/api/v1/processos/${processId}`);
      setProcessForm({
        ...EMPTY_PROCESS_FORM,
        company_id: data?.company_id || "",
        empresa_nao_cadastrada: data?.raw?.empresa_nao_cadastrada === true,
        company_cnpj: data?.raw?.company_cnpj || data?.raw?.cnpj || "",
        company_razao_social: data?.raw?.company_razao_social || data?.raw?.empresa || "",
        process_type: data?.process_type || "DIVERSOS",
        protocolo: data?.protocolo || "",
        municipio: formatMunicipioDisplay(data?.municipio || ""),
        data_solicitacao: data?.data_solicitacao || "",
        situacao: data?.situacao || "",
        obs: data?.obs || "",
        extra: data?.extra || {},
      });
      return;
    }
    setProcessForm(EMPTY_PROCESS_FORM);
  };

  const normalizeTaxForm = (data) => ({
    ...EMPTY_TAX_FORM,
    id: data?.id || data?.tax_id || "",
    company_id: data?.company_id || data?.empresa_id || "",
    empresa: data?.empresa || data?.razao_social || "",
    municipio: formatMunicipioDisplay(data?.municipio || ""),
    data_envio: data?.data_envio || "",
    taxa_funcionamento: data?.taxa_funcionamento || data?.func || "",
    taxa_publicidade: data?.taxa_publicidade || data?.publicidade || "",
    taxa_vig_sanitaria: data?.taxa_vig_sanitaria || data?.sanitaria || "",
    taxa_localiz_instalacao:
      data?.taxa_localiz_instalacao || data?.localizacao_instalacao || "",
    taxa_ocup_area_publica: data?.taxa_ocup_area_publica || data?.area_publica || "",
    taxa_bombeiros: data?.taxa_bombeiros || data?.bombeiros || "",
    tpi: data?.tpi || "",
    vencimento_tpi: data?.vencimento_tpi || "",
    iss: data?.iss || "",
    raw: data?.raw && typeof data.raw === "object" ? data.raw : {},
  });

  const initializeTaxStatusDraft = (normalized) => {
    const nextMode = {};
    const nextInstallment = {};
    const nextPendingObservation = {};
    const rawData = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : {};
    TAX_STATUS_FIELDS.forEach(([field]) => {
      const raw = String(normalized?.[field] || "").trim();
      const parsed = parseInstallment(raw);
      const pendingObsKey = pendingObservationFieldKey(field);
      const pendingObsValue = String(rawData?.[pendingObsKey] || "").trim();
      if (pendingObsValue) {
        nextPendingObservation[field] = pendingObsValue;
      }
      if (parsed) {
        const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
        if (derived === "paid") {
          nextMode[field] = "pago";
        } else {
          nextMode[field] = "parcelado";
          nextInstallment[field] = formatInstallment(parsed.paid, parsed.total);
        }
        return;
      }
      nextMode[field] = raw || "";
      if (raw === "parcelado") {
        nextInstallment[field] = "/";
      }
    });
    setTaxStatusModeDraft(nextMode);
    setTaxInstallmentDraft(nextInstallment);
    setTaxInstallmentError({});
    setTaxPendingObservationDraft(nextPendingObservation);
  };

  const handleTaxStatusChange = (field, value) => {
    setTaxStatusModeDraft((prev) => ({ ...prev, [field]: value }));
    if (value !== "pendente") {
      setTaxPendingObservationDraft((prev) => {
        const clone = { ...prev };
        delete clone[field];
        return clone;
      });
    }
    if (value === "parcelado") {
      setTaxInstallmentDraft((prev) => ({ ...prev, [field]: prev[field] || "/" }));
      setTaxInstallmentError((prev) => ({ ...prev, [field]: validateInstallmentInput("/") }));
      return;
    }
    setTaxForm((prev) => ({ ...prev, [field]: value }));
    setTaxInstallmentDraft((prev) => {
      const clone = { ...prev };
      delete clone[field];
      return clone;
    });
    setTaxInstallmentError((prev) => {
      const clone = { ...prev };
      delete clone[field];
      return clone;
    });
  };

  const handleTaxInstallmentChange = (field, value) => {
    const normalized = normalizeInstallmentInput(value);
    setTaxInstallmentDraft((prev) => ({ ...prev, [field]: normalized }));
    const error = validateInstallmentInput(normalized);
    setTaxInstallmentError((prev) => ({ ...prev, [field]: error }));
  };

  const handleTaxPendingObservationChange = (field, value) => {
    setTaxPendingObservationDraft((prev) => ({ ...prev, [field]: value }));
  };

  const openTax = async ({ mode = "edit", taxId, taxa }) => {
    if (!taxId && !taxa?.id) {
      throw new Error("Taxa sem identificador para edição.");
    }
    const resolvedTaxId = taxId || taxa?.id;
    setTaxModal({ open: true, mode, taxId: resolvedTaxId || null });
    if (taxa) {
      const normalized = normalizeTaxForm(taxa);
      const parsedEnvio = parseDataEnvio(normalized.data_envio);
      setTaxForm(normalized);
      initializeTaxStatusDraft(normalized);
      setTaxEnvioDateDraft(toDateInputFromDataEnvio(normalized.data_envio));
      setTaxEnvioMethodsDraft(parsedEnvio.methods);
      return;
    }
    const data = await apiJson("/api/v1/taxas?limit=1000");
    const list = Array.isArray(data) ? data : [];
    const selected = list.find((item) => item?.id === resolvedTaxId);
    if (!selected) {
      throw new Error("Não foi possível localizar a taxa para edição.");
    }
    const normalized = normalizeTaxForm(selected);
    const parsedEnvio = parseDataEnvio(normalized.data_envio);
    setTaxForm(normalized);
    initializeTaxStatusDraft(normalized);
    setTaxEnvioDateDraft(toDateInputFromDataEnvio(normalized.data_envio));
    setTaxEnvioMethodsDraft(parsedEnvio.methods);
  };

  useEffect(() => {
    const onCompany = (e) => {
      const detail = e?.detail || {};
      openCompany({
        mode: detail.mode || "create",
        companyId: detail.companyId || null,
        cnpj: detail.cnpj || null,
      }).catch((error) => alert(error?.message || "Falha ao abrir edição da empresa."));
    };
    const onProcess = (e) => {
      const detail = e?.detail || {};
      openProcess({ mode: detail.mode || "create", processId: detail.processId || null }).catch(console.error);
    };
    const onTax = (e) => {
      const detail = e?.detail || {};
      openTax({
        mode: detail.mode || "edit",
        taxId: detail.taxId || null,
        taxa: detail.taxa || null,
      }).catch((error) => alert(error?.message || "Falha ao abrir edição de taxa."));
    };

    window.addEventListener(EVT_OPEN_COMPANY, onCompany);
    window.addEventListener(EVT_OPEN_PROCESS, onProcess);
    window.addEventListener(EVT_OPEN_TAX, onTax);
    return () => {
      window.removeEventListener(EVT_OPEN_COMPANY, onCompany);
      window.removeEventListener(EVT_OPEN_PROCESS, onProcess);
      window.removeEventListener(EVT_OPEN_TAX, onTax);
    };
  }, []);

  useEffect(() => {
    apiJson("/api/v1/meta/enums")
      .then((payload) => {
        const situacoesFromCanonical = normalizeEnumOptions(payload?.situacao_processos);
        const situacoesFromLegacy = normalizeEnumOptions(payload?.process_situacoes);
        const situacoes = situacoesFromCanonical.length > 0 ? situacoesFromCanonical : situacoesFromLegacy;
        if (situacoes.length > 0) {
          const labels = {};
          situacoes.forEach((item) => {
            if (item?.value && item?.label) labels[item.value] = item.label;
          });
          Object.assign(PROCESS_SITUACAO_LABELS, labels);
          setProcessSituacoes(situacoes);
        } else {
          setProcessSituacoes(DEFAULT_PROCESS_SITUACOES);
        }

        const operacoes = normalizeEnumOptions(payload?.operacoes_diversos);
        const orgaos = normalizeEnumOptions(payload?.orgaos_diversos);
        const alvaras = normalizeEnumOptions(payload?.alvaras_funcionamento);
        const servicos = normalizeEnumOptions(payload?.servicos_sanitarios);
        const notificacoes = normalizeEnumOptions(payload?.notificacoes_sanitarias);

        setProcessOperacoes(operacoes.length > 0 ? operacoes : DEFAULT_DIVERSOS_OPERACOES);
        setProcessOrgaos(orgaos.length > 0 ? orgaos : DEFAULT_ORGAOS_OPTIONS);
        setProcessAlvaras(alvaras.length > 0 ? alvaras : DEFAULT_ALVARA_OPTIONS);
        setProcessServicos(servicos.length > 0 ? servicos : DEFAULT_SANITARIO_SERVICOS);
        setProcessNotificacoes(notificacoes.length > 0 ? notificacoes : DEFAULT_SANITARIO_NOTIFICACOES);
      })
      .catch(() => {
        setProcessSituacoes(DEFAULT_PROCESS_SITUACOES);
        setProcessOperacoes(DEFAULT_DIVERSOS_OPERACOES);
        setProcessOrgaos(DEFAULT_ORGAOS_OPTIONS);
        setProcessAlvaras(DEFAULT_ALVARA_OPTIONS);
        setProcessServicos(DEFAULT_SANITARIO_SERVICOS);
        setProcessNotificacoes(DEFAULT_SANITARIO_NOTIFICACOES);
      });
  }, []);

  const handleNew = (type) => {
    if (!canWrite) return;
    if (type === "empresa") {
      openCompany({ mode: "create" }).catch(console.error);
    } else if (type === "processo") {
      openProcess({ mode: "create" }).catch(console.error);
    }
  };

  const doReceitaImport = async () => {
    const digits = normalizeDigits(companyForm.cnpj);
    if (digits.length !== 14) throw new Error("Informe um CNPJ válido antes de importar.");
    const data = await apiJson(`/api/v1/lookups/receitaws/${digits}`);
    if (!data || data?.status === "ERROR") {
      throw new Error(data?.message || "Não foi possível importar dados deste CNPJ.");
    }
    setCompanyForm((p) => ({
      ...p,
      razao_social: normalizeTitleCase(data?.razao_social || p.razao_social),
      nome_fantasia: normalizeTitleCase(data?.nome_fantasia || p.nome_fantasia),
      porte: normalizePorteSigla(data?.porte || p.porte),
      municipio: formatMunicipioDisplay(data?.municipio_padrao || data?.municipio || p.municipio),
      uf: data?.uf || p.uf,
      email: normalizeEmail(data?.email || p.email),
      telefone: maskPhone(extractPrimaryPhoneDigits(data?.telefone || p.telefone)),
      mei: data?.simei_optante === true ? true : p.mei,
      cnaes_principal: Array.isArray(data?.cnaes_principal) ? data.cnaes_principal : p.cnaes_principal,
      cnaes_secundarios: Array.isArray(data?.cnaes_secundarios) ? data.cnaes_secundarios : p.cnaes_secundarios,
    }));
  };

  const bulkProgressPercent = useMemo(() => {
    const total = Number(bulkRunStatus?.total || 0);
    const processed = Number(bulkRunStatus?.processed || 0);
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  }, [bulkRunStatus?.processed, bulkRunStatus?.total]);

  const bulkFieldCounters = useMemo(() => {
    const entries = Object.entries(bulkRunStatus?.changes_summary?.field_counters || {});
    return entries.sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0)).slice(0, 8);
  }, [bulkRunStatus?.changes_summary?.field_counters]);

  const fetchBulkRunStatus = async (runId) => {
    if (!runId) return;
    const data = await getReceitaWSBulkSyncStatus(runId);
    setBulkRunStatus(data || null);
    if (TERMINAL_RUN_STATUSES.has(String(data?.status || ""))) {
      window.dispatchEvent(new CustomEvent(EVT_REFRESH_DATA, { detail: { source: "receitaws-bulk-sync" } }));
      if (String(data?.status || "") === "completed") {
        setBulkToastMessage("Concluído");
      }
    }
  };

  useEffect(() => {
    if (!bulkRunId) return;
    let active = true;
    const load = async () => {
      try {
        const data = await getReceitaWSBulkSyncStatus(bulkRunId);
        if (!active) return;
        setBulkRunStatus(data || null);
      } catch {
        if (!active) return;
        setBulkSyncError("Falha ao consultar progresso do run.");
      }
    };
    void load();
    const timer = setInterval(() => {
      if (TERMINAL_RUN_STATUSES.has(String(bulkRunStatus?.status || ""))) return;
      void load();
    }, BULK_SYNC_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [bulkRunId, bulkRunStatus?.status]);

  const handleStartBulkSync = async () => {
    if (!bulkSyncPassword) {
      setBulkSyncError("Informe sua senha para confirmar.");
      return;
    }
    setBulkSyncStarting(true);
    setBulkSyncError("");
    try {
      const response = await startReceitaWSBulkSync({
        password: bulkSyncPassword,
        dry_run: bulkDryRun,
        only_missing: bulkOnlyMissing,
      });
      const runId = response?.run_id;
      if (!runId) throw new Error("Resposta inválida ao iniciar o run.");
      setBulkRunId(runId);
      setBulkSyncPassword("");
      setBulkSyncModalOpen(false);
      setBulkRunModalOpen(true);
      setBulkRunMinimized(false);
      setBulkRunDetailsOpen(false);
      await fetchBulkRunStatus(runId);
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("409")) {
        try {
          const active = await getActiveReceitaWSBulkSyncRun();
          const runId = active?.run_id;
          if (runId) {
            setBulkRunId(runId);
            setBulkSyncPassword("");
            setBulkSyncModalOpen(false);
            setBulkRunModalOpen(true);
            setBulkRunMinimized(false);
            await fetchBulkRunStatus(runId);
            return;
          }
        } catch {
          setBulkSyncError("Já existe um run ativo para esta organização.");
        }
      } else if (message.includes("401")) {
        setBulkSyncError("Senha inválida.");
      } else {
        setBulkSyncError("Não foi possível iniciar o run.");
      }
    } finally {
      setBulkSyncStarting(false);
    }
  };

  const handleCancelBulkSync = async () => {
    if (!bulkRunId) return;
    try {
      await cancelReceitaWSBulkSync(bulkRunId);
      await fetchBulkRunStatus(bulkRunId);
    } catch {
      setBulkSyncError("Falha ao cancelar o run.");
    }
  };

  const handleMinimizeBulkRun = () => {
    setBulkRunModalOpen(false);
    setBulkRunMinimized(true);
  };

  const handleRestoreBulkRun = () => {
    setBulkRunModalOpen(true);
    setBulkRunMinimized(false);
  };

  const handleCloseBulkRun = async () => {
    const confirmed = window.confirm("Fechar esta janela vai cancelar o run atual. Deseja continuar?");
    if (!confirmed) return;
    if (!TERMINAL_RUN_STATUSES.has(String(bulkRunStatus?.status || "")) && bulkRunId) {
      try {
        await cancelReceitaWSBulkSync(bulkRunId);
      } catch {
        setBulkSyncError("Falha ao cancelar o run ao fechar a janela.");
        return;
      }
    }
    setBulkRunModalOpen(false);
    setBulkRunMinimized(false);
    setBulkRunDetailsOpen(false);
    setBulkRunId("");
    setBulkRunStatus(null);
  };

  const handleBulkSyncMenuEntry = async () => {
    setBulkSyncError("");
    if (!isDevUser) return;
    try {
      const active = await getActiveReceitaWSBulkSyncRun();
      const runId = active?.run_id;
      if (runId) {
        setBulkRunId(runId);
        setBulkRunModalOpen(true);
        setBulkRunMinimized(false);
        await fetchBulkRunStatus(runId);
        return;
      }
    } catch {
      // no active run: continue to start modal
    }
    setBulkSyncModalOpen(true);
  };

  const saveCompany = async () => {
    setCompanySaving(true);
    try {
    const digits = normalizeDigits(companyForm.cnpj);
    if (digits.length !== 14) throw new Error("CNPJ inválido");
    if (!companyForm.razao_social?.trim()) throw new Error("Razão social obrigatória");
    if (hasInvalidFsDirname(companyForm.fs_dirname)) {
      throw new Error("Apelido (Pasta) inválido: não use '..', '/', '\\\\' ou ':'");
    }

    const categoriaFinal =
      companyForm.endereco_fiscal && companyForm.categoria && !companyForm.categoria.startsWith("Fiscal -")
        ? `Fiscal - ${companyForm.categoria}`
        : companyForm.categoria;

    if (companyModal.mode === "create") {
      await apiJson("/api/v1/companies/composite", {
        method: "POST",
        body: JSON.stringify({
          company: {
            cnpj: digits,
            razao_social: normalizeTitleCase(companyForm.razao_social),
            nome_fantasia: normalizeTitleCase(companyForm.nome_fantasia) || null,
            fs_dirname: normalizeFsDirname(companyForm.fs_dirname) || null,
            municipio: normalizeMunicipio(companyForm.municipio) || null,
            uf: companyForm.uf || null,
            is_active: companyForm.is_active !== false,
          },
          profile: {
            inscricao_municipal: companyForm.inscricao_municipal || null,
            inscricao_estadual: companyForm.inscricao_estadual || null,
            porte: normalizePorteSigla(companyForm.porte) || null,
            categoria: categoriaFinal || null,
            proprietario_principal: companyForm.representante || null,
            cpf: normalizeDigits(companyForm.cpf) || null,
            email: normalizeEmail(companyForm.email) || null,
            telefone: extractPrimaryPhoneDigits(companyForm.telefone) || null,
            observacoes: companyForm.observacoes || null,
            cnaes_principal: companyForm.cnaes_principal || [],
            cnaes_secundarios: companyForm.cnaes_secundarios || [],
            mei: !!companyForm.mei,
            endereco_fiscal: !!companyForm.endereco_fiscal,
          },
          licences: companyForm.add_licences ? companyForm.licences : undefined,
          taxes: companyForm.add_taxes
            ? {
                ...companyForm.taxes,
                vencimento_tpi: companyForm.taxes.vencimento_tpi || null,
              }
            : undefined,
        }),
      });
    } else {
      await apiJson(`/api/v1/companies/${companyModal.companyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          razao_social: normalizeTitleCase(companyForm.razao_social),
          nome_fantasia: normalizeTitleCase(companyForm.nome_fantasia) || null,
          fs_dirname: normalizeFsDirname(companyForm.fs_dirname) || null,
          municipio: normalizeMunicipio(companyForm.municipio) || null,
          uf: companyForm.uf || null,
          is_active: companyForm.is_active !== false,
          inscricao_municipal: companyForm.inscricao_municipal || null,
          inscricao_estadual: companyForm.inscricao_estadual || null,
          porte: normalizePorteSigla(companyForm.porte) || null,
          categoria: categoriaFinal || null,
          proprietario_principal: normalizeTitleCase(companyForm.representante) || null,
          cpf: normalizeDigits(companyForm.cpf) || null,
          email: normalizeEmail(companyForm.email) || null,
          telefone: extractPrimaryPhoneDigits(companyForm.telefone) || null,
          observacoes: companyForm.observacoes || null,
          cnaes_principal: companyForm.cnaes_principal || [],
          cnaes_secundarios: companyForm.cnaes_secundarios || [],
        }),
      });
    }

      closeCompanyModal();
      window.dispatchEvent(new CustomEvent(EVT_REFRESH_DATA, { detail: { source: "company-save" } }));
    } finally {
      setCompanySaving(false);
    }
  };

  const saveProcess = async () => {
    const isUnregistered = processModal.mode === "create" && processForm.empresa_nao_cadastrada === true;
    if (!isUnregistered && !processForm.company_id && processModal.mode === "create") {
      throw new Error("Selecione a empresa");
    }
    if (isUnregistered && processForm.process_type !== "DIVERSOS") {
      throw new Error("Empresa não cadastrada só é permitida para processos do tipo Diversos");
    }
    if (isUnregistered) {
      const cnpjDigits = normalizeDigits(processForm.company_cnpj);
      if (cnpjDigits.length !== 14) throw new Error("CNPJ da empresa não cadastrada inválido");
      if (!String(processForm.company_razao_social || "").trim()) {
        throw new Error("Razão Social da empresa não cadastrada é obrigatória");
      }
    }
    if (!processForm.protocolo?.trim()) throw new Error("Protocolo obrigatório");

    const basePayload = {
      process_type: processForm.process_type,
      protocolo: processForm.protocolo,
      municipio: normalizeMunicipio(processForm.municipio) || null,
      data_solicitacao: toCanonicalIsoDate(processForm.data_solicitacao) || null,
      situacao: processForm.situacao || null,
      obs: processForm.obs || null,
      extra: processForm.extra || {},
    };

    if (processModal.mode === "create") {
      const createPayload = isUnregistered
        ? {
            ...basePayload,
            company_id: null,
            empresa_nao_cadastrada: true,
            company_cnpj: normalizeDigits(processForm.company_cnpj),
            company_razao_social: String(processForm.company_razao_social || "").trim(),
          }
        : { ...basePayload, company_id: processForm.company_id };
      await apiJson("/api/v1/processos", {
        method: "POST",
        body: JSON.stringify(createPayload),
      });
    } else {
      await apiJson(`/api/v1/processos/${processModal.processId}`, {
        method: "PATCH",
        body: JSON.stringify(basePayload),
      });
    }

    closeProcessModal();
    window.dispatchEvent(new CustomEvent(EVT_REFRESH_DATA, { detail: { source: "process-save" } }));
  };

  const toggleTaxEnvioMetodo = (metodo) => {
    setTaxEnvioMethodsDraft((prev) =>
      prev.includes(metodo) ? prev.filter((item) => item !== metodo) : [...prev, metodo],
    );
  };

  const saveTax = async () => {
    if (!taxModal.taxId) throw new Error("Taxa sem identificador.");
    setTaxSaving(true);
    try {
      const normalizedDataEnvio = formatDataEnvio(taxEnvioDateDraft, taxEnvioMethodsDraft);
      const nextPayloadStatus = {};
      const nextPayloadRaw = {};
      for (const [field, label] of TAX_STATUS_FIELDS) {
        const mode = String(taxStatusModeDraft[field] ?? taxForm[field] ?? "").trim();
        const pendingObsKey = pendingObservationFieldKey(field);
        if (!mode) {
          nextPayloadStatus[field] = null;
          nextPayloadRaw[pendingObsKey] = null;
          continue;
        }
        if (mode === "pendente") {
          const note = String(taxPendingObservationDraft[field] || "").trim();
          nextPayloadRaw[pendingObsKey] = note || null;
        } else {
          nextPayloadRaw[pendingObsKey] = null;
        }
        if (mode !== "parcelado") {
          nextPayloadStatus[field] = mode;
          continue;
        }
        const installmentText = String(taxInstallmentDraft[field] ?? "").trim();
        const installmentError = validateInstallmentInput(installmentText);
        if (installmentError) {
          throw new Error(`${label}: ${installmentError}`);
        }
        const parsed = parseInstallment(installmentText);
        if (!parsed) {
          throw new Error(`${label}: formato de parcelamento inválido.`);
        }
        const derived = deriveStatusFromInstallment(parsed.paid, parsed.total);
        nextPayloadStatus[field] =
          derived === "paid" ? "pago" : formatInstallment(parsed.paid, parsed.total);
      }

      await apiJson(`/api/v1/taxas/${taxModal.taxId}`, {
        method: "PATCH",
        body: JSON.stringify({
          data_envio: normalizedDataEnvio,
          taxa_funcionamento: nextPayloadStatus.taxa_funcionamento,
          taxa_publicidade: nextPayloadStatus.taxa_publicidade,
          taxa_vig_sanitaria: nextPayloadStatus.taxa_vig_sanitaria,
          taxa_localiz_instalacao: nextPayloadStatus.taxa_localiz_instalacao,
          taxa_ocup_area_publica: nextPayloadStatus.taxa_ocup_area_publica,
          taxa_bombeiros: nextPayloadStatus.taxa_bombeiros,
          tpi: nextPayloadStatus.tpi,
          vencimento_tpi: taxForm.vencimento_tpi || null,
          iss: nextPayloadStatus.iss,
          raw: nextPayloadRaw,
        }),
      });
      closeTaxModal();
      window.dispatchEvent(new CustomEvent(EVT_REFRESH_DATA, { detail: { source: "tax-save" } }));
    } finally {
      setTaxSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            title="Criar novo"
            className="border border-white/30 bg-white text-xs text-certhub-navy hover:bg-slate-100"
          >
            + Novo
          </Button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => handleNew("empresa")}>
              <Building2 className="mr-2 h-4 w-4" /> Empresa
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleNew("processo")}>
              <FileText className="mr-2 h-4 w-4" /> Processo
            </DropdownMenuItem>
            {isDevUser ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void handleBulkSyncMenuEntry();
                }}
              >
                <Import className="mr-2 h-4 w-4" /> Atualizar Cadastros em lote
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <OverlayModal
        open={bulkSyncModalOpen}
        title="Atualizar empresas em lote (ReceitaWS)"
        onClose={closeBulkSyncModal}
        footer={
          <div className="flex items-center justify-end gap-2">
            <SecondaryButton type="button" onClick={closeBulkSyncModal}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="button" disabled={bulkSyncStarting} onClick={() => void handleStartBulkSync()}>
              {bulkSyncStarting ? "Iniciando..." : "Iniciar"}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Ação DEV-only. Processo assíncrono, com limite de 3 consultas/min (20s por chamada) e pode levar horas.
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>DRY-RUN (não grava no banco)</span>
            <input type="checkbox" checked={bulkDryRun} onChange={(e) => setBulkDryRun(e.target.checked)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>ONLY-MISSING (somente campos vazios/nulos/"-")</span>
            <input
              type="checkbox"
              checked={bulkOnlyMissing}
              onChange={(e) => setBulkOnlyMissing(e.target.checked)}
            />
          </label>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Senha</label>
            <Input
              type="password"
              value={bulkSyncPassword}
              onChange={(e) => setBulkSyncPassword(e.target.value)}
              placeholder="Confirme sua senha"
            />
          </div>
          {bulkSyncError ? <p className="text-sm text-rose-600">{bulkSyncError}</p> : null}
        </div>
      </OverlayModal>

      <OverlayModal
        open={bulkRunModalOpen}
        title={`Progresso do run ${bulkRunId || ""}`}
        onClose={() => void handleCloseBulkRun()}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500">Status: {bulkRunStatus?.status || "carregando"}</div>
            <div className="flex items-center gap-2">
              <SecondaryButton type="button" onClick={handleMinimizeBulkRun}>
                Minimizar
              </SecondaryButton>
              {TERMINAL_RUN_STATUSES.has(String(bulkRunStatus?.status || "")) ? null : (
                <SecondaryButton type="button" onClick={() => void handleCancelBulkSync()}>
                  Cancelar run
                </SecondaryButton>
              )}
              <PrimaryButton type="button" onClick={() => setBulkRunDetailsOpen((prev) => !prev)}>
                {bulkRunDetailsOpen ? "Ocultar detalhes" : "Ver detalhes do run"}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>
                {Number(bulkRunStatus?.processed || 0)} / {Number(bulkRunStatus?.total || 0)}
              </span>
              <span>{bulkProgressPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${bulkProgressPercent}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded border p-2">OK: {Number(bulkRunStatus?.ok_count || 0)}</div>
            <div className="rounded border p-2">Falhas: {Number(bulkRunStatus?.error_count || 0)}</div>
            <div className="rounded border p-2">Skipped: {Number(bulkRunStatus?.skipped_count || 0)}</div>
            <div className="rounded border p-2">Atual: {bulkRunStatus?.current_cnpj || "—"}</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Últimos 5 erros</p>
            <div className="space-y-1 text-xs">
              {(bulkRunStatus?.errors || []).slice(-5).map((item, index) => (
                <div key={`${item?.cnpj || "err"}-${index}`} className="rounded border border-rose-200 bg-rose-50 p-2">
                  {item?.cnpj || "sem cnpj"}: {item?.error || "erro"}
                </div>
              ))}
              {!bulkRunStatus?.errors?.length ? <div className="text-slate-500">Sem erros até o momento.</div> : null}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {bulkRunStatus?.dry_run ? "Mudanças que seriam aplicadas" : "Mudanças aplicadas"}
            </p>
            <p className="mb-2 text-xs text-slate-600">
              Empresas com mudanças: {Number(bulkRunStatus?.changes_summary?.companies_with_changes || 0)}
            </p>
            <div className="space-y-1 text-xs">
              {bulkFieldCounters.map(([field, count]) => (
                <div key={field} className="rounded border p-2">
                  {field}: {Number(count || 0)}
                </div>
              ))}
              {bulkFieldCounters.length === 0 ? <div className="text-slate-500">Sem alterações registradas.</div> : null}
            </div>
          </div>
          {bulkRunDetailsOpen ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">JSON resumido</p>
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(
                  {
                    run_id: bulkRunStatus?.run_id,
                    status: bulkRunStatus?.status,
                    dry_run: bulkRunStatus?.dry_run,
                    only_missing: bulkRunStatus?.only_missing,
                    total: bulkRunStatus?.total,
                    processed: bulkRunStatus?.processed,
                    ok_count: bulkRunStatus?.ok_count,
                    error_count: bulkRunStatus?.error_count,
                    skipped_count: bulkRunStatus?.skipped_count,
                    changes_summary: bulkRunStatus?.changes_summary,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : null}
        </div>
      </OverlayModal>

      {bulkRunMinimized && bulkRunId ? (
        <div className="fixed right-4 top-[72px] z-[2147483647] flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xl">
          <button
            type="button"
            className="text-left"
            onClick={handleRestoreBulkRun}
            title="Restaurar progresso do run"
          >
            <p className="text-[11px] font-semibold text-slate-800">Run ReceitaWS</p>
            <p className="text-[11px] text-slate-600">
              {Number(bulkRunStatus?.processed || 0)}/{Number(bulkRunStatus?.total || 0)} ({bulkProgressPercent}%)
            </p>
          </button>
          <SecondaryButton type="button" onClick={handleRestoreBulkRun}>
            Abrir
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void handleCloseBulkRun()}>
            Fechar
          </SecondaryButton>
        </div>
      ) : null}

      <SideDrawerForm
        open={companyModal.open}
        title={companyModal.mode === "edit" ? "Editar Empresa" : "Nova Empresa"}
        onClose={closeCompanyModal}
        isDirty={companyIsDirty}
        isSaving={companySaving}
        onSave={() => saveCompany().catch((e) => alert(e.message))}
      >
        <div className="space-y-5">
          <SectionCard title="Dados principais" description="Identificação e situação da empresa">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-medium">CNPJ</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className={COMPANY_FIELD_INLINE_CLASS}
                    value={companyForm.cnpj}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, cnpj: maskCnpj(e.target.value) }))}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md bg-[#0e2659] px-3 py-2 text-sm font-semibold text-white hover:bg-[#22489c]"
                    onClick={() => doReceitaImport().catch((e) => alert(e.message))}
                  >
                    <Import className="h-4 w-4" />
                    Importar
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Razão Social</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.razao_social}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, razao_social: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Apelido (Pasta)</label>
                <input
                  data-testid="company-fs-dirname"
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.fs_dirname}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, fs_dirname: e.target.value }))}
                />
                <p className="mt-1 text-xs text-slate-500">Nome exato da pasta em G:/EMPRESAS/&lt;PASTA&gt;</p>
                {hasInvalidFsDirname(companyForm.fs_dirname) ? (
                  <p className="mt-1 text-xs text-rose-600">Não use '..', '/', '\\' ou ':'</p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium">Situação</label>
                <select
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.is_active ? "ativa" : "inativa"}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, is_active: e.target.value === "ativa" }))}
                >
                  <option value="ativa">Ativa</option>
                  <option value="inativa">Inativa</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Porte</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.porte}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, porte: normalizePorteSigla(e.target.value) }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Cadastro" description="Dados cadastrais da empresa">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Inscrição Municipal</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className={COMPANY_FIELD_INLINE_CLASS}
                    value={companyForm.inscricao_municipal}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, inscricao_municipal: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setCompanyForm((p) => ({ ...p, inscricao_municipal: "-" }))}
                  >
                    <CircleX className="h-4 w-4" />
                    Não possui
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Inscrição Estadual</label>
                <div className="mt-1 flex gap-2">
                  <input
                    className={COMPANY_FIELD_INLINE_CLASS}
                    value={companyForm.inscricao_estadual}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, inscricao_estadual: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                    onClick={() => setCompanyForm((p) => ({ ...p, inscricao_estadual: "-" }))}
                  >
                    <CircleX className="h-4 w-4" />
                    Não possui
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Município</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.municipio}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, municipio: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">UF</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.uf}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, uf: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Categoria</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.categoria}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, categoria: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={companyForm.mei} onChange={(e) => setCompanyForm((p) => ({ ...p, mei: e.target.checked }))} />
                  MEI?
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={companyForm.endereco_fiscal} onChange={(e) => setCompanyForm((p) => ({ ...p, endereco_fiscal: e.target.checked }))} />
                  Endereço Fiscal/Holding?
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Contato" description="Responsáveis e canais de contato">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-medium">Representante Legal</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.representante}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, representante: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">CPF</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.cpf}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, cpf: maskCpf(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">E-mail</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.email}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Telefone</label>
                <input
                  className={COMPANY_FIELD_CLASS}
                  value={companyForm.telefone}
                  onChange={(e) => setCompanyForm((p) => ({ ...p, telefone: maskPhone(e.target.value) }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Observação" description="Notas internas da empresa">
            <FieldRow label="Observação">
              <Textarea
                data-testid="company-observacoes"
                rows={4}
                value={companyForm.observacoes}
                onChange={(e) => setCompanyForm((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </FieldRow>
          </SectionCard>

          {companyModal.mode === "create" && (
            <>
              <SectionCard title="Licenças" description="Pré-cadastro opcional para nova empresa">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={companyForm.add_licences}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, add_licences: e.target.checked }))}
                  />
                  Adicionar Licenças
                </label>
                {companyForm.add_licences && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      ["alvara_sanitario", "Alvará Sanitário"],
                      ["alvara_funcionamento", "Alvará de Funcionamento"],
                      ["cercon", "CERCON"],
                      ["licenca_ambiental", "Licença Ambiental"],
                      ["certidao_uso_solo", "Certidão Uso do Solo"],
                      ["nao_necessita", "Não necessita"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!companyForm.licences[key]}
                          onChange={(e) =>
                            setCompanyForm((p) => ({
                              ...p,
                              licences: { ...p.licences, [key]: e.target.checked },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="Taxas" description="Pré-cadastro opcional para nova empresa">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={companyForm.add_taxes}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, add_taxes: e.target.checked }))}
                  />
                  Adicionar Taxas
                </label>
                {companyForm.add_taxes && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      ["funcionamento", "Funcionamento"],
                      ["publicidade", "Publicidade"],
                      ["vigilancia_sanitaria", "Vigilância Sanitária"],
                      ["localizacao_instalacao", "Localização e Instalação"],
                      ["ocupacao_area_publica", "Ocupação de Área Pública"],
                      ["tpi", "TPI"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!companyForm.taxes[key]}
                          onChange={(e) =>
                            setCompanyForm((p) => ({
                              ...p,
                              taxes: { ...p.taxes, [key]: e.target.checked },
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                    <div>
                      <label className="text-xs font-medium">Vencimento TPI (dd/mm)</label>
                      <input
                        className={COMPANY_FIELD_CLASS}
                        value={companyForm.taxes.vencimento_tpi}
                        onChange={(e) =>
                          setCompanyForm((p) => ({
                            ...p,
                            taxes: { ...p.taxes, vencimento_tpi: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </SideDrawerForm>

      {bulkToastMessage ? (
        <div className="fixed bottom-4 right-4 z-[2147483647] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-lg">
          {bulkToastMessage}
        </div>
      ) : null}

      <SideDrawerForm
        open={processModal.open}
        title={processModal.mode === "edit" ? "Editar Processo" : "Novo Processo"}
        onClose={closeProcessModal}
        onSave={() => saveProcess().catch((e) => alert(e.message))}
      >
        <div className="space-y-4">
          <SectionCard title="Dados do Processo" description="Dados principais e status">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldRow label="Empresa" className="md:col-span-2" required>
                {processModal.mode === "create" && processForm.process_type === "DIVERSOS" ? (
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={processForm.empresa_nao_cadastrada === true}
                      onChange={(e) =>
                        setProcessForm((p) => ({
                          ...p,
                          empresa_nao_cadastrada: e.target.checked,
                          company_id: e.target.checked ? "" : p.company_id,
                          company_cnpj: e.target.checked ? p.company_cnpj : "",
                          company_razao_social: e.target.checked ? p.company_razao_social : "",
                        }))
                      }
                    />
                    Empresa não cadastrada
                  </label>
                ) : null}
                {processModal.mode === "create" && processForm.empresa_nao_cadastrada ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FieldRow label="CNPJ" required>
                      <Input
                        className={COMPANY_FIELD_CLASS}
                        value={maskCnpj(processForm.company_cnpj)}
                        onChange={(e) =>
                          setProcessForm((p) => ({ ...p, company_cnpj: normalizeDigits(e.target.value).slice(0, 14) }))
                        }
                      />
                    </FieldRow>
                    <FieldRow label="Razão Social" required>
                      <Input
                        className={COMPANY_FIELD_CLASS}
                        value={processForm.company_razao_social}
                        onChange={(e) => setProcessForm((p) => ({ ...p, company_razao_social: e.target.value }))}
                      />
                    </FieldRow>
                  </div>
                ) : processModal.mode === "create" ? (
                  <select
                    className={COMPANY_FIELD_CLASS}
                    value={processForm.company_id}
                    onChange={(e) => {
                      const companyId = e.target.value;
                      const selected = companyOptions.find((item) => item.id === companyId);
                      setProcessForm((p) => ({
                        ...p,
                        company_id: companyId,
                        municipio: formatMunicipioDisplay(selected?.municipio) || p.municipio,
                      }));
                    }}
                  >
                    <option value="">Selecione</option>
                    {companyOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.razao_social || "Empresa")} - {maskCnpj(item.cnpj)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={
                      processForm.company_id ||
                      processForm.company_razao_social ||
                      "Empresa não cadastrada"
                    }
                    className={COMPANY_FIELD_CLASS}
                    disabled
                  />
                )}
              </FieldRow>

              <FieldRow label="Tipo">
                <select
                  className={COMPANY_FIELD_CLASS}
                  value={processForm.process_type}
                  onChange={(e) =>
                    setProcessForm((p) => {
                      const nextType = e.target.value;
                      const keepUnregistered = p.empresa_nao_cadastrada && nextType === "DIVERSOS";
                      return {
                        ...p,
                        process_type: nextType,
                        empresa_nao_cadastrada: keepUnregistered,
                        company_cnpj: keepUnregistered ? p.company_cnpj : "",
                        company_razao_social: keepUnregistered ? p.company_razao_social : "",
                      };
                    })
                  }
                >
                  <option value="DIVERSOS">Diversos</option>
                  <option value="FUNCIONAMENTO">Funcionamento</option>
                  <option value="CERCON">CERCON/Bombeiro</option>
                  <option value="USO_DO_SOLO">Uso do Solo</option>
                  <option value="ALVARA_SANITARIO">Sanitário</option>
                </select>
              </FieldRow>
              <FieldRow label="Protocolo" required>
                <Input
                  className={COMPANY_FIELD_CLASS}
                  value={processForm.protocolo}
                  onChange={(e) => setProcessForm((p) => ({ ...p, protocolo: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label="Data solicitação">
                <input
                  id="processo-data-solicitacao"
                  type="date"
                  value={processForm.data_solicitacao || ""}
                  onChange={(event) => setProcessForm((p) => ({ ...p, data_solicitacao: event.target.value }))}
                  className={COMPANY_FIELD_CLASS}
                />
              </FieldRow>
              <FieldRow label="Situação">
                <select
                  className={COMPANY_FIELD_CLASS}
                  value={processForm.situacao}
                  onChange={(e) => setProcessForm((p) => ({ ...p, situacao: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {(processSituacoes.length > 0 ? processSituacoes : DEFAULT_PROCESS_SITUACOES).map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label || humanizeSituacao(item.value)}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>
          </SectionCard>

          <SectionCard title="Detalhes" description="Campos por tipo de processo">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldRow label="Município">
                <Input
                  className={COMPANY_FIELD_CLASS}
                  value={processForm.municipio}
                  onChange={(e) => setProcessForm((p) => ({ ...p, municipio: e.target.value }))}
                />
              </FieldRow>

              {processForm.process_type === "DIVERSOS" && (
                <>
                  <FieldRow label="Operação" required>
                    <select
                      className={COMPANY_FIELD_CLASS}
                      value={processForm.extra?.operacao || ""}
                      onChange={(e) => updateProcessExtra("operacao", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {processOperacoes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Órgão" required>
                    <select
                      className={COMPANY_FIELD_CLASS}
                      value={processForm.extra?.orgao || ""}
                      onChange={(e) => updateProcessExtra("orgao", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {processOrgaos.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </>
              )}

              {processForm.process_type === "FUNCIONAMENTO" && (
                <FieldRow label="Alvará">
                  <select
                    className={COMPANY_FIELD_CLASS}
                    value={processForm.extra?.alvara || ""}
                    onChange={(e) => updateProcessExtra("alvara", e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {processAlvaras.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              )}

              {processForm.process_type === "CERCON" && (
                <>
                  <FieldRow label="Área (m²)">
                    <Input
                      className={COMPANY_FIELD_CLASS}
                      value={processForm.extra?.area_m2 || ""}
                      onChange={(e) =>
                        updateProcessExtra("area_m2", String(e.target.value || "").replace(/[^\d.,]/g, ""))
                      }
                    />
                  </FieldRow>
                  <FieldRow label="Projeto aprovado">
                    <div className="space-y-2">
                      <Input
                        className={COMPANY_FIELD_CLASS}
                        value={processForm.extra?.projeto_aprovado || ""}
                        onChange={(e) => updateProcessExtra("projeto_aprovado", e.target.value)}
                      />
                      <div className="flex gap-2">
                        <SecondaryButton type="button" size="sm" onClick={() => updateProcessExtra("projeto_aprovado", "nao_possui")}>
                          Não possui
                        </SecondaryButton>
                        <SecondaryButton type="button" size="sm" onClick={() => updateProcessExtra("projeto_aprovado", "nao_precisa")}>
                          Não precisa
                        </SecondaryButton>
                      </div>
                    </div>
                  </FieldRow>
                </>
              )}

              {processForm.process_type === "USO_DO_SOLO" && (
                <FieldRow label="Inscrição imobiliária">
                  <Input
                    className={COMPANY_FIELD_CLASS}
                    value={processForm.extra?.inscricao_imobiliaria || ""}
                    onChange={(e) => updateProcessExtra("inscricao_imobiliaria", e.target.value)}
                  />
                </FieldRow>
              )}

              {processForm.process_type === "ALVARA_SANITARIO" && (
                <>
                  <FieldRow label="Serviço">
                    <select
                      className={COMPANY_FIELD_CLASS}
                      value={processForm.extra?.servico || ""}
                      onChange={(e) => updateProcessExtra("servico", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {processServicos.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Notificação">
                    <select
                      className={COMPANY_FIELD_CLASS}
                      value={processForm.extra?.notificacao || ""}
                      onChange={(e) => updateProcessExtra("notificacao", e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {processNotificacoes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </FieldRow>
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Observação" description="Notas internas do processo">
            <FieldRow label="Observação">
              <Textarea
                data-testid="process-obs"
                className={COMPANY_FIELD_CLASS}
                rows={4}
                value={processForm.obs}
                onChange={(e) => setProcessForm((p) => ({ ...p, obs: e.target.value }))}
              />
            </FieldRow>
          </SectionCard>
          <Separator />
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-slate-600">
              {processModal.mode === "edit" ? "Edição" : "Cadastro"}
            </Badge>
            <div className="flex gap-2">
              <SecondaryButton type="button" onClick={closeProcessModal}>
                Cancelar
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => saveProcess().catch((e) => alert(e.message))}>
                Salvar
              </PrimaryButton>
            </div>
          </div>
        </div>
      </SideDrawerForm>

      <SideDrawerForm
        open={taxModal.open}
        title="Editar Taxas"
        onClose={closeTaxModal}
        isSaving={taxSaving}
        onSave={() => saveTax().catch((e) => alert(e.message))}
      >
        <div className="space-y-4">
          <SectionCard title="Empresa" description="Contexto do registro de taxas">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldRow label="Empresa" className="md:col-span-2">
                <Input value={taxForm.empresa || "—"} className={COMPANY_FIELD_CLASS} disabled />
              </FieldRow>
              <FieldRow label="Município">
                <Input value={taxForm.municipio || "—"} className={COMPANY_FIELD_CLASS} disabled />
              </FieldRow>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Data de envio</label>
                <input
                  type="date"
                  data-testid="tax-envio-date"
                  value={taxEnvioDateDraft}
                  onChange={(event) => setTaxEnvioDateDraft(event.target.value)}
                  className={COMPANY_FIELD_CLASS}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Método(s) de envio</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-testid="tax-envio-method-trigger"
                      className={COMPANY_FIELD_BUTTON_CLASS}
                    >
                      <span className="truncate">
                        {taxEnvioMethodsDraft.length > 0
                          ? taxEnvioMethodsDraft.join("; ")
                          : "Selecionar método"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="z-[2147483647] w-72">
                    <DropdownMenuLabel>Métodos permitidos</DropdownMenuLabel>
                    {TAX_DATA_ENVIO_METHOD_OPTIONS.map((metodo) => (
                      <DropdownMenuCheckboxItem
                        key={metodo}
                        checked={taxEnvioMethodsDraft.includes(metodo)}
                        onCheckedChange={() => toggleTaxEnvioMetodo(metodo)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        {metodo}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Taxas" description="Situação por tipo">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TAX_STATUS_FIELDS.map(([key, label]) => (
                <FieldRow key={key} label={label}>
                  <select
                    data-testid={`tax-status-${key}`}
                    className={COMPANY_FIELD_CLASS}
                    value={taxStatusModeDraft[key] ?? taxForm[key] ?? ""}
                    onChange={(e) => handleTaxStatusChange(key, e.target.value)}
                  >
                    {TAX_STATUS_OPTION_ITEMS.map((status) => (
                      <option key={status.value || "empty"} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  {(taxStatusModeDraft[key] ?? taxForm[key]) === "parcelado" ? (
                    <div className="mt-2">
                      <Input
                        data-testid={`tax-installment-${key}`}
                        className={COMPANY_FIELD_INLINE_CLASS}
                        placeholder="x/y"
                        value={taxInstallmentDraft[key] ?? "/"}
                        onChange={(e) => handleTaxInstallmentChange(key, e.target.value)}
                      />
                      <p className={`mt-1 text-xs ${taxInstallmentError[key] ? "text-rose-600" : "text-slate-500"}`}>
                        {taxInstallmentError[key] || "Use x/y. Ex.: 0/3, 1/4. Entrada com espaço vira x/y."}
                      </p>
                    </div>
                  ) : null}
                  {(taxStatusModeDraft[key] ?? taxForm[key]) === "pendente" ? (
                    <div className="mt-2">
                      <Textarea
                        data-testid={`tax-pendente-obs-${key}`}
                        rows={2}
                        className={COMPANY_FIELD_CLASS}
                        placeholder="Observação do motivo pendente"
                        value={taxPendingObservationDraft[key] ?? ""}
                        onChange={(e) => handleTaxPendingObservationChange(key, e.target.value)}
                      />
                    </div>
                  ) : null}
                </FieldRow>
              ))}
              <FieldRow label="Vencimento TPI (dd/mm)">
                <Input
                  className={COMPANY_FIELD_CLASS}
                  value={taxForm.vencimento_tpi}
                  onChange={(e) => setTaxForm((prev) => ({ ...prev, vencimento_tpi: e.target.value }))}
                  placeholder="dd/mm"
                />
              </FieldRow>
            </div>
          </SectionCard>
        </div>
      </SideDrawerForm>
    </div>
  );
}
