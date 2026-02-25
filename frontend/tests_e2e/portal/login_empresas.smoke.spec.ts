import { expect, test } from "@playwright/test";

const email = process.env.ECONTROLE_EMAIL?.trim();
const password = process.env.ECONTROLE_PASSWORD?.trim();

test.describe("Portal E2E smoke", () => {
  test.skip(!email || !password, "ECONTROLE_EMAIL e ECONTROLE_PASSWORD são obrigatórias");

  test("login e navegação para Empresas com listagem carregada", async ({ page }) => {
    await page.goto("/login");

    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();

    await page.waitForURL(/\/painel$/);
    await expect(page.getByTestId("nav-tab-empresas")).toBeVisible();

    await page.getByTestId("nav-tab-empresas").click();

    await expect(page.getByTestId("companies-summary")).toBeVisible();
    await expect(page.getByTestId("companies-grid")).toBeVisible();
    await expect(page.getByTestId("company-card").first()).toBeVisible();
  });
});
