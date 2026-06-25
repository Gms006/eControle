import { normalizeItemsPayload } from "@/lib/domain/adapters/common";

/**
 * @typedef {{ limit: number, offset: number, page: number }} PageQuery
 * @typedef {{ [key: string]: string }} ErrorMap
 */

/**
 * @param {(query: PageQuery) => Promise<any>} fetchPage
 * @param {number} [limit]
 */
export const fetchAllPages = async (
  fetchPage,
  limit = 1000,
) => {
  const allItems = [];
  let offset = 0;

  for (let page = 0; page < 10000; page += 1) {
    const payload = await fetchPage({ limit, offset, page: page + 1 });
    const items = normalizeItemsPayload(payload);
    allItems.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  return allItems;
};

/**
 * @param {{ result: PromiseSettledResult<any>, key?: string, errors?: ErrorMap }} params
 */
export const readSettledCollection = ({
  result,
  key,
  errors,
}) => {
  if (result.status === "fulfilled") {
    return normalizeItemsPayload(result.value);
  }

  const message = result.reason?.message || "Falha ao carregar dados.";
  if (key && errors) {
    errors[key] = message;
  }
  return [];
};

/**
 * @template TReturn
 * @param {{
 *   result: PromiseSettledResult<any>,
 *   fallback: TReturn,
 *   key?: string,
 *   errors?: ErrorMap,
 *   errorMessage?: string,
 *   transform?: (value: any) => TReturn,
 * }} params
 * @returns {TReturn}
 */
export const readSettledValue = ({
  result,
  fallback,
  key,
  errors,
  errorMessage,
  transform,
}) => {
  if (result.status === "fulfilled") {
    return typeof transform === "function" ? transform(result.value) : result.value;
  }

  if (key && errors) {
    errors[key] = result.reason?.message || errorMessage || "Falha ao carregar dados.";
  }
  return fallback;
};

export const normalizeRolesList = (roles) =>
  (Array.isArray(roles) ? roles : []).map((role) => String(role).toUpperCase());
