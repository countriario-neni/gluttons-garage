import { expect, test, type Page } from "@playwright/test";
import { NOON_IST, placeDineIn, staffTab } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

const status = (page: Page) => page.getByTestId("order-status");
const preview = (page: Page) => page.getByRole("region", { name: /live whatsapp messages/i });

test.describe("order tracking", () => {
  test("customer sees staff progress live: Placed, then Ready with the ready message", async ({ page }) => {
    const id = await placeDineIn(page, { table: 4, phone: "9876500101", pay: "upi" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/GG-\d+/);
    await expect(status(page)).toHaveText("Placed");
    await expect(page.getByRole("heading", { name: "Live WhatsApp messages (demo preview)" })).toBeVisible();
    await expect(preview(page).getByText(/received your payment/i)).toBeVisible();

    const staff = await staffTab(page);
    await staff.setStatus(id, "accepted", "preparing", "ready");

    await expect(status(page)).toHaveText("Ready", { timeout: 3000 });
    await expect(page.locator('[aria-current="step"]')).toContainText("Ready");
    await expect(preview(page).getByText(/is ready!/)).toBeVisible({ timeout: 3000 });
    // *bold* markup renders as <strong>, never as raw asterisks
    await expect(preview(page).locator("strong").filter({ hasText: /^GG-\d+$/ }).first()).toBeVisible();
    await expect(preview(page)).not.toContainText("*GG-");
    await expect(page.getByRole("status").filter({ hasText: /your order is now/i })).toHaveText("Your order is now Ready.");
  });

  test("a rejected order shows the destructive state with a call CTA", async ({ page }) => {
    const id = await placeDineIn(page, { table: 6, phone: "9876500102", pay: "upi" });
    const staff = await staffTab(page);
    await staff.setStatus(id, "rejected");
    await expect(status(page)).toHaveText("Rejected", { timeout: 3000 });
    await expect(page.getByRole("link", { name: /call the café/i }).first()).toHaveAttribute("href", "tel:+917702368884");
    await expect(page.getByText(/couldn't take your order/i).first()).toBeVisible();
  });

  test("missing or unknown order id shows a friendly not-found", async ({ page }) => {
    for (const url of ["/track/", "/track/?id=does-not-exist"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: "We couldn't find that order" })).toBeVisible();
      await expect(page.getByRole("link", { name: /menu/i }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /call/i }).first()).toHaveAttribute("href", /^tel:/);
    }
  });

  test("dine-in cash order shows the counter note, bill and share link", async ({ page }) => {
    await placeDineIn(page, { table: 3, phone: "9876500103", pay: "cash" });
    await expect(page.getByText(/Pay ₹\d[\d,]* at the counter/).first()).toBeVisible();
    await expect(page.getByText("Table 3").first()).toBeVisible();
    await expect(page.getByText("CGST 2.5%").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /send order on whatsapp/i })).toHaveAttribute("href", /^https:\/\/wa\.me\/917702368884\?text=/);
    await expect(page.getByRole("link", { name: /order more/i })).toHaveAttribute("href", /\/order\/$/);
  });

  test("Download bill prints only the invoice", async ({ page }) => {
    await placeDineIn(page, { table: 2, phone: "9876500104", pay: "upi" });
    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => void ((window as unknown as { __printed: number }).__printed += 1);
    });
    await page.getByRole("button", { name: /download bill/i }).click();
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

    await page.emulateMedia({ media: "print" });
    const invoice = page.locator("[data-invoice]");
    await expect(invoice).toBeVisible();
    await expect(invoice).toContainText("Gluttons Garage");
    await expect(invoice).toContainText("GSTIN: to be added");
    await expect(invoice).toContainText("SGST 2.5%");
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Live WhatsApp messages (demo preview)" })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await expect(invoice).toBeHidden();
  });
});

const SHOTS = "test-results/screens-t9";

test.describe("screenshots", () => {
  for (const [name, width, height] of [["390", 390, 844], ["1440", 1440, 900]] as const) {
    test(`placed, ready, rejected and print at ${name}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const id = await placeDineIn(page, { table: 5, phone: `98765002${name.slice(0, 2)}`, pay: "cash" });
      const staff = await staffTab(page);
      await expect(status(page)).toHaveText("Placed");
      await page.waitForTimeout(600); // let the status animation settle
      await page.screenshot({ path: `${SHOTS}/${name}-placed.png`, fullPage: true });

      await staff.setStatus(id, "accepted", "preparing", "ready");
      await expect(status(page)).toHaveText("Ready", { timeout: 3000 });
      await page.waitForTimeout(600); // let the status animation settle
      await page.screenshot({ path: `${SHOTS}/${name}-ready.png`, fullPage: true });

      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(600); // let the status animation settle
      await page.screenshot({ path: `${SHOTS}/${name}-print.png`, fullPage: true });
      await page.emulateMedia({ media: "screen" });

      const rejectedId = await placeDineIn(page, { table: 6, phone: `98765003${name.slice(0, 2)}`, pay: "upi" });
      await staff.setStatus(rejectedId, "rejected");
      await expect(status(page)).toHaveText("Rejected", { timeout: 3000 });
      await page.waitForTimeout(600); // let the status animation settle
      await page.screenshot({ path: `${SHOTS}/${name}-rejected.png`, fullPage: true });
    });
  }
});
