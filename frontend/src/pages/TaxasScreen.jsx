import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TAXA_ALERT_KEYS, TAXA_COLUMNS, TAXA_SEARCH_KEYS } from "@/lib/constants";
import {
  formatStatusDisplay,
  hasRelevantStatus,
  isAlertStatus,
  resolveStatusClass,
} from "@/lib/status";
import { ResumoTipoCardTaxa } from "@/components/ResumoTipoCard";
import { ArrowDown, ArrowUp, ArrowUpDown, Receipt, FileCheck2, BriefcaseBusiness } from "lucide-react";
import { Chip } from "@/components/Chip";
import { fetchJson } from "@/lib/api";

const TAXA_ICON_COMPONENTS = {
  tpi: Receipt,
  taxa_funcionamento: FileCheck2,
  taxa_publicidade: BriefcaseBusiness,
};

const TAXA_ICON_COLORS = {
  tpi: "bg-indigo-100 text-indigo-700",
  taxa_funcionamento: "bg-blue-100 text-blue-700",
  taxa_publicidade: "bg-fuchsia-100 text-fuchsia-700",
  taxa_sanitaria: "bg-sky-100 text-sky-700",
  bombeiros: "bg-red-100 text-red-700",
  localizacao_instalacao: "bg-green-100 text-green-700",
  area_publica: "bg-yellow-100 text-yellow-700",
};

function formatVencimentoCurto(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, , month, day] = isoMatch;
      return `${day}/${month}`;
    }

    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/);
    if (slashMatch) {
      const [, day, month] = slashMatch;
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // fallback: se não for uma data válida, retorna o valor original
    return value;
  }
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

const parseSortableDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    }
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const normalizedYear = year ? Number(year) : new Date().getFullYear();
      return new Date(normalizedYear, Number(month) - 1, Number(day)).getTime();
    }
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const formatDataEnvio = (value) => {
  if (!value) return "";
  const ts = parseSortableDate(value);
  if (!ts) return String(value);
  const date = new Date(ts);
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  return `${dia}/${mes}/${ano}`;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const ts = parseSortableDate(value);
  if (!ts) return "";
  const date = new Date(ts);
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  return `${ano}-${mes}-${dia}`;
};

