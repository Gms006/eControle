import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItemFancy, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/Chip";
import CompanyAvatar from "@/components/common/CompanyAvatar";
import CopyableCompanyName from "@/components/CopyableCompanyName";
import { ChevronRight, ExternalLink, File, FileText, Hash, Mail, MapPin, PencilLine, Phone } from "lucide-react";
import { openCartaoCNPJ, openPortalPrefeitura } from "@/lib/quickLinks";

export default function CompanyCard({
  row,
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
  CopyInlineValue,
  InfoTile,
  valueChipClass,
  riskChipVariant,
  formatRiskLabel,
  statusChipClass,
  isCompanyActive,
}) {
  return (
    <Card
      className="overflow-hidden border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-card-hover"
      data-testid="company-card"
    >
      <CardContent
        className="space-y-3 p-4"
        role="button"
        tabIndex={0}
        onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openOverviewEmpresa(row.empresa, row.empresaId);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyAvatar name={resolveCompanyLegalName(row.empresa)} seed={row.empresa?.id ?? companyDocumentValue(row.empresa)} className="h-10 w-10 rounded-xl text-sm" />
            <div className="min-w-0">
              <div
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <CopyableCompanyName value={resolveCompanyLegalName(row.empresa)} onCopy={handleCopy} size="base" className="w-full justify-start text-left text-primary" />
              </div>
              <p className="truncate text-xs text-slate-400">{resolveCompanyTradeName(row.empresa) || resolveCompanyLegalName(row.empresa)}</p>
            </div>
          </div>
          <div className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-slate-900 px-2 text-sm font-semibold text-white" data-testid="company-score-value">
            {Number.isFinite(row.scoreUrgencia) ? row.scoreUrgencia : "—"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoTile title="CNPJ" icon={FileText} value={<CopyOnlyValue value={companyDocumentValue(row.empresa)} onCopy={handleCopy} />} />
          <InfoTile title="Município" icon={MapPin} value={row.municipioNormalized} />
          <InfoTile title="Inscrição Estadual" icon={Hash} value={<CopyInlineValue value={row.empresa?.ie} onCopy={handleCopy} />} />
          <InfoTile title="Inscrição Municipal" icon={Hash} value={<CopyInlineValue value={row.empresa?.im} onCopy={handleCopy} />} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {row.empresa?.telefone ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-slate-900"
              title="Copiar telefone"
              onClick={(event) => {
                event.stopPropagation();
                handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`);
              }}
            >
              <Phone className="h-3.5 w-3.5" />
              {row.empresa.telefone}
            </button>
          ) : null}
          {row.empresa?.email ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-slate-900"
              title="Copiar e-mail"
              onClick={(event) => {
                event.stopPropagation();
                handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`);
              }}
            >
              <Mail className="h-3.5 w-3.5" />
              {row.empresa.email}
            </button>
          ) : null}
          {canManageEmpresas ? (
            <Button
              size="icon"
              variant="outline"
              className="ml-auto h-7 w-7 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              title="Editar empresa"
              data-testid="company-edit-button"
              onClick={(event) => {
                event.stopPropagation();
                openEditEmpresa(row.empresa);
              }}
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-md border-slate-800 bg-slate-900 px-2.5 text-xs text-white hover:bg-slate-800"
                onClick={(event) => event.stopPropagation()}
              >
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuItemFancy icon={ExternalLink} title="Abrir" description="Abrir central operacional da empresa" onClick={() => openOverviewEmpresa(row.empresa, row.empresaId)} />
              {canManageEmpresas ? <DropdownMenuItemFancy icon={PencilLine} title="Editar empresa" description="Abrir cadastro da empresa" onClick={() => openEditEmpresa(row.empresa)} /> : null}
              {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={ExternalLink} title="Cartão CNPJ" description="Abrir site da RFB" onClick={() => openCartaoCNPJ(row.empresa?.cnpj, toast)} /> : null}
              <DropdownMenuItemFancy icon={ExternalLink} title="Portal Prefeitura" description="Abrir portal da Prefeitura" onClick={() => openPortalPrefeitura(row.empresa?.municipio, toast)} />
              {row.empresa?.email ? <DropdownMenuItemFancy icon={Mail} title="Copiar e-mail" description={row.empresa.email} onClick={() => handleCopy(row.empresa.email, `E-mail copiado: ${row.empresa.email}`)} /> : null}
              {row.empresa?.telefone ? <DropdownMenuItemFancy icon={Phone} title="Copiar telefone" description={row.empresa.telefone} onClick={() => handleCopy(row.empresa.telefone, `Telefone copiado: ${row.empresa.telefone}`)} /> : null}
              {row.empresa?.cnpj ? <DropdownMenuItemFancy icon={File} title="Atualizar certidões" description="Buscar últimas CNDs" onClick={() => ensureCNDs(row.empresa?.cnpj, { force: true })} /> : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2">
            <Chip data-testid="company-risk-badge" className={valueChipClass} variant={riskChipVariant(row.riscoConsolidado)}>
              Risco {formatRiskLabel(row.riscoConsolidado)}
            </Chip>
            <Chip className={statusChipClass(isCompanyActive(row.empresa))}>
              {isCompanyActive(row.empresa) ? "Ativa" : "Inativa"}
            </Chip>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              data-testid="company-open-button"
              title="Abrir central"
              onClick={(event) => {
                event.stopPropagation();
                openOverviewEmpresa(row.empresa, row.empresaId);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
