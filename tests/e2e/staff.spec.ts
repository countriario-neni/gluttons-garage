import { expect, test, type Page } from "@playwright/test";
import { NOON_IST, placeDineIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOON_IST);
});

const column = (page: Page, name: "New" | "Preparing" | "Ready") => page.getByRole("region", { name, exact: true });
const card = (page: Page, col: "New" | "Preparing" | "Ready", where: string | RegExp) =>
  column(page, col).getByRole("article").filter({ hasText: where });

async function signInAs(page: Page, who: "Owner" | "Kitchen") {
  await page.goto("/staff/");
  await page.getByRole("button", { name: `Sign in as ${who}` }).click();
  await expect(page).toHaveURL(/\/staff\/orders\/$/);
  await expect(column(page, "New")).toBeVisible();
}

test.describe("staff login", () => {
  test("shows the demo credentials hint and rejects wrong credentials", async ({ page }) => {
    await page.goto("/staff/");
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    const hint = page.getByRole("region", { name: /demo credentials/i });
    await expect(hint).toContainText("owner@gluttonsgarage.demo");
    await expect(hint).toContainText("garage123");

    await page.getByLabel("Email").fill("owner@gluttonsgarage.demo");
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /wrong email or password/i })).toBeVisible(); // (Next adds its own route-announcer alert)
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/staff\/$/);

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  });

  test("unauthenticated /staff/orders/ redirects to the login with ?next=", async ({ page }) => {
    await page.goto("/staff/orders/");
    await expect(page).toHaveURL(/\/staff\/\?next=%2Fstaff%2Forders%2F$/);
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    await expect(page.getByRole("region", { name: "New", exact: true })).toHaveCount(0);
  });

  test("kitchen role sees no owner-only nav entries and no Reset demo", async ({ page }) => {
    await signInAs(page, "Kitchen");
    const nav = page.getByRole("navigation", { name: "Staff" });
    for (const name of ["Orders", "Menu", "Tables", "Customers"]) await expect(nav.getByRole("link", { name })).toBeVisible();
    for (const name of ["Settings", "Campaigns", "Reports", "Loyalty"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset demo" })).toHaveCount(0);
    await expect(page.getByText("Kitchen access", { exact: true })).toBeVisible();
  });

  test("a signed-in visit to /staff/ goes straight to the board", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.goto("/staff/");
    await expect(page).toHaveURL(/\/staff\/orders\/$/);
  });
});

