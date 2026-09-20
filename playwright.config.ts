import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite. Runs against a production build served in demo mode
 * (TYPESAFE_API_KEY forced empty), so no test ever needs or sends a real key.
 * Run `pnpm build` first; `pnpm test:e2e` then starts `next start` itself.
 */
const PORT = 3123;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(a11y|navigation|judge|check-editing)\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { TYPESAFE_API_KEY: "" },
  },
});
