import React from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FilterToggleChip from "@/components/filters/FilterToggleChip";

export default function AdvancedFiltersDrawer({
  open,
  onClose,
  searchField,
  onSearchFieldChange,
  searchFieldOptions,
  municipio,
  municipios,
  onMunicipioChange,
  somenteAlertas,
  onSomenteAlertasChange,
  modoFoco,
  onModoFocoChange,
  onReload,
  onLogout,
}) {
  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      subtitle="Filtros globais"
      title="Refinar listagens"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-subtle"
            onClick={() => {
              onSearchFieldChange("all");
              onMunicipioChange("Todos");
              onSomenteAlertasChange(false);
              onModoFocoChange(false);
            }}
          >
            Limpar filtros
          </Button>
          <Button type="button" variant="secondary" onClick={onReload}>
            <RefreshCw className="mr-2 h-4 w-4" /> Recarregar dados
          </Button>
          <Button type="button" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="search-field" className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Buscar em
          </Label>
          <Select value={searchField} onValueChange={onSearchFieldChange}>
            <SelectTrigger id="search-field" className="h-10 rounded-xl border-subtle bg-card">
              <SelectValue placeholder="Campo" />
            </SelectTrigger>
            <SelectContent>
              {searchFieldOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="municipio-field" className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Município
          </Label>
          <Select value={municipio} onValueChange={onMunicipioChange}>
            <SelectTrigger id="municipio-field" className="h-10 rounded-xl border-subtle bg-card">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {(municipios || []).map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Modos</p>
          <div className="flex flex-wrap gap-2">
            <FilterToggleChip
              label="Somente alertas"
              active={somenteAlertas}
              onClick={() => onSomenteAlertasChange(!somenteAlertas)}
            />
            <FilterToggleChip
              label="Modo foco"
              active={modoFoco}
              onClick={() => onModoFocoChange(!modoFoco)}
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  );
}
