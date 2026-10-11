import { expect, type Page } from "@playwright/test";
import { items } from "../../src/data/menu";

/**
 * Shared by the ordering and tracking specs. The clock is pinned to Tuesday 12:00 IST so takeaway
 * slots exist whatever time the suite runs; timers keep running, so simulated payment delays are real.
 */
export const NOON_IST = new Date("2026-10-13T12:00:00+05:30");
export const DB_KEY = "gg-demo-v1";

export const salad = items.find((i) => i.name === "Fruit Salad")!;
export const sprouts = items.find((i) => i.id === "healthy-breakfast-sprouts-with-honey-spicy-sprouts")!;
export const plain = items.find((i) => i.options.length === 0 && i.available)!;

export async function ordersFor(page: Page, phone: string) {
  return page.evaluate(
    ([key, p]) => {
      const db = JSON.parse(localStorage.getItem(key) ?? "{}") as { orders?: { phone: string; paymentStatus: string; id: string }[] };
      return (db.orders ?? []).filter((o) => o.phone === p);
    },
    [DB_KEY, phone] as const,
  );
}

export async function search(page: Page, q: string) {
  const box = page.getByRole("searchbox", { name: /search the menu/i });
  await box.fill(q);
}

export async function addPlain(page: Page, name: string) {
  await search(page, name);
  await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  // Items without options go straight to the cart.
}

export async function fillContact(page: Page, phone: string) {
  await page.getByLabel("Your name").fill("Asha Rao");
  await page.getByLabel("Mobile number").fill(phone);
}

export async function chooseTakeaway(page: Page) {
  const sheet = page.getByRole("dialog", { name: /how are you eating/i });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /takeaway/i }).click();
  await sheet.getByRole("radio").first().click();
  await sheet.getByRole("button", { name: /start ordering/i }).click();
  await expect(sheet).toBeHidden();
}


/** Dine-in order for `table` through the real UI. "upi" pays by simulated UPI QR; "cash" pays at the counter. Lands on /track/. */
export async function placeDineIn(page: Page, o: { table: number; phone: string; pay: "upi" | "cash" }): Promise<string> {
  await page.goto(`/t/?table=${o.table}`);
  await expect(page.getByRole("button", { name: new RegExp(`Dine-in · Table ${o.table}`) })).toBeVisible();
  await addPlain(page, plain.name);
  await page.locator("[data-cart-bar]").getByRole("link", { name: /checkout/i }).click();
  await fillContact(page, o.phone);
  if (o.pay === "cash") await page.getByRole("radio", { name: /pay at counter/i }).check();
  await page.getByRole("button", { name: /place order/i }).click();
  if (o.pay === "upi") {
    const pay = page.getByRole("dialog", { name: /pay .* to gluttons garage/i });
    await pay.getByRole("tab", { name: /scan qr/i }).click();
    await pay.getByRole("button", { name: /simulate payment received/i }).click();
    await expect(pay.getByText(/payment successful/i)).toBeVisible({ timeout: 10_000 });
  }
  await expect(page).toHaveURL(/\/track\/\?id=/, { timeout: 10_000 });
  return new URL(page.url()).searchParams.get("id")!;
}

/**
 * The staff tab: a second page in the SAME browser context (same origin, so it shares localStorage and the
 * BroadcastChannel with the customer page). It drives the real store through the E2E-only `window.__ggStore`
 * bridge (present only in builds made with NEXT_PUBLIC_E2E=1, which the Playwright webServer does).
 */
export async function staffTab(page: Page) {
  const staff = await page.context().newPage();
  await staff.goto("/order/");
  await staff.waitForFunction(() => Boolean(window.__ggStore));
  const signedIn = await staff.evaluate(() => window.__ggStore!.staffSignIn("owner@gluttonsgarage.demo", "garage123"));
  expect(signedIn.ok).toBe(true);
  return {
    page: staff,
    async setStatus(orderId: string, ...steps: string[]) {
      for (const s of steps) {
        await staff.evaluate(([id, status]) => window.__ggStore!.updateOrderStatus(id, status as never), [orderId, s] as const);
      }
    },
  };
}
