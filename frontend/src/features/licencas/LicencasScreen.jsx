import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InlineBadge from "@/components/InlineBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { DEFAULT_LICENCA_TIPOS } from "@/lib/constants";
import { getStatusKey, hasRelevantStatus, isAlertStatus } from "@/lib/status";
import { Droplets, Shield, ClipboardCheck, MapPin, Trees, Settings } from "lucide-react";

const LIC_ICONS = {
  SANITARIA: <Droplets className="h-4 w-4" />,
  CERCON: <Shield className="h-4 w-4" />,
  FUNCIONAMENTO: <ClipboardCheck className="h-4 w-4" />,
  USO_DO_SOLO: <MapPin className="h-4 w-4" />,
  AMBIENTAL: <Trees className="h-4 w-4" />,
};

const LIC_COLORS = {
  SANITARIA: "border-sky-500 text-sky-700",
  CERCON: "border-indigo-500 text-indigo-700",
  FUNCIONAMENTO: "border-blue-500 text-blue-700",
  USO_DO_SOLO: "border-amber-500 text-amber-700",
  AMBIENTAL: "border-emerald-600 text-emerald-700",
};

// Rótulos de exibição por tipo normalizado
const DISPLAY_BY_NORMALIZED = {
  SANITARIA: "Sanitária",
  USO_DO_SOLO: "Uso do Solo",
  FUNCIONAMENTO: "Funcionamento",
  AMBIENTAL: "Ambiental",
  CERCON: "CERCON",
};

// ---------------------------------------------------------------------------
// eControle – Deduplicação de tipos de licenças
// - Remove acentos/diacríticos
// - Unifica aliases para um TIPO CANÔNICO
//   Ex.: "Sanitária", "Sanitaria", "ALVARA_VIG_SANITARIA" => "SANITARIA"
//       "CERTIDAO_USO_DO_SOLO", "USO_SOLO"               => "USO_DO_SOLO"
// ---------------------------------------------------------------------------

// Aliases → tipo canônico (evita duplicatas por grafia/variação)
const CANONICAL_BY_ALIAS = {
  // Sanitária
  SANITARIA: "SANITARIA",
  SANITÁRIA: "SANITARIA",
  ALVARA_SANITARIA: "SANITARIA",
  ALVARA_VIG_SANITARIA: "SANITARIA",
  VIG_SANITARIA: "SANITARIA",
  VIGILANCIA_SANITARIA: "SANITARIA",

  // Uso do Solo
  USO_DO_SOLO: "USO_DO_SOLO",
  CERTIDAO_USO_DO_SOLO: "USO_DO_SOLO",
  USO_SOLO: "USO_DO_SOLO",

  // Funcionamento
  FUNCIONAMENTO: "FUNCIONAMENTO",
  ALVARA_FUNCIONAMENTO: "FUNCIONAMENTO",

  // Ambiental
  AMBIENTAL: "AMBIENTAL",
  LICENCA_AMBIENTAL: "AMBIENTAL",
  ALVARA_AMBIENTAL: "AMBIENTAL",

  // CERCON (já canônico)
  CERCON: "CERCON",
  ALVARA_BOMBEIROS: "CERCON",
  ALVARA_BOMBEIRO: "CERCON",
  ALVARA_BM: "CERCON",
  BOMBEIROS: "CERCON",
  CERTIFICADO_BOMBEIROS: "CERCON",
  CBMGO: "CERCON",
};

// Normaliza removendo acentos, padroniza separadores e aplica alias → canônico
const normalizeTipoLicenca = (tipo) => {
  if (!tipo) return "";
  // 1) Remove diacríticos/acentos
  const base = String(tipo)
    .normalize("NFD") // separa diacríticos
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_") // qualquer separador → "_"
    .replace(/^_+|_+$/g, ""); // trim "_"
  // 2) Consolida para o canônico se houver mapeamento
  return CANONICAL_BY_ALIAS[base] || base;
};

const shouldHighlightStatus = (status) => {
  const key = getStatusKey(status);
  return isAlertStatus(status) || key.includes("sujeit");
};

