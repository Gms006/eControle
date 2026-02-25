import React, { useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  TimerReset,
  Crown,
} from "lucide-react";

const DEFAULT_NAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "certificados", label: "Certificados", icon: ShieldCheck },
  { key: "licencas", label: "Licenças", icon: FileText },
  { key: "taxas", label: "Taxas", icon: TimerReset },
  { key: "processos", label: "Processos", icon: CheckCircle2 },
  { key: "uteis", label: "Úteis", icon: MessageSquareText },
];

function Brand() {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Ícone da coroa: usa favicon, cai pro ícone do Lucide se der erro */}
      {failed ? (
        <Crown aria-label="eControle" className="h-8 w-8 text-white" />
      ) : (
        <img
          src="/favicons/crown/white/favicon.svg"
          alt="eControle"
          className="h-8 w-8"
          onError={() => setFailed(true)}
        />
      )}

      {/* Texto eControle em branco, pra contrastar no azul */}
      <div className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
        eControle
      </div>
    </div>
  );
}

/** Props esperadas:
 * tab, onTabChange
 * query, onQueryChange
 * searchField, onSearchFieldChange, searchFieldOptions
 * municipio, municipios, onMunicipioChange
 * somenteAlertas, onSomenteAlertasChange
 * modoFoco, onModoFocoChange
 */
