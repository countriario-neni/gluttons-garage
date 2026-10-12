# Pitch demo script (about 5 minutes)

Live site: https://portfolio.hirerockysolutions.com/gluttons-garage/

## Setup (before the meeting)

1. Open `/staff/`, click **Sign in as Owner**, then **Reset demo** (top bar) and confirm. This gives fresh data with a live order board. (The demo also reseeds itself if the stored data is over 12 hours old.)
2. Without Supabase (default): use two browser windows side by side **in the same browser profile** (they share storage and update each other live).
   - Left: customer, `/t/?table=3` (this is what a table QR opens).
   - Right: staff, `/staff/orders/`.
3. With Supabase: staff stay on the laptop; the customer scans a printed QR from `/staff/tables/` with a phone, so it is a real two-device flow.

## Walkthrough

1. **Scan and order (customer, 60 s).** The table QR opens the menu already set to "Dine-in · Table 3". Add two or three dishes (one with options), open the cart, go to checkout. Talking point: no app, no login, no waiter needed to start.
2. **Pay (customer, 30 s).** Enter a name and phone, choose online payment, Place order, pick **Scan QR** and press "Simulate payment received". Talking points: UPI, card, wallets are simulated here; the real gateway plugs into one adapter. Totals and GST are recomputed on the server, never trusted from the phone. Mention pay at counter and split payments for dine-in.
3. **Kitchen chime (staff, 45 s).** The new order appears on the board with a chime and the tab title count. Press **Accept**, **Start preparing**, **Mark ready**. Talking point: big touch targets built for a busy pass.
4. **Customer tracking and WhatsApp (customer, 30 s).** The tracking page steps through the status live, and shows a preview of each WhatsApp message the guest gets. Talking point: with a WhatsApp Business account these go to the guest's phone.
5. **Settle and complete (staff, 30 s).** Find the seeded split order that is Ready, press **Settle cash**, enter the amount, then **Complete**. Complete stays disabled until an order is fully paid. Completing awards loyalty points.
6. **Customers (30 s).** Open **Customers**, click the guest you just created: spend, favourites, points ledger, tags like New or Regular.
7. **Reports (30 s).** Open **Reports**: revenue, orders, top dishes, busiest hours from 3 weeks of seeded data.
8. **Campaigns (30 s).** Open **Campaigns**, choose **We miss you** (15% off with WINBACK15), pick "Inactive for 30+ days", preview the audience and the phone preview, send. Talking point: win-back messages to customers who stopped ordering.
9. **Settings (15 s).** Opening hours, GST, loyalty rate, WhatsApp number, tables. Also show **Menu** (edit a price, mark sold out) and **Tables** (print QR codes).

## Demo versus live

| Part | In this demo | For go-live |
| --- | --- | --- |
| Data | Browser storage (this device only) or optional Supabase | Supabase (or similar) with real staff accounts |
| Payments | Simulated, always succeeds on the button | Payment gateway adapter (UPI, cards) with webhooks |
| WhatsApp / SMS | Message previews and a log, nothing is sent | WhatsApp Business API adapter |
| Printing | Printable QR sheet in the browser | Same, plus an optional kitchen printer adapter |
| Menu and photos | From public listings | Café's own menu and photography |
| Staff login | One-tap demo accounts (local store only) | Real accounts and roles |
| Public menu page | Static, updated at deploy time | Menu edits show on the online ordering page straight away |