export default function LicencasScreen({ licencas, filteredLicencas, modoFoco }) {
  const [viewMode, setViewMode] = useState("empresas");
  const [selectedLicTipo, setSelectedLicTipo] = useState("Todos");

  const licencasLista = useMemo(
    () => (Array.isArray(licencas) ? licencas : []),
    [licencas],
  );

  const filteredLicencasLista = useMemo(
    () => (Array.isArray(filteredLicencas) ? filteredLicencas : []),
    [filteredLicencas],
  );

  const tiposLicenca = useMemo(() => {
    const seenNormalized = new Map(); // key: normalized, value: display label
    const ordered = [];

    // 1. Adiciona tipos das constantes (prioridade de display)
    DEFAULT_LICENCA_TIPOS.forEach((tipoBase) => {
      const display = tipoBase.trim();
      if (!display) return;

      const normalized = normalizeTipoLicenca(display);
      if (!seenNormalized.has(normalized)) {
        const pretty = DISPLAY_BY_NORMALIZED[normalized] ?? display;
        seenNormalized.set(normalized, pretty);
        ordered.push(normalized);
      }
    });

    // 2. Adiciona tipos vindos dos dados
    licencasLista.forEach((lic) => {
      const normalized = normalizeTipoLicenca(lic?.tipo);
      if (!normalized) return;

      if (!seenNormalized.has(normalized)) {
        const pretty = DISPLAY_BY_NORMALIZED[normalized] ?? lic?.tipo ?? normalized;
        seenNormalized.set(normalized, pretty);
        ordered.push(normalized);
      }
    });

    return ordered.map((normalized) => ({
      normalized,
      display: seenNormalized.get(normalized),
    }));
  }, [licencasLista]);

  const licencasVisiveis = useMemo(
    () =>
      modoFoco
        ? filteredLicencasLista.filter((lic) => shouldHighlightStatus(lic.status))
        : filteredLicencasLista,
    [filteredLicencasLista, modoFoco],
  );

  const tiposLicencaStats = useMemo(
    () =>
      tiposLicenca.map(({ normalized, display }) => {
        const items = licencasVisiveis.filter(
          (lic) => normalizeTipoLicenca(lic?.tipo) === normalized,
        );
        const venc = items.filter((item) => item.status === "Vencido").length;
        const soon = items.filter((item) => item.status === "Vence≤30d").length;
        const subj = items.filter((item) => item.status === "Sujeito").length;
        const disp = items.filter((item) => item.status === "Dispensa").length;
        const poss = Math.max(items.length - venc - soon - subj - disp, 0);

        return {
          normalized,
          display,
          total: items.length,
          venc,
          soon,
          subj,
          disp,
          poss,
        };
      }),
    [licencasVisiveis, tiposLicenca],
  );

  const licencasPorEmpresa = useMemo(() => {
    let fallbackIndex = 0;
    const map = new Map();

    licencasVisiveis.forEach((lic) => {
      const key = lic?.empresa_id ?? lic?.empresa ?? lic?.cnpj ?? `sem_empresa_${fallbackIndex++}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          empresa: lic?.empresa || "—",
          cnpj: lic?.cnpj,
          municipio: lic?.municipio,
          licencas: [],
        });
      }
      map.get(key)?.licencas.push(lic);
    });

    return Array.from(map.values()).sort((a, b) =>
      (a.empresa || "").localeCompare(b.empresa || ""),
    );
  }, [licencasVisiveis]);

  useEffect(() => {
    if (selectedLicTipo !== "Todos") {
      const exists = tiposLicenca.some((t) => t.normalized === selectedLicTipo);
      if (!exists) {
        setSelectedLicTipo("Todos");
      }
    }
  }, [selectedLicTipo, tiposLicenca]);

  const tiposLicencaSelecionados = useMemo(
    () =>
      selectedLicTipo === "Todos"
        ? tiposLicenca.map((t) => t.normalized)
        : [selectedLicTipo],
    [selectedLicTipo, tiposLicenca],
  );

  const renderValidade = (lic) => {
    if (lic?.validade_br) return lic.validade_br;
    if (lic?.validade) return dayjs(lic.validade).format("DD/MM/YYYY");
    return "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={viewMode === "empresas" ? "default" : "secondary"}
            onClick={() => setViewMode("empresas")}
            className="inline-flex items-center gap-2"
          >
            Por empresa
            <InlineBadge variant="outline" className="bg-white">
              {licencasPorEmpresa.length}
            </InlineBadge>
          </Button>
          <Button
            size="sm"
            variant={viewMode === "tipos" ? "default" : "secondary"}
            onClick={() => setViewMode("tipos")}
            className="inline-flex items-center gap-2"
          >
            Por tipo
            <InlineBadge variant="outline" className="bg-white">
              {tiposLicenca.length}
            </InlineBadge>
          </Button>
        </div>
        <InlineBadge variant="outline" className="bg-white">
          {modoFoco ? "Modo foco ativo" : "Todos os registros"}
        </InlineBadge>
      </div>

      {viewMode === "empresas" ? (
        licencasPorEmpresa.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="p-6 text-center text-sm text-slate-600">
              Nenhuma licença correspondente ao filtro.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {licencasPorEmpresa.map((grupo) => (
              <Card key={grupo.id} className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-base font-semibold leading-tight text-slate-800 truncate">
                        {grupo.empresa || "—"}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                        {grupo.cnpj && (
                          <InlineBadge variant="outline" className="bg-white">
                            CNPJ: {grupo.cnpj}
                          </InlineBadge>
                        )}
                        {grupo.municipio && (
                          <InlineBadge variant="outline" className="bg-white">
                            Município: {grupo.municipio}
                          </InlineBadge>
                        )}
                        <InlineBadge variant="outline" className="bg-white">
                          Licenças: {grupo.licencas.length}
                        </InlineBadge>
                      </div>
                    </div>
                    <InlineBadge variant="outline" className="bg-white">
                      {tiposLicenca.length} tipos
                    </InlineBadge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {tiposLicenca.map(({ normalized, display }) => {
                      const licencasDoTipo = grupo.licencas
                        .filter((lic) => normalizeTipoLicenca(lic?.tipo) === normalized)
                        .filter((lic) => hasRelevantStatus(lic.status));
                      const chosen =
                        licencasDoTipo.find((lic) => shouldHighlightStatus(lic.status)) ||
                        licencasDoTipo[0];

                      return (
                        <div key={normalized} className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {display}
                          </p>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusBadge status={chosen?.status} />
                              {chosen && (
                                <span className="text-[11px] text-slate-600">
                                  Vencimento: {renderValidade(chosen)}
                                </span>
                              )}
                            </div>
                            {chosen?.status_bruto && (
                              <span className="text-[11px] text-slate-500">
                                {chosen.status_bruto}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            {tiposLicencaStats.map(({ normalized, display, total, venc, soon, subj, disp, poss }) => {
              const icon = LIC_ICONS[normalized] || <Settings className="h-4 w-4" />;
              const colorClasses = LIC_COLORS[normalized] || "border-slate-400 text-slate-700";

              return (
                <Card key={normalized} className="shadow-sm">
                  <CardContent className={`p-4 rounded-xl border-l-4 ${colorClasses}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">{display}</div>
                        <div className="text-2xl font-semibold">{total}</div>
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
                      <InlineBadge className="bg-orange-100 text-orange-800 border-orange-200">
                        Vencido {venc}
                      </InlineBadge>
                      <InlineBadge className="bg-red-100 text-red-700 border-red-200">
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
            {[{ normalized: "Todos", display: "Todos" }, ...tiposLicenca].map(({ normalized, display }) => {
              const count = licencasVisiveis.filter((lic) => {
                if (!hasRelevantStatus(lic.status)) {
                  return false;
                }
                if (normalized === "Todos") {
                  return true;
                }
                return normalizeTipoLicenca(lic?.tipo) === normalized;
              }).length;
              const icon =
                normalized === "Todos" ? null : LIC_ICONS[normalized] || <Settings className="h-4 w-4" />;

              return (
                <Button
                  key={normalized}
                  size="sm"
                  variant={normalized === selectedLicTipo ? "default" : "secondary"}
                  onClick={() => setSelectedLicTipo(normalized)}
                  className="inline-flex items-center gap-1"
                >
                  {icon && <span className="opacity-80">{icon}</span>}
                  {display}
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
              tiposLicencaSelecionados.map((tipoNormalized) => {
                const tipoInfo = tiposLicenca.find((t) => t.normalized === tipoNormalized);
                const display =
                  DISPLAY_BY_NORMALIZED[tipoNormalized] || tipoInfo?.display || tipoNormalized;

                const registros = licencasVisiveis
                  .filter((lic) => normalizeTipoLicenca(lic?.tipo) === tipoNormalized)
                  .filter((lic) => hasRelevantStatus(lic.status))
                  .sort((a, b) => (a?.empresa || "").localeCompare(b?.empresa || ""));

                const icon = LIC_ICONS[tipoNormalized] || <Settings className="h-4 w-4" />;

                return (
                  <Card key={tipoNormalized} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="opacity-80">{icon}</span>
                        {display}
                        <InlineBadge variant="outline" className="bg-white">
                          {registros.length}
                        </InlineBadge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[500px]">
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
                                <TableCell>{renderValidade(lic)}</TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {lic.status_bruto || lic.obs || "—"}
                                </TableCell>
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
        </>
      )}
    </div>
  );
}
