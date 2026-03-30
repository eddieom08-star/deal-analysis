import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.CI ? 3003 : 3003;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(process.env.CI
    ? {
        webServer: {
          command: `npx next dev --turbopack -p ${PORT}`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: false,
          timeout: 60000,
        },
      }
    : {}),
});
