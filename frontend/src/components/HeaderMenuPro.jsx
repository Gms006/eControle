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

const EVT_OPEN_COMPANY = "econtrole:open-company";
const EVT_OPEN_PROCESS = "econtrole:open-process";
const EVT_OPEN_TAX = "econtrole:open-tax";
const EVT_REFRESH_DATA = "econtrole:refresh-data";

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

const EMPTY_COMPANY_FORM = {
  cnpj: "",
  razao_social: "",
  nome_fantasia: "",
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
};

const EMPTY_PROCESS_FORM = {
  company_id: "",
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
  const rolesRaw = auth?.user?.roles || [];
  const roleNames = Array.isArray(rolesRaw)
    ? rolesRaw.map((r) => (typeof r === "string" ? r : r?.name)).filter(Boolean)
    : [];
  const canWrite = useMemo(() => {
    if (roleNames.length > 0) {
      return roleNames.includes("ADMIN") || roleNames.includes("DEV");
    }
    return Boolean(auth?.accessToken);
  }, [auth?.accessToken, roleNames]);

  const [companyModal, setCompanyModal] = useState({ open: false, mode: "create", companyId: null });
  const [processModal, setProcessModal] = useState({ open: false, mode: "create", processId: null });
  const [taxModal, setTaxModal] = useState({ open: false, mode: "edit", taxId: null });
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [processForm, setProcessForm] = useState(EMPTY_PROCESS_FORM);
  const [taxForm, setTaxForm] = useState(EMPTY_TAX_FORM);
  const [taxStatusModeDraft, setTaxStatusModeDraft] = useState({});
  const [taxInstallmentDraft, setTaxInstallmentDraft] = useState({});
  const [taxInstallmentError, setTaxInstallmentError] = useState({});
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

  const closeCompanyModal = () => setCompanyModal({ open: false, mode: "create", companyId: null });
  const closeProcessModal = () => setProcessModal({ open: false, mode: "create", processId: null });
  const closeTaxModal = () => {
    setTaxModal({ open: false, mode: "edit", taxId: null });
    setTaxStatusModeDraft({});
    setTaxInstallmentDraft({});
    setTaxInstallmentError({});
    setTaxEnvioDateDraft("");
    setTaxEnvioMethodsDraft([]);
  };

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

  const openCompany = async ({ mode, companyId }) => {
    setCompanyModal({ open: true, mode, companyId: companyId || null });
    if (mode === "edit" && companyId) {
      const data = await apiJson(`/api/v1/companies/${companyId}`);
      const form = {
        ...EMPTY_COMPANY_FORM,
        cnpj: maskCnpj(data?.cnpj || ""),
        razao_social: data?.razao_social || "",
        nome_fantasia: data?.nome_fantasia || "",
        inscricao_municipal: data?.inscricao_municipal || "",
        inscricao_estadual: data?.inscricao_estadual || "",
        porte: normalizePorteSigla(data?.porte || ""),
        municipio: formatMunicipioDisplay(data?.municipio || ""),
        uf: data?.uf || "",
        categoria: data?.categoria || "",
        is_active: data?.is_active !== false,
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
  });

  const initializeTaxStatusDraft = (normalized) => {
    const nextMode = {};
    const nextInstallment = {};
    TAX_STATUS_FIELDS.forEach(([field]) => {
      const raw = String(normalized?.[field] || "").trim();
      const parsed = parseInstallment(raw);
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
  };

  const handleTaxStatusChange = (field, value) => {
    setTaxStatusModeDraft((prev) => ({ ...prev, [field]: value }));
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
      openCompany({ mode: detail.mode || "create", companyId: detail.companyId || null }).catch(console.error);
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
    if (digits.length !== 14) return;
    const data = await apiJson(`/api/v1/lookups/receitaws/${digits}`);
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

  const saveCompany = async () => {
    setCompanySaving(true);
    try {
    const digits = normalizeDigits(companyForm.cnpj);
    if (digits.length !== 14) throw new Error("CNPJ inválido");
    if (!companyForm.razao_social?.trim()) throw new Error("Razão social obrigatória");

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
    if (!processForm.company_id && processModal.mode === "create") {
      throw new Error("Selecione a empresa");
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
      await apiJson("/api/v1/processos", {
        method: "POST",
        body: JSON.stringify({ ...basePayload, company_id: processForm.company_id }),
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
      for (const [field, label] of TAX_STATUS_FIELDS) {
        const mode = String(taxStatusModeDraft[field] ?? taxForm[field] ?? "").trim();
        if (!mode) {
          nextPayloadStatus[field] = null;
          continue;
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
          </DropdownMenuContent>
        </DropdownMenu>
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
                {processModal.mode === "create" ? (
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
                  <Input value={processForm.company_id} className={COMPANY_FIELD_CLASS} disabled />
                )}
              </FieldRow>

              <FieldRow label="Tipo">
                <select
                  className={COMPANY_FIELD_CLASS}
                  value={processForm.process_type}
                  onChange={(e) => setProcessForm((p) => ({ ...p, process_type: e.target.value }))}
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
