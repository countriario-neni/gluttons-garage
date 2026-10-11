# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` runs the dev server. `npm run build` produces the static export in `out/` (run it before e2e). `npm run lint` runs ESLint.
- `npm test` runs Vitest (jsdom, tests in `tests/unit/**`, `@` aliases `src`). Single test: `npx vitest run tests/unit/path.test.ts -t "name"`.
- `npm run e2e` runs Playwright against `npx serve out -l 4173`. Single e2e: `npx playwright test tests/e2e/file.spec.ts -g "name"`.
- `npm run check:contrast` verifies token contrast pairs in `src/app/globals.css`.
- Pages build: set `NEXT_PUBLIC_BASE_PATH=/gluttons-garage`. Use `withBase()` (`src/lib/basePath.ts`) for raw `<img>` and `public/` URLs.
- npm needs `--legacy-peer-deps` when adding packages (shadcn pins Babel 7, `@vitejs/plugin-react` peers Babel 8).

## Architecture

- Next.js App Router, static export (`output: "export"`, `trailingSlash`, unoptimized images). No dynamic route segments: IDs travel in query params (`/track/?id=`, `/t/?table=`).
- `src/domain/` holds pure logic (pricing, GST, loyalty, coupons, takeaway slots). It has no React or storage imports and is unit-tested.
- Persistence goes through a `DataStore` interface: `LocalStore` (localStorage, default demo) or `SupabaseStore`, chosen by env at startup.
- Integrations (payments, WhatsApp/SMS, printing, etc.) are adapters with demo implementations; swapping in a real one must not touch UI code.
- UI: shadcn/ui (base-ui) in `src/components/ui`, Tailwind v4 tokens in `globals.css`, design rules in `design-system/MASTER.md`. Staff screens wrap in `.theme-kitchen`.

## Constraints

- Money is INR whole-rupee integers, displayed `₹1,234` (`en-IN`). GST 5% (CGST 2.5% + SGST 2.5%) on subtotal minus discounts, rounded to the rupee. Totals are always recomputed from the menu, never trusted from the client.
- Cash and split payment are dine-in only; takeaway is paid fully online.
- Menu data comes only from `research/menu/*.json` transcriptions; skip items marked `uncertain`. No Kaloreez/Junktion77 branding anywhere.
- No raw hex in components; use semantic tokens. Fonts are `--font-display` (Playfair Display) and `--font-sans` (Karla).
- `useSearchParams` must be wrapped in `<Suspense>` or the static export build fails.
- Keep the `turbopack.rules` Tailwind loader in `next.config.ts`; Tailwind does not run without it.
- Next.js here is v16 with breaking changes: read `node_modules/next/dist/docs/` before using unfamiliar APIs (see `AGENTS.md`).
