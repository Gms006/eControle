import { expect, test } from "@playwright/test";

const email = process.env.ECONTROLE_EMAIL?.trim();
const password = process.env.ECONTROLE_PASSWORD?.trim();

test.describe("Taxas envio methods smoke", () => {
  test.skip(!email || !password, "ECONTROLE_EMAIL e ECONTROLE_PASSWORD são obrigatórias");

  test("abre edição de taxa e exibe opções de método de envio", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/painel$/);

    await page.getByTestId("nav-tab-taxas").click();

    const editButtons = page.getByRole("button", { name: /^Editar$/ });
    const hasAnyTaxRecord = (await editButtons.count()) > 0;
    test.skip(!hasAnyTaxRecord, "Sem registros de taxa para validar o dropdown.");

    await editButtons.first().click();
    await expect(page.getByText("Editar Taxas")).toBeVisible();

    await page.getByTestId("tax-envio-method-trigger").click();

    await expect(page.getByRole("menuitemcheckbox", { name: "Pessoal" })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: "Nº Escritório" })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: "E-mail" })).toBeVisible();
    await expect(page.getByRole("menuitemcheckbox", { name: "Office Boy (impresso)" })).toBeVisible();
  });
});
