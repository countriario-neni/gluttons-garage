import { expect, test, type Page } from "@playwright/test";
import { formatINR } from "../../src/domain/money";
import { NOON_IST, plain } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

/** A second tab on the public menu; the first-visit "how are you eating" sheet is dismissed so the menu is usable. */
async function openGuest(page: Page) {
  const guest = await page.context().newPage();
  await guest.clock.setFixedTime(NOON_IST);
  await guest.goto("/order/");
  const sheet = guest.getByRole("dialog", { name: /how are you eating/i });
  if (await sheet.isVisible().catch(() => false)) await guest.keyboard.press("Escape");
  await guest.getByRole("searchbox", { name: /search the menu/i }).fill(plain.name);
  return guest;
}

async function signInAs(page: Page, who: "Owner" | "Kitchen") {
  await page.goto("/staff/");
  await page.getByRole("button", { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/staff\/orders\/$/);
}

async function openMenu(page: Page, who: "Owner" | "Kitchen") {
  await signInAs(page, who);
  await page.getByRole("link", { name: "Menu", exact: true }).first().click();
  await expect(page).toHaveURL(/\/staff\/menu\/$/);
  await page.getByRole("searchbox", { name: "Search dishes" }).fill(plain.name);
  await expect(page.locator(`[data-item="${plain.id}"]`)).toBeVisible();
}

const orderCard = (page: Page) => page.locator(`article#${plain.id}`);

test("kitchen marks a dish sold out and the public order page updates live", async ({ page }) => {
  const guest = await openGuest(page);
  await expect(orderCard(guest)).toBeVisible();
  await expect(orderCard(guest).getByText("Sold out")).toHaveCount(0);

  await openMenu(page, "Kitchen");
  await page.getByRole("switch", { name: `${plain.name} available` }).click();
  await expect(page.locator(`[data-item="${plain.id}"]`)).toHaveAttribute("data-available", "false");

  await expect(orderCard(guest).getByText("Sold out")).toBeVisible({ timeout: 3000 });
  await expect(orderCard(guest)).toHaveAttribute("data-sold", "true");

  await page.getByRole("switch", { name: `${plain.name} available` }).click();
  await expect(orderCard(guest).getByText("Sold out")).toHaveCount(0, { timeout: 3000 });
});

test("kitchen sees no Edit buttons; owner does", async ({ page }) => {
  await openMenu(page, "Kitchen");
  await expect(page.getByText(/only the owner can edit/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
});

test("owner edits a price and the public menu shows it", async ({ page }) => {
  await openMenu(page, "Owner");
  await page.getByRole("button", { name: `Edit ${plain.name}` }).click();
  const sheet = page.getByRole("dialog", { name: /edit dish/i });
  await sheet.getByLabel("Price (₹)").fill("0");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/price must be a whole number/i)).toBeVisible();
  await expect(sheet).toBeVisible();

  const price = plain.price + 17;
  await sheet.getByLabel("Price (₹)").fill(String(price));
  await sheet.getByRole("switch", { name: "Bestseller" }).click();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();

  const guest = await openGuest(page);
  await expect(orderCard(guest)).toContainText(formatINR(price));
  await expect(orderCard(guest)).toContainText("Bestseller");
});

test("owner adds an option with a stable new id and keeps the existing ones", async ({ page }) => {
  await openMenu(page, "Owner");
  await page.getByRole("button", { name: `Edit ${plain.name}` }).click();
  const sheet = page.getByRole("dialog", { name: /edit dish/i });
  await sheet.getByRole("button", { name: "Add option group" }).click();
  await sheet.getByLabel("Group name").first().fill("Spice");
  await sheet.getByLabel("Option label").first().fill("Extra hot");
  await sheet.getByLabel("Extra price").first().fill("10");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();
  const ids = await page.evaluate(async (id) => {
    const menu = await window.__ggStore!.getMenu();
    return menu.items.find((i) => i.id === id)!.options.map((o) => o.id);
  }, plain.id);
  expect(ids).toEqual([`${plain.id}--spice-extra-hot`]);
});

test("tables: 10 QR cards point at /t/?table=N; owner can change the count", async ({ page }) => {
  await signInAs(page, "Owner");
  await page.getByRole("link", { name: "Tables", exact: true }).first().click();
  await expect(page).toHaveURL(/\/staff\/tables\/$/);
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(10);
  for (let n = 1; n <= 10; n++) {
    const card = cards.nth(n - 1);
    await expect(card).toHaveAttribute("data-qr-url", new RegExp(`/t/\\?table=${n}$`));
    await expect(card.getByRole("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(card).toContainText(`Table ${n}`);
  }

  const download = page.waitForEvent("download");
  await cards.nth(2).getByRole("button", { name: /download png/i }).click();
  expect((await download).suggestedFilename()).toBe("gluttons-garage-table-3.png");

  const field = page.getByLabel("Number of tables");
  await field.fill("60");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/from 1 to 50/i).first()).toBeVisible();
  await field.fill("12");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(cards).toHaveCount(12);
});

test("tables: kitchen can print but not change the count", async ({ page }) => {
  await signInAs(page, "Kitchen");
  await page.getByRole("link", { name: "Tables", exact: true }).first().click();
  await expect(page.getByRole("article")).toHaveCount(10);
  await expect(page.getByLabel("Number of tables")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Print all" })).toBeEnabled();
});
