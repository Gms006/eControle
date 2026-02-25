// @ts-nocheck
import type { ChangeEvent } from "react";
import { Bell, LogOut, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { BRAND_COLORS, type AppTabKey, type NavItem } from "@/lib/theme";

type SearchFieldOption = { key: string; label: string };

export default function Topbar({
  items,
  activeTab,
  onTabChange,
  query,
  onQueryChange,
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
  onLogout,
}: {
  items: NavItem[];
  activeTab: AppTabKey;
  onTabChange: (key: AppTabKey) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchField: string;
  onSearchFieldChange: (value: string) => void;
  searchFieldOptions: SearchFieldOption[];
  municipio: string;
  municipios: string[];
  onMunicipioChange: (value: string) => void;
  somenteAlertas: boolean;
  onSomenteAlertasChange: (value: boolean) => void;
  modoFoco: boolean;
  onModoFocoChange: (value: boolean) => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)]">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Buscar em
                </Label>
                <Select value={searchField} onValueChange={onSearchFieldChange}>
                  <SelectTrigger className="h-10 rounded-xl bg-white">
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

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Busca global
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="global-search-input"
                    value={query}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
                    placeholder="Empresa, CNPJ, protocolo ou comando (nome: ...)"
                    className="h-10 rounded-xl bg-white pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center xl:justify-end">
              <div className="min-w-[170px] space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Município
                </Label>
                <Select value={municipio} onValueChange={onMunicipioChange}>
                  <SelectTrigger className="h-10 rounded-xl bg-white">
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

              <ToggleCard
                label="Somente alertas"
                checked={somenteAlertas}
                onCheckedChange={onSomenteAlertasChange}
              />
              <ToggleCard label="Modo foco" checked={modoFoco} onCheckedChange={onModoFocoChange} />

              <div className="flex items-center justify-end gap-2">
                <Button size="icon" variant="secondary" title="Favoritos">
                  <Star className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" title="Notificações">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" title="Sair" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
                <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm md:flex">
                  <div
                    className="grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.blue} 100%)`,
                    }}
                  >
                    MC
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-slate-800">Maria Clara</div>
                    <div className="text-[11px] text-slate-500">Neto Contabilidade</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto lg:hidden">
            <div className="flex min-w-max gap-2">
              {items.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                      isActive
                        ? "border-blue-200 bg-blue-50 text-blue-800"
                        : "border-slate-200 bg-white text-slate-700",
                    )}
                    title={`Alt+${index + 1}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ToggleCard({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex h-10 min-w-[150px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn("text-[11px] font-semibold", checked ? "text-emerald-700" : "text-slate-500")}>
          {checked ? "ON" : "OFF"}
        </span>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}
