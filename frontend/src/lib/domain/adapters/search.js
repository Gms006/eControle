import { normalizeText, removeDiacritics } from "@/lib/text";

export const normalizeSearchKey = (value) => {
  const normalized = removeDiacritics(normalizeText(value)).toLowerCase();
  return normalized.trim();
};

export const matchesMunicipio = (item, municipio, pickMunicipioValue) => {
  if (!municipio || municipio === "Todos") return true;
  const target = normalizeSearchKey(municipio);
  const value = normalizeSearchKey(pickMunicipioValue(item));
  return value === target;
};

export const matchesQueryTokens = (query, searchField, values, fieldMap = {}) => {
  const trimmed = String(query || "").trim();
  if (!trimmed) return true;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const fieldTokens = tokens.filter((token) => token.includes(":"));
  const freeTokens = tokens.filter((token) => !token.includes(":"));

  const matchesToken = (haystack, token) => {
    if (!token) return true;
    const normalizedToken = normalizeSearchKey(token);
    return haystack.some((value) => normalizeSearchKey(value).includes(normalizedToken));
  };

  for (const rawToken of fieldTokens) {
    const [field, ...rest] = rawToken.split(":");
    const term = rest.join(":");
    const valuesForField = fieldMap[field] || [];
    if (!matchesToken(valuesForField, term)) {
      return false;
    }
  }

  if (freeTokens.length === 0) {
    return true;
  }

  const scopedValues = searchField !== "all" && fieldMap[searchField] ? fieldMap[searchField] : values;
  return freeTokens.every((token) => matchesToken(scopedValues, token));
};

export const filterEmpresasCollection = (
  collection,
  { municipio, query, searchField, pickMunicipioValue },
) =>
  collection.filter((empresa) => {
    if (!matchesMunicipio(empresa, municipio, pickMunicipioValue)) return false;
    const values = [
      empresa?.empresa,
      empresa?.razao_social,
      empresa?.razaoSocial,
      empresa?.nome_fantasia,
      empresa?.nomeFantasia,
      empresa?.cnpj,
      pickMunicipioValue(empresa),
      empresa?.responsavelFiscal,
      empresa?.observacoes,
    ];
    return matchesQueryTokens(query, searchField, values, {
      nome: [empresa?.empresa, empresa?.nome_fantasia, empresa?.razao_social],
      razao: [empresa?.razao_social, empresa?.empresa],
      cnpj: [empresa?.cnpj],
    });
  });

export const filterLicencasCollection = (
  collection,
  { matchesMunicipioFilter, matchesQuery },
) =>
  collection.filter((lic) => {
    if (!matchesMunicipioFilter(lic)) return false;
    const values = [
      lic?.empresa,
      lic?.cnpj,
      lic?.tipo,
      lic?.status,
      lic?.validade,
      lic?.municipio,
    ];
    return matchesQuery(values, {
      nome: [lic?.empresa],
      razao: [lic?.empresa],
      cnpj: [lic?.cnpj],
    });
  });
