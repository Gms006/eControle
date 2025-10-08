import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import KPI from "@/components/KPI";
import EmpresasScreen from "@/features/empresas/EmpresasScreen";
import LicencasScreen from "@/features/licencas/LicencasScreen";
import TaxasScreen from "@/features/taxas/TaxasScreen";
import ProcessosScreen from "@/features/processos/ProcessosScreen";
import ToastProvider, { useToast } from "@/providers/ToastProvider.jsx";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  Clipboard,
  Clock,
  FileText,
  LineChart as LineChartIcon,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
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
import {
  formatMonthLabel,
  normalizeIdentifier,
  normalizeText,
  normalizeTextLower,
  parsePtDate,
} from "@/lib/text";
import {
  PROCESS_DIVERSOS_LABEL,
  buildDiversosOperacaoKey,
  getProcessBaseType,
  normalizeProcessType,
} from "@/lib/process";
import {
  MUNICIPIO_ALL,
  TAB_BACKGROUNDS,
  TAB_SHORTCUTS,
  TAXA_TYPE_KEYS,
} from "@/lib/constants";
import { apiUrl, fetchJson } from "@/lib/api";
import {
  getStatusKey,
  hasRelevantStatus,
  isAlertStatus,
  isProcessStatusActiveOrPending,
  isProcessStatusInactive,
  resolveStatusClass,
} from "@/lib/status";

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

function AppContent() {
  const [tab, setTab] = useState("painel");
  const [query, setQuery] = useState("");
  const [municipio, setMunicipio] = useState();
  const [soAlertas, setSoAlertas] = useState(false);
  const [modoFoco, setModoFoco] = useState(true);
  const [uteisQuery, setUteisQuery] = useState("");

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
  const { dismissToast, enqueueToast, toasts } = useToast();

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
        const tipoNormalizado = normalizeProcessType(proc);
        const tipoBase = getProcessBaseType(tipoNormalizado);
        const diversosOperacaoKey =
          tipoBase === PROCESS_DIVERSOS_LABEL
            ? buildDiversosOperacaoKey(proc.operacao)
            : undefined;
        return {
          ...proc,
          empresaId,
          empresa_id: empresaId,
          tipoNormalizado,
          tipoBase,
          diversosOperacaoKey,
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
          <EmpresasScreen
            filteredEmpresas={filteredEmpresas}
            empresas={empresas}
            soAlertas={soAlertas}
            extractEmpresaId={extractEmpresaId}
            licencasByEmpresa={licencasByEmpresa}
            taxasByEmpresa={taxasByEmpresa}
            processosByEmpresa={processosByEmpresa}
            handleCopy={handleCopy}
            enqueueToast={enqueueToast}
          />
        </TabsContent>

        <TabsContent value="licencas" className="mt-4">
          <LicencasScreen licencas={licencas} filteredLicencas={filteredLicencas} modoFoco={modoFoco} />
        </TabsContent>

        <TabsContent value="taxas" className="mt-4">
          <TaxasScreen
            taxas={taxas}
            modoFoco={modoFoco}
            matchesMunicipioFilter={matchesMunicipioFilter}
            matchesQuery={matchesQuery}
          />
        </TabsContent>

        <TabsContent value="processos">
          <ProcessosScreen
            processosNormalizados={processosNormalizados}
            modoFoco={modoFoco}
            matchesMunicipioFilter={matchesMunicipioFilter}
            matchesQuery={matchesQuery}
            handleCopy={handleCopy}
          />
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

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
