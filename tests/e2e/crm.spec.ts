import { expect, test, type Page } from "@playwright/test";
import { addPlain, DB_KEY, fillContact, NOON_IST, plain, placeDineIn, staffTab } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

type Row = { id: string; code: string; total: number; customerId: string };
/** The just-placed order for `phone`, read straight from the demo DB. */
async function dbOrder(page: Page, phone: string): Promise<Row> {
  return page.evaluate(
    ([key, p]) => {
      const db = JSON.parse(localStorage.getItem(key) ?? "{}") as { orders: { id: string; code: string; phone: string; customerId: string; bill: { total: number } }[] };
      const o = db.orders.find((x) => x.phone === p)!;
      return { id: o.id, code: o.code, total: o.bill.total, customerId: o.customerId };
    },
    [DB_KEY, phone] as const,
  );
}

test("a new customer tops the list; the profile shows the order, an earn entry and persistent notes", async ({ page }) => {
  const phone = "9876512001";
  const orderId = await placeDineIn(page, { table: 4, phone, pay: "upi" });
  const staff = await staffTab(page);
  await staff.page.clock.setFixedTime(NOON_IST);
  await staff.setStatus(orderId, "accepted", "preparing", "ready", "completed");
  const order = await dbOrder(page, phone);

  await staff.page.goto("/staff/customers/");
  const first = staff.page.getByTestId("customer-row").first();
  await expect(first).toContainText("Asha Rao");
  await expect(first.getByRole("link", { name: "Asha Rao" })).toHaveAttribute("href", new RegExp(`id=${order.customerId}$`));
  await expect(staff.page.getByTestId("kpi-total")).not.toHaveText("0");

  // Phone is masked until revealed.
  await expect(first.getByTestId("phone")).toHaveText("98•••••001");
  await first.getByRole("button", { name: "Reveal phone number" }).click();
  await expect(first.getByTestId("phone")).toHaveText("+91 98765 12001");

  await first.getByRole("link", { name: "Asha Rao" }).click();
  await expect(staff.page).toHaveURL(/\/staff\/customers\/\?id=/);
  await expect(staff.page.getByRole("heading", { name: "Asha Rao" })).toBeVisible();
  const history = staff.page.getByTestId("history-row");
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText(order.code);
  await expect(history.first().getByRole("link", { name: order.code })).toHaveAttribute("href", `/track/?id=${order.id}`);
  const earned = Math.floor(order.total / 10);
  const ledger = staff.page.getByTestId("ledger-row");
  await expect(ledger).toHaveCount(1);
  await expect(ledger.first()).toContainText("Earned");
  await expect(ledger.first()).toContainText(`+${earned}`);
  await expect(staff.page.getByTestId("loyalty-balance")).toHaveText(String(earned));
  await expect(staff.page.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876512001\?text=/);
  await expect(staff.page.getByRole("link", { name: /call/i })).toHaveAttribute("href", "tel:+919876512001");

  const notes = staff.page.getByLabel("Notes");
  await notes.fill("Prefers the window table");
  await notes.blur();
  await expect(staff.page.getByText("Notes saved")).toBeVisible();
  await staff.page.reload();
  await expect(staff.page.getByLabel("Notes")).toHaveValue("Prefers the window table");
});

test("owner creates a coupon that a customer can apply at checkout", async ({ page }) => {
  await page.goto("/order/");
  const staff = await staffTab(page);
  await staff.page.goto("/staff/loyalty/");
  await expect(staff.page.getByText("Rules are configurable in the live version")).toBeVisible();

  await staff.page.getByRole("button", { name: "New coupon" }).click();
  const dialog = staff.page.getByRole("dialog", { name: "New coupon" });
  // Invalid first: a duplicate code and a too-short code are caught inline.
  await dialog.getByLabel("Code").fill("welcome10");
  await dialog.getByLabel("Percent", { exact: true }).fill("20");
  await dialog.getByRole("button", { name: "Create coupon" }).click();
  await expect(dialog.getByText("That code already exists.")).toBeVisible();
  await dialog.getByLabel("Code").fill("ab");
  await expect(dialog.getByText(/3 to 20 letters or numbers/)).toBeVisible();

  await dialog.getByLabel("Code").fill("test20");
  await dialog.getByRole("button", { name: "Create coupon" }).click();
  await expect(dialog).toBeHidden();
  const row = staff.page.getByTestId("coupon-row").filter({ hasText: "TEST20" });
  await expect(row).toContainText("20% off");
  await expect(row.getByRole("switch", { name: "TEST20 active" })).toBeChecked();

  await page.goto("/t/?table=3");
  await expect(page.getByRole("button", { name: /Dine-in · Table 3/ })).toBeVisible();
  await addPlain(page, plain.name);
  await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
  await fillContact(page, "9876512002");
  await page.getByLabel("Coupon code").fill("TEST20");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("TEST20 applied")).toBeVisible();

  // Pausing it in the staff tab stops it working for the next customer.
  await row.getByRole("switch", { name: "TEST20 active" }).click();
  await expect(row.getByRole("switch", { name: "TEST20 active" })).not.toBeChecked();
});

test("kitchen cannot open /staff/loyalty/", async ({ page }) => {
  await page.goto("/staff/");
  await page.getByRole("button", { name: "Sign in as Kitchen" }).click();
  await expect(page).toHaveURL(/\/staff\/orders\/$/);
  await page.goto("/staff/loyalty/");
  await expect(page).toHaveURL(/\/staff\/orders\/$/);
  await expect(page.getByRole("heading", { name: /loyalty/i })).toHaveCount(0);

  // Kitchen can still use the customer list.
  await page.goto("/staff/customers/");
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
});
