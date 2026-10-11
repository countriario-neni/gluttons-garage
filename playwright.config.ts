import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // The takeaway mode sheet occasionally misses its 5 s hydration window when workers compete for CPU.
  retries: 1,
  use: { baseURL: "http://localhost:4173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Builds the static export with the E2E-only `window.__ggStore` bridge (NEXT_PUBLIC_E2E=1), then serves out/.
  // Never reuse a server: a plain `npm run build` has no bridge and the tracking specs would fail.
  webServer: {
    command: "npm run build && npx serve out -l 4173",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_PUBLIC_E2E: "1" },
  },
});