test.describe("kitchen board", () => {
  test("owner board shows the three seeded live orders in the right columns", async ({ page }) => {
    await signInAs(page, "Owner");
    await expect(page.getByText("Demo mode · this device").first()).toBeVisible();
    await expect(card(page, "New", "Table 3")).toHaveCount(1);
    await expect(card(page, "Preparing", /Takeaway · \d{1,2}:\d{2} [AP]M/)).toHaveCount(1);
    await expect(card(page, "Ready", "Table 6")).toHaveCount(1);
    await expect(card(page, "New", "Table 3").getByText("Paid", { exact: true })).toBeVisible();
    await expect(card(page, "Ready", "Table 6").getByText(/^Partial ₹[\d,]+ due$/)).toBeVisible();
    for (const b of await page.getByRole("main").getByRole("button").all()) {
      const box = await b.boundingBox();
      if (box) expect(box.height, `button "${await b.innerText()}"`).toBeGreaterThanOrEqual(44);
    }
  });

  test("a new customer order pops into New, then Accept, Start preparing, Mark ready", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.getByRole("button", { name: "Enable sound" }).click();
    await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("gg-kds-sound"))).toBe("on");

    const customer = await page.context().newPage();
    await placeDineIn(customer, { table: 8, phone: "9876500201", pay: "upi" });

    const fresh = card(page, "New", "Table 8");
    await expect(fresh).toBeVisible({ timeout: 3000 });
    await expect(fresh).toHaveAttribute("data-new", "true");
    await expect(page.getByText(/^New order GG-\d+ · Table 8$/)).toBeVisible();
    await expect(page).toHaveTitle("(1) Orders · Gluttons Garage");

    await fresh.getByRole("button", { name: "Accept" }).click();
    const accepted = card(page, "Preparing", "Table 8");
    await expect(accepted).toBeVisible();
    await expect(accepted.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Orders · Gluttons Garage");

    await accepted.getByRole("button", { name: "Start preparing" }).click();
    await expect(accepted.getByText("Preparing", { exact: true })).toBeVisible();
    await accepted.getByRole("button", { name: "Mark ready" }).click();
    await expect(card(page, "Ready", "Table 8")).toBeVisible();
    await expect(card(page, "Preparing", "Table 8")).toHaveCount(0);
  });

  test("Reject asks for confirmation in an in-app dialog", async ({ page }) => {
    await signInAs(page, "Owner");
    page.on("dialog", () => {
      throw new Error("window.confirm must not be used");
    });
    await card(page, "New", "Table 3").getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog", { name: /reject GG-\d+\?/i });
    await dialog.getByRole("button", { name: "Keep order" }).click();
    await expect(card(page, "New", "Table 3")).toHaveCount(1);
    await card(page, "New", "Table 3").getByRole("button", { name: "Reject" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Reject order" }).click();
    await expect(card(page, "New", "Table 3")).toHaveCount(0);
  });

  test("settling cash on the split order makes it Paid, then Complete moves it to Completed today", async ({ page }) => {
    await signInAs(page, "Owner");
    const t6 = card(page, "Ready", "Table 6");
    await expect(t6.getByRole("button", { name: "Complete" })).toBeDisabled();
    const hint = (await t6.getByText(/^Settle ₹[\d,]+ first$/).innerText()).match(/₹[\d,]+/)![0];

    await t6.getByRole("button", { name: /settle cash/i }).click();
    const dialog = page.getByRole("dialog", { name: /settle cash/i });
    await expect(dialog.getByText(hint).first()).toBeVisible();
    const received = dialog.getByLabel("Amount received");
    await expect(received).toHaveValue(hint.replace(/[₹,]/g, ""));
    await received.fill("1");
    await expect(dialog.getByText(/less than the amount due/i)).toBeVisible();
    await dialog.getByRole("group", { name: "Quick amounts" }).getByRole("button").last().click(); // next ₹500 note
    await expect(dialog.getByTestId("change-due")).toHaveText(/^₹[1-9][\d,]*$/);
    await dialog.getByRole("button", { name: `Record ${hint} cash` }).click();
    await expect(dialog).toBeHidden();

    await expect(t6.getByText("Paid", { exact: true })).toBeVisible();
    await t6.getByRole("button", { name: "Complete" }).click();
    await expect(card(page, "Ready", "Table 6")).toHaveCount(0);
    await page.getByRole("button", { name: /completed today/i }).click();
    await expect(page.getByRole("region", { name: /completed today/i })).toContainText("Table 6");
  });

  test("Reset demo (owner) restores the seeded live orders", async ({ page }) => {
    await signInAs(page, "Owner");
    await card(page, "New", "Table 3").getByRole("button", { name: "Accept" }).click();
    await expect(card(page, "Preparing", "Table 3")).toBeVisible();

    page.on("dialog", () => {
      throw new Error("window.confirm must not be used");
    });
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.getByRole("dialog", { name: /reset the demo/i }).getByRole("button", { name: "Reset demo data" }).click();
    await expect(page.getByText("Demo data reset").first()).toBeVisible();
    await expect(card(page, "New", "Table 3")).toHaveCount(1);
    await expect(card(page, "Preparing", "Table 3")).toHaveCount(0);
    await expect(column(page, "New").getByRole("article")).toHaveCount(1);
    await expect(column(page, "Preparing").getByRole("article")).toHaveCount(1);
    await expect(column(page, "Ready").getByRole("article")).toHaveCount(1);
    await expect(page).toHaveTitle("Orders · Gluttons Garage"); // reset is not a "new order"
  });

  test("sign out returns to the login page", async ({ page }) => {
    await signInAs(page, "Owner");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/staff\/$/);
    await page.goto("/staff/orders/");
    await expect(page).toHaveURL(/\/staff\/\?next=/);
  });
});

const SHOTS = "test-results/screens-t10";

test.describe("screenshots", () => {
  test("login, board and settle dialog at 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/staff/");
    await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/1440-login.png`, fullPage: true });
    await signInAs(page, "Owner");
    const customer = await page.context().newPage();
    await placeDineIn(customer, { table: 9, phone: "9876500202", pay: "cash" });
    await expect(card(page, "New", "Table 9")).toBeVisible({ timeout: 3000 });
    await page.screenshot({ path: `${SHOTS}/1440-board.png` });
    await card(page, "Ready", "Table 6").getByRole("button", { name: /settle cash/i }).click();
    await expect(page.getByRole("dialog", { name: /settle cash/i })).toBeVisible();
    await page.waitForTimeout(400); // let the open animation finish
    await page.screenshot({ path: `${SHOTS}/1440-settle.png` });
  });

  for (const width of [768, 390]) {
    test(`board tabs at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
      await page.goto("/staff/");
      await page.screenshot({ path: `${SHOTS}/${width}-login.png`, fullPage: true });
      await page.getByRole("button", { name: "Sign in as Owner" }).click();
      await expect(page.getByRole("tab", { name: /New/ })).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/${width}-board.png` });
      await page.getByRole("tab", { name: /Ready/ }).click();
      await expect(card(page, "Ready", "Table 6")).toBeVisible();
      await page.waitForTimeout(400); // tab colour transition
      await page.screenshot({ path: `${SHOTS}/${width}-ready.png` });
      await page.getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("dialog", { name: "More" })).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/${width}-more.png` });
    });
  }
});
