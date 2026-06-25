import React from "react";
import { ArrowUpDown, ChevronDown, FileSpreadsheet, LayoutGrid, Logs, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LABEL_SORT_DIRECTION = "Dire\u00e7\u00e3o";
const LABEL_ADVANCED_FILTERS = "Filtros avan\u00e7ados";
const LABEL_EXPORT_REPORT = "Exportar relat\u00f3rio";

export default function CompaniesToolbar({
  filteredCount,
  totalCount,
  sortOptions,
  sortBy,
  setSortField,
  toggleSortDirection,
  handleScoreSortQuickToggle,
  onOpenFilters,
  onOpenExport,
  viewMode,
  setViewMode,
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">{filteredCount} de {totalCount} empresas exibidas</span>
      </div>

      <Card className="border-subtle bg-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
                  <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                  {sortOptions.find((item) => item.value === sortBy.field)?.label || "Nome fantasia"}
                  <span className="ml-1 text-xs text-blue-700">{sortBy.direction === "asc" ? "\u2191" : "\u2193"}</span>
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 p-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordenar por</p>
                <div className="space-y-1">
                  {sortOptions.map((option) => {
                    const isActive = sortBy.field === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSortField(option.value)}
                        className={cn("flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm", isActive ? "bg-slate-100 text-blue-700" : "text-slate-700 hover:bg-slate-50")}
                      >
                        <span>{option.label}</span>
                        <span className="text-xs text-slate-500">{isActive ? (sortBy.direction === "asc" ? "A-Z / Menor" : "Z-A / Maior") : ""}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <Button size="sm" variant="outline" className="w-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={toggleSortDirection}>
                    {LABEL_SORT_DIRECTION}: {sortBy.direction === "asc" ? "Crescente" : "Decrescente"}
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              data-testid="companies-sort-score"
              onClick={handleScoreSortQuickToggle}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Score {sortBy.field === "score" ? (sortBy.direction === "asc" ? "\u2191" : "\u2193") : ""}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50" onClick={onOpenFilters}>
              <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> {LABEL_ADVANCED_FILTERS}
            </Button>
            <Button size="sm" variant="outline" className="border-blue-300 bg-blue-100 text-blue-900 hover:bg-blue-200" onClick={onOpenExport}>
              <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> {LABEL_EXPORT_REPORT}
            </Button>
            <div className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 p-1">
              <button type="button" onClick={() => setViewMode("compact")} className={cn("rounded-md p-2 transition", viewMode === "compact" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")} title="Modo lista"><Logs className="h-4 w-4" /></button>
              <button type="button" onClick={() => setViewMode("detailed")} className={cn("rounded-md p-2 transition", viewMode === "detailed" ? "bg-indigo-700 text-white" : "bg-white text-indigo-700 hover:bg-indigo-100")} title="Modo cards"><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
