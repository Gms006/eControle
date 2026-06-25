import React, { useCallback, useEffect, useMemo } from "react";
import { Building2, FileText, Import } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompanyForm } from "@/hooks/useCompanyForm";
import { useProcessForm } from "@/hooks/useProcessForm";
import { useTaxForm } from "@/hooks/useTaxForm";
import { useReceitaWsBulkSync } from "@/hooks/useReceitaWsBulkSync";
import CompanyDrawer from "@/components/forms/CompanyDrawer";
import ProcessDrawer from "@/components/forms/ProcessDrawer";
import TaxDrawer from "@/components/forms/TaxDrawer";
import BulkSyncManager from "@/components/header/BulkSyncManager";
import { fetchJson } from "@/lib/api";

const EVT_OPEN_COMPANY = "econtrole:open-company";
const EVT_OPEN_PROCESS = "econtrole:open-process";
const EVT_OPEN_TAX = "econtrole:open-tax";
const EVT_REFRESH_DATA = "econtrole:refresh-data";

/**
 * @param {{ currentRoles?: Array<string | { name?: string }> }} [props]
 */
export default function HeaderMenuPro({ currentRoles } = {}) {
  const rolesRaw = Array.isArray(currentRoles) ? currentRoles : [];
  const roleNames = Array.isArray(rolesRaw)
    ? rolesRaw.map((r) => String(typeof r === "string" ? r : r?.name || "").toUpperCase()).filter(Boolean)
    : [];

  const isDevUser = roleNames.includes("DEV");
  const canWrite = useMemo(
    () => roleNames.includes("ADMIN") || roleNames.includes("DEV"),
    [roleNames],
  );

  const emitRefresh = useCallback((source) => {
    window.dispatchEvent(new CustomEvent(EVT_REFRESH_DATA, { detail: { source } }));
  }, []);

  const company = useCompanyForm({ apiJson: fetchJson, onRefresh: emitRefresh });
  const process = useProcessForm({ apiJson: fetchJson, onRefresh: emitRefresh });
  const tax = useTaxForm({ apiJson: fetchJson, onRefresh: emitRefresh });
  const bulk = useReceitaWsBulkSync({ isDevUser, onRefresh: emitRefresh });

  useEffect(() => {
    const onCompany = (e) => {
      const detail = e?.detail || {};
      company
        .openCompany({
          mode: detail.mode || "create",
          companyId: detail.companyId || null,
          cnpj: detail.cnpj || null,
          cpf: detail.cpf || null,
          initialTab: detail.initialTab || null,
        })
        .catch((error) => alert(error?.message || "Falha ao abrir edição da empresa."));
    };

    const onProcess = (e) => {
      const detail = e?.detail || {};
      process
        .openProcess({
          mode: detail.mode || "create",
          processId: detail.processId || null,
        })
        .catch((error) => alert(error?.message || "Falha ao abrir edição do processo."));
    };

    const onTax = (e) => {
      const detail = e?.detail || {};
      tax
        .openTax({
          mode: detail.mode || "edit",
          taxId: detail.taxId || null,
          taxa: detail.taxa || null,
        })
        .catch((error) => alert(error?.message || "Falha ao abrir edição de taxa."));
    };

    window.addEventListener(EVT_OPEN_COMPANY, onCompany);
    window.addEventListener(EVT_OPEN_PROCESS, onProcess);
    window.addEventListener(EVT_OPEN_TAX, onTax);

    return () => {
      window.removeEventListener(EVT_OPEN_COMPANY, onCompany);
      window.removeEventListener(EVT_OPEN_PROCESS, onProcess);
      window.removeEventListener(EVT_OPEN_TAX, onTax);
    };
  }, [company, process, tax]);

  const handleNew = (type) => {
    if (!canWrite) return;

    if (type === "empresa") {
      company.openCompany({ mode: "create" }).catch(console.error);
      return;
    }

    if (type === "processo") {
      process.openProcess({ mode: "create" }).catch(console.error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              title="Criar novo"
              className="rounded-lg border border-certhub-navy/30 bg-certhub-navy text-xs text-white hover:bg-opacity-90"
            >
              + Novo
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => handleNew("empresa")}>
              <Building2 className="mr-2 h-4 w-4" />
              Empresa
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => handleNew("processo")}>
              <FileText className="mr-2 h-4 w-4" />
              Processo
            </DropdownMenuItem>

            {isDevUser ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void bulk.requestOpen();
                }}
              >
                <Import className="mr-2 h-4 w-4" />
                Atualizar Cadastros em lote
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <BulkSyncManager bulk={bulk} />
      <CompanyDrawer state={company} />
      <ProcessDrawer state={process} />
      <TaxDrawer state={tax} />
    </div>
  );
}
