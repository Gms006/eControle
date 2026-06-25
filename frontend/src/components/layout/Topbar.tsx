// @ts-nocheck
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Database,
  Filter,
  Search,
  SlidersHorizontal,
  Star,
  UserRound,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type AppTabKey, type NavItem } from "@/lib/theme";
import NotificationsButton from "@/components/notifications/NotificationsButton";
import AdvancedFiltersDrawer from "@/components/layout/AdvancedFiltersDrawer";
import FilterToggleChip from "@/components/filters/FilterToggleChip";

type SearchFieldOption = { key: string; label: string };

type HeaderContext = {
  breadcrumb: string;
  title: string;
  subtitle: string;
};

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
  onReload,
  onNotificationRouteNavigate,
  actions,
  panelHeaderStats,
  headerContext,
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
  onReload: () => void;
  onNotificationRouteNavigate?: (routePath: string) => void;
  actions?: ReactNode;
  panelHeaderStats?: {
    datasets: string;
    filtro: string;
    alertas: string;
  };
  headerContext?: HeaderContext;
}) {
  const [openAdvancedFilters, setOpenAdvancedFilters] = useState(false);

  const activeItem = useMemo(
    () => items.find((item) => item.key === activeTab),
    [activeTab, items],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchField !== "all") count += 1;
    if (municipio && municipio !== "Todos") count += 1;
    if (somenteAlertas) count += 1;
    if (modoFoco) count += 1;
    return count;
  }, [modoFoco, municipio, searchField, somenteAlertas]);

  const heading = headerContext || {
    breadcrumb: "Painel / Hoje",
    title: activeItem?.label || "Painel",
    subtitle: activeItem?.description || "Visão operacional",
  };

  return (
    <header className="sticky top-0 z-40 border-b border-subtle bg-white/92 backdrop-blur">
      <div className="px-4 py-3 lg:px-6">
        <div className="ec-topbar-card">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[210px] pr-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{heading.breadcrumb}</p>
              <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">{heading.title}</h2>
              <p className="text-xs text-slate-500">{heading.subtitle}</p>
            </div>

            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="global-search-input"
                aria-label="Busca global"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
                placeholder="Pesquisar empresa, CNPJ, protocolo ou comando"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/90 pl-9 pr-16 text-slate-900 placeholder:text-slate-500 focus-visible:ring-brand-navy-soft"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Ctrl+K
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2 rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setOpenAdvancedFilters(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>

              {actions}

              <NotificationsButton onNotificationRouteNavigate={onNotificationRouteNavigate} />
              <Button size="icon" variant="secondary" title="Favoritos" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                <Star className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                title="Perfil e sessão"
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={onLogout}
              >
                <UserRound className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <FilterToggleChip
              label="Somente alertas"
              active={somenteAlertas}
              onClick={() => onSomenteAlertasChange(!somenteAlertas)}
            />
            <FilterToggleChip label="Modo foco" active={modoFoco} onClick={() => onModoFocoChange(!modoFoco)} />
            {municipio && municipio !== "Todos" ? (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Município: {municipio}
              </span>
            ) : null}
            {activeTab === "painel" && panelHeaderStats ? (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <QuickStat icon={<Database className="h-3.5 w-3.5" />} label="Dados" value={panelHeaderStats.datasets} />
                <QuickStat icon={<Filter className="h-3.5 w-3.5" />} label="Filtros" value={panelHeaderStats.filtro} />
                <QuickStat icon={<BellRing className="h-3.5 w-3.5" />} label="Alertas" value={panelHeaderStats.alertas} />
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto pt-2 lg:hidden">
            <div className="flex min-w-max gap-2">
              {items.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    data-testid={`nav-tab-${item.key}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                      isActive
                        ? "border-brand-navy/30 bg-brand-navy/10 text-brand-navy"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
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

      <AdvancedFiltersDrawer
        open={openAdvancedFilters}
        onClose={() => setOpenAdvancedFilters(false)}
        searchField={searchField}
        onSearchFieldChange={onSearchFieldChange}
        searchFieldOptions={searchFieldOptions}
        municipio={municipio}
        municipios={municipios}
        onMunicipioChange={onMunicipioChange}
        somenteAlertas={somenteAlertas}
        onSomenteAlertasChange={onSomenteAlertasChange}
        modoFoco={modoFoco}
        onModoFocoChange={onModoFocoChange}
        onReload={onReload}
        onLogout={onLogout}
      />
    </header>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
      <span className="text-slate-500">{icon}</span>
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="text-slate-800">{value}</span>
    </span>
  );
}
