import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "tests/e2e",
  retries: 0,
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Builds the static export with the E2E-only `window.__ggStore` bridge (NEXT_PUBLIC_E2E=1), then serves out/.
  // Never reuse a server: a plain `npm run build` has no bridge and the tracking specs would fail.
  webServer: {
    command: `npm run build && npx serve out -l ${port} --no-compression`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { NEXT_PUBLIC_E2E: "1" },
  },
});
