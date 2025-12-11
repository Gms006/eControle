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
import { Receipt, FileCheck2, BriefcaseBusiness } from "lucide-react";
import { Chip } from "@/components/Chip";

const TAXA_ICON_COMPONENTS = {
  tpi: Receipt,
  taxa_funcionamento: FileCheck2,
  taxa_publicidade: BriefcaseBusiness,
};

const TAXA_ICON_COLORS = {
  tpi: "bg-indigo-100 text-indigo-700",
  taxa_funcionamento: "bg-blue-100 text-blue-700",
  taxa_publicidade: "bg-amber-100 text-amber-700",
};

function formatVencimentoCurto(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // fallback: se não for uma data válida, retorna o valor original
    return value;
  }
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
}

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
                const vencimentoTpi = getVencimentoTpi(taxa);

                return (
                  <div
                    key={`${taxa.empresa_id ?? taxa.empresa}-${index}`}
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
                          {taxa.data_envio && (
                            <Chip className="text-[11px]">Último envio: {taxa.data_envio}</Chip>
                          )}
                        </div>
                      </div>
                      {taxa.status_geral && (
                        <StatusBadge status={taxa.status_geral} />
                      )}
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
              const registros = taxasVisiveis
                .filter((taxa) => hasRelevantStatus(taxa?.[tipo.key]))
                .filter((taxa) => (modoFoco ? isAlertStatus(taxa?.[tipo.key]) : true))
                .sort((a, b) => (a?.empresa || "").localeCompare(b?.empresa || ""));

              return (
                <Card key={tipo.key} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {tipo.label}
                      <InlineBadge variant="outline" className="bg-white">
                        {registros.length}
                      </InlineBadge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[420px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Status</TableHead>
                            {tipo.key === "tpi" && <TableHead>Vencimento</TableHead>}
                            <TableHead>Status geral</TableHead>
                            <TableHead>Município</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registros.map((taxa, index) => (
                            <TableRow key={`${taxa.empresa_id ?? taxa.empresa}-${tipo.key}-${index}`}>
                              <TableCell className="font-medium">{taxa.empresa}</TableCell>
                              <TableCell>
                                <StatusBadge status={taxa?.[tipo.key]} />
                              </TableCell>
                              {tipo.key === "tpi" && (
                                <TableCell className="text-xs text-slate-700">
                                  {formatVencimentoCurto(getVencimentoTpi(taxa)) || "—"}
                                </TableCell>
                              )}
                              <TableCell>
                                <StatusBadge status={taxa?.status_geral} />
                              </TableCell>
                              <TableCell className="text-xs text-slate-600">
                                {taxa.municipio || "—"}
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
      )}
    </div>
  );
}

export default TaxasScreen;
