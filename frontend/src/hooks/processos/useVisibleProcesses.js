import { useMemo } from "react";
import { isProcessStatusActiveOrPending } from "@/lib/domain/status/common";
import { normalizeText, removeDiacritics } from "@/lib/text";

export default function useVisibleProcesses({
  processosNormalizados,
  matchesMunicipioFilter,
  matchesQuery,
  modoFoco,
  soAlertas,
}) {
  return useMemo(() => {
    return processosNormalizados.filter((proc) => {
      const matchesMunicipio = matchesMunicipioFilter(proc);
      const matchesBusca = matchesQuery(
        [
          proc.empresa,
          proc.tipo,
          proc.tipoNormalizado,
          proc.status,
          proc.situacao,
          proc.status_padrao,
          proc.obs,
          proc.protocolo,
          proc.cnpj,
          proc.data_solicitacao,
          proc.prazo,
          proc.operacao,
          proc.orgao,
          proc.alvara,
          proc.inscricao_imobiliaria,
          proc.servico,
          proc.taxa,
          proc.notificacao,
          proc.data_val,
          proc.municipio,
          proc.tpi,
          proc.area_m2,
          proc.projeto,
          proc.tpi_sync_status,
          proc.taxa_bombeiros_sync_status,
          proc.taxa_sanitaria_sync_status,
          proc.alvara_sanitario_status,
        ],
        {
          nome: [proc.empresa],
          razao: [proc.empresa],
          cnpj: [proc.cnpj],
        },
      );

      const matchesFoco = modoFoco ? isProcessStatusActiveOrPending(proc.status) : true;
      const statusKey = removeDiacritics(normalizeText(proc?.situacao || proc?.status).toLowerCase());
      const blockedByAlertMode =
        soAlertas &&
        ["pendente", "concluido", "licenciado"].some((keyword) => statusKey.includes(keyword));

      return matchesMunicipio && matchesBusca && matchesFoco && !blockedByAlertMode;
    });
  }, [matchesMunicipioFilter, matchesQuery, modoFoco, processosNormalizados, soAlertas]);
}
