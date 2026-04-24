// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  Bell,
  Database,
  Filter,
  LogOut,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  UserRound,
  BellRing,
} from "lucide-react";
import { Chip } from "@/components/Chip";
import { SideDrawer } from "@/components/ui/side-drawer";
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
import { cn } from "@/lib/utils";
import { type AppTabKey, type NavItem } from "@/lib/theme";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import {
  contarNotificacoesNaoLidas,
  listarNotificacoes,
  marcarNotificacaoComoLida,
} from "@/services/notifications";

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
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsLoadingMore, setNotificationsLoadingMore] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [notificationsOffset, setNotificationsOffset] = useState(0);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
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

  const loadUnreadCount = async () => {
    try {
      const payload = await contarNotificacoesNaoLidas();
      setUnreadCount(Number(payload?.unread_count || 0));
    } catch {
      // no-op: keep current value if endpoint is temporarily unavailable
    }
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsOffset(0);
    try {
      const payload = await listarNotificacoes({ limit: 100, offset: 0 });
      setNotifications(Array.isArray(payload?.items) ? payload.items : []);
      setTotalUnread(Number(payload?.total || 0));
    } catch {
      setNotifications([]);
      setTotalUnread(0);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    setNotificationsLoadingMore(true);
    try {
      const nextOffset = notificationsOffset + 100;
      const payload = await listarNotificacoes({ limit: 100, offset: nextOffset });
      const newItems = Array.isArray(payload?.items) ? payload.items : [];
      setNotifications((prev) => [...prev, ...newItems]);
      setNotificationsOffset(nextOffset);
    } catch {
      // no-op
    } finally {
      setNotificationsLoadingMore(false);
    }
  };

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!openNotifications) return;
    void loadNotifications();
  }, [openNotifications]);

  useEffect(() => {
    const onOpenNotifications = () => setOpenNotifications(true);
    window.addEventListener("econtrole:open-notifications", onOpenNotifications);
    return () => window.removeEventListener("econtrole:open-notifications", onOpenNotifications);
  }, []);

  useEffect(() => {
    if (!openNotifications) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!notificationsRef.current?.contains(target)) {
        setOpenNotifications(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openNotifications]);

  const handleMarkRead = async (item: any) => {
    if (!item?.id) return;
    try {
      await marcarNotificacaoComoLida(item.id);
      setNotifications((prev) =>
        prev.map((entry) => (entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // no-op
    }
  };

  const handleOpenNotification = async (item: any) => {
    if (!item) return;
    if (!item.read_at) {
      await handleMarkRead(item);
    }
    if (item.route_path) {
      onNotificationRouteNavigate?.(item.route_path);
      setOpenNotifications(false);
    }
  };

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

              <div className="relative" ref={notificationsRef}>
                <Button
                  size="icon"
                  variant="secondary"
                  title="Notificações"
                  className="relative border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpenNotifications((prev) => !prev)}
                  data-testid="topbar-notifications-button"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span
                      className="absolute -right-2 -top-2 flex h-[21px] min-w-[21px] items-center justify-center rounded-full border border-white bg-rose-600 px-1 text-[11px] font-bold text-white"
                      data-testid="topbar-notifications-unread"
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </Button>
                <NotificationPanel
                  open={openNotifications}
                  loading={notificationsLoading}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkRead={handleMarkRead}
                  onNavigate={handleOpenNotification}
                  onLoadMore={loadMoreNotifications}
                  hasMore={notifications.length < totalUnread}
                  loadingMore={notificationsLoadingMore}
                  totalUnread={totalUnread}
                />
              </div>
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
            <FilterChip
              label="Somente alertas"
              active={somenteAlertas}
              onClick={() => onSomenteAlertasChange(!somenteAlertas)}
            />
            <FilterChip label="Modo foco" active={modoFoco} onClick={() => onModoFocoChange(!modoFoco)} />
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

      <SideDrawer
        open={openAdvancedFilters}
        onClose={() => setOpenAdvancedFilters(false)}
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
              <FilterChip
                label="Somente alertas"
                active={somenteAlertas}
                onClick={() => onSomenteAlertasChange(!somenteAlertas)}
              />
              <FilterChip
                label="Modo foco"
                active={modoFoco}
                onClick={() => onModoFocoChange(!modoFoco)}
              />
            </div>
          </div>
        </div>
      </SideDrawer>
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-soft",
        active
          ? "border-blue-300 bg-blue-50 text-blue-800"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
      onClick={onClick}
      aria-pressed={active}
    >
      <Chip variant={active ? "success" : "neutral"} size="sm" className="rounded-full px-1.5 py-0">
        {active ? "ON" : "OFF"}
      </Chip>
      {label}
    </button>
  );
}
