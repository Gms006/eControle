import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  BadgeAlert,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  Droplets,
  Clock,
  FileText,
  Filter,
  LineChart as LineChartIcon,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Trees,
  Users,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const normalizeApiBase = (rawBase) => {
  const fallback = "/api";
  const trimmed = rawBase?.trim();
  const base = trimmed && trimmed !== "" ? trimmed : fallback;
  const collapseExtraSlashes = (value) => {
    if (!value) return value;
    const placeholder = "__TMP_PROTOCOL__";
    const placeholderRegex = new RegExp(placeholder, "g");
    const [path, ...rest] = value.split("?");
    const withPlaceholder = path.replace(/:\/\//g, placeholder);
    const collapsedPath = withPlaceholder
      .replace(/\/{2,}/g, "/")
      .replace(placeholderRegex, "://");
    return rest.length > 0 ? `${collapsedPath}?${rest.join("?")}` : collapsedPath;
  };
  const collapsed = collapseExtraSlashes(base);
  const withoutTrailing = collapsed.replace(/\/+$/, "");
  const ensuredSuffix = withoutTrailing.endsWith("/api")
    ? withoutTrailing
    : `${withoutTrailing || ""}/api`;
  const withLeadingSlash =
    ensuredSuffix.startsWith("http://") || ensuredSuffix.startsWith("https://")
      ? ensuredSuffix
      : ensuredSuffix.startsWith("/")
        ? ensuredSuffix
        : `/${ensuredSuffix}`;
  return collapseExtraSlashes(withLeadingSlash);
};

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

const apiUrl = (path = "") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
};

const fetchJson = async (path) => {
  const response = await fetch(apiUrl(path));
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.detail || JSON.stringify(payload);
    } catch (jsonError) {
      try {
        detail = await response.text();
      } catch (textError) {
        detail = "";
      }
    }
    const message = detail ? `Erro ${response.status}: ${detail}` : `Erro ${response.status}`;
    throw new Error(message);
  }
  return await response.json();
};

const MUNICIPIO_ALL = "__ALL__";
const PROCESS_ALL = "__PROCESS_ALL__";

const TAB_BACKGROUNDS = {
  painel: "bg-sky-50",
  empresas: "bg-indigo-50",
  licencas: "bg-emerald-50",
  taxas: "bg-amber-50",
  processos: "bg-violet-50",
  uteis: "bg-slate-50",
};

const TAB_SHORTCUTS = {
  1: "painel",
  2: "empresas",
  3: "licencas",
  4: "taxas",
  5: "processos",
  6: "uteis",
};

const PROCESS_ICONS = {
  Diversos: <Settings className="h-4 w-4" />, // fallback genérico
  Funcionamento: <ClipboardCheck className="h-4 w-4" />,
  Bombeiros: <Shield className="h-4 w-4" />,
  Ambiental: <Sparkles className="h-4 w-4" />,
  "Licença Ambiental": <Sparkles className="h-4 w-4" />,
  "Uso do Solo": <MapPin className="h-4 w-4" />,
  Sanitário: <BadgeAlert className="h-4 w-4" />,
  "Alvará Sanitário": <BadgeAlert className="h-4 w-4" />,
};

const LIC_ICONS = {
  Sanitária: <Droplets className="h-4 w-4" />,
  CERCON: <Shield className="h-4 w-4" />,
  Funcionamento: <Building2 className="h-4 w-4" />,
  "Uso do Solo": <MapPin className="h-4 w-4" />,
  Ambiental: <Trees className="h-4 w-4" />,
};

const LIC_COLORS = {
  Sanitária: "border-sky-500 text-sky-700",
  CERCON: "border-indigo-500 text-indigo-700",
  Funcionamento: "border-blue-500 text-blue-700",
  "Uso do Solo": "border-amber-500 text-amber-700",
  Ambiental: "border-emerald-600 text-emerald-700",
};

const DEFAULT_LICENCA_TIPOS = ["Sanitária", "CERCON", "Funcionamento", "Uso do Solo", "Ambiental"];

const removeDiacritics = (value) => {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const getStatusKey = (status) => removeDiacritics(normalizeTextLower(status));

const hasRelevantStatus = (status) => {
  const statusText = normalizeText(status).trim();
  if (!statusText || statusText === "*" || statusText === "-" || statusText === "—") {
    return false;
  }
  const statusKey = getStatusKey(statusText);
  return Boolean(statusKey && statusKey !== "*");
};

const toFiniteNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const extractEmpresaId = (entity) => {
  if (!entity || typeof entity !== "object") return undefined;
  const candidates = [entity.empresa_id, entity.empresaId, entity.id];
  for (const candidate of candidates) {
    const numeric = toFiniteNumber(candidate);
    if (numeric !== undefined) {
      return numeric;
    }
  }
  return undefined;
};

const normalizeEmpresaRelacionada = (entity) => {
  if (!entity || typeof entity !== "object") return entity;
  const empresaId = extractEmpresaId(entity);
  return {
    ...entity,
    empresaId,
    empresa_id: empresaId,
  };
};

const ALERT_STATUS_KEYWORDS = [
  "vencid",
  "vence",
  "nao pago",
  "nao-pago",
  "negad",
  "indefer",
  "abert",
];

const TAXA_COLUMNS = [
  { key: "tpi", label: "TPI" },
  { key: "func", label: "Funcionamento" },
  { key: "publicidade", label: "Publicidade" },
  { key: "sanitaria", label: "Sanitária" },
  { key: "localizacao_instalacao", label: "Localização/Instalação" },
  { key: "area_publica", label: "Área Pública" },
  { key: "bombeiros", label: "Bombeiros" },
  { key: "status_geral", label: "Status geral" },
];

const TAXA_TYPE_KEYS = TAXA_COLUMNS.filter((column) => column.key !== "status_geral").map(
  (column) => column.key,
);

const TAXA_ALERT_KEYS = [...TAXA_TYPE_KEYS, "status_geral"];

const TAXA_SEARCH_KEYS = [...TAXA_COLUMNS.map((column) => column.key), "data_envio"];

const parseProgressFraction = (status) => {
  if (status === null || status === undefined) {
    return null;
  }
  const text = normalizeText(status);
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }
  const parseNumber = (value) => {
    const trimmed = value.replace(/\s+/g, "");
    const hasComma = trimmed.includes(",");
    const hasDot = trimmed.includes(".");
    const normalized = hasComma && hasDot
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const current = parseNumber(match[1]);
  const total = parseNumber(match[2]);
  return { current, total };
};

const hasPendingFraction = (status) => {
  const fraction = parseProgressFraction(status);
  if (!fraction) {
    return false;
  }
  const { current, total } = fraction;
  if (!Number.isFinite(current) || !Number.isFinite(total)) {
    return true;
  }
  if (total <= 0) {
    return true;
  }
  return current < total;
};

const isAlertStatus = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  if (key.includes("nao se aplica") || key.includes("n/a")) return false;
  if (hasPendingFraction(status)) {
    return true;
  }
  return ALERT_STATUS_KEYWORDS.some((keyword) => key.includes(keyword));
};