export default function HeaderMenuPro({
  tab,
  onTabChange,
  navItems,
  query,
  onQueryChange,
  searchField = "all",
  onSearchFieldChange,
  searchFieldOptions = [],
  municipio,
  municipios,
  onMunicipioChange,
  somenteAlertas,
  onSomenteAlertasChange,
  modoFoco,
  onModoFocoChange,
}) {
  const resolvedNavItems = Array.isArray(navItems) && navItems.length > 0 ? navItems : DEFAULT_NAV_ITEMS;

  // Atalho Ctrl/Cmd + K para focar no input
  useEffect(() => {
    const onKey = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        String(e.key).toLowerCase() === "k"
      ) {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    if (import.meta.env.DEV) {
      if (resolvedNavItems === DEFAULT_NAV_ITEMS) {
        const keys = DEFAULT_NAV_ITEMS.map((n) => n.key);
        console.assert(
          JSON.stringify(keys) ===
            JSON.stringify([
              "painel",
              "empresas",
              "certificados",
              "licencas",
              "taxas",
              "processos",
              "uteis",
            ]),
          "[HeaderMenuPro] Ordem inesperada"
        );
      }
      console.assert(
        Array.isArray(municipios) && municipios.includes("Todos"),
        "[HeaderMenuPro] municipios deve conter 'Todos'"
      );
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [municipios, resolvedNavItems]);

  // Botão “+ Novo” é decorativo por enquanto
  const handleNew = (type) => console.log(`[Novo] criar ${type}`);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#22489c]/80 backdrop-blur supports-[backdrop-filter]:bg-[#22489c]/70">
      <div className="max-w-[1400px] mx-auto px-4">
        {/* Linha 1: marca + busca + ações + perfil */}
        <div className="h-16 flex items-center gap-3">
          <Brand />

          {/* Busca global */}
          <div className="flex-1">
            <div className="relative flex items-end gap-3">
              <div className="flex w-36 md:w-40 flex-col gap-1">
                <Label className="text-[11px] text-slate-100">
                  Pesquisar por
                </Label>
                <Select
                  value={searchField}
                  onValueChange={onSearchFieldChange}
                >
                  <SelectTrigger className="h-9 rounded-lg border border-slate-200 bg-white/80 px-3 text-[13px] shadow-sm">
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
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-350" />
                <Input
                  id="global-search-input"
                  placeholder="Buscar: Empresa, CNPJ ou comando (ex.: nome: Silva)  (Ctrl/Cmd + K)"
                  value={query}
                  onChange={(e) => onQueryChange?.(e.target.value)}
                  className="pl-8 bg-white/90"
                />
              </div>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  title="Criar novo"
                >
                  + Novo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() => handleNew("empresa")}
                >
                  <Building2 className="h-4 w-4 mr-2" /> Empresa
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleNew("processo")}
                >
                  <FileText className="h-4 w-4 mr-2" /> Processo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="secondary"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              title="Favoritos"
            >
              <Star className="h-4 w-4" />
            </Button>
          </div>

          {/* Perfil */}
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur px-2 py-1">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 grid place-items-center text-white text-xs font-semibold">
              MC
            </div>
            <div className="hidden md:block leading-tight text-white">
              <div className="text-xs font-medium">Maria Clara</div>
              <div className="text-[10px] text-slate-200">
                Neto Contabilidade
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-slate-100" />
          </div>
        </div>

        {/* Linha 2: navegação + filtros */}
        <div className="pb-3 -mt-1">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-y-2 lg:gap-y-1.5 gap-x-1">
            <Tabs
              value={tab}
              onValueChange={onTabChange}
              className="w-full lg:flex-1 min-w-0"
            >
              <TabsList className="flex w-full flex-nowrap items-stretch gap-1 overflow-x-auto lg:overflow-visible">
                {resolvedNavItems.map(
                  ({ key, label, icon: Icon }, index) => (
                    <TabsTrigger
                      key={key}
                      value={key}
                      data-testid={`nav-tab-${key}`}
                      className="gap-2 whitespace-nowrap lg:flex-1 lg:basis-0 lg:justify-center"
                      data-tab-target={key}
                      title={`Alt+${index + 1} para abrir | Alt+↑ para topo`}
                    >
                      <Icon
                        className="h-[15px] w-[15px] shrink-0"
                        aria-hidden
                      />{" "}
                      {label}
                    </TabsTrigger>
                  )
                )}
              </TabsList>
                {resolvedNavItems.map(({ key }) => (
                  <TabsContent key={key} value={key} />
                ))}
            </Tabs>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-y-2 sm:gap-y-0 sm:gap-x-1">
              {/* Municípios */}
              <div className="w-36 md:w-44 xl:w-45 shrink-0">
                <Label className="text-[11px] text-slate-100 lg:inline xl:inline">
                  Município
                </Label>
                <Select
                  value={municipio}
                  onValueChange={onMunicipioChange}
                >
                  <SelectTrigger className="h-8 px-2 text-[13px] bg-white/80">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios?.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Somente alertas */}
              <div className="inline-flex items-center gap-0.5 rounded-md border border-white/20 px-2 py-2 bg-white/10 backdrop-blur shrink-0 min-w-[160px] justify-between">
                <Switch
                  checked={!!somenteAlertas}
                  onCheckedChange={onSomenteAlertasChange}
                  className="75"
                />
                <span className="text-xs font-medium text-slate-100 leading-tight">
                  Somente alertas
                </span>
                {somenteAlertas ? (
                  <span className="inline-flex items-center rounded-md bg-red-100 px-1 py-0.5 text-[10px] text-red-700 whitespace-nowrap">
                    <ShieldAlert className="mr-0.5 h-3 w-3" /> ON
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1 py-0.5 text-[10px] text-slate-700">
                    OFF
                  </span>
                )}
              </div>

              {/* Modo foco */}
              <div className="inline-flex items-center gap-0.5 rounded-md border border-white/20 px-2 py-2 bg-white/10 backdrop-blur shrink-0 min-w-[130px] justify-between">
                <Switch
                  checked={!!modoFoco}
                  onCheckedChange={onModoFocoChange}
                  className="75"
                />
                <span className="text-xs font-medium text-slate-100 leading-tight">
                  Modo foco
                </span>
                {modoFoco ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-100 px-1 py-0.5 text-[10px] text-emerald-700 whitespace-nowrap">
                    ON
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1 py-0.5 text-[10px] text-slate-700">
                    OFF
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator />
      </div>
    </header>
  );
}
