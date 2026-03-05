import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import CopyableIdentifier from "@/components/CopyableIdentifier";
import { Chip } from "@/components/Chip";
import { TAXA_ALERT_KEYS, TAXA_COLUMNS, TAXA_SEARCH_KEYS } from "@/lib/constants";
import { getStatusKey, hasRelevantStatus, isAlertStatus } from "@/lib/status";
import { ResumoTipoCardTaxa } from "@/components/ResumoTipoCard";
import { BriefcaseBusiness, FileCheck2, PencilLine, Receipt } from "lucide-react";
import { getDataEnvioDisplay, isEnvioPendente, isTaxStatusEmAberto, isTaxStatusPendente } from "@/lib/taxes";
import { isInstallmentInProgress } from "@/lib/installment";

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

const WORK_QUEUE_ITEMS = [
  { key: "em_aberto", label: "Em aberto" },
  { key: "vencidas", label: "Vencidas/Atrasadas" },
  { key: "vence_7_dias", label: "Vence em <=7 dias" },
  { key: "sem_status", label: "Sem status" },
  { key: "isentas", label: "Isentas" },
  { key: "parcelado_andamento", label: "Parcelado em andamento" },
  { key: "envio_pendente", label: "Envio pendente" },
];

const TAX_SORT_OPTIONS = [
  { value: "empresa_asc", label: "Empresa (A-Z)" },
  { value: "empresa_desc", label: "Empresa (Z-A)" },
  { value: "status_asc", label: "Status (A-Z)" },
  { value: "vencimento_asc", label: "Vencimento (mais próximo)" },
  { value: "vencimento_desc", label: "Vencimento (mais distante)" },
  { value: "envio_desc", label: "Último envio (mais recente)" },
];

const TAX_LINE_ITEMS = [
  { key: "tpi", label: "TPI", getVencimento: (taxa) => getVencimentoTpi(taxa) },
  { key: "publicidade", label: "PUBLICIDADE" },
  { key: "localizacao_instalacao", label: "LOCALIZAÇÃO/INSTALAÇÃO" },
  { key: "bombeiros", label: "BOMBEIROS" },
  { key: "func", label: "FUNCIONAMENTO" },
  { key: "sanitaria", label: "SANITÁRIA" },
  { key: "area_publica", label: "ÁREA PÚBLICA" },
];

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
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

const getVencimentoTpi = (taxa) =>
  taxa?.vencimento_tpi ?? taxa?.vencimentoTpi ?? taxa?.tpi_vencimento ?? taxa?.vencimento;

const resolveTaxaKey = (taxa, index) =>
  taxa?.id ?? taxa?.taxa_id ?? taxa?.empresa_id ?? taxa?.empresa ?? index;

const getQueueStatusFields = (taxa) => [
  taxa?.tpi,
  taxa?.func,
  taxa?.publicidade,
  taxa?.sanitaria,
  taxa?.localizacao_instalacao,
  taxa?.area_publica,
  taxa?.bombeiros,
  taxa?.iss,
  taxa?.taxa_funcionamento,
  taxa?.taxa_publicidade,
  taxa?.taxa_vig_sanitaria,
  taxa?.taxa_localiz_instalacao,
  taxa?.taxa_ocup_area_publica,
  taxa?.taxa_bombeiros,
];

const hasAnyStatus = (taxa, tipoKeys) => tipoKeys.some((key) => hasRelevantStatus(taxa?.[key]));

const hasAnyEmAberto = (taxa) => getQueueStatusFields(taxa).some((value) => isTaxStatusEmAberto(value));

const hasAnyIsenta = (taxa) => getQueueStatusFields(taxa).some((value) => getStatusKey(value) === "isento");
const hasAnyInstallmentInProgress = (taxa) =>
  getQueueStatusFields(taxa).some((value) => isInstallmentInProgress(value));

const getTpiDiffDays = (taxa) => {
  const ts = parseSortableDate(getVencimentoTpi(taxa));
  if (ts === null) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.floor((ts - base) / 86400000);
};

