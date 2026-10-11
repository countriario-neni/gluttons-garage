import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Run `npm run build` first: the server serves the static export in out/.
  webServer: { command: "npx serve out -l 4173", url: "http://localhost:4173", reuseExistingServer: true },
});
