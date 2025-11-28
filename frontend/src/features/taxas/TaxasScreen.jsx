import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InlineBadge from "@/components/InlineBadge";
import StatusBadge from "@/components/StatusBadge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TAXA_ALERT_KEYS, TAXA_COLUMNS, TAXA_SEARCH_KEYS } from "@/lib/constants";
import { hasRelevantStatus, isAlertStatus } from "@/lib/status";

function TaxasScreen({ taxas, modoFoco, matchesMunicipioFilter, matchesQuery }) {
  const [viewMode, setViewMode] = useState("empresas");
  const [selectedTipo, setSelectedTipo] = useState("__ALL__");

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
            <div className="grid gap-3 lg:grid-cols-2">
              {taxasVisiveis.map((taxa, index) => (
                <Card
                  key={`${taxa.empresa_id ?? taxa.empresa}-${index}`}
                  className="shadow-sm overflow-hidden border border-white/60"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 min-w-0">
                        <h3 className="text-base font-semibold leading-tight text-slate-800 truncate">
                          {taxa.empresa || "—"}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          {taxa.cnpj && (
                            <InlineBadge variant="outline" className="bg-white">
                              CNPJ: {taxa.cnpj}
                            </InlineBadge>
                          )}
                          {taxa.municipio && (
                            <InlineBadge variant="outline" className="bg-white">
                              Município: {taxa.municipio}
                            </InlineBadge>
                          )}
                          {taxa.data_envio && (
                            <InlineBadge variant="outline" className="bg-white">
                              Último envio: {taxa.data_envio}
                            </InlineBadge>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={taxa.status_geral} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {taxaTipos.map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                          <StatusBadge status={taxa?.[key]} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {taxaTipoStats.map((tipo) => (
              <Card key={tipo.key} className="shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{tipo.label}</span>
                    <InlineBadge className="bg-red-100 text-red-700 border-red-200">
                      Alertas {tipo.alertas}
                    </InlineBadge>
                  </div>
                  <div className="text-2xl font-semibold text-slate-800">
                    {tipo.total}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <InlineBadge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      OK {tipo.ok}
                    </InlineBadge>
                    <InlineBadge className="bg-red-100 text-red-700 border-red-200">
                      Alertas {tipo.alertas}
                    </InlineBadge>
                    <InlineBadge className="bg-slate-100 text-slate-700 border-slate-200">
                      Sem status {tipo.semStatus}
                    </InlineBadge>
                  </div>
                </CardContent>
              </Card>
            ))}
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
