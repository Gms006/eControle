import {
  buildNormalizedSearchKey,
  normalizeDocumentDigits,
  normalizeIdentifier,
  normalizeTextLower,
  removeDiacritics,
} from "@/lib/text";

const MIN_DOCUMENT_LENGTH = 11;

export const DEFAULT_CERTIFICADO_SITUACAO = "Não Possui";

const getDocumentKey = (value) => {
  const digits = normalizeDocumentDigits(value);
  if (!digits) {
    return undefined;
  }
  return digits.length >= MIN_DOCUMENT_LENGTH ? digits : undefined;
};

const getNameKey = (value) => buildNormalizedSearchKey(value);

const getEmpresaDocumentCandidates = (empresa) => {
  if (!empresa || typeof empresa !== "object") {
    return [];
  }
  return [
    getDocumentKey(empresa.cnpj),
    getDocumentKey(empresa.cpfCnpj),
    getDocumentKey(empresa.cpf_cnpj),
    getDocumentKey(empresa.cpf),
    getDocumentKey(empresa.documento),
    getDocumentKey(empresa.document),
    getDocumentKey(empresa.titular),
  ].filter(Boolean);
};

const getEmpresaNameCandidates = (empresa) => {
  if (!empresa || typeof empresa !== "object") {
    return [];
  }
  return [
    getNameKey(empresa.empresa),
    getNameKey(empresa.razaoSocial),
    getNameKey(empresa.razao_social),
    getNameKey(empresa.nome),
    getNameKey(empresa.nomeFantasia),
    getNameKey(empresa.fantasia),
  ].filter(Boolean);
};

export const buildCertificadoIndex = (certificados) => {
  const lista = Array.isArray(certificados) ? certificados : [];
  const byDocument = new Map();
  const byName = new Map();

  lista.forEach((certificado) => {
    const docKey = getDocumentKey(certificado?.titular);
    if (docKey && !byDocument.has(docKey)) {
      byDocument.set(docKey, certificado);
    }
    const nameKey = getNameKey(certificado?.titular);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, certificado);
    }
  });

  return { byDocument, byName };
};

const findCertificadoForEmpresa = (empresa, index) => {
  if (!index) {
    return undefined;
  }
  const { byDocument, byName } = index;
  for (const docKey of getEmpresaDocumentCandidates(empresa)) {
    if (byDocument.has(docKey)) {
      return byDocument.get(docKey);
    }
  }
  for (const nameKey of getEmpresaNameCandidates(empresa)) {
    if (byName.has(nameKey)) {
      return byName.get(nameKey);
    }
  }
  return undefined;
};

export const resolveEmpresaCertificadoSituacao = (empresa, index) => {
  const match = findCertificadoForEmpresa(empresa, index);
  const situacao = normalizeIdentifier(match?.situacao);
  return situacao ?? DEFAULT_CERTIFICADO_SITUACAO;
};

export const categorizeCertificadoSituacao = (situacao) => {
  const key = removeDiacritics(normalizeTextLower(situacao)).trim();
  if (!key) {
    return "Outros";
  }
  if (key.includes("vencid")) {
    return "Vencido";
  }
  if (key.includes("vencend") || key.includes("vence")) {
    return "Vencendo em breve";
  }
  if (key.includes("valido") || key.includes("vigent") || key.includes("ativo")) {
    return "Válido";
  }
  return "Outros";
};

export const isCertificadoSituacaoAlert = (situacao) => {
  const key = removeDiacritics(normalizeTextLower(situacao)).trim();
  if (!key) {
    return true;
  }
  if (key === "naopossui" || key === "semcertificado" || key === "naotem") {
    return true;
  }
  const categoria = categorizeCertificadoSituacao(situacao);
  return categoria === "Vencido" || categoria === "Vencendo em breve";
};

