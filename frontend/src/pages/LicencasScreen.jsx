import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InlineBadge from "@/components/InlineBadge";
import { Chip } from "@/components/Chip";
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
import { ResumoTipoCardLicenca } from "@/components/ResumoTipoCard";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Droplets,
  Shield,
  ClipboardCheck,
  MapPin,
  Trees,
  Settings,
  Clipboard,
} from "lucide-react";

const LIC_ICON_COMPONENTS = {
  SANITARIA: Droplets,
  CERCON: Shield,
  FUNCIONAMENTO: ClipboardCheck,
  USO_DO_SOLO: MapPin,
  AMBIENTAL: Trees,
};

const LIC_ICON_COLORS = {
  SANITARIA: "bg-sky-200 text-sky-700",
  CERCON: "bg-red-200 text-red-600",
  FUNCIONAMENTO: "bg-pink-200 text-pink-800",
  USO_DO_SOLO: "bg-yellow-200 text-yellow-700",
  AMBIENTAL: "bg-emerald-200 text-emerald-700",
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

function LinhaTipoLicenca({ tipo, status, vencimento, detalhe }) {
  const statusVariant =
    status === "Vencido"
      ? "danger"
      : status === "Sujeito"
        ? "warning"
        : status === "Possui"
          ? "success"
          : "neutral";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b last:border-0 border-slate-100">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {tipo}
        </span>
        {status && <Chip variant={statusVariant}>{status}</Chip>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {vencimento && (
          <>
            <span className="text-slate-400">Vencimento:</span>
            <span className="font-medium text-slate-700">{vencimento}</span>
          </>
        )}
        {detalhe && <span className="text-slate-400">{detalhe}</span>}
      </div>
    </div>
  );
}

export default function LicencasScreen({ licencas, filteredLicencas, modoFoco, handleCopy }) {
  const [viewMode, setViewMode] = useState("empresas");
  const [selectedLicTipo, setSelectedLicTipo] = useState("Todos");

  /** @typedef {"empresa" | "status" | "vencimento" | "status_geral" | "municipio"} LicencaSortColumn */
  /** @typedef {"asc" | "desc"} LicencaSortDirection */
  /** @typedef {{ column: LicencaSortColumn; direction: LicencaSortDirection }} LicencaSortState */

  const [sortByTipoLicenca, setSortByTipoLicenca] = useState({});

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

  function renderValidade(lic) {
    if (lic?.validade_br) return lic.validade_br;
    if (lic?.validade) return dayjs(lic.validade).format("DD/MM/YYYY");
    return "—";
  }

  function toggleSortLicenca(tipoKey, column) {
    setSortByTipoLicenca((prev) => {
      const current = prev[tipoKey];
      if (current?.column === column) {
        if (current.direction === "asc") {
          return { ...prev, [tipoKey]: { column, direction: "desc" } };
        }
        if (current.direction === "desc") {
          const clone = { ...prev };
          delete clone[tipoKey];
          return clone;
        }
      }
      return { ...prev, [tipoKey]: { column, direction: "asc" } };
    });
  }

  function sortRegistrosLicencaPorTipo(registros, tipoKey, sortState) {
    const base = [...registros];

    if (!sortState) {
      return base.sort((a, b) => (a?.empresa || "").localeCompare(b?.empresa || ""));
    }

    const { column, direction } = sortState;

    const getValue = (lic) => {
      switch (column) {
        case "empresa":
          return lic?.empresa || "";
        case "status":
          return lic?.status || "";
        case "vencimento": {
          const value = renderValidade(lic);
          return value === "—" ? "" : value;
        }
        case "status_geral":
          return lic?.status_geral || "";
        case "municipio":
          return lic?.municipio || "";
        default:
          return "";
      }
    };

    const sorted = base.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);

      if (
        column === "vencimento" &&
        va &&
        vb &&
        typeof va === "string" &&
        typeof vb === "string"
      ) {
        const [da, ma] = va.split("/");
        const [db, mb] = vb.split("/");
        const numA = (Number(ma) || 0) * 100 + (Number(da) || 0);
        const numB = (Number(mb) || 0) * 100 + (Number(db) || 0);
        return numA - numB;
      }

      return String(va).localeCompare(String(vb));
    });

    return direction === "asc" ? sorted : sorted.reverse();
  }

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
            {licencasPorEmpresa.map((grupo) => {
              const totalLicencas = grupo.licencas?.length || 0;
              const totalTipos = tiposLicenca.length;

              const resumoPorTipo = (normalized) => {
                const licencasDoTipo = (grupo.licencas || [])
                  .filter((lic) => normalizeTipoLicenca(lic?.tipo) === normalized)
                  .filter((lic) => hasRelevantStatus(lic.status));
                const chosen =
                  licencasDoTipo.find((lic) => shouldHighlightStatus(lic.status)) ||
                  licencasDoTipo[0];

                if (!chosen) {
                  return { status: null, vencimento: null, detalhe: null };
                }

                return {
                  status: chosen.status,
                  vencimento: renderValidade(chosen),
                  detalhe: chosen.status_detalhe,
                };
              };

              return (
                <div
                  key={grupo.id}
                  className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 lg:p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {grupo.empresa || "—"}
                      </h3>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {grupo.cnpj && handleCopy ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(grupo.cnpj, `CNPJ copiado: ${grupo.cnpj}`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            title="Copiar CNPJ"
                          >
                            <Clipboard className="h-3.5 w-3.5 opacity-70" aria-hidden />
                            <span>CNPJ: {grupo.cnpj}</span>
                          </button>
                        ) : (
                          grupo.cnpj && <Chip>CNPJ: {grupo.cnpj}</Chip>
                        )}
                        {grupo.municipio && <Chip>Município: {grupo.municipio}</Chip>}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {totalLicencas} licenças • {totalTipos} tipos
                      </p>
                    </div>
                    <Chip variant="neutral" className="text-[11px]">
                      {totalTipos} tipos
                    </Chip>
                  </div>

                  <div className="mt-1">
                    <LinhaTipoLicenca
                      tipo="Sanitária"
                      {...resumoPorTipo("SANITARIA")}
                    />
                    <LinhaTipoLicenca
                      tipo="Cercon"
                      {...resumoPorTipo("CERCON")}
                    />
                    <LinhaTipoLicenca
                      tipo="Funcionamento"
                      {...resumoPorTipo("FUNCIONAMENTO")}
                    />
                    <LinhaTipoLicenca
                      tipo="Uso do Solo"
                      {...resumoPorTipo("USO_DO_SOLO")}
                    />
                    <LinhaTipoLicenca
                      tipo="Ambiental"
                      {...resumoPorTipo("AMBIENTAL")}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            {tiposLicencaStats.map(({ normalized, display, total, venc, soon, subj, disp, poss }) => {
              const IconComponent = LIC_ICON_COMPONENTS[normalized] || Settings;
              const colorClasses = LIC_ICON_COLORS[normalized] || "bg-slate-100 text-slate-700";

              return (
                <ResumoTipoCardLicenca
                  key={normalized}
                  tipo={display}
                  total={total}
                  icon={IconComponent}
                  corClasse={colorClasses}
                  stats={{
                    possui: poss,
                    ate30d: soon,
                    vencido: venc,
                    sujeito: subj,
                    dispensa: disp,
                  }}
                />
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
              const IconComponent =
                normalized === "Todos" ? null : LIC_ICON_COMPONENTS[normalized] || Settings;

              return (
                <Button
                  key={normalized}
                  size="sm"
                  variant={normalized === selectedLicTipo ? "default" : "secondary"}
                  onClick={() => setSelectedLicTipo(normalized)}
                  className="inline-flex items-center gap-1"
                >
                  {IconComponent && (
                    <span className="opacity-80">
                      <IconComponent className="h-4 w-4" />
                    </span>
                  )}
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

                const registrosBase = licencasVisiveis
                  .filter((lic) => normalizeTipoLicenca(lic?.tipo) === tipoNormalized)
                  .filter((lic) => hasRelevantStatus(lic.status));

                const registros = sortRegistrosLicencaPorTipo(
                  registrosBase,
                  tipoNormalized,
                  sortByTipoLicenca[tipoNormalized],
                );

                const columns = [
                  { id: "empresa", label: "Empresa" },
                  { id: "status", label: "Status" },
                  { id: "vencimento", label: "Vencimento" },
                  { id: "status_geral", label: "Status geral" },
                  { id: "municipio", label: "Município" },
                ];

                const currentSort = sortByTipoLicenca[tipoNormalized];

                const IconComponent = LIC_ICON_COMPONENTS[tipoNormalized] || Settings;

                return (
                  <Card key={tipoNormalized} className="shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="opacity-80">
                          <IconComponent className="h-4 w-4" />
                        </span>
                        {display}
                        <InlineBadge variant="outline" className="bg-white">
                          {registros.length}
                        </InlineBadge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-[500px]">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-slate-50">
                            <TableRow className="shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                              {columns.map((col) => {
                                const isActive = currentSort?.column === col.id;
                                const direction = currentSort?.direction;

                                return (
                                  <TableHead key={col.id}>
                                    <button
                                      type="button"
                                      onClick={() => toggleSortLicenca(tipoNormalized, col.id)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                                    >
                                      {col.label}
                                      <span className="inline-flex items-center">
                                        {!isActive && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                                        {isActive && direction === "asc" && <ArrowUp className="h-3 w-3" />}
                                        {isActive && direction === "desc" && <ArrowDown className="h-3 w-3" />}
                                      </span>
                                    </button>
                                  </TableHead>
                                );
                              })}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {registros.map((lic, index) => (
                              <TableRow key={`${lic.empresa_id ?? lic.empresa}-${lic.tipo}-${index}`}>
                                <TableCell className="font-medium">{lic.empresa}</TableCell>
                                <TableCell>
                                  <StatusBadge status={lic.status} />
                                </TableCell>
                                <TableCell className="text-xs text-slate-700">
                                  {renderValidade(lic)}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge status={lic.status_geral} />
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">
                                  {lic.municipio || "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                            {registros.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-sm text-slate-500">
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
