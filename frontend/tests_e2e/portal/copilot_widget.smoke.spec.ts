import { expect, test } from "@playwright/test";

async function ensureCompanySelected(page: Parameters<typeof test>[0]["page"]) {
  if (await page.getByTestId("copilot-company-selected").count()) return;
  await expect(page.getByTestId("copilot-step-company")).toBeVisible();
  await page.getByTestId("copilot-company-search").fill("Empresa");
  await expect(page.getByTestId("copilot-company-option").first()).toBeVisible();
  await page.getByTestId("copilot-company-option").first().click();
  await expect(page.getByTestId("copilot-company-selected")).toBeVisible();
}

async function setupMockApi(page: Parameters<typeof test>[0]["page"]) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("access_token", "mock-token");
  });

  const companies = [
    { id: "company-1", razao_social: "Empresa Copilot LTDA", cnpj: "12345678000199", municipio: "Anápolis" },
  ];
  let copilotCalls = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const formData = request.postDataBuffer();

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
        roles: ["ADMIN"],
      });
    }
    if (path === "/api/v1/companies/municipios" && method === "GET") return fulfillJson(["Anápolis"]);
    if (path === "/api/v1/companies" && method === "GET") {
      if (url.searchParams.get("razao_social")) return fulfillJson(companies);
      return fulfillJson(companies);
    }
    if (path === "/api/v1/licencas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/taxas" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/processos" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/certificados" && method === "GET") return fulfillJson([]);
    if (path === "/api/v1/grupos/kpis" && method === "GET") return fulfillJson({});
    if (path === "/api/v1/notificacoes/unread-count" && method === "GET") return fulfillJson({ unread_count: 0 });
    if (path === "/api/v1/notificacoes" && method === "GET") return fulfillJson({ items: [], total: 0, limit: 20, offset: 0 });

    if (path === "/api/v1/copilot/respond" && method === "POST") {
      copilotCalls += 1;
      const map: Record<number, { category: string; requiresCompany: boolean }> = {
        1: { category: "COMPANY_SUMMARY", requiresCompany: false },
        2: { category: "DUVIDAS_DIVERSAS", requiresCompany: false },
        3: { category: "DUVIDAS_DIVERSAS", requiresCompany: true },
        4: { category: "RISK_SIMULATION", requiresCompany: false },
        5: { category: "DOCUMENT_ANALYSIS", requiresCompany: false },
      };
      const resolved = map[copilotCalls] || { category: "DUVIDAS_DIVERSAS", requiresCompany: false };
      const category = resolved.category;
      const requiresCompany = resolved.requiresCompany;
      return fulfillJson({
        category,
        company_context: {
          company_id: requiresCompany ? null : "company-1",
          razao_social: requiresCompany ? null : "Empresa Copilot LTDA",
          cnpj: "12345678000199",
          municipio: "Anápolis",
          risk_tier: "HIGH",
          score_urgencia: 70,
          score_status: "OK",
        },
        answer_markdown: requiresCompany ? "Para essa pergunta eu preciso da empresa selecionada." : "Resposta estruturada do copiloto.",
        sections: [
          { id: "resumo", title: "Resumo", kind: "markdown", content: requiresCompany ? "Selecione a empresa" : "Resumo da análise", items: [] },
          { id: "evidencias", title: "Evidências", kind: "list", content: "Dados usados", items: ["Item A"] },
        ],
        suggested_actions: [
          { id: "go-licences", label: "Ir para licenças", action_type: "NAVIGATE", target: "/painel?tab=licencas" },
        ],
        warnings: category === "DOCUMENT_ANALYSIS" ? ["Provider indisponível"] : [],
        evidence: [{ label: "Fonte", value: "mock", source: "test" }],
        grounding_used: category === "DUVIDAS_DIVERSAS" && !requiresCompany,
        sources:
          category === "DUVIDAS_DIVERSAS" && !requiresCompany
            ? [{ title: "Prefeitura de Anápolis", url: "https://anapolis.go.gov.br/tpi", snippet: "Fonte oficial" }]
            : [],
        requires_company: requiresCompany,
        not_conclusive_reason: category === "DOCUMENT_ANALYSIS" ? "Evidência insuficiente" : null,
        simulation_result:
          category === "RISK_SIMULATION"
            ? {
                score_before: 70,
                score_after: 55,
                delta: -15,
                risk_tier_before: "HIGH",
                risk_tier_after: "HIGH",
                applied_assumptions: ["cercon_valid_until"],
                top_impacts: [],
              }
            : null,
      });
    }

    return fulfillJson({});
  });
}