function LinhaTipoTaxa({ tipo, status, vencimento }) {
  const { variant } = resolveStatusClass(status);
  const displayStatus = formatStatusDisplay(status);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b last:border-0 border-slate-100">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {tipo}
      </span>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {hasRelevantStatus(status) && (
          <Chip variant={variant} className="text-xs">
            {displayStatus}
          </Chip>
        )}
        {vencimento && (
          <>
            <span className="text-slate-400">Vencimento:</span>
            <span className="font-medium text-slate-700">
              {formatVencimentoCurto(vencimento)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const getVencimentoTpi = (taxa) =>
  taxa?.vencimento_tpi ?? taxa?.vencimentoTpi ?? taxa?.tpi_vencimento ?? taxa?.vencimento;

function TaxasScreen({ taxas, modoFoco, matchesMunicipioFilter, matchesQuery, handleCopy }) {
  const [viewMode, setViewMode] = useState("empresas");
  const [selectedTipo, setSelectedTipo] = useState("__ALL__");
  const [envioModal, setEnvioModal] = useState({ open: false, taxa: null, key: null });
  const [envioDraft, setEnvioDraft] = useState("");
  const [envioSaving, setEnvioSaving] = useState(false);
  const [envioError, setEnvioError] = useState("");
  const [envioOverrides, setEnvioOverrides] = useState({});

  /** @typedef {"empresa" | "status" | "vencimento" | "data_envio" | "status_geral" | "municipio"} TaxaSortColumn */
  /** @typedef {"asc" | "desc"} TaxaSortDirection */
  /** @typedef {{ column: TaxaSortColumn; direction: TaxaSortDirection }} TaxaSortState */

  const [sortByTipo, setSortByTipo] = useState({});

  const resolveTaxaKey = (taxa, index) =>
    taxa?.id ?? taxa?.taxa_id ?? taxa?.empresa_id ?? taxa?.empresa ?? index;

  const resolveDataEnvio = (taxa, key) => envioOverrides[key] ?? taxa?.data_envio;

  function toggleSort(tipoKey, column) {
    setSortByTipo((prev) => {
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

  function sortRegistrosPorTipo(registros, tipoKey, sortState) {
    const base = [...registros];

    if (!sortState) {
      return base.sort((a, b) => (a?.empresa || "").localeCompare(b?.empresa || ""));
    }

    const { column, direction } = sortState;

    const getValue = (taxa) => {
      switch (column) {
        case "empresa":
          return taxa?.empresa || "";
        case "status":
          return taxa?.[tipoKey] || "";
        case "vencimento": {
          if (tipoKey === "tpi") {
            const vencimentoTpi = getVencimentoTpi(taxa);
            return vencimentoTpi ? formatVencimentoCurto(vencimentoTpi) : "";
          }
          const vencKey = `vencimento_${tipoKey}`;
          return taxa?.[vencKey] || "";
        }
        case "status_geral":
          return taxa?.status_geral || "";
        case "municipio":
          return taxa?.municipio || "";
        case "data_envio":
          return resolveDataEnvio(taxa, resolveTaxaKey(taxa, 0)) || "";
        default:
          return "";
      }
    };

    const sorted = base.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);

      if (column === "data_envio") {
        const ta = parseSortableDate(va);
        const tb = parseSortableDate(vb);
        if (ta === null && tb === null) return 0;
        if (ta === null) return 1;
        if (tb === null) return -1;
        return ta - tb;
      }

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

  // Debug
  useEffect(() => {
    if (import.meta.env.DEV && taxas.length > 0) {
      const tpisComVencimento = taxas.filter((t) => t.vencimento_tpi);
      const tpisSemVencimento = taxas.filter((t) => !t.vencimento_tpi && t.tpi);
      console.log("[TaxasScreen] Debug TPIs:", {
        totalTaxas: taxas.length,
        tpisComVencimento: tpisComVencimento.length,
        tpisSemVencimento: tpisSemVencimento.length,
        primeiroComVencimento: tpisComVencimento[0],
        primeiroSemVencimento: tpisSemVencimento[0],
      });
    }
  }, [taxas]);

  const taxaTipos = useMemo(
    () => TAXA_COLUMNS.filter((column) => column.key !== "status_geral"),
    [],
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
        return matchesQuery(camposPesquisa, {
          nome: [taxa.empresa],
          razao: [taxa.empresa],
          cnpj: [taxa.cnpj],
        });
      }),
    [matchesMunicipioFilter, matchesQuery, taxas],
  );

  const taxasVisiveis = useMemo(() => {
    if (!modoFoco) {
      return filteredTaxas;
    }
    return filteredTaxas.filter((taxa) =>
      TAXA_ALERT_KEYS.some((key) => isAlertStatus(taxa?.[key])),
    );
  }, [filteredTaxas, modoFoco]);

  const taxaTipoStats = useMemo(
    () =>
      taxaTipos.map((column) => {
        const registrosComStatus = taxasVisiveis.filter((taxa) =>
          hasRelevantStatus(taxa?.[column.key]),
        );
        const alertas = registrosComStatus.filter((taxa) =>
          isAlertStatus(taxa?.[column.key]),
        ).length;
        const ok = Math.max(registrosComStatus.length - alertas, 0);
        const semStatus = Math.max(taxasVisiveis.length - registrosComStatus.length, 0);
        return {
          ...column,
          total: registrosComStatus.length,
          alertas,
          ok,
          semStatus,
        };
      }),
    [taxaTipos, taxasVisiveis],
  );

  useEffect(() => {
    if (selectedTipo === "__ALL__") return;
    const exists = taxaTipos.some((tipo) => tipo.key === selectedTipo);
    if (!exists) {
      setSelectedTipo("__ALL__");
    }
  }, [selectedTipo, taxaTipos]);

  const tiposSelecionados =
    selectedTipo === "__ALL__"
      ? taxaTipos
      : taxaTipos.filter((tipo) => tipo.key === selectedTipo);

  const openEnvioModal = (taxa, key) => {
    setEnvioModal({ open: true, taxa, key });
    setEnvioDraft(toDateInputValue(taxa?.data_envio));
    setEnvioError("");
  };

  const closeEnvioModal = () => {
    setEnvioModal({ open: false, taxa: null, key: null });
    setEnvioDraft("");
    setEnvioError("");
  };

  const saveEnvio = async () => {
    if (!envioModal?.taxa) return;
    setEnvioSaving(true);
    setEnvioError("");

    const taxa = envioModal.taxa;
    const taxaId = taxa?.id ?? taxa?.taxa_id;
    const empresaId = taxa?.empresa_id ?? taxa?.empresaId;

    const payload = {
      ...(empresaId !== undefined ? { empresa_id: empresaId } : {}),
      ...(taxa?.empresa ? { empresa: taxa.empresa } : {}),
      data_envio: envioDraft || null,
    };

    try {
      const endpoint = taxaId ? `/api/v1/taxas/${taxaId}` : "/api/v1/taxas";
      const method = taxaId ? "PATCH" : "POST";
      await fetchJson(endpoint, { method, body: payload });
      if (envioModal.key !== null) {
        setEnvioOverrides((prev) => ({ ...prev, [envioModal.key]: payload.data_envio }));
      }
      closeEnvioModal();
    } catch (error) {
      const message = error?.message || "Erro ao salvar data de envio.";
      if (message.includes("404")) {
        setEnvioError("Backend ainda não aceita Data de Envio. Tente novamente mais tarde.");
      } else {
        setEnvioError(message);
      }
    } finally {
      setEnvioSaving(false);
    }
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
              {taxasVisiveis.length}
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
              {taxaTipos.length}
            </InlineBadge>
          </Button>
        </div>
        <InlineBadge variant="outline" className="bg-white">
          {modoFoco ? "Modo foco ativo" : "Todos os registros"}
        </InlineBadge>
      </div>

      {viewMode === "empresas" ? (
        <>
          {taxasVisiveis.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center text-sm text-slate-600">
                Nenhuma taxa correspondente ao filtro.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {taxasVisiveis.map((taxa, index) => {
                const taxaKey = resolveTaxaKey(taxa, index);
                const dataEnvio = resolveDataEnvio(taxa, taxaKey);
                const vencimentoTpi = getVencimentoTpi(taxa);

                return (
                  <div
                    key={taxaKey}
                    className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 lg:p-5"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {taxa.empresa || "—"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                          {taxa.cnpj && handleCopy && (
                            <CopyableIdentifier
                              label="CNPJ"
                              value={taxa.cnpj}
                              onCopy={handleCopy}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          {taxa.municipio && (
                            <Chip className="text-[11px]">Município: {taxa.municipio}</Chip>
                          )}
                          {dataEnvio && (
                            <Chip className="text-[11px]">
                              Último envio: {formatDataEnvio(dataEnvio)}
                            </Chip>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {taxa.status_geral && <StatusBadge status={taxa.status_geral} />}
                        <button
                          type="button"
                          onClick={() => openEnvioModal(taxa, taxaKey)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Editar envio
                        </button>
                      </div>
                    </div>

                    <div className="mt-1">
                      <LinhaTipoTaxa
                        tipo="TPI"
                        status={taxa.tpi}
                        vencimento={vencimentoTpi}
                      />
                      <LinhaTipoTaxa tipo="PUBLICIDADE" status={taxa.publicidade} />
                      <LinhaTipoTaxa
                        tipo="LOCALIZAÇÃO/INSTALAÇÃO"
                        status={taxa.localizacao_instalacao}
                      />
                      <LinhaTipoTaxa tipo="BOMBEIROS" status={taxa.bombeiros} />
                      <LinhaTipoTaxa tipo="FUNCIONAMENTO" status={taxa.func} />
                      <LinhaTipoTaxa tipo="SANITÁRIA" status={taxa.sanitaria} />
                      <LinhaTipoTaxa tipo="ÁREA PÚBLICA" status={taxa.area_publica} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {taxaTipoStats.map((tipo) => {
              const IconComponent = TAXA_ICON_COMPONENTS[tipo.key] || Receipt;
              const colorClasses = TAXA_ICON_COLORS[tipo.key] || "bg-slate-100 text-slate-700";

              return (
                <ResumoTipoCardTaxa
                  key={tipo.key}
                  tipo={tipo.label}
                  total={tipo.total}
                  icon={IconComponent}
                  corClasse={colorClasses}
                  stats={{
                    ok: tipo.ok,
                    alerta: tipo.alertas,
                    semStatus: tipo.semStatus,
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedTipo === "__ALL__" ? "default" : "secondary"}
              onClick={() => setSelectedTipo("__ALL__")}
              className="inline-flex items-center gap-1"
            >
              Todos
              <span className="text-xs opacity-70">{taxasVisiveis.length}</span>
            </Button>
            {taxaTipoStats.map((tipo) => (
              <Button
                key={tipo.key}
                size="sm"
                variant={selectedTipo === tipo.key ? "default" : "secondary"}
                onClick={() => setSelectedTipo(tipo.key)}
                className="inline-flex items-center gap-1"
              >
                {tipo.label}
                <span className="text-xs opacity-70">{tipo.total}</span>
              </Button>
            ))}
          </div>

          {tiposSelecionados.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="p-6 text-center text-sm text-slate-600">
                Nenhuma taxa correspondente ao filtro.
              </CardContent>
            </Card>
          ) : (
            tiposSelecionados.map((tipo) => {
              const registrosBase = taxasVisiveis
                .filter((taxa) => hasRelevantStatus(taxa?.[tipo.key]))
                .filter((taxa) => (modoFoco ? isAlertStatus(taxa?.[tipo.key]) : true));

              const registros = sortRegistrosPorTipo(
                registrosBase,
                tipo.key,
                sortByTipo[tipo.key],
              );

              const columns = [
                { id: "empresa", label: "Empresa" },
                { id: "status", label: "Status" },
                { id: "vencimento", label: "Vencimento" },
                { id: "data_envio", label: "Data de Envio" },
                { id: "status_geral", label: "Status geral" },
                { id: "municipio", label: "Município" },
              ];

              const currentSort = sortByTipo[tipo.key];

              return (
                <Card key={tipo.key} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        {tipo.label}
                        <InlineBadge variant="outline" className="bg-white">
                          {registros.length}
                        </InlineBadge>
                      </CardTitle>

                      <span className="hidden sm:inline-flex items-center rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-600">
                        Ordenar por: Vencimento • Empresa • Status geral
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[420px]">
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
                                    onClick={() => toggleSort(tipo.key, col.id)}
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
                          {registros.map((taxa, index) => {
                            const taxaKey = resolveTaxaKey(taxa, index);
                            const dataEnvio = resolveDataEnvio(taxa, taxaKey);
                            return (
                            <TableRow key={`${taxaKey}-${tipo.key}`}>
                              <TableCell className="font-medium">{taxa.empresa}</TableCell>
                              <TableCell>
                                <StatusBadge status={taxa?.[tipo.key]} />
                              </TableCell>
                              <TableCell className="text-xs text-slate-700">
                                {tipo.key === "tpi"
                                  ? formatVencimentoCurto(getVencimentoTpi(taxa)) || "—"
                                  : taxa[`vencimento_${tipo.key}`] ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs text-slate-700">
                                {formatDataEnvio(dataEnvio) || "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={taxa?.status_geral} />
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {taxa.municipio || "—"}
                              </TableCell>
                            </TableRow>
                          )})}
                          {registros.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-sm text-slate-500">
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
      )}

      {envioModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Data de Envio
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                {envioModal.taxa?.empresa || "Empresa"}
              </h3>
            </div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Data de Envio
            </label>
            <input
              type="date"
              value={envioDraft}
              onChange={(event) => setEnvioDraft(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 shadow-inner focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {envioError && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {envioError}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEnvioModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEnvio}
                disabled={envioSaving}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {envioSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaxasScreen;
