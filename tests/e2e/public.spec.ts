import { expect, test, type Page } from "@playwright/test";
import { cafe } from "../../src/data/cafe";
import { categories, items } from "../../src/data/menu";
import { dietOf } from "../../src/lib/menu";

/** Collects console errors and uncaught page errors while a page loads. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("home page", () => {
  test("h1 names the cafe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Gluttons Garage");
  });

  test("Call link dials the cafe", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^call/i }).first()).toHaveAttribute("href", "tel:+917702368884");
  });

  test("WhatsApp FAB opens a chat with the cafe", async ({ page }) => {
    await page.goto("/");
    const fab = page.getByTestId("whatsapp-fab");
    await expect(fab).toBeVisible();
    expect(await fab.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/917702368884/);
  });

  test("Instagram link points to the profile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /instagram/i }).first()).toHaveAttribute("href", cafe.instagram);
  });

  test("reviews are labelled as samples", async ({ page }) => {
    await page.goto("/");
    const reviews = page.locator("#reviews");
    await expect(reviews.getByText("Sample reviews", { exact: true })).toBeVisible();
    await expect(reviews.getByRole("link", { name: /google/i }).first()).toHaveAttribute("href", cafe.mapsUrl);
  });

  test("no console errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("menu page", () => {
  test("lists every category", async ({ page }) => {
    await page.goto("/menu/");
    for (const c of categories) {
      await expect(page.getByRole("heading", { level: 2, name: c.name, exact: true })).toHaveCount(1);
    }
  });

  test("search narrows the list", async ({ page }) => {
    await page.goto("/menu/");
    await page.getByRole("searchbox", { name: /search/i }).fill("nutella pancakes");
    await expect(page.getByRole("heading", { level: 3, name: "Nutella Pancakes" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "BBQ Potato Wedges" })).toHaveCount(0);
  });

  test("veg filter hides non-veg dishes", async ({ page }) => {
    const veg = items.find((i) => dietOf(i) === "veg")!;
    const nonVeg = items.find((i) => dietOf(i) === "non-veg")!;
    await page.goto("/menu/");
    await expect(page.getByRole("heading", { level: 3, name: nonVeg.name, exact: true })).toHaveCount(1);
    await page.getByRole("switch", { name: /veg only/i }).click();
    await expect(page.getByRole("heading", { level: 3, name: nonVeg.name, exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: veg.name, exact: true })).toHaveCount(1);
  });

  test("no console errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/menu/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});
