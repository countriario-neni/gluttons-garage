import { expect, test } from "@playwright/test";
import { items } from "../../src/data/menu";
import { addPlain, chooseTakeaway, fillContact, NOON_IST, ordersFor, plain, salad, search, sprouts } from "./helpers";

/** Ordering flow against the LocalStore build (no Supabase env). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

test.describe("QR landing /t/", () => {
  test("invalid table shows the table picker", async ({ page }) => {
    await page.goto("/t/?table=abc");
    await expect(page.getByRole("heading", { name: "Choose your table" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Table 1", exact: true })).toBeVisible();
  });

  test("out-of-range and missing tables show the picker", async ({ page }) => {
    await page.goto("/t/?table=999");
    await expect(page.getByRole("heading", { name: "Choose your table" })).toBeVisible();
    await page.goto("/t/");
    await expect(page.getByRole("heading", { name: "Choose your table" })).toBeVisible();
  });

  test("valid table lands on /order/ in dine-in mode", async ({ page }) => {
    await page.goto("/t/?table=7");
    await expect(page).toHaveURL(/\/order\/$/);
    await expect(page.getByRole("button", { name: /Dine-in · Table 7/ })).toBeVisible();
  });

  test("picking a table from the picker starts ordering", async ({ page }) => {
    await page.goto("/t/?table=abc");
    await page.getByRole("button", { name: "Table 3", exact: true }).click();
    await expect(page).toHaveURL(/\/order\/$/);
    await expect(page.getByRole("button", { name: /Dine-in · Table 3/ })).toBeVisible();
  });
});

test.describe("ordering", () => {
  test("(a) dine-in via table QR, two items with options, pay by UPI QR", async ({ page }) => {
    const phone = "9876500001";
    await page.goto("/t/?table=4");
    await expect(page.getByRole("button", { name: /Dine-in · Table 4/ })).toBeVisible();

    // Item 1: single-choice dressing.
    await search(page, "fruit salad");
    await page.getByRole("button", { name: `Add ${salad.name}`, exact: true }).click();
    let sheet = page.getByRole("dialog", { name: salad.name });
    await expect(sheet.getByRole("radio").first()).toBeChecked(); // 0-delta base pre-selected
    await sheet.getByRole("radio", { name: /Yogurt/ }).check();
    await sheet.getByRole("button", { name: /add to cart/i }).click();
    await expect(sheet).toBeHidden();

    // Item 2: paid add-on, qty 2.
    await search(page, "sprouts");
    await page.getByRole("button", { name: `Add ${sprouts.name}`, exact: true }).click();
    sheet = page.getByRole("dialog", { name: sprouts.name });
    await sheet.getByRole("checkbox", { name: /Honey \/ Maple Syrup/ }).check();
    await sheet.getByRole("button", { name: "Increase quantity" }).click();
    await expect(sheet.getByRole("button", { name: /add to cart/i })).toContainText("₹140"); // (45 + 25) × 2
    await sheet.getByRole("button", { name: /add to cart/i }).click();

    const bar = page.locator("[data-cart-bar]");
    await expect(bar).toContainText("3 items");
    await bar.getByRole("link", { name: /checkout/i }).click();

    await expect(page).toHaveURL(/\/checkout\/$/);
    await expect(page.getByText("Table 4")).toBeVisible();
    await fillContact(page, phone);
    await expect(page.getByRole("radio", { name: /pay online/i })).toBeChecked();
    await page.getByRole("button", { name: /place order/i }).click();

    const pay = page.getByRole("dialog", { name: /pay .* to gluttons garage/i });
    await expect(pay).toBeVisible();
    await pay.getByRole("tab", { name: /scan qr/i }).click();
    await expect(pay.getByText(/waiting for payment/i)).toBeVisible();
    await pay.getByRole("button", { name: /simulate payment received/i }).click();
    await expect(pay.getByText(/payment successful/i)).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/track\/\?id=/, { timeout: 10_000 });
    const id = new URL(page.url()).searchParams.get("id");
    const [order] = await ordersFor(page, phone);
    expect(order.id).toBe(id);
    expect(order.paymentStatus).toBe("paid");
  });

  test("(b) takeaway slot, pay by card", async ({ page }) => {
    const phone = "9876500002";
    await page.goto("/order/");
    await chooseTakeaway(page);
    await expect(page.getByRole("button", { name: /Takeaway · \d{1,2}:\d{2} (AM|PM)/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();

    await fillContact(page, phone);
    await page.getByRole("button", { name: /place order/i }).click();
    const pay = page.getByRole("dialog", { name: /pay .* to gluttons garage/i });
    await pay.getByRole("tab", { name: /cards/i }).click();
    await pay.getByLabel("Card number").fill("4111111111111111");
    await expect(pay.getByLabel("Card number")).toHaveValue("4111 1111 1111 1111");
    await expect(pay.getByText("Visa", { exact: true })).toBeVisible();
    await pay.getByLabel(/expiry/i).fill("1230");
    await expect(pay.getByLabel(/expiry/i)).toHaveValue("12/30");
    await pay.getByLabel("CVV").fill("123");
    await pay.getByLabel("Name on card").fill("Asha Rao");
    await pay.getByRole("button", { name: /^pay ₹/i }).click();
    await expect(pay.getByText(/payment successful/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/track\/\?id=/, { timeout: 10_000 });
    const [order] = await ordersFor(page, phone);
    expect(order.paymentStatus).toBe("paid");
  });

  test("(c) takeaway hides cash and split", async ({ page }) => {
    await page.goto("/order/");
    await chooseTakeaway(page);
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await expect(page.getByRole("radio", { name: /pay online/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /pay at counter/i })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /split/i })).toHaveCount(0);
  });

  test("dine-in offers cash and split; split shows the counter remainder", async ({ page }) => {
    await page.goto("/t/?table=2");
    await expect(page.getByRole("button", { name: /Dine-in · Table 2/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await page.getByRole("radio", { name: /split/i }).check();
    await page.getByLabel(/pay online now/i).fill("50");
    // Shown under the input and repeated in the bill summary.
    await expect(page.getByText(/Pay ₹50 now, ₹\d+ at counter/).first()).toBeVisible();
  });

  test("(d) double-clicking Place order creates exactly one order", async ({ page }) => {
    const phone = "9876500004";
    await page.goto("/t/?table=5");
    await expect(page.getByRole("button", { name: /Dine-in · Table 5/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await fillContact(page, phone);
    await page.getByRole("button", { name: /place order/i }).dblclick();
    await expect(page.getByRole("dialog", { name: /pay .* to gluttons garage/i })).toBeVisible();
    await page.waitForTimeout(500);
    expect(await ordersFor(page, phone)).toHaveLength(1);
  });

  test("(e) an invalid card number shows an inline error", async ({ page }) => {
    await page.goto("/t/?table=6");
    await expect(page.getByRole("button", { name: /Dine-in · Table 6/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await fillContact(page, "9876500005");
    await page.getByRole("button", { name: /place order/i }).click();
    const pay = page.getByRole("dialog", { name: /pay .* to gluttons garage/i });
    await pay.getByRole("tab", { name: /cards/i }).click();
    await pay.getByLabel("Card number").fill("4111111111111112");
    await pay.getByLabel(/expiry/i).fill("1230");
    await pay.getByLabel("CVV").fill("123");
    await pay.getByLabel("Name on card").fill("Asha Rao");
    await pay.getByRole("button", { name: /^pay ₹/i }).click();
    await expect(pay.getByText("Enter a valid card number")).toBeVisible();
    await expect(pay.getByLabel("Card number")).toHaveAttribute("aria-invalid", "true");
  });

  test("invalid phone shows an inline error and places nothing", async ({ page }) => {
    await page.goto("/t/?table=8");
    await expect(page.getByRole("button", { name: /Dine-in · Table 8/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await fillContact(page, "12345");
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText(/enter a 10-digit indian mobile number/i)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a coupon rejected at placement shows its error on the coupon input and creates no order", async ({ page }) => {
    const phone = "9876500006";
    await page.goto("/t/?table=3");
    await expect(page.getByRole("button", { name: /Dine-in · Table 3/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    // Lift the cart over TIRAMISU50's ₹400 minimum, apply it, then drop back under it.
    const inc = page.getByRole("button", { name: `Increase quantity ${plain.name}` });
    await inc.click();
    await inc.click();
    await page.getByLabel("Coupon code").fill("TIRAMISU50");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("TIRAMISU50 applied")).toBeVisible();
    await page.getByRole("button", { name: `Decrease quantity ${plain.name}` }).click();
    await page.getByRole("button", { name: `Decrease quantity ${plain.name}` }).click();
    await fillContact(page, phone);
    await page.getByRole("button", { name: /place order/i }).click();

    const input = page.getByLabel("Coupon code");
    await expect(page.getByRole("alert").filter({ hasText: "Your order is below this coupon's minimum amount." })).toBeVisible();
    await expect(input).toHaveValue("TIRAMISU50");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await ordersFor(page, phone)).toHaveLength(0);
  });

  test("an abandoned takeaway payment doesn't block a new cart", async ({ page }) => {
    await page.goto("/order/");
    await chooseTakeaway(page);
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await fillContact(page, "9876500007");
    await page.getByRole("button", { name: /place order/i }).click();
    const pay = page.getByRole("dialog", { name: /pay .* to gluttons garage/i });
    await expect(pay).toBeVisible();
    await page.keyboard.press("Escape"); // abandon
    await expect(page.getByRole("heading", { name: /order GG-\d+ placed/i })).toBeVisible();

    // Shopping again: the new cart wins over the unpaid order.
    const other = items.find((i) => i.options.length === 0 && i.available && i.id !== plain.id)!;
    await page.goto("/order/");
    await addPlain(page, other.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await expect(page.getByText(other.name, { exact: true })).toBeVisible();
    await expect(page.getByText(/earlier order GG-\d+ was left unpaid/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible();
  });

  test("the placed panel can cancel an unpaid payment and start over", async ({ page }) => {
    await page.goto("/t/?table=10");
    await expect(page.getByRole("button", { name: /Dine-in · Table 10/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await fillContact(page, "9876500008");
    await page.getByRole("button", { name: /place order/i }).click();
    await page.keyboard.press("Escape");
    await page.reload(); // the pending payment survives a reload…
    await expect(page.getByRole("heading", { name: /order GG-\d+ placed/i })).toBeVisible();
    await page.getByRole("button", { name: /cancel this payment and start a new order/i }).click();
    // …until it is cancelled: back to checkout with the (now empty) cart.
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });

  test("cart persists across reloads", async ({ page }) => {
    await page.goto("/t/?table=9");
    await expect(page.getByRole("button", { name: /Dine-in · Table 9/ })).toBeVisible();
    await addPlain(page, plain.name);
    await expect(page.locator("[data-cart-bar]")).toContainText("1 item");
    await page.reload();
    await expect(page.locator("[data-cart-bar]")).toContainText("1 item");
    await expect(page.getByRole("button", { name: /Dine-in · Table 9/ })).toBeVisible();
  });

  test("no console errors on /order and /checkout", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/t/?table=1");
    await expect(page.getByRole("button", { name: /Dine-in · Table 1/ })).toBeVisible();
    await addPlain(page, plain.name);
    await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
    await expect(page.getByRole("button", { name: /place order/i })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
