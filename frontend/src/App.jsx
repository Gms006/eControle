import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import EmpresasScreen from "@/features/empresas/EmpresasScreen";
import LicencasScreen from "@/features/licencas/LicencasScreen";
import TaxasScreen from "@/features/taxas/TaxasScreen";
import ProcessosScreen from "@/features/processos/ProcessosScreen";
import UteisScreen from "@/features/uteis/UteisScreen";
import PainelScreen from "@/features/painel/PainelScreen";
import CertificadosScreen from "@/features/certificados/CertificadosScreen";
import ToastProvider, { useToast } from "@/providers/ToastProvider.jsx";
import { Sparkles, X } from "lucide-react";
import {
  buildNormalizedSearchKey,
  normalizeIdentifier,
  normalizeText,
  normalizeTextLower,
} from "@/lib/text";
import {
  PROCESS_DIVERSOS_LABEL,
  buildDiversosOperacaoKey,
  getProcessBaseType,
  normalizeProcessType,
} from "@/lib/process";
import {
  MUNICIPIO_ALL,
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
import HeaderMenuPro from "@/components/HeaderMenuPro";

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
  const inscricaoMunicipal =
    normalizeIdentifier(empresa.inscricaoMunicipal) ||
    normalizeIdentifier(empresa.inscricao_municipal) ||
    normalizeIdentifier(empresa["inscrição_municipal"]);
  const inscricaoEstadual =
    normalizeIdentifier(empresa.inscricaoEstadual) ||
    normalizeIdentifier(empresa.inscricao_estadual) ||
    normalizeIdentifier(empresa["inscrição_estadual"]);
  const responsavelLegal = empresa.responsavelLegal ?? empresa.responsavel_legal;
  const cpfResponsavelLegal =
    normalizeIdentifier(empresa.cpfResponsavelLegal) || empresa.cpf_responsavel_legal;
  const responsavelFiscal = empresa.responsavelFiscal ?? empresa.responsavel_fiscal;
  const empresaId = extractEmpresaId(empresa);
  return {
    ...empresa,
    ie,
    im,
    inscricaoMunicipal: inscricaoMunicipal ?? im,
    inscricaoEstadual: inscricaoEstadual ?? ie,
    responsavelLegal,
    cpfResponsavelLegal,
    responsavelFiscal,
    empresaId: empresaId ?? empresa?.id,
    empresa_id: empresaId ?? empresa?.id,
  };
};

const SEARCH_FIELD_OPTIONS = [
  { key: "all", label: "Todos os campos" },
  { key: "nome", label: "Nome" },
  { key: "razao", label: "Razão Social" },
  { key: "cnpj", label: "CNPJ" },
  { key: "responsavelLegal", label: "Responsável legal" },
];

