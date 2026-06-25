import { formatMunicipioDisplay } from "@/lib/normalization";

export const normalizeEmpresaRecord = (empresa, { getEmpresaKey }) => {
  const empresaId = getEmpresaKey(empresa);
  const empresaNome =
    empresa?.razao_social ??
    empresa?.razaoSocial ??
    empresa?.empresa ??
    empresa?.nome_fantasia ??
    empresa?.nomeFantasia ??
    "—";

  return {
    ...empresa,
    ...(empresaId ? { empresa_id: empresaId } : {}),
    empresa: empresaNome,
    razao_social: empresa?.razao_social ?? empresa?.empresa ?? empresa?.razaoSocial ?? empresaNome,
    nome_fantasia: empresa?.nome_fantasia ?? empresa?.nomeFantasia ?? undefined,
    ie: empresa?.ie ?? empresa?.inscricao_estadual ?? empresa?.inscricaoEstadual,
    im: empresa?.im ?? empresa?.inscricao_municipal ?? empresa?.inscricaoMunicipal,
    inscricaoMunicipal: empresa?.inscricaoMunicipal ?? empresa?.inscricao_municipal ?? empresa?.im,
    inscricaoEstadual: empresa?.inscricaoEstadual ?? empresa?.inscricao_estadual ?? empresa?.ie,
    situacao: empresa?.situacao ?? empresa?.status_empresa,
    debito: empresa?.debito ?? empresa?.situacao_debito,
    certificado: empresa?.certificado ?? empresa?.certificado_digital,
    responsavelFiscal: empresa?.responsavelFiscal ?? empresa?.responsavel_fiscal,
    responsavelLegal: empresa?.responsavelLegal ?? empresa?.proprietario_principal,
    cpfResponsavelLegal: empresa?.cpfResponsavelLegal ?? empresa?.cpf,
    observacoes: empresa?.observacoes ?? empresa?.observacao ?? null,
    municipio: formatMunicipioDisplay(empresa?.municipio),
  };
};
