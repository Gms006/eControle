import { expect, test } from "@playwright/test";

async function setupMockApi(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.setItem("access_token", "mock-token");
    window.localStorage.setItem("econtrole.empresas.viewMode", "compact");
  });

  const companies = [
    {
      id: "company-1",
      org_id: "org-1",
      cnpj: "11.111.111/0001-11",
      razao_social: "Empresa Alto Score Ltda",
      nome_fantasia: "Empresa Alto Score",
      municipio: "Anápolis",
      situacao: "ativa",
      score_urgencia: 95,
      risco_consolidado: "HIGH",
      score_status: "OK",
      cnaes_principal: [{ code: "47.11-3-02", text: "Comércio varejista de mercadorias" }],
    },
    {
      id: "company-2",
      org_id: "org-1",
      cnpj: "22.222.222/0001-22",
      razao_social: "Empresa Sem Licença Ltda",
      nome_fantasia: "Empresa Sem Licença",
      municipio: "Anápolis",
      situacao: "ativa",
      score_urgencia: 40,
      risco_consolidado: "MEDIUM",
      score_status: "NO_LICENCE",
      cnaes_principal: [{ code: "56.11-2-01", text: "Restaurantes e similares" }],
    },
    {
      id: "company-3",
      org_id: "org-1",
      cnpj: "33.333.333/0001-33",
      razao_social: "Empresa Placeholder Ltda",
      nome_fantasia: "Empresa Placeholder",
      municipio: "Anápolis",
      situacao: "ativa",
      score_urgencia: 10,
      risco_consolidado: null,
      score_status: "UNMAPPED_CNAE",
      cnaes_principal: [{ code: "00.00-0-00", text: "Não informado" }],
    },
    {
      id: "company-4",
      org_id: "org-1",
      cnpj: "44.444.444/0001-44",
      razao_social: "Empresa Nula Ltda",
      nome_fantasia: "Empresa Nula",
      municipio: "Anápolis",
      situacao: "ativa",
      score_urgencia: null,
      risco_consolidado: null,
      score_status: null,
      cnaes_principal: [],
    },
  ];
  const licencas = [
    {
      id: "lic-1",
      org_id: "org-1",
      company_id: "company-1",
      empresa: "Empresa Alto Score Ltda",
      cnpj: "11.111.111/0001-11",
      municipio: "Anápolis",
      tipo: "Sanitária",
      status: "vencido",
      validade: "01/01/2025",
    },
    {
      id: "lic-2",
      org_id: "org-1",
      company_id: "company-2",
      empresa: "Empresa Sem Licença Ltda",
      cnpj: "22.222.222/0001-22",
      municipio: "Anápolis",
      tipo: "Funcionamento",
      status: "vencido",
      validade: "05/01/2025",
    },
  ];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    const fulfillJson = (payload: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });

    if (path === "/api/v1/auth/me" && method === "GET") {
      return fulfillJson({
        id: "user-1",
        org_id: "org-1",
        email: "admin@mock.local",
        roles: [{ name: "ADMIN" }],
      });
    }
    if (path === "/api/v1/companies/municipios" && method === "GET") {
      return fulfillJson(["Anápolis"]);
    }
    if (path === "/api/v1/companies" && method === "GET") {
      return fulfillJson(companies);
    }
    if (path === "/api/v1/licencas" && method === "GET") {
      return fulfillJson(licencas);
    }
    if (path === "/api/v1/taxas" && method === "GET") {
      return fulfillJson([]);
    }
    if (path === "/api/v1/processos" && method === "GET") {
      return fulfillJson([]);
    }
    if (path === "/api/v1/certificados" && method === "GET") {
      return fulfillJson([]);
    }
    if (path === "/api/v1/grupos/kpis" && method === "GET") {
      return fulfillJson({});
    }
    return fulfillJson({});
  });
}

test.describe("Portal S10.3 scoring", () => {
  test("exibe score/risco/status, filtra por risco e ordena por score com nulls last", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await page.getByTestId("nav-tab-empresas").first().click();
    await expect(page.getByTestId("companies-summary")).toBeVisible();
    await expect(page.getByTestId("company-score-value").first()).toBeVisible();
    await expect(page.getByTestId("company-risk-badge").first()).toBeVisible();
    await expect(page.getByTestId("company-score-status").first()).toBeVisible();

    const firstRow = page.locator('[data-testid="company-card"]').first();
    await expect(firstRow).toContainText("Empresa Alto Score");
    await expect(firstRow.getByTestId("company-score-value")).toContainText("95");
    await expect(page.getByText("Sem licença datada")).toBeVisible();
    await expect(page.getByText("Sem CNAE")).toBeVisible();

    await page.getByTestId("companies-summary").getByRole("button", { name: "Filtros avançados" }).click();
    await page.getByTestId("companies-risk-filter-HIGH").click();
    await page.getByRole("button", { name: "Aplicar" }).click();

    const filteredRows = page.locator('[data-testid="company-card"]');
    await expect(filteredRows).toHaveCount(1);
    await expect(filteredRows.first()).toContainText("Empresa Alto Score");

    await page.getByTestId("companies-summary").getByRole("button", { name: "Filtros avançados" }).click();
    await page.getByTestId("companies-risk-filter-todos").click();
    await page.getByRole("button", { name: "Aplicar" }).click();

    await page.getByTestId("companies-sort-score").click();
    const ascendingFirstRow = page.locator('[data-testid="company-card"]').first();
    await expect(ascendingFirstRow).toContainText("Empresa Placeholder");

    const nullRow = page
      .locator('[data-testid="company-card"]')
      .filter({ hasText: "Empresa Nula" });
    await expect(nullRow.getByTestId("company-score-value")).toContainText("—");
    await expect(nullRow.getByTestId("company-risk-badge")).toContainText("—");
    await expect(nullRow.getByTestId("company-score-status")).toContainText("—");
  });

  test("aba Licenças aplica filtro por risco de score", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await page.getByTestId("nav-tab-licencas").first().click();
    await expect(page.getByTestId("licencas-score-risk-filter")).toBeVisible();
    await expect(page.getByText("Empresa Alto Score Ltda")).toBeVisible();
    await expect(page.getByText("Empresa Sem Licença Ltda")).toBeVisible();

    await page.getByTestId("licencas-score-risk-filter").click();
    await page.getByRole("option", { name: "Risco alto" }).click();

    await expect(page.getByText("Empresa Alto Score Ltda")).toBeVisible();
    await expect(page.getByText("Empresa Sem Licença Ltda")).toHaveCount(0);
  });
});