const PROCESS_INACTIVE_KEYWORDS = ["concluido", "licenciado", "aprovado", "indeferido", "negado", "finalizado"];

const isProcessStatusInactive = (status) => {
  const key = getStatusKey(status);
  if (!key) return false;
  return PROCESS_INACTIVE_KEYWORDS.some((keyword) => key.includes(keyword));
};

const STATUS_VARIANT_CLASSES = {
  success: "bg-emerald-500 text-white border-emerald-500",
  warning: "bg-amber-500 text-white border-amber-500",
  danger: "bg-red-500 text-white border-red-500",
  info: "bg-sky-500 text-white border-sky-500",
  neutral: "bg-slate-500 text-white border-slate-500",
  muted: "bg-slate-400 text-white border-slate-400",
  plain: "bg-transparent border-transparent text-slate-500",
};

const PROCESS_BASE_COLUMNS = [
  { key: "protocolo", label: "Protocolo", copyable: true },
  { key: "data_solicitacao", label: "Data de Solicitação" },
  { key: "situacao", label: "Situação", isStatus: true },
];

const normalizeProcessColumnKey = (value) =>
  removeDiacritics(String(value ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, "_");

const PROCESS_EXTRA_COLUMNS = {
  diversos: [
    { key: "operacao", label: "Operação" },
    { key: "orgao", label: "Órgão" },
  ],
  bombeiros: [{ key: "tpi", label: "TPI" }],
  funcionamento: [{ key: "alvara", label: "Alvará" }],
  alvara_de_funcionamento: [{ key: "alvara", label: "Alvará" }],
  uso_do_solo: [
    { key: "inscricao_imobiliaria", label: "Inscrição Imobiliária", copyable: true },
  ],
  sanitario: [
    { key: "taxa", label: "Taxa" },
    { key: "servico", label: "Serviço" },
    { key: "notificacao", label: "Notificação" },
    { key: "data_val", label: "Data Val" },
  ],
  alvara_sanitario: [
    { key: "servico", label: "Serviço" },
    { key: "notificacao", label: "Notificação" },
    { key: "data_val", label: "Data Val" },
  ],
};

const resolveStatusClass = (status) => {
  const key = getStatusKey(status);
  if (!key || key === "*" || key === "-" || key === "—") {
    return { variant: "plain", className: STATUS_VARIANT_CLASSES.plain };
  }

  const fraction = parseProgressFraction(status);
  if (fraction) {
    const { current, total } = fraction;
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
      return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
    }
    if (current < total) {
      return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
    }
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key === "/") {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key.includes("possui debit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("sem debit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("possui")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("pago") && !key.includes("nao")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("em aberto") || key.includes("emaberto") || key.includes("nao pago")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("sujeit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("vencid") || key.includes("vence")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key === "nao" || key.includes("nao possui") || key.includes("nao tem")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.muted };
  }

  if (key.includes("indefer") || key.includes("negad")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (key.includes("em andament") || key.includes("aguard")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.warning };
  }

  if (key.includes("pend")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.neutral };
  }

  if (key.includes("conclu") || key.includes("aprov") || key.includes("licenc") || key.includes("defer") || key.includes("emit")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  if (key.includes("nao se aplica") || key.includes("n/a")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.info };
  }

  if (key.includes("dispens") || key.includes("orient") || key.includes("inform") || key.includes("consult")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.info };
  }

  if (key.includes("irregular") || key.includes("suspens") || key.includes("cancel") || key.includes("bloque") || key.includes("inadimpl")) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.danger };
  }

  if (
    (key.includes("regular") && !key.includes("irregular")) ||
    key.includes("quit") ||
    key.includes("vigent") ||
    key.includes("ativo") ||
    (key.includes("em dia") && !key.includes("irregular")) ||
    (key === "sim" && !key.includes("irregular"))
  ) {
    return { variant: "solid", className: STATUS_VARIANT_CLASSES.success };
  }

  return { variant: "solid", className: STATUS_VARIANT_CLASSES.neutral };
};

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const normalizeTextLower = (value) => normalizeText(value).toLowerCase();

const normalizeProcessType = (proc) => {
  const rawValue =
    typeof proc === "string"
      ? proc
      : typeof proc?.tipo === "string"
        ? proc.tipo
        : undefined;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  return trimmed !== "" ? trimmed : "Sem tipo";
};

const normalizeIdentifier = (value) => {
  const normalized = normalizeText(value).trim();
  return normalized !== "" ? normalized : undefined;
};

