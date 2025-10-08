import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { TAXA_ALERT_KEYS, TAXA_COLUMNS, TAXA_SEARCH_KEYS } from "@/lib/constants";
import { isAlertStatus } from "@/lib/status";

function TaxasScreen({ taxas, modoFoco, matchesMunicipioFilter, matchesQuery }) {
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
        return matchesQuery(camposPesquisa);
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

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                {TAXA_COLUMNS.map(({ key, label }) => (
                  <TableHead key={key}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxasVisiveis.map((taxa, index) => (
                <TableRow key={`${taxa.empresa_id ?? taxa.empresa}-${index}`}>
                  <TableCell className="font-medium">{taxa.empresa}</TableCell>
                  {TAXA_COLUMNS.map(({ key }) => (
                    <TableCell key={key}>
                      <StatusBadge status={taxa?.[key]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default TaxasScreen;
