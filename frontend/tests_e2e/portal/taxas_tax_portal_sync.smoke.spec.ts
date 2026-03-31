import { expect, test } from "@playwright/test";

const email = process.env.ECONTROLE_EMAIL?.trim();
const password = process.env.ECONTROLE_PASSWORD?.trim();

test.describe("Tax Portal Sync smoke", () => {
  test.skip(!email || !password, "ECONTROLE_EMAIL e ECONTROLE_PASSWORD são obrigatórias");

  test("inicia run dry-run, mostra progresso, retoma run ativa e permite cancelar", async ({ page }) => {
    const runId = "run-smoke-001";
    let isRunActive = false;
    let statusCalls = 0;

    const nowIso = new Date().toISOString();

    const buildStatusPayload = (status: "queued" | "running" | "cancelled") => ({
      run_id: runId,
      org_id: "org-smoke",
      started_by_user_id: "user-smoke",
      status,
      trigger_type: "manual",
      dry_run: true,
      municipio: "ANÁPOLIS",
      limit: 1,
      total: 2,
      processed: status === "cancelled" ? 1 : Math.min(statusCalls, 1),
      ok_count: status === "cancelled" ? 1 : Math.min(statusCalls, 1),
      error_count: 0,
      skipped_count: 0,
      relogin_count: 0,
      current_cnpj: "12345678000199",
      current_company_id: "company-smoke",
      started_at: nowIso,
      finished_at: status === "cancelled" ? nowIso : null,
      errors: [],
      summary: {
        companies_with_debits: 1,
        companies_marked_paid: 0,
      },
    });

    await page.route("**/api/v1/dev/taxas/portal-sync/active", async (route) => {
      if (!isRunActive) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ detail: "No active run" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: runId }),
      });
    });

    await page.route("**/api/v1/dev/taxas/portal-sync/start", async (route) => {
      isRunActive = true;
      statusCalls = 0;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: runId }),
      });
    });

    await page.route(`**/api/v1/dev/taxas/portal-sync/${runId}`, async (route) => {
      statusCalls += 1;
      const status = isRunActive ? "running" : "cancelled";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildStatusPayload(status)),
      });
    });

    await page.route(`**/api/v1/dev/taxas/portal-sync/${runId}/cancel`, async (route) => {
      isRunActive = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: runId, status: "cancelled" }),
      });
    });

    await page.goto("/login");
    await page.getByTestId("login-email").fill(email!);
    await page.getByTestId("login-password").fill(password!);
    await page.getByTestId("login-submit").click();
    await page.waitForURL(/\/painel$/);

    await page.getByTestId("nav-tab-taxas").first().click();

    const openSyncButton = page.getByTestId("tax-portal-sync-open");
    await expect(openSyncButton).toBeVisible();
    await openSyncButton.click();

    await page.getByTestId("tax-portal-sync-password").fill(password!);
    await page.getByTestId("tax-portal-sync-limit").fill("1");
    await page.getByTestId("tax-portal-sync-start-submit").click();

    await expect(page.getByTestId("tax-portal-sync-manager")).toBeVisible();
    await expect(page.getByText(`Tax Portal Sync - run ${runId}`)).toBeVisible();
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.getByTestId("nav-tab-empresas").first().click();
    await page.getByTestId("nav-tab-taxas").first().click();

    await expect(page.getByTestId("tax-portal-sync-manager")).toBeVisible();
    await expect(page.getByText(`Tax Portal Sync - run ${runId}`)).toBeVisible();

    await page.getByTestId("tax-portal-sync-cancel").click();
    await expect(page.getByText("Status: cancelled")).toBeVisible();
  });
});