const enhanceEmpresa = (empresa) => {
  if (!empresa || typeof empresa !== "object") {
    return empresa;
  }
  const ie =
    normalizeIdentifier(empresa.ie) ||
    normalizeIdentifier(empresa.inscricao_estadual) ||
    normalizeIdentifier(empresa.inscricaoEstadual) ||
    normalizeIdentifier(empresa["inscrição_estadual"]);
  const im =
    normalizeIdentifier(empresa.im) ||
    normalizeIdentifier(empresa.inscricao_municipal) ||
    normalizeIdentifier(empresa.inscricaoMunicipal) ||
    normalizeIdentifier(empresa["inscrição_municipal"]);
  const empresaId = extractEmpresaId(empresa);
  return {
    ...empresa,
    ie,
    im,
    empresaId: empresaId ?? empresa?.id,
    empresa_id: empresaId ?? empresa?.id,
  };
};

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
  const variants = {
    solid: "bg-slate-100 border-transparent text-slate-700",
    outline: "bg-white border-slate-200 text-slate-600",
    plain: "bg-transparent border-transparent text-slate-500",
  };
  const variantClasses = variants[variant] || variants.solid;
  return (
    <span className={`${base} ${variantClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}

function CopyableIdentifier({ label, value, onCopy }) {
  const normalizedValue = normalizeIdentifier(value);
  const displayValue = normalizedValue || "—";
  return (
    <button
      type="button"
      onClick={() => onCopy(normalizedValue, normalizedValue ? `${label} copiado: ${normalizedValue}` : undefined)}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      title={`Copiar ${label}`}
    >
      <Clipboard className="h-3 w-3 opacity-70" aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span>{displayValue}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const normalized = normalizeText(status);
  const trimmed = normalized.trim();
  const displayValue = trimmed === "" || trimmed === "*" || trimmed === "-" || trimmed === "—" ? "—" : trimmed;
  const { variant, className } = resolveStatusClass(status);
  return (
    <InlineBadge variant={variant} className={className}>
      {displayValue}
    </InlineBadge>
  );
}

function KPI({ title, value, icon, accent }) {
  return (
    <Card className={`shadow-sm border-none ${accent}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/70 text-slate-700">{icon}</div>
        <div>
          <div className="text-xs text-slate-600 uppercase tracking-wide">{title}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const formatMonthLabel = (date) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);

const parsePtDate = (value) => {
  if (!value) return null;
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

export default function App() {
  const [tab, setTab] = useState("painel");
  const [query, setQuery] = useState("");
  const [municipio, setMunicipio] = useState();
  const [soAlertas, setSoAlertas] = useState(false);
  const [modoFoco, setModoFoco] = useState(true);
  const [selectedTipo, setSelectedTipo] = useState(PROCESS_ALL);
  const [selectedLicTipo, setSelectedLicTipo] = useState("Todos");
  const [toasts, setToasts] = useState([]);
  const [uteisQuery, setUteisQuery] = useState("");

  const toastTimeoutsRef = useRef(new Map());

  const normalizedQueryValue = useMemo(() => normalizeTextLower(query).trim(), [query]);
  const municipioKey = useMemo(() => normalizeTextLower(municipio).trim(), [municipio]);
  const normalizedUteisQuery = useMemo(() => normalizeTextLower(uteisQuery).trim(), [uteisQuery]);

  const [empresas, setEmpresas] = useState([]);
  const [licencas, setLicencas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [kpis, setKpis] = useState({});
  const [municipios, setMunicipios] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleKeyDown = (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const activeElement = event.target;
      const isHtmlElement = typeof HTMLElement !== 'undefined' && activeElement instanceof HTMLElement;
      if (isHtmlElement) {
        const tag = activeElement.tagName;
        const isFormField =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          activeElement.isContentEditable ||
          activeElement.getAttribute('role') === 'combobox';
        if (isFormField) {
          return;
        }
      }
      const shortcutValue = TAB_SHORTCUTS[event.key];
      if (!shortcutValue) {
        return;
      }
      event.preventDefault();
      setTab(shortcutValue);
      if (typeof document !== 'undefined') {
        const trigger = document.querySelector(`[data-tab-target="${shortcutValue}"]`);
        if (trigger && typeof trigger.focus === 'function') {
          trigger.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTab]);

  const tiposLicenca = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    DEFAULT_LICENCA_TIPOS.forEach((tipoBase) => {
      const trimmed = normalizeText(tipoBase).trim();
      if (trimmed !== "" && !seen.has(trimmed)) {
        seen.add(trimmed);
        ordered.push(trimmed);
      }
    });
    licencas.forEach((lic) => {
      const tipo = normalizeText(lic?.tipo).trim();
      if (tipo === "" || seen.has(tipo)) {
        return;
      }
      seen.add(tipo);
      ordered.push(tipo);
    });
    return ordered;
  }, [licencas]);

  useEffect(() => {
    if (selectedLicTipo !== "Todos" && !tiposLicenca.includes(selectedLicTipo)) {
      setSelectedLicTipo("Todos");
    }
  }, [selectedLicTipo, tiposLicenca]);

  const tiposLicencaSelecionados = useMemo(
    () => (selectedLicTipo === "Todos" ? tiposLicenca : [selectedLicTipo]),
    [selectedLicTipo, tiposLicenca],
  );

  const sanitizedMunicipios = useMemo(() => {
    const seen = new Set();
    return municipios.reduce((acc, item) => {
      const normalized = normalizeText(item);
      const trimmed = normalized.trim();
      if (trimmed === "" || trimmed === MUNICIPIO_ALL) {
        return acc;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        return acc;
      }
      seen.add(key);
      acc.push(trimmed);
      return acc;
    }, []);
  }, [municipios]);

  const contatosOrdenados = useMemo(() => {
    return [...contatos]
      .filter((item) => item && (item.contato || item.email || item.telefone))
      .sort((a, b) => {
        const catA = normalizeText(a?.categoria || "");
        const catB = normalizeText(b?.categoria || "");
        if (catA !== catB) {
          return catA.localeCompare(catB, "pt-BR");
        }
        const nomeA = normalizeText(a?.contato || "");
        const nomeB = normalizeText(b?.contato || "");
        return nomeA.localeCompare(nomeB, "pt-BR");
      });
  }, [contatos]);

  const modelosOrdenados = useMemo(() => {
    return [...modelos]
      .filter((item) => item && (item.modelo || item.descricao))
      .sort((a, b) => {
        const usoA = normalizeText(a?.utilizacao || "");
        const usoB = normalizeText(b?.utilizacao || "");
        if (usoA !== usoB) {
          return usoA.localeCompare(usoB, "pt-BR");
        }
        const descA = normalizeText(a?.descricao || "");
        const descB = normalizeText(b?.descricao || "");
        return descA.localeCompare(descB, "pt-BR");
      });
  }, [modelos]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchJson("/empresas"),
      fetchJson("/licencas"),
      fetchJson("/taxas"),
      fetchJson("/processos"),
      fetchJson("/kpis"),
      fetchJson("/municipios"),
      fetchJson("/uteis"),
    ])
      .then(([emp, lic, tax, proc, kpi, mun, uteis]) => {
        if (!mounted) return;
        const empresasNormalizadas = Array.isArray(emp)
          ? emp.map((item) => enhanceEmpresa(item))
          : [];
        const licencasNormalizadas = Array.isArray(lic)
          ? lic.map((item) => normalizeEmpresaRelacionada(item))
          : [];
        const taxasNormalizadas = Array.isArray(tax)
          ? tax.map((item) => normalizeEmpresaRelacionada(item))
          : [];
        const processosComEmpresa = Array.isArray(proc)
          ? proc.map((item) => normalizeEmpresaRelacionada(item))
          : [];
        setEmpresas(empresasNormalizadas);
        setLicencas(licencasNormalizadas);
        setTaxas(taxasNormalizadas);
        setProcessos(processosComEmpresa);
        setKpis(kpi);
        setMunicipios(Array.isArray(mun) ? mun : []);
        setContatos(Array.isArray(uteis?.contatos) ? uteis.contatos : []);
        setModelos(Array.isArray(uteis?.modelos) ? uteis.modelos : []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erro ao carregar dados:", error);
        if (mounted) {
          setEmpresas([]);
          setLicencas([]);
          setTaxas([]);
          setProcessos([]);
          setKpis({});
          setMunicipios([]);
          setContatos([]);
          setModelos([]);
          setLoading(false);
          enqueueToast("Não foi possível carregar os dados.");
        }
      });
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const empresasById = useMemo(() => {
    const map = new Map();
    empresas.forEach((empresa) => {
      const empresaId = extractEmpresaId(empresa);
      if (empresaId === undefined) return;
      map.set(empresaId, empresa);
    });
    return map;
  }, [empresas]);

  const licencasByEmpresa = useMemo(() => {
    const map = new Map();
    licencas.forEach((lic) => {
      const empresaId = extractEmpresaId(lic);
      if (empresaId === undefined) return;
      const group = map.get(empresaId) || [];
      group.push(lic);
      map.set(empresaId, group);
    });
    return map;
  }, [licencas]);

  const taxasByEmpresa = useMemo(() => {
    const map = new Map();
    taxas.forEach((tx) => {
      const empresaId = extractEmpresaId(tx);
      if (empresaId === undefined) return;
      map.set(empresaId, tx);
    });
    return map;
  }, [taxas]);

  const processosNormalizados = useMemo(
    () =>
      processos.map((proc) => {
        const empresaId = extractEmpresaId(proc);
        const statusCandidates = [proc.status, proc.status_padrao, proc.situacao];
        const resolvedStatus = statusCandidates.find((value) => normalizeIdentifier(value));
        return {
          ...proc,
          empresaId,
          empresa_id: empresaId,
          tipoNormalizado: normalizeProcessType(proc),
          status: resolvedStatus ?? proc.status ?? proc.status_padrao ?? proc.situacao,
        };
      }),
    [processos],
  );

  const processosByEmpresa = useMemo(() => {
    const map = new Map();
    processosNormalizados.forEach((proc) => {
      const empresaId = extractEmpresaId(proc);
      if (empresaId === undefined) return;
      const group = map.get(empresaId) || [];
      group.push(proc);
      map.set(empresaId, group);
    });
    return map;
  }, [processosNormalizados]);

  const matchesQuery = useCallback(
    (fields) => {
      if (normalizedQueryValue === "") {
        return true;
      }
      return fields
        .filter((field) => field !== null && field !== undefined)
        .some((field) => normalizeTextLower(field).includes(normalizedQueryValue));
    },
    [normalizedQueryValue],
  );

  const matchesUteisQuery = useCallback(
    (fields) => {
      if (normalizedUteisQuery === "") {
        return true;
      }
      return fields
        .filter((field) => field !== null && field !== undefined)
        .some((field) => normalizeTextLower(field).includes(normalizedUteisQuery));
    },
    [normalizedUteisQuery],
  );

  const matchesMunicipioFilter = useCallback(
    (entity) => {
      if (municipioKey === "") {
        return true;
      }
      if (!entity || typeof entity !== "object") {
        return false;
      }
      const candidates = [];
      if ("municipio" in entity) {
        candidates.push(entity.municipio);
      }
      const empresaId = extractEmpresaId(entity);
      if (empresaId !== undefined) {
        const empresaRelacionada = empresasById.get(empresaId);
        if (empresaRelacionada) {
          candidates.push(empresaRelacionada.municipio);
        }
      }
      return candidates
        .filter((value) => value !== null && value !== undefined)
        .some((value) => normalizeTextLower(value).trim() === municipioKey);
    },
    [empresasById, municipioKey],
  );

  const filteredLicencas = useMemo(
    () =>
      licencas.filter(
        (lic) =>
          matchesMunicipioFilter(lic) &&
          matchesQuery([
            lic.empresa,
            lic.cnpj,
            lic.tipo,
            lic.status,
            lic.validade,
            lic.obs,
          ]),
      ),
    [licencas, matchesMunicipioFilter, matchesQuery],
  );

  const filteredTaxas = useMemo(
    () =>
      taxas.filter((taxa) => {
        if (!matchesMunicipioFilter(taxa)) {
          return false;
        }
        const camposPesquisa = [
          taxa.empresa,
          taxa.cnpj,
          ...TAXA_SEARCH_KEYS.map((key) => taxa?.[key]),
        ];
        return matchesQuery(camposPesquisa);
      }),
    [matchesMunicipioFilter, matchesQuery, taxas],
  );

  const filteredProcessosBase = useMemo(
    () =>
      processosNormalizados.filter(
        (proc) =>
          matchesMunicipioFilter(proc) &&
          matchesQuery([
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
          ]),
      ),
    [matchesMunicipioFilter, matchesQuery, processosNormalizados],
  );

  const filteredContatos = useMemo(() => {
    const lista = Array.isArray(contatos) ? contatos : [];
    return lista.filter(
      (contato) =>
        matchesMunicipioFilter(contato) &&
        matchesUteisQuery([
          contato?.contato,
          contato?.categoria,
          contato?.municipio,
          contato?.email,
          contato?.telefone,
          contato?.whatsapp,
        ]),
    );
  }, [contatos, matchesMunicipioFilter, matchesUteisQuery]);

  const filteredModelos = useMemo(() => {
    const lista = Array.isArray(modelos) ? modelos : [];
    return lista.filter(
      (modelo) =>
        matchesMunicipioFilter(modelo) &&
        matchesUteisQuery([modelo?.descricao, modelo?.utilizacao, modelo?.modelo]),
    );
  }, [matchesMunicipioFilter, matchesUteisQuery, modelos]);

  const contatosOrdenadosLista = useMemo(() => {
    const lista = Array.isArray(filteredContatos) ? filteredContatos : [];
    return [...lista]
      .filter((item) => item && (item.contato || item.email || item.telefone))
      .sort((a, b) => {
        const catA = normalizeText(a?.categoria || "");
        const catB = normalizeText(b?.categoria || "");
        if (catA !== catB) {
          return catA.localeCompare(catB, "pt-BR");
        }
        const nomeA = normalizeText(a?.contato || "");
        const nomeB = normalizeText(b?.contato || "");
        return nomeA.localeCompare(nomeB, "pt-BR");
      });
  }, [filteredContatos]);

  const modelosOrdenadosLista = useMemo(() => {
    const lista = Array.isArray(filteredModelos) ? filteredModelos : [];
    return [...lista]
      .filter((item) => item && (item.modelo || item.descricao))
      .sort((a, b) => {
        const usoA = normalizeText(a?.utilizacao || "");
        const usoB = normalizeText(b?.utilizacao || "");
        if (usoA !== usoB) {
          return usoA.localeCompare(usoB, "pt-BR");
        }
        const descA = normalizeText(a?.descricao || "");
        const descB = normalizeText(b?.descricao || "");
        return descA.localeCompare(descB, "pt-BR");
      });
  }, [filteredModelos]);

  const taxasVisiveis = useMemo(() => {
    if (!modoFoco) {
      return filteredTaxas;
    }
    return filteredTaxas.filter((taxa) =>
      TAXA_ALERT_KEYS.some((key) => isAlertStatus(taxa?.[key])),
    );
  }, [filteredTaxas, modoFoco]);

  const enqueueToast = useCallback((message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message }]);
    if (typeof window !== "undefined") {
      const timeout = window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        const stored = toastTimeoutsRef.current.get(id);
        if (stored) {
          clearTimeout(stored);
          toastTimeoutsRef.current.delete(id);
        }
      }, 3200);
      toastTimeoutsRef.current.set(id, timeout);
    }
  }, []);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const stored = toastTimeoutsRef.current.get(id);
    if (stored) {
      clearTimeout(stored);
      toastTimeoutsRef.current.delete(id);
    }
  }, []);

  const companyHasAlert = useCallback(
    (empresa) => {
      if (!empresa) return false;
      const empresaId = extractEmpresaId(empresa);
      if (empresaId === undefined) return false;
      const debitoLower = normalizeTextLower(empresa.debito);
      const certificadoLower = normalizeTextLower(empresa.certificado);
      if (debitoLower === "sim" || certificadoLower === "não") {
        return true;
      }
      const licList = licencasByEmpresa.get(empresaId) || [];
      const hasLicencaAlert = licList.some((lic) => isAlertStatus(lic.status));
      if (hasLicencaAlert) return true;
      const taxa = taxasByEmpresa.get(empresaId);
      if (taxa) {
        const entries = TAXA_TYPE_KEYS.map((key) => taxa?.[key]);
        if (entries.some((status) => isAlertStatus(status))) {
          return true;
        }
      }
      const processosEmpresa = processosByEmpresa.get(empresaId) || [];
      return processosEmpresa.some((proc) => !isProcessStatusInactive(proc.status));
    },
    [licencasByEmpresa, processosByEmpresa, taxasByEmpresa],
  );

  const filterEmpresas = useCallback(
    (lista) => {
      return lista.filter((empresa) => {
        if (!empresa) return false;
        const matchesQueryEmpresa = matchesQuery([
          empresa.empresa,
          empresa.cnpj,
          empresa.municipio,
          empresa.categoria,
          empresa.email,
          empresa.ie,
          empresa.im,
        ]);
        const matchesMunicipio = matchesMunicipioFilter(empresa);
        const matchesAlert = !soAlertas || companyHasAlert(empresa);
        return matchesQueryEmpresa && matchesMunicipio && matchesAlert;
      });
    },
    [companyHasAlert, matchesMunicipioFilter, matchesQuery, soAlertas],
  );

  const filteredEmpresas = useMemo(
    () => filterEmpresas(empresas),
    [empresas, filterEmpresas],
  );

  const empresasComPendencias = useMemo(
    () => filterEmpresas(empresas.filter((empresa) => companyHasAlert(empresa))).slice(0, 8),
    [companyHasAlert, empresas, filterEmpresas],
  );

  const licencaResumo = useMemo(() => {
    return filteredLicencas.reduce(
      (acc, lic) => {
        if (!hasRelevantStatus(lic?.status)) {
          return acc;
        }
        const statusKey = getStatusKey(lic.status);
        acc.total += 1;
        if (statusKey.includes("vencid")) acc.vencidas += 1;
        else if (statusKey.includes("vence")) acc.vencendo += 1;
        else if (statusKey.includes("dispens")) acc.dispensa += 1;
        else if (statusKey.includes("sujeit")) acc.sujeito += 1;
        else acc.ativas += 1;
        return acc;
      },
      { total: 0, ativas: 0, vencendo: 0, vencidas: 0, dispensa: 0, sujeito: 0 },
    );
  }, [filteredLicencas]);

  const alertTrendData = useMemo(() => {
    const monthly = new Map();
    filteredLicencas.forEach((lic) => {
      const validade = parsePtDate(lic.validade);
      if (!validade) return;
      if (!hasRelevantStatus(lic.status)) return;
      const statusKey = getStatusKey(lic.status);
      const key = `${validade.getFullYear()}-${validade.getMonth()}`;
      const entry = monthly.get(key) || { date: validade, vencidas: 0, vencendo: 0 };
      if (statusKey.includes("vencid")) entry.vencidas += 1;
      else if (statusKey.includes("vence")) entry.vencendo += 1;
      monthly.set(key, entry);
    });
    if (monthly.size === 0) {
      return [
        { mes: "Sem dados", vencidas: 0, vencendo: 0 },
      ];
    }
    const sorted = Array.from(monthly.values())
      .filter(entry => entry.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return sorted.slice(-6).map((entry) => ({
      mes: `${formatMonthLabel(entry.date)}`,
      vencidas: entry.vencidas,
      vencendo: entry.vencendo,
    }));
  }, [filteredLicencas]);

  const processosTipos = useMemo(() => {
    const counts = new Map();
    filteredProcessosBase.forEach((proc) => {
      const current = counts.get(proc.tipoNormalizado) || 0;
      counts.set(proc.tipoNormalizado, current + 1);
    });
    const asArray = Array.from(counts.entries()).map(([tipo, count]) => ({ tipo, count }));
    asArray.sort((a, b) => a.tipo.localeCompare(b.tipo));
    return asArray;
  }, [filteredProcessosBase]);

  useEffect(() => {
    if (
      selectedTipo !== PROCESS_ALL &&
      !processosTipos.some((item) => item.tipo === selectedTipo)
    ) {
      setSelectedTipo(PROCESS_ALL);
    }
  }, [processosTipos, selectedTipo]);

  const processosFiltrados = useMemo(() => {
    const listaBase =
      selectedTipo === PROCESS_ALL
        ? filteredProcessosBase
        : filteredProcessosBase.filter((proc) => proc.tipoNormalizado === selectedTipo);
    if (!modoFoco) return listaBase;
    return listaBase.filter((proc) => !isProcessStatusInactive(proc.status));
  }, [filteredProcessosBase, modoFoco, selectedTipo]);

  const resolveProcessExtraColumns = useCallback((proc) => {
    const extras = [];
    const seen = new Set();
    const pushColumn = (column) => {
      if (!column || !column.key || seen.has(column.key)) {
        return;
      }
      seen.add(column.key);
      extras.push(column);
    };

    const includeColumns = (key) => {
      if (!key) return;
      const columns = PROCESS_EXTRA_COLUMNS[key];
      if (Array.isArray(columns)) {
        columns.forEach(pushColumn);
      }
    };

    const tipoReferencia = proc?.tipoNormalizado || proc?.tipo;
    const normalized = normalizeProcessColumnKey(tipoReferencia);
    if (normalized) {
      includeColumns(normalized);
      if (extras.length === 0) {
        if (normalized.includes("sanitario")) {
          includeColumns("sanitario");
        } else if (normalized.includes("uso") && normalized.includes("solo")) {
          includeColumns("uso_do_solo");
        } else if (normalized.includes("funcion")) {
          includeColumns("funcionamento");
        } else if (normalized.includes("divers")) {
          includeColumns("diversos");
        } else if (normalized.includes("bombeir")) {
          includeColumns("bombeiros");
        } else if (normalized.includes("alvara") && normalized.includes("sanit")) {
          includeColumns("alvara_sanitario");
        }
      }
    }

    return extras;
  }, []);

  const processosAtivos = useMemo(() => {
    return processosNormalizados.filter((proc) => !isProcessStatusInactive(proc.status));
  }, [processosNormalizados]);

  const selfTestResults = useMemo(
    () => [
      { label: "Empresas carregadas", pass: empresas.length > 0 },
      { label: "Licenças normalizadas", pass: licencas.length > 0 },
      { label: "Taxas disponíveis", pass: taxas.length > 0 },
      { label: "Processos ativos", pass: processosAtivos.length > 0 },
    ],
    [empresas.length, licencas.length, processosAtivos.length, taxas.length],
  );

  const handleMunicipioChange = (value) => {
    setMunicipio(value === MUNICIPIO_ALL ? undefined : value);
  };

  const handleCopy = useCallback(
    async (content, successMessage) => {
      if (!content) {
        enqueueToast("Conteúdo indisponível para copiar.");
        return;
      }
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(content);
        } else {
          const textarea = document.createElement("textarea");
          textarea.value = content;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
        enqueueToast(successMessage);
      } catch (error) {
        console.error("Erro ao copiar conteúdo:", error);
        enqueueToast("Não foi possível copiar.");
      }
    },
    [enqueueToast],
  );

  const renderProcessValue = useCallback(
    (proc, column) => {
      const rawValue = proc?.[column.key];
      if (column.isStatus) {
        return <StatusBadge status={proc.status ?? rawValue} />;
      }
      if (column.copyable) {
        const normalizedValue = normalizeIdentifier(rawValue);
        if (!normalizedValue) {
          return "—";
        }
        return (
          <button
            type="button"
            onClick={() =>
              handleCopy(normalizedValue, `${column.label} copiado: ${normalizedValue}`)
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span>{normalizedValue}</span>
            <Clipboard className="h-3 w-3 opacity-70" aria-hidden="true" />
          </button>
        );
      }
      const displayValue = normalizeText(rawValue).trim();
      return displayValue !== "" ? displayValue : "—";
    },
    [handleCopy],
  );

  const hasProcessColumnValue = useCallback((proc, column) => {
    if (!proc || !column) return false;
    const rawValue = proc?.[column.key];
    if (column.isStatus) {
      const statusValue = proc.status ?? rawValue;
      const normalized = normalizeText(statusValue).trim();
      return normalized !== "" && normalized !== "*" && normalized !== "-" && normalized !== "—";
    }
    if (column.copyable) {
      return Boolean(normalizeIdentifier(rawValue));
    }
    const normalized = normalizeText(rawValue).trim();
    return normalized !== "" && normalized !== "*" && normalized !== "-" && normalized !== "—";
  }, []);

  const selectMunicipioValue = municipio ?? MUNICIPIO_ALL;

  if (loading) {
    return <div className="p-6 text-center">Carregando dados...</div>;
  }

  return (
    <div className={`p-4 md:p-6 max-w-[1400px] mx-auto rounded-2xl ${TAB_BACKGROUNDS[tab]}`}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent drop-shadow-sm">
          eControle
        </h1>
        <span className="hidden md:block text-xs md:text-sm text-slate-500">
          Gestão de Empresas • Licenças • Processos
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
        <div className="flex-1">
          <Label className="text-xs uppercase">Pesquisa</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Empresa, CNPJ, palavra-chave…"
              className="pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-56">
          <Label className="text-xs uppercase">Município</Label>
          <Select value={selectMunicipioValue} onValueChange={handleMunicipioChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MUNICIPIO_ALL}>Todos</SelectItem>
              {sanitizedMunicipios.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={soAlertas} onCheckedChange={setSoAlertas} />
          <span className="text-sm">Somente alertas</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={modoFoco} onCheckedChange={setModoFoco} />
          <span className="text-sm">Modo foco</span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="painel" data-tab-target="painel" title="Alt+1">
            <TrendingUp className="h-4 w-4 mr-2" /> Painel
          </TabsTrigger>
          <TabsTrigger value="empresas" data-tab-target="empresas" title="Alt+2">
            <Building2 className="h-4 w-4 mr-2" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="licencas" data-tab-target="licencas" title="Alt+3">
            <FileText className="h-4 w-4 mr-2" /> Licenças
          </TabsTrigger>
          <TabsTrigger value="taxas" data-tab-target="taxas" title="Alt+4">
            <Clock className="h-4 w-4 mr-2" /> Taxas
          </TabsTrigger>
          <TabsTrigger value="processos" data-tab-target="processos" title="Alt+5">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Processos
          </TabsTrigger>
          <TabsTrigger value="uteis" data-tab-target="uteis" title="Alt+6">
            <MessageSquare className="h-4 w-4 mr-2" /> Úteis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KPI
              title="Empresas monitoradas"
              value={kpis.total_empresas || empresas.length}
              icon={<Building2 className="h-5 w-5" />}
              accent="bg-white/80"
            />
            <KPI
              title="Sem certificado digital"
              value={kpis.sem_certificado || 0}
              icon={<ShieldAlert className="h-5 w-5 text-amber-600" />}
              accent="bg-amber-100/80"
            />
            <KPI
              title="Licenças vencidas"
              value={kpis.licencas_vencidas || licencaResumo.vencidas}
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
              accent="bg-red-100/70"
            />
            <KPI
              title="TPI pendentes"
              value={kpis.tpi_pendente || 0}
              icon={<Bell className="h-5 w-5 text-sky-600" />}
              accent="bg-sky-100/70"
            />
          </div>

          <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <LineChartIcon className="h-4 w-4" /> Tendência de alertas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={alertTrendData}>
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        labelStyle={{ color: "#0f172a", fontWeight: 600 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="vencendo"
                        strokeWidth={2}
                        dot={false}
                        stroke="#f59e0b"
                        name="Vencendo"
                      />
                      <Line
                        type="monotone"
                        dataKey="vencidas"
                        strokeWidth={2}
                        dot={false}
                        stroke="#ef4444"
                        name="Vencidas"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Auto-teste do painel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {selfTestResults.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="font-medium text-slate-700">{item.label}</span>
                      {item.pass ? (
                      <InlineBadge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> OK
                      </InlineBadge>
                      ) : (
                      <InlineBadge className="bg-amber-100 text-amber-700 border-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Verificar
                      </InlineBadge>
                      )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Empresas com pendências
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-60">
                <ul className="divide-y divide-slate-200">
                  {empresasComPendencias.length === 0 && (
                    <li className="px-4 py-6 text-sm text-slate-500 text-center">
                      Nenhuma pendência identificada no momento.
                    </li>
                  )}
                  {empresasComPendencias.map((empresa) => {
                    const empresaId = extractEmpresaId(empresa);
                    const licencasPendentes =
                      empresaId !== undefined ? licencasByEmpresa.get(empresaId) || [] : [];
                    return (
                      <li key={empresa.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-800">{empresa.empresa}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {empresa.municipio}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {normalizeTextLower(empresa.debito) === "sim" && (
                            <StatusBadge status="Não pago" />
                          )}
                          {normalizeTextLower(empresa.certificado) === "não" && <StatusBadge status="NÃO" />}
                          {licencasPendentes
                            .filter((lic) => isAlertStatus(lic.status))
                            .slice(0, 2)
                            .map((lic) => (
                              <StatusBadge key={`${empresa.id}-${lic.tipo}`} status={lic.status} />
                            ))}
                        </div>
                      </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              {filteredEmpresas.length} de {empresas.length} empresas exibidas
            </span>
            {soAlertas && <InlineBadge variant="outline">Modo alertas ativo</InlineBadge>}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredEmpresas.map((empresa) => {
              const empresaId = extractEmpresaId(empresa);
              const licList = empresaId !== undefined ? licencasByEmpresa.get(empresaId) || [] : [];
              const licSummary = licList.reduce(
                (acc, lic) => {
                  if (!hasRelevantStatus(lic.status)) {
                    return acc;
                  }
                  const statusKey = getStatusKey(lic.status);
                  acc.total += 1;
                  if (statusKey.includes("vencid")) acc.vencidas += 1;
                  else if (statusKey.includes("vence")) acc.vencendo += 1;
                  else acc.ativas += 1;
                  return acc;
                },
                { total: 0, ativas: 0, vencendo: 0, vencidas: 0 },
              );
              const taxa = empresaId !== undefined ? taxasByEmpresa.get(empresaId) : undefined;
              const processosEmpresa =
                empresaId !== undefined ? processosByEmpresa.get(empresaId) || [] : [];
              const processosAtivosEmpresa = processosEmpresa.filter(
                (proc) => !isProcessStatusInactive(proc.status),
              );
              const rawId =
                empresa.empresa_id ?? empresa.empresaId ?? empresa.id ?? extractEmpresaId(empresa);
              const avatarLabel =
                rawId !== undefined && rawId !== null && `${rawId}`.toString().trim() !== ""
                  ? `${rawId}`
                  : "?";
              return (
                <Card key={empresa.id} className="shadow-sm overflow-hidden border border-white/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 font-semibold grid place-items-center">
                        {avatarLabel}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold leading-tight text-slate-800">
                              {empresa.empresa}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <CopyableIdentifier
                                label="CNPJ"
                                value={empresa.cnpj}
                                onCopy={handleCopy}
                              />
                              <span className="text-slate-300">•</span>
                              <CopyableIdentifier
                                label="IE"
                                value={empresa.ie}
                                onCopy={handleCopy}
                              />
                              <span className="text-slate-300">•</span>
                              <CopyableIdentifier
                                label="IM"
                                value={empresa.im}
                                onCopy={handleCopy}
                              />
                              <span className="text-slate-400">• {empresa.municipio}</span>
                            </div>
                          </div>
                          <StatusBadge status={empresa.situacao || "Ativa"} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                          <InlineBadge variant="outline" className="bg-white">
                            Categoria: {empresa.categoria || "—"}
                          </InlineBadge>
                          <InlineBadge variant="outline" className="bg-white">
                            Certificado: {empresa.certificado}
                          </InlineBadge>
                          <InlineBadge variant="outline" className="bg-white">
                            Débito: {empresa.debito}
                          </InlineBadge>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="text-[11px] uppercase text-emerald-600 font-semibold">
                          Licenças
                        </p>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-2xl font-semibold text-emerald-700">
                            {licSummary.total}
                          </span>
                          <div className="space-y-0.5 text-[11px] text-emerald-700/80">
                            <p>Ativas: {licSummary.ativas}</p>
                            <p>Vencendo: {licSummary.vencendo}</p>
                            <p>Vencidas: {licSummary.vencidas}</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3">
                        <p className="text-[11px] uppercase text-sky-600 font-semibold">
                          Processos
                        </p>
                        <div className="mt-1 flex items-end gap-2">
                          <span className="text-2xl font-semibold text-sky-700">
                            {processosEmpresa.length}
                          </span>
                          <div className="space-y-0.5 text-[11px] text-sky-700/80">
                            <p>Ativos: {processosAtivosEmpresa.length}</p>
                            <p>Encerrados: {processosEmpresa.length - processosAtivosEmpresa.length}</p>
                            <p>
                              Taxas pend.:
                              {taxa
                                ? TAXA_TYPE_KEYS.filter((key) =>
                                    isAlertStatus(taxa?.[key]),
                                  ).length
                                : 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(empresa.email, `E-mail copiado: ${empresa.email}`)}
                        className="text-xs"
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" /> Copiar e-mail
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(empresa.telefone, `Telefone copiado: ${empresa.telefone}`)}
                        className="text-xs"
                      >
                        <Phone className="h-3.5 w-3.5 mr-1" /> Copiar telefone
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => enqueueToast(`Solicitar documentos para ${empresa.empresa}`)}
                        className="text-xs"
                      >
                        <Clipboard className="h-3.5 w-3.5 mr-1" /> Ações rápidas
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredEmpresas.length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="p-6 text-center text-sm text-slate-600">
                  Nenhuma empresa encontrada com os filtros atuais.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="licencas" className="mt-4">
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            {tiposLicenca.map((tipo) => {
              const items = filteredLicencas.filter((lic) => normalizeText(lic?.tipo).trim() === tipo);
              const venc = items.filter((item) => item.status === "Vencido").length;
              const soon = items.filter((item) => item.status === "Vence≤30d").length;
              const subj = items.filter((item) => item.status === "Sujeito").length;
              const disp = items.filter((item) => item.status === "Dispensa").length;
              const poss = Math.max(items.length - venc - soon - subj - disp, 0);
              const icon = LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
              const colorClasses = LIC_COLORS[tipo] || "border-slate-400 text-slate-700";
              return (
                <Card key={tipo} className="shadow-sm">
                  <CardContent className={`p-4 rounded-xl border-l-4 ${colorClasses}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">{tipo}</div>
                        <div className="text-2xl font-semibold">{items.length}</div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-white/70 grid place-items-center text-slate-600">
                        {icon}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <InlineBadge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        Possui {poss}
                      </InlineBadge>
                      <InlineBadge className="bg-amber-100 text-amber-800 border-amber-200">
                        ≤30d {soon}
                      </InlineBadge>
                      <InlineBadge className="bg-red-100 text-red-700 border-red-200">
                        Vencido {venc}
                      </InlineBadge>
                      <InlineBadge className="bg-slate-200 text-slate-800 border-slate-300">
                        Sujeito {subj}
                      </InlineBadge>
                      <InlineBadge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                        Dispensa {disp}
                      </InlineBadge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {["Todos", ...tiposLicenca].map((tipo) => {
              const count = filteredLicencas.filter((lic) => {
                if (!hasRelevantStatus(lic.status)) {
                  return false;
                }
                if (tipo === "Todos") {
                  return true;
                }
                return normalizeText(lic?.tipo).trim() === tipo;
              }).length;
              const icon = tipo === "Todos" ? null : LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
              return (
                <Button
                  key={tipo}
                  size="sm"
                  variant={tipo === selectedLicTipo ? "default" : "secondary"}
                  onClick={() => setSelectedLicTipo(tipo)}
                  className="inline-flex items-center gap-1"
                >
                  {icon && <span className="opacity-80">{icon}</span>}
                  {tipo}
                  <span className="ml-1 text-xs opacity-70">{count}</span>
                </Button>
              );
            })}
          </div>

          <div className="space-y-3">
            {tiposLicencaSelecionados.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="p-6 text-center text-sm text-slate-600">
                  Nenhuma licença cadastrada no momento.
                </CardContent>
              </Card>
            ) : (
              tiposLicencaSelecionados.map((tipo) => {
                const registros = filteredLicencas
                  .filter((lic) => normalizeText(lic?.tipo).trim() === tipo)
                  .filter((lic) => hasRelevantStatus(lic.status))
                  .filter((lic) =>
                    modoFoco
                      ? isAlertStatus(lic.status) || getStatusKey(lic.status).includes("sujeit")
                      : true,
                  );
                const icon = LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
                return (
                  <Card key={tipo} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="opacity-80">{icon}</span>
                        {tipo}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[260px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Empresa</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Observação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {registros.map((lic, index) => (
                              <TableRow key={`${lic.empresa_id ?? lic.empresa}-${lic.tipo}-${index}`}>
                                <TableCell className="font-medium">{lic.empresa}</TableCell>
                                <TableCell>
                                  <StatusBadge status={lic.status} />
                                </TableCell>
                                <TableCell>{lic.validade || "—"}</TableCell>
                                <TableCell className="text-xs text-slate-600">{lic.obs || "—"}</TableCell>
                              </TableRow>
                            ))}
                            {registros.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-sm text-slate-500">
                                  Nenhum registro para este tipo.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="taxas" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      {TAXA_COLUMNS.map(({ key, label }) => (
                        <TableHead key={key}>{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxasVisiveis.map((taxa, index) => (
                      <TableRow key={`${taxa.empresa_id ?? taxa.empresa}-${index}`}>
                        <TableCell className="font-medium">{taxa.empresa}</TableCell>
                        {TAXA_COLUMNS.map(({ key }) => (
                          <TableCell key={key}>
                            <StatusBadge status={taxa?.[key]} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processos" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedTipo === PROCESS_ALL ? "default" : "outline"}
              onClick={() => setSelectedTipo(PROCESS_ALL)}
              className="inline-flex items-center gap-1"
            >
              <Filter className="h-3.5 w-3.5" /> Todos
              <span className="text-xs">{filteredProcessosBase.length}</span>
            </Button>
            {processosTipos.map(({ tipo, count }) => (
              <Button
                key={tipo}
                size="sm"
                variant={selectedTipo === tipo ? "default" : "secondary"}
                onClick={() => setSelectedTipo(tipo)}
                className="inline-flex items-center gap-1"
              >
                <span className="opacity-80">
                  {PROCESS_ICONS[tipo] || <Settings className="h-4 w-4" />}
                </span>
                {tipo}
                <span className="ml-1 text-xs opacity-70">{count}</span>
              </Button>
            ))}
          </div>

          {processosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Nenhum processo correspondente ao filtro.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {processosFiltrados.map((proc, index) => {
                const iconCandidate =
                  PROCESS_ICONS[proc.tipoNormalizado] ||
                  PROCESS_ICONS[proc.tipo] || (
                    <FileText className="h-5 w-5" />
                  );
                const tipoLabel = proc.tipoNormalizado || proc.tipo || "Processo";
                const prazoColumn = { key: "prazo", label: "Prazo" };
                const baseColumns = [...PROCESS_BASE_COLUMNS];
                if (hasProcessColumnValue(proc, prazoColumn)) {
                  baseColumns.push(prazoColumn);
                }
                const extraColumns = resolveProcessExtraColumns(proc).filter((column) =>
                  hasProcessColumnValue(proc, column),
                );
                const obsText = normalizeText(proc.obs).trim();
                const hasObs =
                  obsText !== "" && obsText !== "-" && obsText !== "—" && obsText !== "*";

                return (
                  <Card
                    key={`${proc.empresa_id || proc.empresa || index}-${proc.protocolo || index}`}
                    className="shadow-sm overflow-hidden border border-white/60"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 shrink-0 rounded-lg bg-violet-100 text-violet-700 grid place-items-center">
                          {iconCandidate}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold leading-tight text-slate-800 truncate">
                                {proc.empresa || "—"}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <InlineBadge variant="outline" className="bg-white">
                                  {tipoLabel}
                                </InlineBadge>
                                {hasProcessColumnValue(proc, { key: "municipio" }) && proc.municipio && (
                                  <InlineBadge variant="outline" className="bg-white">
                                    <MapPin className="h-3 w-3 mr-1" /> {proc.municipio}
                                  </InlineBadge>
                                )}
                              </div>
                            </div>
                            <StatusBadge status={proc.status} />
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                            <CopyableIdentifier label="CNPJ" value={proc.cnpj} onCopy={handleCopy} />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid gap-3 sm:grid-cols-2">
                        {baseColumns.map((column) => (
                          <div key={column.key} className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {column.label}
                            </p>
                            <div className="text-sm text-slate-700">
                              {renderProcessValue(proc, column)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {extraColumns.length > 0 && (
                        <>
                          <Separator />
                          <div className="grid gap-3 sm:grid-cols-2">
                            {extraColumns.map((column) => (
                              <div key={column.key} className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  {column.label}
                                </p>
                                <div className="text-sm text-slate-700">
                                  {renderProcessValue(proc, column)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {hasObs && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Observações
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{obsText}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="uteis" className="mt-4 space-y-4">
          <div className="max-w-xl">
            <Label className="text-xs uppercase">Pesquisa em úteis</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar contato, categoria ou mensagem…"
                className="pl-8"
                value={uteisQuery}
                onChange={(event) => setUteisQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Contatos úteis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {contatosOrdenadosLista.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Nenhum contato cadastrado no Excel.
                  </div>
                )}
                {contatosOrdenadosLista.map((contato) => {
                  const whatsappTexto = normalizeTextLower(contato.whatsapp || "");
                  const temWhatsapp =
                    whatsappTexto !== "" &&
                    !["nao", "não", "nao possui", "não possui"].some((neg) => whatsappTexto.includes(neg));
                  const info = [contato.email, contato.telefone, temWhatsapp ? contato.whatsapp : null]
                    .filter((value) => value && value.toString().trim() !== "")
                    .join(" • ");
                  const municipioInfo = [contato.categoria, contato.municipio]
                    .filter((value) => value && value.toString().trim() !== "")
                    .join(" • ");
                  return (
                    <div
                      key={`${contato.contato}-${contato.email}-${contato.telefone}`}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{contato.contato}</p>
                          {municipioInfo && <p className="text-xs text-slate-500">{municipioInfo}</p>}
                        </div>
                        {info && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopy(info, `Contato copiado de ${contato.contato}`)}
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {contato.email && (
                          <InlineBadge variant="outline" className="bg-white">
                            <Mail className="h-3 w-3 mr-1" /> {contato.email}
                          </InlineBadge>
                        )}
                        {contato.telefone && (
                          <InlineBadge variant="outline" className="bg-white">
                            <Phone className="h-3 w-3 mr-1" /> {contato.telefone}
                          </InlineBadge>
                        )}
                        {temWhatsapp && (
                          <InlineBadge variant="outline" className="bg-white">
                            <Phone className="h-3 w-3 mr-1" /> WhatsApp: {contato.whatsapp}
                          </InlineBadge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Modelos de mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {modelosOrdenadosLista.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Nenhum modelo cadastrado no Excel.
                  </div>
                )}
                {modelosOrdenadosLista.map((modelo) => (
                  <div
                    key={`${modelo.descricao || "Modelo"}-${(modelo.modelo || "").slice(0, 20)}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{modelo.descricao || "Modelo"}</p>
                        <p className="text-xs text-slate-500">
                          {modelo.utilizacao ? `Uso: ${modelo.utilizacao}` : "Clique para copiar e enviar."}
                        </p>
                      </div>
                      {modelo.modelo && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCopy(modelo.modelo, `Mensagem copiada: ${modelo.descricao || "Modelo"}`)}
                        >
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {modelo.modelo && (
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{modelo.modelo}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center sm:justify-end px-4">
        <div className="w-full sm:max-w-sm space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-xl border border-slate-200 bg-white shadow-lg px-4 py-3 flex items-start gap-3"
            >
              <div className="mt-0.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-sm text-slate-700 flex-1">{toast.message}</div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => dismissToast(toast.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
