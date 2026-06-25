import dayjs from "dayjs";

const BR_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

export const parseDateLike = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const iso = text.match(ISO_DATE_RE);
  if (iso) {
    const parsed = dayjs(`${iso[1]}-${iso[2]}-${iso[3]}`, "YYYY-MM-DD", true);
    return parsed.isValid() ? parsed : null;
  }

  const br = text.match(BR_DATE_RE);
  if (br) {
    const parsed = dayjs(`${br[3]}-${br[2]}-${br[1]}`, "YYYY-MM-DD", true);
    return parsed.isValid() ? parsed : null;
  }

  const fallback = dayjs(text);
  return fallback.isValid() ? fallback : null;
};

export const toUiBrDate = (value) => {
  const parsed = parseDateLike(value);
  return parsed ? parsed.format("DD/MM/YYYY") : "";
};

export const toCanonicalIsoDate = (value) => {
  const parsed = parseDateLike(value);
  return parsed ? parsed.format("YYYY-MM-DD") : null;
};

export const maskBrDate = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
};

export const isValidBrDate = (value) => {
  if (!BR_DATE_RE.test(String(value ?? "").trim())) return false;
  return Boolean(toCanonicalIsoDate(value));
};
