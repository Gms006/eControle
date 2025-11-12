import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Building2, ChevronsUpDown, Crown, LayoutDashboard, MessageSquareText, Search } from "lucide-react";

const NAV_ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "empresas", label: "Empresas", icon: Building2 },
  { key: "alertas", label: "Alertas", icon: Bell },
  { key: "uteis", label: "Úteis", icon: MessageSquareText },
];

function Brand() {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <Crown aria-label="eControle" className="h-8 w-8 text-indigo-600" />
      ) : (
        <img
          src="/favicons/crown/favicon-coroa-gradient.svg"
          alt="eControle"
          className="h-8 w-8"
          onError={() => setFailed(true)}
        />
      )}
      <div className="text-xl md:text-2xl font-extrabold tracking-tight">
        <span className="bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent">
          eControle
        </span>
      </div>
    </div>
  );
}

export default function HeaderMenuPro({ tab, onTabChange, query, onQueryChange, municipio, municipios, onMunicipioChange }) {
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    if (import.meta.env.DEV) {
      const keys = NAV_ITEMS.map((item) => item.key);
      console.assert(JSON.stringify(keys) === JSON.stringify(["painel", "empresas", "alertas", "uteis"]), "[HeaderMenuPro] Ordem inesperada");
      console.assert(Array.isArray(municipios) && municipios.includes("Todos"), "[HeaderMenuPro] municipios deve conter 'Todos'");
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [municipios]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="h-16 flex items-center gap-3">
          <Brand />

          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-350" />
              <Input
                id="global-search-input"
                placeholder="Buscar: empresa, CNPJ ou palavra-chave… (Ctrl/Cmd + K)"
                value={query}
                onChange={(event) => onQueryChange?.(event.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" title="Notificações">
              <Bell className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-xl border bg-white/70 backdrop-blur px-2 py-1">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 grid place-items-center text-white text-xs font-semibold">
              MC
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-xs font-medium">Maria Clara</div>
              <div className="text-[10px] text-slate-500">Neto Contabilidade</div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>

        <div className="pb-3 -mt-1">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-y-2 lg:gap-y-1.5 gap-x-1">
            <Tabs value={tab} onValueChange={onTabChange} className="w-full lg:flex-1 min-w-0">
              <TabsList className="flex w-full flex-nowrap items-stretch gap-1 overflow-x-auto lg:overflow-visible">
                {NAV_ITEMS.map(({ key, label, icon: Icon }, index) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="gap-2 whitespace-nowrap lg:flex-1 lg:basis-0 lg:justify-center"
                    data-tab-target={key}
                    title={`Alt+${index + 1}`}
                  >
                    <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden /> {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {NAV_ITEMS.map(({ key }) => (
                <TabsContent key={key} value={key} />
              ))}
            </Tabs>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-y-2 sm:gap-y-0 sm:gap-x-1">
              <div className="w-36 md:w-44 xl:w-48 shrink-0">
                <Label className="text-[11px] text-slate-500">Município</Label>
                <Select value={municipio} onValueChange={onMunicipioChange}>
                  <SelectTrigger className="h-8 px-2 text-[13px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios?.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Separator />
      </div>
    </header>
  );
}