const matchesQueueFilter = (taxa, queueFilter, tipoKeys) => {
  if (!queueFilter) return true;
  if (queueFilter === "em_aberto") return hasAnyEmAberto(taxa);
  if (queueFilter === "vencidas") {
    const diff = getTpiDiffDays(taxa);
    return typeof diff === "number" && diff < 0;
  }
  if (queueFilter === "vence_7_dias") {
    const diff = getTpiDiffDays(taxa);
    return typeof diff === "number" && diff >= 0 && diff <= 7;
  }
  if (queueFilter === "sem_status") return !hasAnyStatus(taxa, tipoKeys);
  if (queueFilter === "isentas") return hasAnyIsenta(taxa);
  if (queueFilter === "parcelado_andamento") return hasAnyInstallmentInProgress(taxa);
  if (queueFilter === "envio_pendente") return Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
  return true;
};

function LinhaTipoTaxa({ label, status, vencimento, envioPendente }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle py-1.5 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {hasRelevantStatus(status) ? (
          <StatusBadge status={status} />
        ) : (
          <Chip variant="outline">Sem status</Chip>
        )}
        {vencimento ? (
          <Chip variant="outline" className="text-[11px]">
            Venc.: {formatVencimentoCurto(vencimento)}
          </Chip>
        ) : null}
        {envioPendente && (isTaxStatusEmAberto(status) || isTaxStatusPendente(status)) ? (
          <Chip variant="warning" className="text-[11px]">
            Envio pendente
          </Chip>
        ) : null}
      </div>
    </div>
  );
}

