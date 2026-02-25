import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.ECONTROLE_E2E_PORTAL_BASE_URL?.replace(/\/+$/u, "") ||
  "http://127.0.0.1:5174";

export default defineConfig({
  testDir: "./tests_e2e/portal",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