function AppContent() {
  const [tab, setTab] = useState("painel");
  const [query, setQuery] = useState("");
  const [queryField, setQueryField] = useState("all");
  const [municipio, setMunicipio] = useState();
  const [somenteAlertas, setSomenteAlertas] = useState(false);
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

      // Alt + Seta para Cima: rolar até o topo da aba
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
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

  const municipiosOptions = useMemo(
    () => Array.from(new Set(["Todos", ...sanitizedMunicipios])),
    [sanitizedMunicipios],
  );

  if (import.meta.env.DEV) {
    console.assert(
      Array.isArray(municipiosOptions) && municipiosOptions.includes("Todos"),
      "[App] municipios deve conter 'Todos'",
    );
  }

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
        const municipiosItems = Array.isArray(mun?.items)
          ? mun.items
          : Array.isArray(mun)
            ? mun
            : [];
        setMunicipios(municipiosItems);
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
    (fields, fieldMap = {}) => {
      const commandMatch = normalizedQueryValue.match(/^([a-zçãõáéíóú\s_]+):\s*(.+)$/i);
      const commandKey = commandMatch?.[1];
      const commandValue = commandMatch?.[2];

      const resolveFieldKey = (value) => {
        const key = normalizeTextLower(value).replace(/[^a-z]/g, "");
        if (["nome", "name"].includes(key)) return "nome";
        if (["razao", "razaosocial", "razao_social"].includes(key)) return "razao";
        if (["cnpj"].includes(key)) return "cnpj";
        if (["responsavel", "responsavellegal", "responsavel_legal"].includes(key)) return "responsavelLegal";
        return undefined;
      };

      const directiveField = commandKey ? resolveFieldKey(commandKey) : undefined;
      const resolvedField = directiveField ?? (queryField !== "all" ? queryField : undefined);
      const searchKey = buildNormalizedSearchKey(commandValue ?? normalizedQueryValue);

      if (!searchKey) {
        return true;
      }

      const collectCandidates = () => {
        if (resolvedField) {
          const value = fieldMap[resolvedField];
          if (Array.isArray(value)) {
            return value;
          }
          if (value !== undefined) {
            return [value];
          }
          // FIX: Fazer fallback para fields quando fieldMap[resolvedField] não existir
          // ao invés de retornar array vazio
          const base = Array.isArray(fields) ? fields : Object.values(fields || {});
          return base;
        }
        const base = Array.isArray(fields) ? fields : Object.values(fields || {});
        return base;
      };

      return collectCandidates()
        .filter((field) => field !== null && field !== undefined)
        .some((field) => {
          const normalizedField = buildNormalizedSearchKey(field);
          return normalizedField?.includes(searchKey);
        });
    },
    [normalizedQueryValue, queryField],
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
          matchesQuery(
            [
              lic.empresa,
              lic.cnpj,
              lic.tipo,
              lic.status,
              lic.validade,
              lic.obs,
            ],
            {
              nome: [lic.empresa],
              razao: [lic.empresa],
              cnpj: [lic.cnpj],
            },
          ),
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
          empresa.razaoSocial,
          empresa.razao_social,
          empresa.cnpj,
          empresa.municipio,
          empresa.categoria,
          empresa.email,
          empresa.ie,
          empresa.im,
          empresa.telefone,
          empresa.responsavel,
          empresa.responsavelLegal,
          empresa.responsavelFiscal,
        ], {
          // A SOLUÇÃO: usar empresa.empresa como fallback para razao!
          // Muitas empresas não têm razaoSocial separada, o campo "empresa" contém tudo
          nome: [empresa.empresa, empresa.nome, empresa.nomeFantasia, empresa.fantasia],
          razao: [
            empresa.razaoSocial, 
            empresa.razao_social, 
            empresa.razao,
            empresa.empresa // ← ADICIONE ISTO! É o fallback essencial
          ],
          cnpj: [empresa.cnpj, empresa.cpfCnpj, empresa.cpf_cnpj],
          responsavelLegal: [empresa.responsavelLegal, empresa.responsavel_legal],
        });
        const matchesMunicipio = matchesMunicipioFilter(empresa);
        const matchesAlert = !somenteAlertas || companyHasAlert(empresa);
        return matchesQueryEmpresa && matchesMunicipio && matchesAlert;
      });
    },
    [companyHasAlert, matchesMunicipioFilter, matchesQuery, somenteAlertas],
  );

  const filteredEmpresas = useMemo(
    () => filterEmpresas(empresasComCertificados),
    [empresasComCertificados, filterEmpresas],
  );


  const handleMunicipioChange = (value) => {
    if (value === "Todos" || value === MUNICIPIO_ALL) {
      setMunicipio(undefined);
      return;
    }
    setMunicipio(value);
  };

  const municipioSelectValue = municipio ?? "Todos";

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

  return (
    <div className="min-h-screen bg-surface-body text-slate-900">
      <HeaderMenuPro
        tab={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        searchField={queryField}
        onSearchFieldChange={setQueryField}
        searchFieldOptions={SEARCH_FIELD_OPTIONS}
        municipio={municipioSelectValue}
        municipios={municipiosOptions}
        onMunicipioChange={handleMunicipioChange}
        somenteAlertas={somenteAlertas}
        onSomenteAlertasChange={setSomenteAlertas}
        modoFoco={modoFoco}
        onModoFocoChange={setModoFoco}
      />
      <main className="pt-20 px-4 pb-8 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          {loading ? (
            <div className="p-6 text-center">Carregando dados...</div>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsContent value="painel">
                <PainelScreen
                  query={query}
                  municipio={municipio}
                  soAlertas={somenteAlertas}
                  kpis={kpis}
                  empresas={empresasComCertificados}
                  licencas={licencas}
                  taxas={taxas}
                  certificados={certificados}
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
                  soAlertas={somenteAlertas}
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
                  soAlertas={somenteAlertas}
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
                  soAlertas={somenteAlertas}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

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
