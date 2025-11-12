import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import HeaderMenuPro from "@/components/HeaderMenuPro";
import PainelScreen from "@/features/painel/PainelScreen";
import EmpresasScreen from "@/features/empresas/EmpresasScreen";
import AlertasScreen from "@/features/alertas/AlertasScreen";
import UteisScreen from "@/features/uteis/UteisScreen";
import PainelScreen from "@/features/painel/PainelScreen";
import CertificadosScreen from "@/features/certificados/CertificadosScreen";
import ToastProvider, { useToast } from "@/providers/ToastProvider.jsx";
import { Sparkles, X } from "lucide-react";
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
import { listarEmpresas } from "@/services/empresas";
import { listarGruposKPIs } from "@/services/kpis";
import { listarContatos, listarModelos } from "@/services/uteis";
import { isAlertStatus, isProcessStatusInactive } from "@/lib/status";
import {
  buildCertificadoIndex,
  isCertificadoSituacaoAlert,
  resolveEmpresaCertificadoSituacao,
} from "@/lib/certificados";
import HeaderMenuPro from "@/components/HeaderMenuPro";

const NORMALIZE = (value) => (value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const MUNICIPIO_TODOS = "Todos";

function useAppData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [kpiItems, setKpiItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [requerimentos, setRequerimentos] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [modelos, setModelos] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const results = await Promise.allSettled([
        listarEmpresas({ size: 100 }),
        listarGruposKPIs(),
        listarContatos(),
        listarModelos(),
      ]);

      if (!mounted) {
        return;
      }

      const [empresasResult, kpisResult, contatosResult, modelosResult] = results;

      const empresasPayload = empresasResult?.status === "fulfilled" ? empresasResult.value : [];
      const empresasLista = Array.isArray(empresasPayload?.items)
        ? empresasPayload.items
        : Array.isArray(empresasPayload)
          ? empresasPayload
          : [];
      const empresasNormalizadas = empresasLista.map((item) => enhanceEmpresa(item));

      const municipioMap = new Map();
      empresasNormalizadas.forEach((empresa) => {
        const original = normalizeText(empresa?.municipio || "").trim();
        if (!original || original === MUNICIPIO_ALL) {
          return;
        }
        const normalizedKey = normalizeTextLower(original).trim();
        if (!normalizedKey || municipioMap.has(normalizedKey)) {
          return;
        }
        municipioMap.set(normalizedKey, original);
      });
      const municipiosExtraidos = Array.from(municipioMap.values());

      const kpisPayload = kpisResult?.status === "fulfilled" ? kpisResult.value : {};
      const contatosPayload = contatosResult?.status === "fulfilled" ? contatosResult.value : [];
      const modelosPayload = modelosResult?.status === "fulfilled" ? modelosResult.value : [];

      setEmpresas(empresasNormalizadas);
      setLicencas([]);
      setTaxas([]);
      setProcessos([]);
      setCertificados([]);
      setAgendamentos([]);
      setKpis(kpisPayload || {});
      setMunicipios([MUNICIPIO_ALL, ...municipiosExtraidos]);
      setContatos(Array.isArray(contatosPayload?.items) ? contatosPayload.items : contatosPayload || []);
      setModelos(Array.isArray(modelosPayload?.items) ? modelosPayload.items : modelosPayload || []);
      setLoading(false);

      if (results.some((result) => result.status === "rejected")) {
        enqueueToast("Alguns dados não puderam ser carregados.");
      }
    };

    load().catch((error) => {
      console.error("Erro ao carregar dados:", error);
      if (mounted) {
        setEmpresas([]);
        setLicencas([]);
        setTaxas([]);
        setProcessos([]);
        setCertificados([]);
        setAgendamentos([]);
        setKpis({});
        setMunicipios([MUNICIPIO_ALL]);
        setContatos([]);
        setModelos([]);
        setLoading(false);
        enqueueToast("Não foi possível carregar os dados.");
      }
    });

    return () => {
      active = false;
    };
  }, [enqueueToast]);

  return { loading, error, empresas, kpiItems, alertas, requerimentos, contatos, modelos };
}

