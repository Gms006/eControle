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

const PROCESS_ICONS = {
  Diversos: <Settings className="h-4 w-4" />, // fallback genérico
  "Alvará de Funcionamento": <ClipboardCheck className="h-4 w-4" />,
  Bombeiros: <Shield className="h-4 w-4" />,
  "Licença Ambiental": <Sparkles className="h-4 w-4" />,
  "Uso do Solo": <MapPin className="h-4 w-4" />,
  "Alvará Sanitário": <BadgeAlert className="h-4 w-4" />,
};

const STATUS_STYLES = {
  Possui: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Vencido: "bg-red-100 text-red-700 border-red-200",
  "Vence≤30d": "bg-amber-100 text-amber-800 border-amber-200",
  Dispensa: "bg-indigo-100 text-indigo-700 border-indigo-200",
  Sujeito: "bg-slate-200 text-slate-700 border-slate-300",
  Pago: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Não pago": "bg-red-100 text-red-700 border-red-200",
  SIM: "bg-emerald-100 text-emerald-700 border-emerald-200",
  NÃO: "bg-red-100 text-red-700 border-red-200",
};

const ALERT_STATUSES = new Set(["Vencido", "Vence≤30d", "Não pago"]);

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

function InlineBadge({ children, className = "", variant = "solid", ...props }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium";
  const variants = {
    solid: "bg-slate-100 border-transparent text-slate-700",
    outline: "bg-white border-slate-200 text-slate-600",
  };
  const variantClasses = variants[variant] || variants.solid;
  return (
    <span className={`${base} ${variantClasses} ${className}`} {...props}>
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <InlineBadge variant="outline" className={style}>
      {status}
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
  const [toasts, setToasts] = useState([]);

  const toastTimeoutsRef = useRef(new Map());

  const [empresas, setEmpresas] = useState([]);
  const [licencas, setLicencas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [kpis, setKpis] = useState({});
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(true);

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
    ])
      .then(([emp, lic, tax, proc, kpi, mun]) => {
        if (!mounted) return;
        setEmpresas(Array.isArray(emp) ? emp : []);
        setLicencas(Array.isArray(lic) ? lic : []);
        setTaxas(Array.isArray(tax) ? tax : []);
        setProcessos(Array.isArray(proc) ? proc : []);
        setKpis(kpi);
        setMunicipios(Array.isArray(mun) ? mun : []);
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
          setLoading(false);
          enqueueToast("Não foi possível carregar os dados.");
        }
      });
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const licencasByEmpresa = useMemo(() => {
    const map = new Map();
    licencas.forEach((lic) => {
      const group = map.get(lic.empresa) || [];
      group.push(lic);
      map.set(lic.empresa, group);
    });
    return map;
  }, [licencas]);

  const taxasByEmpresa = useMemo(() => {
    const map = new Map();
    taxas.forEach((tx) => {
      map.set(tx.empresa, tx);
    });
    return map;
  }, [taxas]);

  const processosNormalizados = useMemo(
    () =>
      processos.map((proc) => ({
        ...proc,
        tipoNormalizado: normalizeProcessType(proc),
      })),
    [processos],
  );

  const processosByEmpresa = useMemo(() => {
    const map = new Map();
    processosNormalizados.forEach((proc) => {
      const group = map.get(proc.empresa) || [];
      group.push(proc);
      map.set(proc.empresa, group);
    });
    return map;
  }, [processosNormalizados]);

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
      const debitoLower = normalizeTextLower(empresa.debito);
      const certificadoLower = normalizeTextLower(empresa.certificado);
      if (debitoLower === "sim" || certificadoLower === "não") {
        return true;
      }
      const licList = licencasByEmpresa.get(empresa.empresa) || [];
      const hasLicencaAlert = licList.some((lic) => ALERT_STATUSES.has(lic.status));
      if (hasLicencaAlert) return true;
      const taxa = taxasByEmpresa.get(empresa.empresa);
      if (taxa) {
        const entries = [taxa.tpi, taxa.func, taxa.publicidade, taxa.sanitaria];
        if (entries.some((status) => ALERT_STATUSES.has(status))) {
          return true;
        }
      }
      const processosEmpresa = processosByEmpresa.get(empresa.empresa) || [];
      const inativos = new Set(["CONCLUÍDO", "LICENCIADO", "Aprovado", "INDEFERIDO"]);
      return processosEmpresa.some((proc) => !inativos.has(proc.status));
    },
    [licencasByEmpresa, processosByEmpresa, taxasByEmpresa],
  );

  const filterEmpresas = useCallback(
    (lista) => {
      const normalizedQuery = normalizeTextLower(query).trim();
      return lista.filter((empresa) => {
        if (!empresa) return false;
        const matchesQuery =
          normalizedQuery === "" ||
          [
            empresa.empresa,
            empresa.cnpj,
            empresa.municipio,
            empresa.categoria,
            empresa.email,
          ]
            .filter(Boolean)
            .some((field) => normalizeTextLower(field).includes(normalizedQuery));
        const matchesMunicipio = !municipio || empresa.municipio === municipio;
        const matchesAlert = !soAlertas || companyHasAlert(empresa);
        return matchesQuery && matchesMunicipio && matchesAlert;
      });
    },
    [companyHasAlert, municipio, query, soAlertas],
  );

  const filteredEmpresas = useMemo(
    () => filterEmpresas(empresas),
    [empresas, filterEmpresas],
  );

  const empresasComPendencias = useMemo(
    () => empresas.filter((empresa) => companyHasAlert(empresa)).slice(0, 8),
    [companyHasAlert, empresas],
  );

  const licencaResumo = useMemo(() => {
    return licencas.reduce(
      (acc, lic) => {
        acc.total += 1;
        if (lic.status === "Vencido") acc.vencidas += 1;
        else if (lic.status === "Vence≤30d") acc.vencendo += 1;
        else if (lic.status === "Dispensa") acc.dispensa += 1;
        else if (lic.status === "Sujeito") acc.sujeito += 1;
        else acc.ativas += 1;
        return acc;
      },
      { total: 0, ativas: 0, vencendo: 0, vencidas: 0, dispensa: 0, sujeito: 0 },
    );
  }, [licencas]);

  const alertTrendData = useMemo(() => {
    const monthly = new Map();
    licencas.forEach((lic) => {
      const validade = parsePtDate(lic.validade);
      if (!validade) return;
      const key = `${validade.getFullYear()}-${validade.getMonth()}`;
      const entry = monthly.get(key) || { date: validade, vencidas: 0, vencendo: 0 };
      if (lic.status === "Vencido") entry.vencidas += 1;
      else if (lic.status === "Vence≤30d") entry.vencendo += 1;
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
  }, [licencas]);

  const processosTipos = useMemo(() => {
    const counts = new Map();
    processosNormalizados.forEach((proc) => {
      const current = counts.get(proc.tipoNormalizado) || 0;
      counts.set(proc.tipoNormalizado, current + 1);
    });
    const asArray = Array.from(counts.entries()).map(([tipo, count]) => ({ tipo, count }));
    asArray.sort((a, b) => a.tipo.localeCompare(b.tipo));
    return asArray;
  }, [processosNormalizados]);

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
        ? processosNormalizados
        : processosNormalizados.filter((proc) => proc.tipoNormalizado === selectedTipo);
    if (!modoFoco) return listaBase;
    const inativos = new Set(["CONCLUÍDO", "LICENCIADO", "Aprovado", "INDEFERIDO"]);
    return listaBase.filter((proc) => !inativos.has(proc.status));
  }, [modoFoco, processosNormalizados, selectedTipo]);

  const processosAtivos = useMemo(() => {
    const inativos = new Set(["CONCLUÍDO", "LICENCIADO", "Aprovado", "INDEFERIDO"]);
    return processosNormalizados.filter((proc) => !inativos.has(proc.status));
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
              {municipios.map((item) => (
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
          <TabsTrigger value="painel">
            <TrendingUp className="h-4 w-4 mr-2" /> Painel
          </TabsTrigger>
          <TabsTrigger value="empresas">
            <Building2 className="h-4 w-4 mr-2" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="licencas">
            <FileText className="h-4 w-4 mr-2" /> Licenças
          </TabsTrigger>
          <TabsTrigger value="taxas">
            <Clock className="h-4 w-4 mr-2" /> Taxas
          </TabsTrigger>
          <TabsTrigger value="processos">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Processos
          </TabsTrigger>
          <TabsTrigger value="uteis">
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
                  {empresasComPendencias.map((empresa) => (
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
                          {(licencasByEmpresa.get(empresa.empresa) || [])
                            .filter((lic) => ALERT_STATUSES.has(lic.status))
                            .slice(0, 2)
                            .map((lic) => (
                              <StatusBadge key={`${empresa.id}-${lic.tipo}`} status={lic.status} />
                            ))}
                        </div>
                      </div>
                    </li>
                  ))}
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
              const licList = licencasByEmpresa.get(empresa.empresa) || [];
              const licSummary = licList.reduce(
                (acc, lic) => {
                  acc.total += 1;
                  if (lic.status === "Vencido") acc.vencidas += 1;
                  else if (lic.status === "Vence≤30d") acc.vencendo += 1;
                  else acc.ativas += 1;
                  return acc;
                },
                { total: 0, ativas: 0, vencendo: 0, vencidas: 0 },
              );
              const taxa = taxasByEmpresa.get(empresa.empresa);
              const processosEmpresa = processosByEmpresa.get(empresa.empresa) || [];
              const processosAtivosEmpresa = processosEmpresa.filter((proc) =>
                processosAtivos.includes(proc),
              );
              return (
                <Card key={empresa.id} className="shadow-sm overflow-hidden border border-white/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-700 font-semibold grid place-items-center">
                        {empresa.empresa?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold leading-tight text-slate-800">
                              {empresa.empresa}
                            </h3>
                            <p className="text-xs text-slate-500">
                              CNPJ {empresa.cnpj} • {empresa.municipio}
                            </p>
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
                                ? [taxa.tpi, taxa.func, taxa.publicidade, taxa.sanitaria].filter((status) =>
                                    ALERT_STATUSES.has(status),
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

        <TabsContent value="licencas" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <InlineBadge variant="outline" className="bg-white">
              Total: {licencaResumo.total}
            </InlineBadge>
            <InlineBadge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              Ativas: {licencaResumo.ativas}
            </InlineBadge>
            <InlineBadge className="bg-amber-100 text-amber-700 border-amber-200">
              Vencendo: {licencaResumo.vencendo}
            </InlineBadge>
            <InlineBadge className="bg-red-100 text-red-700 border-red-200">
              Vencidas: {licencaResumo.vencidas}
            </InlineBadge>
            <InlineBadge className="bg-indigo-100 text-indigo-700 border-indigo-200">
              Dispensa: {licencaResumo.dispensa}
            </InlineBadge>
            <InlineBadge className="bg-slate-200 text-slate-700 border-slate-300">
              Sujeito: {licencaResumo.sujeito}
            </InlineBadge>
          </div>
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licencas
                      .filter((lic) =>
                        modoFoco ? ALERT_STATUSES.has(lic.status) || lic.status === "Sujeito" : true,
                      )
                      .map((lic, index) => (
                        <TableRow key={`${lic.empresa}-${lic.tipo}-${index}`}>
                          <TableCell className="font-medium">{lic.empresa}</TableCell>
                          <TableCell>{lic.tipo}</TableCell>
                          <TableCell>
                            <StatusBadge status={lic.status} />
                          </TableCell>
                          <TableCell>{lic.validade}</TableCell>
                          <TableCell className="text-xs text-slate-600">{lic.obs || "—"}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxas" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>TPI</TableHead>
                      <TableHead>Funcionamento</TableHead>
                      <TableHead>Publicidade</TableHead>
                      <TableHead>Sanitária</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxas
                      .filter((taxa) =>
                        modoFoco
                          ? [taxa.tpi, taxa.func, taxa.publicidade, taxa.sanitaria].some((status) =>
                              ALERT_STATUSES.has(status),
                            )
                          : true,
                      )
                      .map((taxa, index) => (
                        <TableRow key={`${taxa.empresa}-${index}`}>
                          <TableCell className="font-medium">{taxa.empresa}</TableCell>
                          <TableCell>
                            <StatusBadge status={taxa.tpi} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={taxa.func} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={taxa.publicidade} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={taxa.sanitaria} />
                          </TableCell>
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
              <span className="text-xs">{processosNormalizados.length}</span>
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

          <div className="grid gap-3 lg:grid-cols-2">
            {processosFiltrados.map((proc, index) => (
              <Card key={`${proc.empresa}-${proc.codigo}-${index}`} className="shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/80 grid place-items-center text-slate-600">
                      {PROCESS_ICONS[proc.tipoNormalizado] || <Settings className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-slate-800 truncate">{proc.empresa}</h3>
                        <StatusBadge status={proc.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">{proc.tipoNormalizado}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span>Código: {proc.codigo}</span>
                        <span>Início: {proc.inicio}</span>
                        {proc.prazo && (
                          <span className="text-red-600 font-medium">Prazo: {proc.prazo}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {processosFiltrados.length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="p-6 text-sm text-slate-600">
                  Nenhum processo correspondente ao filtro.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="uteis" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" /> Contatos úteis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {["Prefeitura de Anápolis", "Vigilância Sanitária", "Corpo de Bombeiros"]
                  .map((org, index) => {
                    const contato =
                      index === 0
                        ? {
                            email: "atendimento@anapolis.go.gov.br",
                            fone: "(62) 3902-0000",
                            site: "https://www.anapolis.go.gov.br",
                          }
                        : index === 1
                          ? {
                              email: "visa@go.gov.br",
                              fone: "(62) 3201-0000",
                              site: "https://saude.go.gov.br",
                            }
                          : {
                              email: "atendimento@bombeiros.go.gov.br",
                              fone: "193",
                              site: "https://www.bombeiros.go.gov.br",
                            };
                    return (
                      <div key={org} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-800">{org}</p>
                            <p className="text-xs text-slate-500">{contato.site}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopy(`${contato.email} • ${contato.fone}`, `Contato copiado de ${org}`)}
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <InlineBadge variant="outline" className="bg-white">
                            <Mail className="h-3 w-3 mr-1" /> {contato.email}
                          </InlineBadge>
                          <InlineBadge variant="outline" className="bg-white">
                            <Phone className="h-3 w-3 mr-1" /> {contato.fone}
                          </InlineBadge>
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
                {[
                  {
                    titulo: "Cobrança de documentos",
                    texto:
                      "Olá! Poderiam encaminhar os documentos pendentes listados no eControle para avançarmos no processo?",
                  },
                  {
                    titulo: "Agendamento de vistoria",
                    texto:
                      "Boa tarde! Podemos agendar a vistoria para a próxima semana? Favor confirmar a disponibilidade da equipe.",
                  },
                  {
                    titulo: "Lembrete de renovação",
                    texto:
                      "Estamos nos aproximando do prazo de renovação da licença. Poderiam verificar os documentos necessários?",
                  },
                ].map((modelo) => (
                  <div key={modelo.titulo} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{modelo.titulo}</p>
                        <p className="text-xs text-slate-500">
                          Clique para copiar e enviar no canal preferido.
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopy(modelo.texto, `Mensagem copiada: ${modelo.titulo}`)}
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{modelo.texto}</p>
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
