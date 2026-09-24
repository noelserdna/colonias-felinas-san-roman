import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:4321", trace: "retain-on-failure" },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev -- --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
