import React, { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import HeaderMenuPro from "@/components/HeaderMenuPro";
import PainelScreen from "@/features/painel/PainelScreen";
import EmpresasScreen from "@/features/empresas/EmpresasScreen";
import AlertasScreen from "@/features/alertas/AlertasScreen";
import UteisScreen from "@/features/uteis/UteisScreen";
import { listarEmpresas } from "@/services/empresas";
import { listarGruposKPIs } from "@/services/kpis";
import { listarAlertas } from "@/services/alertas";
import { listarContatos, listarModelos, listarRequerimentos } from "@/services/uteis";
import { TAB_BACKGROUNDS } from "@/lib/constants";

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
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [empresasResp, kpisResp, alertasResp, reqResp, contatosResp, modelosResp] =
          await Promise.all([
            listarEmpresas({ size: 200 }),
            listarGruposKPIs({ size: 200 }),
            listarAlertas({ size: 200 }),
            listarRequerimentos({ size: 200 }),
            listarContatos({ size: 200 }),
            listarModelos({ size: 200 }),
          ]);

        if (!active) return;
        setEmpresas(empresasResp?.items ?? []);
        setKpiItems(kpisResp?.items ?? []);
        setAlertas(alertasResp?.items ?? []);
        setRequerimentos(reqResp?.items ?? []);
        setContatos(contatosResp?.items ?? []);
        setModelos(modelosResp?.items ?? []);
        setError(null);
      } catch (err) {
        console.error("[App] Falha ao carregar dados", err);
        if (active) {
          setError(err);
          setEmpresas([]);
          setKpiItems([]);
          setAlertas([]);
          setRequerimentos([]);
          setContatos([]);
          setModelos([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

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