export default function App() {
  const [tab, setTab] = useState("painel");
  const [query, setQuery] = useState("");
  const [municipio, setMunicipio] = useState(MUNICIPIO_TODOS);
  const { loading, error, empresas, kpiItems, alertas, requerimentos, contatos, modelos } =
    useAppData();

  const municipiosOptions = useMemo(() => {
    const set = new Set([MUNICIPIO_TODOS]);
    empresas.forEach((empresa) => {
      if (empresa?.municipio) {
        set.add(empresa.municipio);
      }
    });
    return Array.from(set);
  }, [empresas]);

  const empresaById = useMemo(() => {
    const map = new Map();
    empresas.forEach((empresa) => {
      const id = empresa?.empresa_id ?? empresa?.empresaId ?? empresa?.id;
      if (id !== undefined && id !== null) {
        map.set(Number(id), empresa);
      }
    });
    return map;
  }, [empresas]);

  const municipioKey = NORMALIZE(municipio === MUNICIPIO_TODOS ? "" : municipio);
  const normalizedQuery = NORMALIZE(query);

  const filteredEmpresas = useMemo(() => {
    return empresas.filter((empresa) => {
      if (!empresa) return false;
      const municipioAtual = NORMALIZE(empresa.municipio);
      if (municipioKey && municipioAtual !== municipioKey) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const campos = [empresa.empresa, empresa.cnpj, empresa.municipio, empresa.categoria];
      return campos.some((campo) => NORMALIZE(campo).includes(normalizedQuery));
    });
  }, [empresas, municipioKey, normalizedQuery]);

  const filteredAlertas = useMemo(() => {
    return alertas.filter((alerta) => {
      if (!alerta) return false;
      const empresaRelacionada = empresaById.get(Number(alerta.empresa_id));
      const municipioEmpresa = empresaRelacionada?.municipio
        ? NORMALIZE(empresaRelacionada.municipio)
        : "";
      if (municipioKey && municipioEmpresa !== municipioKey) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const campos = [
        alerta.empresa,
        alerta.cnpj,
        alerta.tipo_alerta,
        alerta.descricao,
        empresaRelacionada?.municipio,
      ];
      return campos.some((campo) => NORMALIZE(campo).includes(normalizedQuery));
    });
  }, [alertas, empresaById, municipioKey, normalizedQuery]);

  const kpisResumo = useMemo(() => {
    const resumo = {};
    kpiItems.forEach((item) => {
      if (!item) return;
      const chave = item.chave || item.valor_nome || item.grupo;
      if (!chave) return;
      resumo[chave] = item.valor;
    });
    return resumo;
  }, [kpiItems]);

  return (
    <div className="min-h-screen bg-slate-100">
      <HeaderMenuPro
        tab={tab}
        onTabChange={setTab}
        query={query}
        onQueryChange={setQuery}
        municipio={municipio}
        municipios={municipiosOptions}
        onMunicipioChange={(value) => setMunicipio(value)}
      />

      <main className={`px-4 py-6 transition-colors ${TAB_BACKGROUNDS[tab] || "bg-white"}`}>
        <div className="mx-auto max-w-[1200px] space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados. Verifique o token e tente novamente.
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsContent value="painel">
              <PainelScreen loading={loading} kpiItems={kpiItems} kpisResumo={kpisResumo} alertas={filteredAlertas} />
            </TabsContent>

            <TabsContent value="empresas">
              <EmpresasScreen loading={loading} empresas={filteredEmpresas} total={empresas.length} />
            </TabsContent>

            <TabsContent value="alertas">
              <AlertasScreen loading={loading} alertas={filteredAlertas} />
            </TabsContent>

            <TabsContent value="uteis">
              <UteisScreen
                loading={loading}
                requerimentos={requerimentos}
                contatos={contatos}
                modelos={modelos}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
