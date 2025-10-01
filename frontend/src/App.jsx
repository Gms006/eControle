import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ShieldAlert,
  FileText,
  Clock,
  MessageSquare,
  Settings,
  Shield,
  MapPin,
  Droplets,
  ClipboardCheck,
  Trees,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

// ✅ Usa env var (VITE_API_URL) ou cai para proxy "/api"
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

function Chip({ status }) {
  const map = {
    Possui: "bg-emerald-100 text-emerald-700",
    Vencido: "bg-red-100 text-red-700",
    "Vence≤30d": "bg-amber-100 text-amber-800",
    Sujeito: "bg-slate-200 text-slate-800",
    Dispensa: "bg-indigo-100 text-indigo-700",
    Pago: "bg-emerald-100 text-emerald-700",
    "Não pago": "bg-red-100 text-red-700",
    "*": "bg-slate-200 text-slate-800",
    SIM: "bg-emerald-100 text-emerald-700",
    NÃO: "bg-red-100 text-red-700",
    Sim: "bg-emerald-100 text-emerald-700",
    Não: "bg-red-100 text-red-700",
    Ativa: "bg-emerald-100 text-emerald-700",
  };
  const cls = map[status] || "bg-gray-200 text-gray-800";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function KPI({ title, value, icon }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-slate-100">{icon}</div>
        <div>
          <div className="text-xs text-slate-500">{title}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [tab, setTab] = useState("painel");
  const [query, setQuery] = useState("");
  const [municipio, setMunicipio] = useState(undefined);
  const [soAlertas, setSoAlertas] = useState(false);
  const [modoFoco, setModoFoco] = useState(true);
  const [selectedTipo, setSelectedTipo] = useState("Diversos");

  // Estado para dados da API
  const [empresas, setEmpresas] = useState([]);
  const [licencas, setLicencas] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [processos, setProcessos] = useState([]);
  const [kpis, setKpis] = useState({});
  const [municipios, setMunicipios] = useState([]);
  const [loading, setLoading] = useState(true);

  const ALL = "__ALL__";

  const ICONS = {
    Diversos: <Settings className="h-4 w-4" />,
    "Alvará de Funcionamento": <ClipboardCheck className="h-4 w-4" />,
    Bombeiros: <Shield className="h-4 w-4" />,
    "Licença Ambiental": <Trees className="h-4 w-4" />,
    "Uso do Solo": <MapPin className="h-4 w-4" />,
    "Alvará Sanitário": <Droplets className="h-4 w-4" />,
  };

  const tabBg = {
    painel: "bg-sky-50",
    empresas: "bg-indigo-50",
    licencas: "bg-emerald-50",
    taxas: "bg-amber-50",
    processos: "bg-violet-50",
    uteis: "bg-slate-50",
  };

  // Carrega dados da API
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/empresas?query=${query}&municipio=${municipio || ""}&so_alertas=${soAlertas}`).then(r => r.json()),
      fetch(`${API_URL}/licencas`).then(r => r.json()),
      fetch(`${API_URL}/taxas`).then(r => r.json()),
      fetch(`${API_URL}/processos`).then(r => r.json()),
      fetch(`${API_URL}/kpis`).then(r => r.json()),
      fetch(`${API_URL}/municipios`).then(r => r.json()),
    ])
      .then(([emp, lic, tax, proc, kpi, mun]) => {
        setEmpresas(emp);
        setLicencas(lic);
        setTaxas(tax);
        setProcessos(proc);
        setKpis(kpi);
        setMunicipios(mun);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao carregar dados:", err);
        setLoading(false);
      });
  }, [query, municipio, soAlertas]);

  const chartData = [
    { m: "Mai", venc: 4, tpi: 3 },
    { m: "Jun", venc: 6, tpi: 2 },
    { m: "Jul", venc: 5, tpi: 4 },
    { m: "Ago", venc: 7, tpi: 5 },
    { m: "Set", venc: 9, tpi: 6 },
  ];

  const selectMunicipioValue = municipio ?? ALL;
  const handleMunicipioChange = (v) => setMunicipio(v === ALL ? undefined : v);

  const processosAtivos = processos.filter(p => ["CONCLUÍDO", "Aprovado"].includes(p.status) === false);
  const processosPorTipo = useMemo(() => {
    return processos.filter(p => p.tipo === selectedTipo);
  }, [processos, selectedTipo]);

  if (loading) {
    return <div className="p-6 text-center">Carregando dados...</div>;
  }

  return (
    <div className={`p-4 md:p-6 max-w-[1400px] mx-auto rounded-2xl ${tabBg[tab]}`}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500 bg-clip-text text-transparent drop-shadow-sm">
          eControle
        </h1>
        <span className="hidden md:block text-xs md:text-sm text-slate-500">Gestão de Empresas • Licenças • Processos</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
        <div className="flex-1">
          <Label className="text-xs">Pesquisa</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Empresa, CNPJ, palavra-chave…"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-56">
          <Label className="text-xs">Município</Label>
          <Select value={selectMunicipioValue} onValueChange={handleMunicipioChange}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {municipios.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={soAlertas} onCheckedChange={setSoAlertas} />
          <span className="text-sm">Somente alertas</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={modoFoco} onCheckedChange={setModoFoco} />
          <span className="text-sm">Modo foco</span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="painel"><Search className="h-4 w-4 mr-2" /> Painel</TabsTrigger>
          <TabsTrigger value="empresas"><Building2 className="h-4 w-4 mr-2" /> Empresas</TabsTrigger>
          <TabsTrigger value="licencas"><FileText className="h-4 w-4 mr-2" /> Licenças</TabsTrigger>
          <TabsTrigger value="taxas"><Clock className="h-4 w-4 mr-2" /> Taxas</TabsTrigger>
          <TabsTrigger value="processos"><CheckCircle2 className="h-4 w-4 mr-2" /> Processos</TabsTrigger>
          <TabsTrigger value="uteis"><MessageSquare className="h-4 w-4 mr-2" /> Úteis</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="mt-4">
          <div className="grid md:grid-cols-4 gap-3">
            <KPI title="Empresas" value={kpis.total_empresas || 0} icon={<Building2 className="h-5 w-5" />} />
            <KPI title="Sem certificado" value={kpis.sem_certificado || 0} icon={<ShieldAlert className="h-5 w-5" />} />
            <KPI title="Licenças vencidas" value={kpis.licencas_vencidas || 0} icon={<AlertTriangle className="h-5 w-5" />} />
            <KPI title="TPI pendente" value={kpis.tpi_pendente || 0} icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mt-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tendência de alertas (últimos meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="m" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="venc" strokeWidth={2} dot={false} stroke="#f59e0b" />
                      <Line type="monotone" dataKey="tpi" strokeWidth={2} dot={false} stroke="#ef4444" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Processos em andamento</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-48">
                  <ul className="divide-y">
                    {processosAtivos.slice(0, 10).map((p, i) => (
                      <li key={i} className="px-3 py-2 text-sm flex items-center justify-between">
                        <div>
                          <div className="font-medium">{p.empresa}</div>
                          <div className="text-xs text-slate-600">{p.tipo}</div>
                        </div>
                        <Chip status={p.status} />
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="empresas" className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-slate-500">{empresas.length} empresas encontradas</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {empresas.map((e) => (
              <Card key={e.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center font-semibold text-indigo-700">
                      {e.empresa?.[0] || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold leading-tight">{e.empresa}</div>
                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3">
                        <span>CNPJ: {e.cnpj}</span>
                        <span>IE: {e.inscricao_estadual}</span>
                        <span>IM: {e.inscricao_municipal}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Chip status={e.situacao} />
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{e.categoria}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{e.municipio}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Atualizado: {e.updated_at}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="licencas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licencas.filter(l => !modoFoco || ["Vencido", "Vence≤30d"].includes(l.status)).map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{l.empresa}</TableCell>
                        <TableCell>{l.tipo}</TableCell>
                        <TableCell><Chip status={l.status} /></TableCell>
                        <TableCell>{l.validade}</TableCell>
                        <TableCell className="text-xs text-slate-600">{l.obs || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="taxas" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>TPI</TableHead>
                      <TableHead>Func.</TableHead>
                      <TableHead>Publicidade</TableHead>
                      <TableHead>Sanitária</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxas.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.empresa}</TableCell>
                        <TableCell><Chip status={t.tpi} /></TableCell>
                        <TableCell><Chip status={t.func} /></TableCell>
                        <TableCell><Chip status={t.publicidade} /></TableCell>
                        <TableCell><Chip status={t.sanitaria} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processos" className="mt-4">
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            {["Diversos", "Alvará de Funcionamento", "Bombeiros", "Licença Ambiental", "Uso do Solo", "Alvará Sanitário"].map((t) => {
              const count = processos.filter(p => p.tipo === t).length;
              const cores = {
                "Diversos": "border-slate-400 text-slate-700",
                "Alvará de Funcionamento": "border-indigo-500 text-indigo-700",
                "Bombeiros": "border-red-500 text-red-700",
                "Licença Ambiental": "border-emerald-600 text-emerald-700",
                "Uso do Solo": "border-amber-500 text-amber-700",
                "Alvará Sanitário": "border-sky-500 text-sky-700",
              };
              return (
                <Card key={t}>
                  <CardContent className={`p-4 rounded-xl border-l-4 ${cores[t]}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">{t}</div>
                        <div className="text-2xl font-semibold">{count}</div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-white/70 grid place-items-center">{ICONS[t]}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {["Diversos", "Alvará de Funcionamento", "Bombeiros", "Licença Ambiental", "Uso do Solo", "Alvará Sanitário"].map((t) => (
              <Button
                key={t}
                size="sm"
                variant={t === selectedTipo ? "default" : "secondary"}
                onClick={() => setSelectedTipo(t)}
                className="inline-flex items-center gap-1"
              >
                <span className="opacity-80">{ICONS[t]}</span>
                {t}
                <span className="ml-1 text-xs opacity-70">{processos.filter(p => p.tipo === t).length}</span>
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {processosPorTipo.map((p, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">{ICONS[p.tipo]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{p.empresa}</div>
                      <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span>{p.codigo}</span>
                        <span>Início: {p.inicio}</span>
                        {p.prazo && <span className="text-red-600 font-medium">Prazo: {p.prazo} ⚠️</span>}
                      </div>
                      <div className="mt-2">
                        <Chip status={p.status} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {processosPorTipo.length === 0 && (
              <Card className="shadow-sm">
                <CardContent className="p-6 text-sm text-slate-600">Nenhum processo para o tipo selecionado.</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="uteis" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contatos Úteis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { org: "Prefeitura de Anápolis", email: "atendimento@anapolis.go.gov.br", fone: "(62) 3902-xxxx", site: "https://www.anapolis.go.gov.br" },
                  { org: "Vigilância Sanitária", email: "visa@go.gov.br", fone: "(62) 3201-xxxx", site: "https://saude.go.gov.br" },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="font-medium">{c.org}</div>
                    <div className="text-slate-600 text-xs">{c.email} • {c.fone}</div>
                    <div className="text-sky-700 text-xs truncate">{c.site}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mensagens / Modelos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { titulo: "Cobrança de documento", texto: "Olá, tudo bem? Precisamos dos documentos abaixo para dar andamento ao processo: ..." },
                  { titulo: "Agendamento de vistoria", texto: "Boa tarde! Podemos agendar a vistoria para a data __/__/____? Seguem orientações: ..." },
                ].map((m, i) => (
                  <div key={i} className="rounded-xl border p-3">
                    <div className="font-medium">{m.titulo}</div>
                    <p className="text-slate-600 text-sm mt-1">{m.texto}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
