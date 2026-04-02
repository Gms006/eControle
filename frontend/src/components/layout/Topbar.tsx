// @ts-nocheck
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
 import {
   Bell,
   Filter,
   LogOut,
   RefreshCw,
   Search,
   SlidersHorizontal,
   Star,
   UserRound,
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
}) {
  const [openAdvancedFilters, setOpenAdvancedFilters] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
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
    try {
      const payload = await listarNotificacoes({ limit: 20, offset: 0 });
      setNotifications(Array.isArray(payload?.items) ? payload.items : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
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

  return (
    <header className="sticky top-0 z-40 border-b border-certhub-blue/60 bg-certhub-navy text-brand-navy-foreground backdrop-blur">
      <div className="px-4 py-3 lg:px-6">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="global-search-input"
                aria-label="Busca global"
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
                placeholder="Busca global: empresa, CNPJ, protocolo ou comando"
                className="h-11 rounded-2xl border-white/25 bg-white/95 pl-9 text-slate-900 placeholder:text-slate-500 focus-visible:ring-brand-navy-soft"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-2xl border-white/25 bg-white/10 text-white hover:bg-white/20"
              onClick={() => setOpenAdvancedFilters(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros avançados
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-brand-navy">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              {actions}
              <div className="relative" ref={notificationsRef}>
                <Button
                  size="icon"
                  variant="secondary"
                  title="Notificacoes"
                  className="relative border border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => setOpenNotifications((prev) => !prev)}
                  data-testid="topbar-notifications-button"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 ? (
                    <span
                      className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
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
                />
              </div>
              <Button size="icon" variant="secondary" title="Favoritos" className="border border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Star className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                title="Perfil e sessão"
                className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={onLogout}
              >
                <UserRound className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterChip
              label="Somente alertas"
              active={somenteAlertas}
              onClick={() => onSomenteAlertasChange(!somenteAlertas)}
            />
            <FilterChip label="Modo foco" active={modoFoco} onClick={() => onModoFocoChange(!modoFoco)} />
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
                    data-testid={`nav-tab-${item.key}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                      isActive
                        ? "border-white/30 bg-white/20 text-white"
                        : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20",
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
          ? "border-white/35 bg-white/20 text-white"
          : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20",
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
