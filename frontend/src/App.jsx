import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import EmpresasScreen from "@/features/empresas/EmpresasScreen";
import LicencasScreen from "@/features/licencas/LicencasScreen";
import TaxasScreen from "@/features/taxas/TaxasScreen";
import ProcessosScreen from "@/features/processos/ProcessosScreen";
import UteisScreen from "@/features/uteis/UteisScreen";
import PainelScreen from "@/features/painel/PainelScreen";
import CertificadosScreen from "@/features/certificados/CertificadosScreen";
import ToastProvider, { useToast } from "@/providers/ToastProvider.jsx";
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { normalizeIdentifier, normalizeText, normalizeTextLower } from "@/lib/text";
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
import { fetchJson } from "@/lib/api";
import { isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import {
  buildCertificadoIndex,
  isCertificadoSituacaoAlert,
  resolveEmpresaCertificadoSituacao,
} from "@/lib/certificados";

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
  const normalizedQueryValue = useMemo(() => normalizeTextLower(query).trim(), [query]);
  const municipioKey = useMemo(() => normalizeTextLower(municipio).trim(), [municipio]);
  const [empresas, setEmpresas] = useState([]);
  const [licencas, setLicencas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [kpis, setKpis] = useState({});
  const [municipios, setMunicipios] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { dismissToast, enqueueToast, toasts } = useToast();

  const certificadoIndex = useMemo(() => buildCertificadoIndex(certificados), [certificados]);

  const empresasComCertificados = useMemo(
    () =>
      empresas.map((empresa) => {
        const situacao = resolveEmpresaCertificadoSituacao(empresa, certificadoIndex);
        return {
          ...empresa,
          certificadoSituacao: situacao,
          certificado: situacao,
        };
      }),
    [certificadoIndex, empresas],
  );

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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      fetchJson("/empresas"),
      fetchJson("/licencas"),
      fetchJson("/taxas"),
      fetchJson("/processos"),
      fetchJson("/certificados"),
      fetchJson("/agendamentos"),
      fetchJson("/kpis"),
      fetchJson("/municipios"),
      fetchJson("/uteis"),
    ])
      .then(([emp, lic, tax, proc, certs, agds, kpi, mun, uteis]) => {
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
        setCertificados(Array.isArray(certs) ? certs : []);
        setAgendamentos(Array.isArray(agds) ? agds : []);
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
          setCertificados([]);
          setAgendamentos([]);
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
    empresasComCertificados.forEach((empresa) => {
      const empresaId = extractEmpresaId(empresa);
      if (empresaId === undefined) return;
      map.set(empresaId, empresa);
    });
    return map;
  }, [empresasComCertificados]);

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

  const companyHasAlert = useCallback(
    (empresa) => {
      if (!empresa) return false;
      const empresaId = extractEmpresaId(empresa);
      if (empresaId === undefined) return false;
      const debitoLower = normalizeTextLower(empresa.debito);
      if (debitoLower === "sim") {
        return true;
      }
      const situacaoCertificado = empresa.certificadoSituacao ?? empresa.certificado;
      if (isCertificadoSituacaoAlert(situacaoCertificado)) {
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
    () => filterEmpresas(empresasComCertificados),
    [empresasComCertificados, filterEmpresas],
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
            <SelectContent
              position="popper"
              className="max-h-80 overflow-y-auto overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
            >
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
        <TabsList className="grid w-full grid-cols-7">
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
          <TabsTrigger value="certificados" data-tab-target="certificados" title="Alt+7">
            <ShieldCheck className="h-4 w-4 mr-2" /> Certificados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="painel">
          <PainelScreen
            query={query}
            municipio={municipio}
            soAlertas={soAlertas}
            kpis={kpis}
            empresas={empresasComCertificados}
            licencas={licencas}
            taxas={taxas}
            filteredLicencas={filteredLicencas}
            processosNormalizados={processosNormalizados}
            filterEmpresas={filterEmpresas}
            companyHasAlert={companyHasAlert}
            licencasByEmpresa={licencasByEmpresa}
            extractEmpresaId={extractEmpresaId}
          />
        </TabsContent>

        <TabsContent value="empresas" className="mt-4 space-y-3">
          <EmpresasScreen
            filteredEmpresas={filteredEmpresas}
            empresas={empresasComCertificados}
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

        <TabsContent value="uteis">
          <UteisScreen
            query={query}
            municipio={municipio}
            soAlertas={soAlertas}
            contatos={contatos}
            modelos={modelos}
            matchesMunicipioFilter={matchesMunicipioFilter}
            handleCopy={handleCopy}
          />
        </TabsContent>

        <TabsContent value="certificados" className="mt-4">
          <CertificadosScreen
            certificados={certificados}
            agendamentos={agendamentos}
            soAlertas={soAlertas}
          />
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
