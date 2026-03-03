import test from "node:test";
import assert from "node:assert/strict";

import { formatDataEnvio, isEnvioPendente, parseDataEnvio } from "./taxes.js";
import {
  deriveStatusFromInstallment,
  formatInstallment,
  normalizeInstallmentInput,
  parseInstallment,
  validateInstallmentInput,
} from "./installment.js";

test("parseDataEnvio parses single method payload", () => {
  const parsed = parseDataEnvio("05/02/2026 - Nº Escritório");
  assert.equal(parsed.date, "05/02/2026");
  assert.deepEqual(parsed.methods, ["Nº Escritório"]);
});

test("formatDataEnvio formats multiple methods with standard separator", () => {
  const formatted = formatDataEnvio("05/02/2026", ["Nº Escritório", "E-mail"]);
  assert.equal(formatted, "05/02/2026 - Nº Escritório; E-mail");
});

test("formatDataEnvio normalizes legacy impresso to office boy label", () => {
  const formatted = formatDataEnvio("05/02/2026", ["Impresso"]);
  assert.equal(formatted, "05/02/2026 - Office Boy (impresso)");
});

test("isEnvioPendente returns true when there is em_aberto without data_envio", () => {
  const pending = isEnvioPendente({
    taxa_funcionamento: "em_aberto",
    data_envio: null,
  });
  assert.equal(pending, true);
});

test("installment parsing normalizes spaced input and validates boundaries", () => {
  assert.equal(normalizeInstallmentInput("0 3"), "0/3");
  assert.equal(normalizeInstallmentInput(" 1 / 4 "), "1/4");
  assert.deepEqual(parseInstallment("0 3"), { paid: 0, total: 3 });
  assert.equal(validateInstallmentInput("4/3"), "Formato inválido. Use x/y com y > 0 e 0 <= x <= y.");
});

test("installment derives paid status and display always uses slash", () => {
  const parsedOpen = parseInstallment("0 3");
  assert.ok(parsedOpen);
  assert.equal(deriveStatusFromInstallment(parsedOpen.paid, parsedOpen.total), "installment");
  assert.equal(formatInstallment(parsedOpen.paid, parsedOpen.total), "0/3");

  const parsedPaid = parseInstallment("3/3");
  assert.ok(parsedPaid);
  assert.equal(deriveStatusFromInstallment(parsedPaid.paid, parsedPaid.total), "paid");
});
