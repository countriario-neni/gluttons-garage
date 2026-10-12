import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addPlain, NOON_IST, placeDineIn, plain } from "./helpers";

async function scan(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

test("home has no serious a11y violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await scan(page);
});

test("menu has no serious a11y violations", async ({ page }) => {
  await page.goto("/menu/");
  await page.waitForLoadState("networkidle");
  await scan(page);
});

test("order page (dine-in set) has no serious a11y violations", async ({ page }) => {
  await page.goto("/t/?table=3");
  await expect(page.getByRole("button", { name: /Dine-in · Table 3/ })).toBeVisible();
  await page.goto("/order/");
  await page.waitForLoadState("networkidle");
  await scan(page);
});

test("checkout with a cart has no serious a11y violations", async ({ page }) => {
  await page.goto("/t/?table=3");
  await addPlain(page, plain.name);
  await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await scan(page);
});

test("tracking and staff orders have no serious a11y violations", async ({ page }) => {
  await placeDineIn(page, { table: 4, phone: "9812345678", pay: "cash" });
  await expect(page).toHaveURL(/\/track\/\?id=/);
  await page.waitForLoadState("networkidle");
  await scan(page);

  await page.goto("/staff/");
  await page.getByRole("button", { name: /sign in as owner/i }).click();
  await expect(page).toHaveURL(/\/staff\/orders\//);
  await page.waitForLoadState("networkidle");
  await scan(page);
});
