import { expect, test } from "@playwright/test";

const email = process.env.ECONTROLE_EMAIL?.trim();
const password = process.env.ECONTROLE_PASSWORD?.trim();
const cnpj = process.env.ECONTROLE_SMOKE_CNPJ?.trim();

test.describe("Empresa import/save smoke", () => {
  test.skip(!email || !password || !cnpj, "Requer ECONTROLE_EMAIL, ECONTROLE_PASSWORD e ECONTROLE_SMOKE_CNPJ");

  test("importa ReceitaWS e salva sem reload forçado", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/painel$/);

    await page.getByRole("button", { name: "+ Novo" }).click();
    await page.getByRole("menuitem", { name: "Empresa" }).click();

    await page.locator("label:has-text('CNPJ')").locator("..").getByRole("textbox").fill(cnpj!);
    await page.getByRole("button", { name: "Importar" }).click();

    const razao = page.locator("label:has-text('Razão Social') + input");
    await expect(razao).not.toHaveValue("");
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByTestId("companies-summary")).toBeVisible();
  });
});
