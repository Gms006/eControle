import React, { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InlineBadge from "@/components/InlineBadge";
import { Clipboard, Mail, MessageSquare, Phone, Search, Users } from "lucide-react";
import { normalizeText, normalizeTextLower } from "@/lib/text";

export default function UteisScreen(props) {
  const { contatos, modelos, matchesMunicipioFilter, handleCopy } = props;

  const [uteisQuery, setUteisQuery] = useState("");

  const normalizedUteisQuery = useMemo(
    () => normalizeTextLower(uteisQuery).trim(),
    [uteisQuery],
  );

  const matchesUteisQuery = useCallback(
    (fields) => {
      if (normalizedUteisQuery === "") {
        return true;
      }
      return fields
        .filter((field) => field !== null && field !== undefined)
        .some((field) => normalizeTextLower(field).includes(normalizedUteisQuery));
    },
    [normalizedUteisQuery],
  );

  const filteredContatos = useMemo(() => {
    const lista = Array.isArray(contatos) ? contatos : [];
    return lista.filter(
      (contato) =>
        matchesMunicipioFilter(contato) &&
        matchesUteisQuery([
          contato?.contato,
          contato?.categoria,
          contato?.municipio,
          contato?.email,
          contato?.telefone,
          contato?.whatsapp,
        ]),
    );
  }, [contatos, matchesMunicipioFilter, matchesUteisQuery]);

  const filteredModelos = useMemo(() => {
    const lista = Array.isArray(modelos) ? modelos : [];
    return lista.filter((modelo) =>
      matchesMunicipioFilter(modelo) &&
      matchesUteisQuery([modelo?.descricao, modelo?.utilizacao, modelo?.modelo]),
    );
  }, [matchesMunicipioFilter, matchesUteisQuery, modelos]);

  const contatosOrdenadosLista = useMemo(() => {
    const lista = Array.isArray(filteredContatos) ? filteredContatos : [];
    return [...lista]
      .filter((item) => item && (item.contato || item.email || item.telefone))
      .sort((a, b) => {
        const catA = normalizeText(a?.categoria || "");
        const catB = normalizeText(b?.categoria || "");
        if (catA !== catB) {
          return catA.localeCompare(catB, "pt-BR");
        }
        const nomeA = normalizeText(a?.contato || "");
        const nomeB = normalizeText(b?.contato || "");
        return nomeA.localeCompare(nomeB, "pt-BR");
      });
  }, [filteredContatos]);

  const modelosOrdenadosLista = useMemo(() => {
    const lista = Array.isArray(filteredModelos) ? filteredModelos : [];
    return [...lista]
      .filter((item) => item && (item.modelo || item.descricao))
      .sort((a, b) => {
        const usoA = normalizeText(a?.utilizacao || "");
        const usoB = normalizeText(b?.utilizacao || "");
        if (usoA !== usoB) {
          return usoA.localeCompare(usoB, "pt-BR");
        }
        const descA = normalizeText(a?.descricao || "");
        const descB = normalizeText(b?.descricao || "");
        return descA.localeCompare(descB, "pt-BR");
      });
  }, [filteredModelos]);

  return (
    <div className="mt-4 space-y-4">
      <div className="max-w-xl">
        <Label className="text-xs uppercase">Pesquisa em úteis</Label>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar contato, categoria ou mensagem…"
            className="pl-8"
            value={uteisQuery}
            onChange={(event) => setUteisQuery(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Contatos úteis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contatosOrdenadosLista.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhum contato cadastrado no Excel.
              </div>
            )}
            {contatosOrdenadosLista.map((contato) => {
              const whatsappTexto = normalizeTextLower(contato.whatsapp || "");
              const temWhatsapp =
                whatsappTexto !== "" &&
                !["nao", "não", "nao possui", "não possui"].some((neg) => whatsappTexto.includes(neg));
              const info = [contato.email, contato.telefone, temWhatsapp ? contato.whatsapp : null]
                .filter((value) => value && value.toString().trim() !== "")
                .join(" • ");
              const municipioInfo = [contato.categoria, contato.municipio]
                .filter((value) => value && value.toString().trim() !== "")
                .join(" • ");
              return (
                <div
                  key={`${contato.contato}-${contato.email}-${contato.telefone}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{contato.contato}</p>
                      {municipioInfo && <p className="text-xs text-slate-500">{municipioInfo}</p>}
                    </div>
                    {info && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopy(info, `Contato copiado de ${contato.contato}`)}
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {contato.email && (
                      <InlineBadge variant="outline" className="bg-white">
                        <Mail className="h-3 w-3 mr-1" /> {contato.email}
                      </InlineBadge>
                    )}
                    {contato.telefone && (
                      <InlineBadge variant="outline" className="bg-white">
                        <Phone className="h-3 w-3 mr-1" /> {contato.telefone}
                      </InlineBadge>
                    )}
                    {temWhatsapp && (
                      <InlineBadge variant="outline" className="bg-white">
                        <Phone className="h-3 w-3 mr-1" /> WhatsApp: {contato.whatsapp}
                      </InlineBadge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Modelos de mensagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {modelosOrdenadosLista.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Nenhum modelo cadastrado no Excel.
              </div>
            )}
            {modelosOrdenadosLista.map((modelo) => (
              <div
                key={`${modelo.descricao || "Modelo"}-${(modelo.modelo || "").slice(0, 20)}`}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{modelo.descricao || "Modelo"}</p>
                    <p className="text-xs text-slate-500">
                      {modelo.utilizacao ? `Uso: ${modelo.utilizacao}` : "Clique para copiar e enviar."}
                    </p>
                  </div>
                  {modelo.modelo && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleCopy(modelo.modelo, `Mensagem copiada: ${modelo.descricao || "Modelo"}`)}
                    >
                      <Clipboard className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {modelo.modelo && (
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{modelo.modelo}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
