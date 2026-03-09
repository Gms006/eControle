import { expect, test } from "@playwright/test";

const email = process.env.ECONTROLE_EMAIL?.trim();
const password = process.env.ECONTROLE_PASSWORD?.trim();
const viewEmail = process.env.ECONTROLE_VIEW_EMAIL?.trim();
const viewPassword = process.env.ECONTROLE_VIEW_PASSWORD?.trim();

test.describe("Licencas assisted upload", () => {
  test.skip(!email || !password, "ECONTROLE_EMAIL e ECONTROLE_PASSWORD são obrigatórias");

  test("ADMIN/DEV abre modal, detecta e envia", async ({ page }) => {
    await page.route("**/api/v1/licencas/detect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            {
              original_filename: "Dispensa Sanitária - Definitivo.pdf",
              suggested_group: "SANITARIA",
              suggested_document_kind: "DISPENSA_SANITARIA",
              suggested_expires_at: null,
              is_definitive: true,
              confidence: 0.95,
              evidence_snippets: ["keyword: dispensa sanitaria", "token: definitivo"],
              canonical_filename: "Dispensa Sanitária - Definitivo.pdf",
              warnings: [],
            },
          ],
        }),
      });
    });
    await page.route("**/api/v1/licencas/upload-bulk", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          company_id: "company-e2e",
          saved_count: 1,
          results: [
            {
              file_original: "Dispensa Sanitária - Definitivo.pdf",
              ok: true,
              final_name: "Dispensa Sanitária - Definitivo.pdf",
              relative_path: "empresa/Societário/Alvarás e Certidões/Dispensa Sanitária - Definitivo.pdf",
            },
          ],
        }),
      });
    });

    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/painel$/);

    await page.getByTestId("nav-tab-licencas").first().click();
    await expect(page.getByTestId("licencas-upload-action")).toBeVisible();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "Dispensa Sanitária - Definitivo.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("arquivo-e2e"),
    });

    await expect(page.getByText("Upload assistido de licenças")).toBeVisible();
    await page.getByPlaceholder("Informe o ID da empresa").fill("company-e2e");
    await page.getByRole("button", { name: "Enviar arquivos" }).click();

    await expect(page.getByText("Upload concluído: 1/1 arquivos salvos.")).toBeVisible();
  });

  test("VIEW não vê ação de upload/detect", async ({ page }) => {
    test.skip(!viewEmail || !viewPassword, "ECONTROLE_VIEW_EMAIL e ECONTROLE_VIEW_PASSWORD são obrigatórias");

    await page.goto("/login");
    await page.getByTestId("login-email").fill(viewEmail!);
    await page.getByTestId("login-password").fill(viewPassword!);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/painel$/);

    await page.getByTestId("nav-tab-licencas").first().click();
    await expect(page.getByTestId("licencas-upload-action")).toHaveCount(0);
  });
});
