import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clipboard, ExternalLink, FileDown, Search } from "lucide-react";
import { urlArquivoRequerimento, urlFoxit } from "@/services/uteis";

const formatDateTime = (value) => {
  if (!value && value !== 0) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR");
};

const normalize = (value) => (value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function UteisScreen({ loading, requerimentos, contatos, modelos }) {
  const [buscaRequerimentos, setBuscaRequerimentos] = useState("");
  const [buscaContatos, setBuscaContatos] = useState("");
  const [buscaModelos, setBuscaModelos] = useState("");

  const requerimentosFiltrados = useMemo(() => {
    const lista = Array.isArray(requerimentos) ? requerimentos : [];
    const termo = normalize(buscaRequerimentos);
    if (!termo) return lista;
    return lista.filter((item) =>
      [item.nome, item.municipio, item.tipo, item.relpath]
        .filter(Boolean)
        .some((campo) => normalize(campo).includes(termo)),
    );
  }, [buscaRequerimentos, requerimentos]);

  const contatosFiltrados = useMemo(() => {
    const lista = Array.isArray(contatos) ? contatos : [];
    const termo = normalize(buscaContatos);
    if (!termo) return lista;
    return lista.filter((contato) =>
      [contato.contato, contato.email, contato.telefone, contato.municipio, contato.categoria]
        .filter(Boolean)
        .some((campo) => normalize(campo).includes(termo)),
    );
  }, [buscaContatos, contatos]);

  const modelosFiltrados = useMemo(() => {
    const lista = Array.isArray(modelos) ? modelos : [];
    const termo = normalize(buscaModelos);
    if (!termo) return lista;
    return lista.filter((modelo) =>
      [modelo.modelo, modelo.descricao, modelo.utilizacao].filter(Boolean).some((campo) => normalize(campo).includes(termo)),
    );
  }, [buscaModelos, modelos]);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Requerimentos disponíveis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Label className="text-xs uppercase text-slate-500">Buscar requerimento</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Nome, tipo ou município"
                value={buscaRequerimentos}
                onChange={(event) => setBuscaRequerimentos(event.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-slate-500">Carregando requerimentos…</div>
          ) : requerimentosFiltrados.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">Nenhum arquivo encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Município</TableHead>
                    <TableHead>Atualizado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requerimentosFiltrados.map((item) => {
                    const verUrl = urlArquivoRequerimento(item.id, true);
                    const baixarUrl = urlArquivoRequerimento(item.id, false);
                    const foxitUrl = urlFoxit(item.id);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-slate-800">{item.nome}</TableCell>
                        <TableCell className="text-sm text-slate-600">{item.tipo ?? "-"}</TableCell>
                        <TableCell className="text-sm text-slate-600">{item.municipio ?? "-"}</TableCell>
                        <TableCell className="text-sm text-slate-600">{formatDateTime(item.mtime)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" asChild>
                            <a href={verUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" /> Ver
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={baixarUrl} target="_blank" rel="noreferrer">
                              <FileDown className="mr-1 h-4 w-4" /> Baixar
                            </a>
                          </Button>
                          {foxitUrl && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={foxitUrl}>
                                <ExternalLink className="mr-1 h-4 w-4" /> Foxit
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Contatos úteis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Buscar por nome, e-mail ou categoria"
                value={buscaContatos}
                onChange={(event) => setBuscaContatos(event.target.value)}
              />
            </div>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500">Carregando contatos…</div>
            ) : contatosFiltrados.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Nenhum contato encontrado.</div>
            ) : (
              <ul className="space-y-3 text-sm">
                {contatosFiltrados.map((contato) => {
                  const info = [contato.email, contato.telefone, contato.whatsapp]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <li key={`${contato.id}-${contato.contato}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="font-medium text-slate-800">{contato.contato}</div>
                      <div className="text-xs text-slate-500">
                        {[contato.categoria, contato.municipio].filter(Boolean).join(" • ")}
                      </div>
                      {info && (
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                          <span>{info}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigator.clipboard?.writeText(info)}
                            title="Copiar contato"
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Modelos de mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Buscar por descrição ou utilização"
                value={buscaModelos}
                onChange={(event) => setBuscaModelos(event.target.value)}
              />
            </div>
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-500">Carregando modelos…</div>
            ) : modelosFiltrados.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Nenhum modelo encontrado.</div>
            ) : (
              <ul className="space-y-3 text-sm">
                {modelosFiltrados.map((modelo) => (
                  <li key={modelo.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="font-medium text-slate-800">{modelo.modelo}</div>
                    <div className="text-xs text-slate-500">{modelo.utilizacao}</div>
                    {modelo.descricao && <p className="mt-2 text-slate-600 text-sm">{modelo.descricao}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
