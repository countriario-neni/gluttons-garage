# Gluttons Garage

A pitch demo website and ordering system for Gluttons Garage, a garage-themed café on Dr NTR Beach Road, Visakhapatnam. It has a public site, a QR dine-in and takeaway ordering flow with simulated payments, order tracking with WhatsApp previews, and a staff back office (kitchen board, customers, loyalty, campaigns, reports, menu admin and table QR codes).

**Live demo:** https://portfolio.hirerockysolutions.com/gluttons-garage/

> Demo only. Payments, WhatsApp and printing are simulated adapters. `robots` is set to noindex.

## Demo logins

Staff sign-in is at `/staff/` and works with the default local (browser) data store only:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@gluttonsgarage.demo` | `garage123` |
| Kitchen | `kitchen@gluttonsgarage.demo` | `garage123` |

The sign-in page has one-tap "Sign in as Owner / Kitchen" buttons. With Supabase, staff are real Supabase Auth users (see the setup doc). A step-by-step pitch walkthrough is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Features

- Public site: hero, menu with photos and dietary marks, reviews, gallery, opening hours, visit info.
- Online ordering: dine-in by table QR (`/t/?table=3`) or takeaway with pickup slots, options, coupons, loyalty points, GST breakdown.
- Payments: UPI QR, card, wallets and net banking (simulated), pay-at-counter cash, or split online plus cash for dine-in.
- Live order tracking (`/track/?id=`) with a WhatsApp message preview.
- Staff: kitchen order board with chime, cash settlement, customer CRM and profiles, loyalty and coupons, WhatsApp campaigns by segment, reports, menu editor, printable table QR codes, settings.

## Tech stack

Next.js 16 (App Router, static export), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Recharts, Zustand. Data goes through a `DataStore` interface with two implementations: `LocalStore` (localStorage, default) and `SupabaseStore` (Postgres functions with RLS). Tests: Vitest, PGlite for the SQL, Playwright with axe-core for end-to-end and accessibility.

## Local development

```bash
npm ci --legacy-peer-deps   # or npm install --legacy-peer-deps
npm run dev                 # http://localhost:3000
npm test                    # unit + SQL tests
npm run lint
npm run build               # static export to out/
npm run e2e                 # Playwright (builds with the test-only store bridge)
npm run check:contrast      # design-token contrast
npm run check:no-bridge     # after a plain build
```

GitHub Pages build: set `NEXT_PUBLIC_BASE_PATH=/gluttons-garage`. See [CLAUDE.md](CLAUDE.md) for architecture notes.

## Supabase (optional)

By default the demo runs entirely in the browser. To share orders across devices, set up Supabase following [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md). Read its "Before going live" section before real customers use it.

## Credits

Menu content and photos are taken from public listings and are used for pitch purposes only. All rights belong to their owners. Gluttons Garage branding belongs to the café.