test.describe("Copilot Widget smoke", () => {
  test("abre, minimiza e executa fluxos guiados", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/painel");

    await expect(page.getByTestId("copilot-launcher")).toBeVisible();
    await page.getByTestId("copilot-launcher").click();
    await expect(page.getByTestId("copilot-panel")).toBeVisible();
    await expect(page.getByTestId("copilot-step-categories")).toBeVisible();

    await page.getByTestId("copilot-minimize").click();
    await expect(page.getByTestId("copilot-panel")).toHaveCount(0);
    await expect(page.getByTestId("copilot-launcher")).toBeVisible();
    await page.getByTestId("copilot-launcher").click();
    await expect(page.getByTestId("copilot-step-categories")).toBeVisible();

    await page.getByTestId("copilot-category-COMPANY_SUMMARY").click();
    await expect(page.getByTestId("copilot-input-locked")).toBeVisible();
    await expect(page.getByTestId("copilot-manual-input")).toHaveCount(0);

    await page.getByTestId("copilot-company-search").fill("Empresa");
    await expect(page.getByTestId("copilot-company-option").first()).toBeVisible();
    await page.getByTestId("copilot-company-option").first().click();

    await expect(page.getByTestId("copilot-manual-input")).toBeVisible();
    await page.getByTestId("copilot-example-chip").first().click();
    await expect(page.getByTestId("copilot-response-structured")).toBeVisible();

    await page.getByTestId("copilot-close").click();
    await page.getByTestId("copilot-launcher").click();
    await page.getByTestId("copilot-category-DUVIDAS_DIVERSAS").click();
    await expect(page.getByTestId("copilot-manual-input")).toBeVisible();
    await page.getByTestId("copilot-manual-input").fill("O que influencia o score de urgência?");
    await page.getByTestId("copilot-send").click();
    await expect(page.getByText("O que influencia o score de urgência?")).toBeVisible();
    await expect(page.getByTestId("copilot-grounding-indicator")).toBeVisible();
    await expect(page.getByTestId("copilot-source-link").first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByTestId("copilot-manual-input").fill("Essa empresa paga TPI?");
    await page.getByTestId("copilot-send").click();
    await expect(page.getByTestId("copilot-step-company")).toBeVisible();
    await expect(page.getByTestId("copilot-input-locked")).toBeVisible();

    await page.getByTestId("copilot-change-category").click();
    await page.getByTestId("copilot-category-RISK_SIMULATION").click();
    await ensureCompanySelected(page);
    await page.getByTestId("copilot-example-chip").first().click();
    await expect(page.getByTestId("copilot-response-structured")).toBeVisible();

    await page.getByTestId("copilot-change-category").click();
    await page.getByTestId("copilot-category-DOCUMENT_ANALYSIS").click();
    await ensureCompanySelected(page);
    await page.getByTestId("copilot-document-upload").setInputFiles({
      name: "doc.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("teste documento"),
    });
    await expect(page.getByTestId("copilot-document-upload-container")).toBeVisible();
    await page.getByTestId("copilot-send").click();
    await expect(page.getByTestId("copilot-document-status")).toHaveCount(0);
    await expect(page.getByTestId("copilot-response-structured")).toBeVisible();
  });

  test("mostra erro amigável quando provider falha", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem("access_token", "mock-token");
    });
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
        return fulfillJson({ id: "user-1", org_id: "org-1", email: "admin@mock.local", roles: ["ADMIN"] });
      }
      if (path === "/api/v1/companies/municipios" && method === "GET") return fulfillJson(["Anápolis"]);
      if (path === "/api/v1/companies" && method === "GET")
        return fulfillJson([{ id: "company-1", razao_social: "Empresa Copilot LTDA", cnpj: "12345678000199", municipio: "Anápolis" }]);
      if (path === "/api/v1/licencas" && method === "GET") return fulfillJson([]);
      if (path === "/api/v1/taxas" && method === "GET") return fulfillJson([]);
      if (path === "/api/v1/processos" && method === "GET") return fulfillJson([]);
      if (path === "/api/v1/certificados" && method === "GET") return fulfillJson([]);
      if (path === "/api/v1/grupos/kpis" && method === "GET") return fulfillJson({});
      if (path === "/api/v1/notificacoes/unread-count" && method === "GET") return fulfillJson({ unread_count: 0 });
      if (path === "/api/v1/notificacoes" && method === "GET") return fulfillJson({ items: [], total: 0, limit: 20, offset: 0 });
      if (path === "/api/v1/copilot/respond" && method === "POST") {
        return fulfillJson({ detail: "Chave Gemini ausente. Configure GEMINI_API_KEY." }, 503);
      }
      return fulfillJson({});
    });

    await page.goto("/painel");
    await page.getByTestId("copilot-launcher").click();
    await page.getByTestId("copilot-category-DUVIDAS_DIVERSAS").click();
    await page.getByTestId("copilot-manual-input").fill("O que é TPI?");
    await page.getByTestId("copilot-send").click();
    await expect(page.getByText("Chave Gemini ausente. Configure GEMINI_API_KEY para usar o copiloto.")).toBeVisible();
  });
});
