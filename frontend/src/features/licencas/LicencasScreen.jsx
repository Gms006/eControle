import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Droplets,
  Shield,
  Building2,
  MapPin,
  Trees,
  Settings,
} from "lucide-react";
import { hasRelevantStatus, isAlertStatus, getStatusKey } from "@/lib/status";
import { normalizeText } from "@/lib/text";

const LIC_ICONS = {
  Sanitária: <Droplets className="h-4 w-4" />,
  CERCON: <Shield className="h-4 w-4" />,
  Funcionamento: <Building2 className="h-4 w-4" />,
  "Uso do Solo": <MapPin className="h-4 w-4" />,
  Ambiental: <Trees className="h-4 w-4" />,
};

const LIC_COLORS = {
  Sanitária: "border-sky-500 text-sky-700",
  CERCON: "border-indigo-500 text-indigo-700",
  Funcionamento: "border-blue-500 text-blue-700",
  "Uso do Solo": "border-amber-500 text-amber-700",
  Ambiental: "border-emerald-600 text-emerald-700",
};

export default function LicencasScreen(props) {
  const {
    filteredLicencas,
    tiposLicenca,
    selectedLicTipo,
    setSelectedLicTipo,
    tiposLicencaSelecionados,
    modoFoco,
  } = props;
  return (
    <>
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        {tiposLicenca.map((tipo) => {
          const items = filteredLicencas.filter(
            (lic) => normalizeText(lic?.tipo).trim() === tipo,
          );
          const venc = items.filter((item) => item.status === "Vencido").length;
          const soon = items.filter((item) => item.status === "Vence≤30d").length;
          const subj = items.filter((item) => item.status === "Sujeito").length;
          const disp = items.filter((item) => item.status === "Dispensa").length;
          const poss = Math.max(items.length - venc - soon - subj - disp, 0);
          const icon = LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
          const colorClasses = LIC_COLORS[tipo] || "border-slate-400 text-slate-700";
          return (
            <Card key={tipo} className="shadow-sm">
              <CardContent className={`p-4 rounded-xl border-l-4 ${colorClasses}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">{tipo}</div>
                    <div className="text-2xl font-semibold">{items.length}</div>
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
        {["Todos", ...tiposLicenca].map((tipo) => {
          const count = filteredLicencas.filter((lic) => {
            if (!hasRelevantStatus(lic.status)) {
              return false;
            }
            if (tipo === "Todos") {
              return true;
            }
            return normalizeText(lic?.tipo).trim() === tipo;
          }).length;
          const icon = tipo === "Todos" ? null : LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
          return (
            <Button
              key={tipo}
              size="sm"
              variant={tipo === selectedLicTipo ? "default" : "secondary"}
              onClick={() => setSelectedLicTipo(tipo)}
              className="inline-flex items-center gap-1"
            >
              {icon && <span className="opacity-80">{icon}</span>}
              {tipo}
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
          tiposLicencaSelecionados.map((tipo) => {
            const registros = filteredLicencas
              .filter((lic) => normalizeText(lic?.tipo).trim() === tipo)
              .filter((lic) => hasRelevantStatus(lic.status))
              .filter((lic) =>
                modoFoco
                  ? isAlertStatus(lic.status) || getStatusKey(lic.status).includes("sujeit")
                  : true,
              );
            const icon = LIC_ICONS[tipo] || <Settings className="h-4 w-4" />;
            return (
              <Card key={tipo} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="opacity-80">{icon}</span>
                    {tipo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[260px]">
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
                            <TableCell>{lic.validade || "—"}</TableCell>
                            <TableCell className="text-xs text-slate-600">{lic.obs || "—"}</TableCell>
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
  );
}
