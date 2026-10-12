import { expect, test, type Page } from "@playwright/test";
import { NOON_IST, placeDineIn, staffTab } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

async function signInAs(page: Page, who: "Owner" | "Kitchen") {
  await page.goto("/staff/");
  await page.getByRole("button", { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/staff\/orders\/$/);
}

const rupees = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));

test.describe("reports", () => {
  test("Today revenue increases after a new order is paid and completed", async ({ page }) => {
    const staff = await staffTab(page);
    await staff.page.goto("/staff/reports/");
    await staff.page.getByRole("button", { name: "Today", exact: true }).click();
    const revenue = staff.page.getByTestId("kpi-revenue");
    await expect(revenue).toBeVisible();
    const before = rupees(await revenue.textContent());

    const id = await placeDineIn(page, { table: 4, phone: "9000011122", pay: "upi" });
    await staff.setStatus(id, "accepted", "preparing", "ready", "completed");

    await expect.poll(async () => rupees(await revenue.textContent()), { timeout: 10_000 }).toBeGreaterThan(before);
  });

  test("Export CSV downloads a header row and data rows", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/reports/");
    await page.getByRole("button", { name: "30 days", exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /export csv/i }).click()]);
    expect(download.suggestedFilename()).toMatch(/^gluttons-garage-orders-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const lines = Buffer.concat(chunks).toString("utf8").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Order,Placed at,Customer,Phone,/);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  test("custom range rejects an end date before the start", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/reports/");
    await page.getByRole("button", { name: "Custom", exact: true }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-10-10");
    await page.getByLabel("To", { exact: true }).fill("2026-10-01");
    await expect(page.getByRole("alert").filter({ hasText: /on or before the end date/i })).toBeVisible();
  });
});

test.describe("campaigns", () => {
  test("inactive segment has recipients; sending logs a history row with that count", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/campaigns/");
    await page.getByLabel("Who gets it").selectOption("inactive_30d");
    const countText = page.getByTestId("recipient-count");
    await expect(countText).toContainText(/\d+\s+customers? will receive/);
    const n = Number(/(\d+)\s+customers?/.exec((await countText.textContent()) ?? "")![1]);
    expect(n).toBeGreaterThan(0);

    await page.getByLabel("Template").selectOption("we_miss_you");
    await expect(page.getByLabel("Message")).toHaveValue(/WINBACK15/);
    await expect(page.getByTestId("preview-text")).toContainText("WINBACK15");
    await expect(page.getByTestId("preview-text").locator("strong")).toHaveText("WINBACK15");

    await page.getByRole("button", { name: /send campaign/i }).click();
    const dialog = page.getByRole("dialog", { name: new RegExp(`send to ${n} customers?\\?`, "i") });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Send now" }).click();

    await expect(page.getByText(`Queued to ${n} customers`)).toBeVisible();
    const row = page.getByTestId("campaign-row").first();
    await expect(row).toContainText("Inactive for 30+ days");
    await expect(row.getByRole("cell").nth(1)).toHaveText(String(n));
  });
});

test.describe("settings", () => {
  test("turning accepting-orders off shows the banner on /order", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/settings/");
    const sw = page.getByRole("switch", { name: "Accepting online orders" });
    await expect(sw).toBeChecked();
    await sw.click();
    await page.getByRole("button", { name: /save settings/i }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();

    await page.goto("/order/");
    await expect(page.getByText("Not accepting online orders right now")).toBeVisible();
  });

  test("invalid hours and links block saving", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/settings/");
    await page.getByLabel("Tuesday opens").fill("23:00");
    await page.getByLabel("Swiggy (optional)").fill("not a link");
    await page.getByRole("button", { name: /save settings/i }).click();
    await expect(page.getByText(/Tuesday: Opening time must be before closing time/)).toBeVisible();
    await expect(page.getByText(/full link starting with https/).first()).toBeVisible();
    await expect(page.getByText("Settings saved")).toHaveCount(0);
  });
});

test.describe("kitchen role", () => {
  for (const path of ["/staff/reports/", "/staff/campaigns/", "/staff/settings/"]) {
    test(`cannot open ${path}`, async ({ page }) => {
      await signInAs(page, "Kitchen");
      await page.goto(path);
      await expect(page).toHaveURL(/\/staff\/orders\/$/);
    });
  }
});

test.describe("screenshots", () => {
  for (const [label, size] of [
    ["1440", { width: 1440, height: 900 }],
    ["390", { width: 390, height: 844 }],
  ] as const) {
    test(`owner screens at ${label}`, async ({ page }) => {
      await page.setViewportSize(size);
      await signInAs(page, "Owner");
      for (const name of ["reports", "campaigns", "settings"]) {
        await page.goto(`/staff/${name}/`);
        await page.getByRole("heading", { level: 1, name: new RegExp(name, "i") }).waitFor();
        await page.waitForTimeout(600); // let the charts finish their entrance animation
        await page.screenshot({ path: `test-results/screens-t13/${name}-${label}.png`, fullPage: true });
      }
    });
  }
});