function TaxasScreen({ taxas, modoFoco, soAlertas, matchesMunicipioFilter, matchesQuery, handleCopy }) {
  const [viewMode, setViewMode] = useState("empresas");
  const [selectedTipo, setSelectedTipo] = useState("__ALL__");
  const [queueFilter, setQueueFilter] = useState(null);
  const [sortByTipo, setSortByTipo] = useState({});

  const taxaTipos = useMemo(
    () => TAXA_COLUMNS.filter((column) => column.key !== "status_geral"),
    [],
  );
  const tipoKeys = useMemo(() => taxaTipos.map((tipo) => tipo.key), [taxaTipos]);

  const filteredTaxas = useMemo(
    () =>
      taxas.filter((taxa) => {
        if (!matchesMunicipioFilter(taxa)) return false;
        const camposPesquisa = [taxa.empresa, taxa.cnpj, ...TAXA_SEARCH_KEYS.map((key) => taxa?.[key])];
        return matchesQuery(camposPesquisa, {
          nome: [taxa.empresa],
          razao: [taxa.empresa],
          cnpj: [taxa.cnpj],
        });
      }),
    [matchesMunicipioFilter, matchesQuery, taxas],
  );

  const alertFilterActive = Boolean(modoFoco || soAlertas);

  const taxasGlobais = useMemo(() => {
    if (!alertFilterActive) return filteredTaxas;
    return filteredTaxas.filter((taxa) => TAXA_ALERT_KEYS.some((key) => isAlertStatus(taxa?.[key])));
  }, [alertFilterActive, filteredTaxas]);

  const queueCounts = useMemo(
    () =>
      Object.fromEntries(
        WORK_QUEUE_ITEMS.map((item) => [
          item.key,
          taxasGlobais.filter((taxa) => matchesQueueFilter(taxa, item.key, tipoKeys)).length,
        ]),
      ),
    [taxasGlobais, tipoKeys],
  );

  const taxasVisiveis = useMemo(
    () => taxasGlobais.filter((taxa) => matchesQueueFilter(taxa, queueFilter, tipoKeys)),
    [queueFilter, taxasGlobais, tipoKeys],
  );

  const taxaTipoStats = useMemo(
    () =>
      taxaTipos.map((column) => {
        const registrosComStatus = taxasVisiveis.filter((taxa) => hasRelevantStatus(taxa?.[column.key]));
        const alertas = registrosComStatus.filter((taxa) => isAlertStatus(taxa?.[column.key])).length;
        const ok = Math.max(registrosComStatus.length - alertas, 0);
        const semStatus = Math.max(taxasVisiveis.length - registrosComStatus.length, 0);
        const envioPendente = taxasVisiveis.filter((taxa) => {
          const pending = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
          return pending && isTaxStatusEmAberto(taxa?.[column.key]);
        }).length;
        return {
          ...column,
          total: registrosComStatus.length,
          alertas,
          ok,
          semStatus,
          envioPendente,
        };
      }),
    [taxaTipos, taxasVisiveis],
  );

  useEffect(() => {
    if (selectedTipo === "__ALL__") return;
    const exists = taxaTipos.some((tipo) => tipo.key === selectedTipo);
    if (!exists) setSelectedTipo("__ALL__");
  }, [selectedTipo, taxaTipos]);

  const tiposSelecionados =
    selectedTipo === "__ALL__" ? taxaTipos : taxaTipos.filter((tipo) => tipo.key === selectedTipo);

  const openEditTaxa = (taxa) => {
    const taxId = taxa?.id ?? taxa?.taxa_id;
    if (!taxId) return;
    window.dispatchEvent(
      new CustomEvent("econtrole:open-tax", {
        detail: { mode: "edit", taxId, taxa },
      }),
    );
  };

  const applySort = (registros, tipoKey, sortValue) => {
    const base = [...registros];
    const [field, direction] = String(sortValue || "empresa_asc").split("_");
    const factor = direction === "desc" ? -1 : 1;

    const getValue = (taxa) => {
      if (field === "empresa") return String(taxa?.empresa || "");
      if (field === "status") return String(taxa?.[tipoKey] || "");
      if (field === "vencimento") return parseSortableDate(getVencimentoTpi(taxa)) ?? Number.MAX_SAFE_INTEGER;
      if (field === "envio") return parseSortableDate(getDataEnvioDisplay(taxa?.data_envio).date) ?? 0;
      return String(taxa?.empresa || "");
    };

    base.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb)) * factor;
    });
    return base;
  };

  return (
    <div className="space-y-3">
      <Card className="border-subtle bg-surface">
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-xl border border-subtle bg-card p-1">
              <button
                type="button"
                onClick={() => setViewMode("empresas")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${viewMode === "empresas" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              >
                Por empresa
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tipos")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${viewMode === "tipos" ? "bg-slate-900 text-white" : "text-slate-600"}`}
              >
                Por tipo
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {alertFilterActive ? <Chip variant="warning">Somente alertas</Chip> : null}
              <Chip variant="outline">
                {taxasVisiveis.length} de {taxas.length} registros
              </Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORK_QUEUE_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setQueueFilter((prev) => (prev === item.key ? null : item.key))}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${queueFilter === item.key ? "border-blue-200 bg-blue-50 text-blue-800" : "border-subtle bg-card text-slate-600"}`}
              >
                {item.label}
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px]">
                  {queueCounts[item.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {viewMode === "empresas" ? (
        taxasVisiveis.length === 0 ? (
          <Card className="border-subtle bg-card">
            <CardContent className="p-6 text-center text-sm text-muted">Nenhuma taxa correspondente ao filtro.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {taxasVisiveis.map((taxa, index) => {
              const taxaKey = resolveTaxaKey(taxa, index);
              const envio = getDataEnvioDisplay(taxa?.data_envio);
              const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
              return (
                <Card key={taxaKey} className="border-subtle bg-card transition hover:border-strong hover:shadow-card-hover">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-sm font-semibold text-primary">{taxa.empresa || "—"}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          {taxa.cnpj && handleCopy ? (
                            <CopyableIdentifier label="CNPJ" value={taxa.cnpj} onCopy={handleCopy} />
                          ) : null}
                          <span>• {taxa.municipio || "—"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <Chip variant="outline">Último envio: {envio.date || "—"}</Chip>
                          <Chip variant={envio.methodLabel ? "neutral" : "outline"}>
                            {envio.methodLabel || "Sem método"}
                          </Chip>
                          {envioPendente ? <Chip variant="warning">Envio pendente</Chip> : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {taxa.status_geral ? <StatusBadge status={taxa.status_geral} /> : <Chip variant="outline">Sem status</Chip>}
                        <button
                          type="button"
                          onClick={() => openEditTaxa(taxa)}
                          data-testid="tax-edit-button"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <PencilLine className="h-3 w-3" />
                          Editar
                        </button>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {TAX_LINE_ITEMS.map((item) => (
                        <LinhaTipoTaxa
                          key={`${taxaKey}-${item.key}`}
                          label={item.label}
                          status={taxa?.[item.key]}
                          vencimento={item.getVencimento ? item.getVencimento(taxa) : null}
                          envioPendente={envioPendente}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {taxaTipoStats.map((tipo) => {
              const IconComponent = TAXA_ICON_COMPONENTS[tipo.key] || Receipt;
              const colorClasses = TAXA_ICON_COLORS[tipo.key] || "bg-slate-100 text-slate-700";
              const active = selectedTipo === tipo.key;
              return (
                <button
                  key={tipo.key}
                  type="button"
                  onClick={() => setSelectedTipo((prev) => (prev === tipo.key ? "__ALL__" : tipo.key))}
                  className={`rounded-2xl text-left transition ${active ? "ring-2 ring-blue-300" : ""}`}
                >
                  <ResumoTipoCardTaxa
                    tipo={tipo.label}
                    total={tipo.total}
                    icon={IconComponent}
                    corClasse={colorClasses}
                    stats={{
                      ok: tipo.ok,
                      alerta: tipo.alertas,
                      semStatus: tipo.semStatus,
                      envioPendente: tipo.envioPendente,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <Card className="border-subtle bg-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedTipo === "__ALL__" ? "default" : "secondary"}
                  onClick={() => setSelectedTipo("__ALL__")}
                >
                  Todos
                </Button>
                {taxaTipoStats.map((tipo) => (
                  <Button
                    key={tipo.key}
                    size="sm"
                    variant={selectedTipo === tipo.key ? "default" : "secondary"}
                    onClick={() => setSelectedTipo(tipo.key)}
                  >
                    {tipo.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted">Ordenar por:</span>
                <Select
                  value={sortByTipo[selectedTipo] || "empresa_asc"}
                  onValueChange={(value) => setSortByTipo((prev) => ({ ...prev, [selectedTipo]: value }))}
                >
                  <SelectTrigger className="h-9 w-[220px]">
                    <SelectValue placeholder="Ordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {tiposSelecionados.map((tipo) => {
            const rows = applySort(
              taxasVisiveis.map((taxa, index) => ({ ...taxa, __taxa_key: resolveTaxaKey(taxa, index) })),
              tipo.key,
              sortByTipo[selectedTipo] || "empresa_asc",
            );
            return (
              <Card key={tipo.key} className="border-subtle bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {tipo.label} <span className="text-sm font-normal text-muted">({rows.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[420px]">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-slate-100/70">
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Último envio</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Fila</TableHead>
                          <TableHead>Município</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((taxa) => {
                          const envio = getDataEnvioDisplay(taxa?.data_envio);
                          const envioPendente = Boolean(taxa?.envio_pendente) || isEnvioPendente(taxa);
                          const status = taxa?.[tipo.key];
                          return (
                            <TableRow key={`${taxa.__taxa_key}-${tipo.key}`}>
                              <TableCell className="font-medium">{taxa.empresa || "—"}</TableCell>
                              <TableCell>
                                {hasRelevantStatus(status) ? (
                                  <StatusBadge status={status} />
                                ) : (
                                  <Chip variant="outline">Sem status</Chip>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-slate-700">
                                {tipo.key === "tpi" ? formatVencimentoCurto(getVencimentoTpi(taxa)) || "—" : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-slate-700">{envio.date || "—"}</TableCell>
                              <TableCell>
                                {envio.methodLabel ? <Chip variant="neutral">{envio.methodLabel}</Chip> : <Chip variant="outline">Sem método</Chip>}
                              </TableCell>
                              <TableCell>
                                {envioPendente ? <Chip variant="warning" title={taxa?.motivo_envio_pendente || undefined}>Envio pendente</Chip> : <Chip variant="outline">—</Chip>}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">{taxa.municipio || "—"}</TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openEditTaxa(taxa)}
                                  data-testid="tax-edit-button"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                  <PencilLine className="h-3 w-3" />
                                  Editar
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-sm text-slate-500">
                              Nenhum registro para este tipo.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TaxasScreen;
