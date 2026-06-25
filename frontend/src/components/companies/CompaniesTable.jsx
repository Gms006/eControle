import React from "react";
import { ChevronDown, ChevronRight, ExternalLink, File, Mail, MapPin, PencilLine, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItemFancy, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/Chip";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { openCartaoCNPJ, openPortalPrefeitura } from "@/lib/quickLinks";

export default function CompaniesTable({
  filteredRows,
  handleCopy,
  toast,
  canManageEmpresas,
  openOverviewEmpresa,
  openEditEmpresa,
  ensureCNDs,
  resolveCompanyLegalName,
  resolveCompanyTradeName,
  companyDocumentValue,
  CopyOnlyValue,
  statusChipClass,
  isCompanyActive,
  valueChipClass,
  riskChipVariant,
  formatRiskLabel,
  formatScoreStatusLabel,
  CertificadoIcon,
}) {
  return (
    <CardWrapper>
      <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 text-center backdrop-blur">Empresa</TableHead>
              <TableHead className="sticky top-0 z-10 w-[180px] whitespace-nowrap bg-slate-100/95 backdrop-blur">Documento</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Município</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Porte</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Status</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Risco</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Score</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Certificado</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">Pendências</TableHead>
              <TableHead className="sticky top-0 z-10 bg-slate-100/95 text-right backdrop-blur">Ações</TableHead>
              <TableHead className="sticky top-0 z-10 w-10 bg-slate-100/95 text-right backdrop-blur">Abrir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.rowKey} className="hover:shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]" data-testid="company-card">
                <TableCell className="min-w-[290px] text-left align-top">
                  <div className="space-y-1 text-left">
                    <CopyableCompanyName value={resolveCompanyLegalName(row.empresa)} onCopy={handleCopy} size="sm" className="w-full justify-start text-left text-primary" />
                    {resolveCompanyTradeName(row.empresa) ? <p className="text-xs text-slate-400">{resolveCompanyTradeName(row.empresa)}</p> : null}
                  </div>
                </TableCell>
                <TableCell className="w-[180px] whitespace-nowrap">
                  <CopyOnlyValue value={companyDocumentValue(row.empresa)} onCopy={handleCopy} />
                </TableCell>
                <TableCell><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{row.municipioNormalized}</span></TableCell>
                <TableCell>{row.porte || "-"}</TableCell>
                <TableCell>
                  <Chip className={statusChipClass(isCompanyActive(row.empresa))}>
                    {isCompanyActive(row.empresa) ? "Ativa" : "Inativa"}
                  </Chip>
                </TableCell>
                <TableCell data-testid="company-risk-badge"><Chip className={valueChipClass} variant={riskChipVariant(row.riscoConsolidado)}>{formatRiskLabel(row.riscoConsolidado)}</Chip></TableCell>
                <TableCell data-testid="company-score-value">
                  <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-sm font-semibold text-white">
                    {Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}
                  </div>
                  <div data-testid="company-score-status" className="mt-1 text-[11px] text-slate-500">{formatScoreStatusLabel(row.scoreStatus, row.hasUsefulCnae)}</div>
                </TableCell>
                <TableCell><span className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1"><CertificadoIcon bucket={row.certBucket} /></span></TableCell>
                <TableCell><Chip className={valueChipClass} variant={row.taxaPendencias > 0 ? "warning" : "neutral"}>{row.taxaPendencias}</Chip></TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800">
                        Ações <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
                      {canManageEmpresas ? <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(row.empresa)} /> : null}
                      {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} /> : null}
                      <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
                      {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
                      {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
                      {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} /> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} data-testid="company-open-button" title="Abrir central">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardWrapper>
  );
}

function CardWrapper({ children }) {
  return <Card className="overflow-hidden border-subtle bg-card" data-testid="companies-grid">{children}</Card>;
}
