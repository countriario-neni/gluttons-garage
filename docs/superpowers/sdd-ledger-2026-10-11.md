# SDD ledger — plan: docs/superpowers/plans/2026-10-11-gluttons-garage-demo.md
Spec: docs/superpowers/specs/2026-10-11-gluttons-garage-demo-design.md
Branch: build/demo (from master @ 9ac1e02)

## Pre-flight scan
| Rows | Produces → Consumes / self-consistency | Finding |
|---|---|---|
| T1→all | tokens, withBase, fonts | ok |
| T2→T3,T4,T7,T8,T11 | MenuItem/MenuOption/MenuCategory, cafe | Global Constraints say Toppings→"Add-ons" option group & dressings→free options; T2 step 1 only mentions variants→Size. Ruling below |
| T3→T4,T5,T8,T13 | priceOrder/Bill/Coupon/CartLine, takeawaySlots(hours: Cafe["hours"]) | ok; `Cafe` type must be exported from data/cafe.ts |
| T4→T5..T13 | DataStore uses Settings, LedgerEntry, Campaign, Segment types not defined anywhere | Ruling below |
| T4 vs T12 | Segment defined in T12 domain/segments.ts but DataStore.sendCampaign (T4) uses it | Ruling below |
| T5→T8,T9 | upiUri/simulatePayment/templates | ok |
| T6 self | parity test needs Supabase creds | skipped until creds; ok per spec deviation |
| T8 self | double-submit guard + idempotency | ok |
| T9 self | "two browser contexts sharing storage" — Playwright contexts do NOT share localStorage | Ruling below |
| T10 self | lists public/sounds/new-order.mp3 AND says generate with WebAudio | Ruling below |
| T1 self | create-next-app in non-empty dir (docs/, research/) may refuse | Ruling below |
| T7/T8/T9 | useSearchParams in static export needs <Suspense> | carry as context to dispatches |

Ruling: T2 build-menu merges each page's "Toppings" section into an "Add-ons" option group (group:"Add-ons", priceDelta = price) attached to every item in that page's non-topping sections; "Choose Your Dressing" → option group "Dressing" priceDelta 0 on that page's salads; variants → "Size"/"Choice" group with base = min price — follows Global Constraints (spec authority) — cost if wrong: add-ons show on slightly wrong items, cosmetic.
Ruling: T4 defines in src/store/DataStore.ts: Settings {cafeName, phone, whatsapp, gstPercent:5, acceptingOrders, slotMinutes:15, tables:number, socials:{instagram,facebook|null}, delivery:{swiggy|null,zomato|null}, hours, loyalty: typeof LOYALTY}, LedgerEntry {id, customerId, orderId|null, points, reason, createdAt}, Campaign {id,name,segment,body,sentCount,createdAt}; Segment type lives in src/domain/types.ts (T4 creates it; T12 implements tagsFor/inSegment) — plan omitted these — cost if wrong: small type refactor.
Ruling: T9 cross-tab E2E uses two pages in ONE browser context (shared localStorage + BroadcastChannel) — contexts are isolated in Playwright — cost if wrong: none.
Ruling: T10 chime generated via WebAudio at runtime; no mp3 file — plan body says so; file mention is stale — cost: none.
Ruling: T1 scaffold create-next-app into a temp subdir and move files to repo root, preserving docs/, research/, .gitignore (merge entries) — cost: none.

## Progress
Task 1: dispatched (BASE c9ed254, implementer ae8954e504f35ceef)
Task 1: review (e5d7b9e) spec ✅, 1 Important (sub-44px button/control hit areas) → fix round 1 dispatched to implementer
Task 1: minor (deferred): README.md is create-next-app boilerplate (Geist/Vercel)
Task 1: minor (deferred): @custom-variant dark + dark: classes with no .dark token set (dead weight)
Task 1: minor (deferred): contrast script omits --border/--input 3:1 UI-boundary checks; input border #D6C7AB on cream likely < 3:1
Task 1: minor (deferred): shadcn CLI in dependencies; `start` script irrelevant under static export
Task 1: verified ⚠️ `cn` npm pkg = shadcn-ui/cn (legit, maintainer shadcn)
Task 1: fix round 1/5 (1 addressed, 0 open — 44px hit areas; commits e5d7b9e..6dbfa63)
Task 1: minor (deferred): 44px pseudo hit areas on stacked radio/checkbox overlap neighbours when gap < ~28px — use gap-3+ / min-h-11 rows
Task 1: complete (commits c9ed254..6dbfa63, review clean)
Task 2: dispatched (BASE 6dbfa63, implementer afe81bd0ffd2d8db1)
Ruling: T2 'GG Specials'/'Twisted' sections fold into each page's main category with a tag instead of one cross-page category — keeps related dishes together — cost if wrong: re-run generator with different grouping.
Ruling: T2 printed spellings kept verbatim (only all-caps normalised) — user asked for genuine/identical — cost if wrong: copy edit pass.
Ruling: T2 photos with identifiable faces excluded; top-left watermarks cropped — consent/branding hygiene for a pitch — cost: fewer images.
Task 2: minor (deferred): menu.test dressing test doesn't assert salad-only categories; generator attaches Dressing to all items on page (fragile)
Task 2: minor (deferred): single-variant items ignore variant; images:build must precede menu:build (unenforced; rmSync wipes public/images)
Task 2: minor (deferred): 1239 duplicated Add-ons options make menu.ts ~13k lines
Task 2: complete (commits 6dbfa63..a19ce61, review clean) — 32 cats, 269 items, 10 with images, 7 bestsellers
Task 3: dispatched (BASE a19ce61, implementer a5153ead08b23947c)
Ruling: T3 priceOrder validates option ownership and single-choice groups (BAD_OPTION) — plan omitted it but option groups from T2 require it; prevents tampered option ids — cost: one extra error code.
Ruling: T3 Segment type defined in src/domain/types.ts now (logic in T12) — resolves T4/T12 ordering — cost: none.
Ruling: T3 GST = round(taxable*5%) once; cgst=floor(tax/2), sgst=tax-cgst — invoice totals match the single 5% figure — cost if wrong: ₹1 display split difference.
Ruling: T3 priceOrder ignores invalid coupons; T4 placeOrder must validate coupon via couponDiscount and return the reason before pricing — keeps priceOrder's error union small — cost: none if T4 honours it (carry into T4 dispatch).
Task 3: minor (deferred): priceOrder NaN pointsToRedeem → NaN bill (store layer must validate — carried into T4); mastercard regex matches 2220; formatINR(-5) → "₹-5"; no tests for odd-tax cgst/sgst split or half-rupee percent rounding
Task 3: complete (commits a19ce61..c01a2e9, review clean)
Task 4: dispatched (BASE c01a2e9, implementer afc1a882cbffc0cb7)
Ruling: T4 placeOrder validates all inputs with explicit error codes (NOT_ACCEPTING, BAD_PHONE, BAD_NAME, BAD_TABLE, BAD_PICKUP, CASH_DINE_IN_ONLY, BAD_SPLIT, BAD_POINTS, COUPON_*) before priceOrder — covers T3 NaN minor and coupon-ignored ruling — cost: more codes for UI to map.
Ruling: T4 order status transitions restricted (placed→accepted|rejected; accepted→preparing|cancelled; preparing→ready; ready→completed); redeemed points refunded on reject/cancel — spec silent; prevents loyalty abuse — cost: staff can't skip steps.
Ruling: T4 CustomerStats tags use a temporary inline rule replaced by domain/segments.ts in T12 — keeps T4 testable now — cost: T12 refactor.
Ruling: T4 message bodies via one internal messageFor() swapped to T5 templates in T5 — cost: T5 touches LocalStore.
Task 4: review (c6b86be) Needs fixes — 2 Important (confirmOnlinePayment trusts client amount/double-apply; anon staff writes) → fix round 1 sent (+ ruled-in: cash due excludes pending online; seed inactive customers + 3 live orders; lint fix)
Ruling: T4 setItemAvailability=staff, upsertItem=owner, updateCustomerNotes=staff — spec §3 RLS intent; T6 must mirror — cost: none.
Ruling: T4 seed adds ~6 inactive customers (orders 35–60d ago) and 3 live orders today — segment demo + non-empty kitchen board at pitch — cost: seed size.
Task 4: minor (deferred): settings.loyalty edits not used by priceOrder/pointsEarned (make read-only or pass through in T12)
Task 4: minor (deferred): remote change fires twice (BroadcastChannel + storage event); last-write-wins across tabs (document); useLive out-of-order reload race; currentStaff JSON.parse unguarded; crypto.randomUUID needs secure context (LAN http); isFirstOrder counts failed-payment placed orders; idempotency map unbounded
Task 4: fix round 1/5 (5 addressed, 0 open — payment integrity, staff gating, cash due, seed inactive+live, lint; commits c6b86be..b20761b)
Task 4: minor (deferred): after a failed online attempt cash can cover full bill (fallback; acceptable); lapsed 1-order customers tagged both new+inactive (T12 rule should decide); fix reports summarise rather than paste output
Task 4: complete (commits c01a2e9..b20761b, review clean)
Task 5: dispatched (BASE b20761b, implementer ab9c3e96579fb62b6)
Ruling: T5 Razorpay real checkout only with rzp_test_ keys — demo must never take real money — cost: none.
Ruling: T5 adds payment_received WhatsApp message on online confirm and cash record — spec lists paymentReceived template — cost: more message rows.
Task 5: implementer DONE (0fb3847); concerns: WINBACK15 coupon needed in T12/13 (carry); preparing status msg skipped
Task 5: minor (deferred → carry to T8): razorpay payment.failed resolves early (modal retry success lost); no script-load timeout; window.Razorpay undefined throws
Task 5: minor (deferred): "Table null" when dine-in table null; no wa.me length guard; "100 points = ₹50" hardcoded in template; razorpay channel always "card"
Task 5: complete (commits b20761b..0fb3847, review clean)
Ruling: T6 SQL tested with @electric-sql/pglite (in-process Postgres) using an auth/roles shim, instead of skipping until creds — no Docker available; gives real SQL + RLS + parity evidence now — cost: shim may differ slightly from Supabase (auth.uid via request.jwt.claims setting).
Task 6: dispatched (BASE 0fb3847, implementer a29431774fe1cee09, opus)
Ruling: T6 SQL message bodies mirror templates' key fields, not char-for-char — browser can't be trusted to write message_log — cost: slight copy drift between stores.
Ruling: T6 lookup_loyalty returns first name + points to anon (phone-knowledge leak) — demo-acceptable, documented under "Before going live" — cost: privacy fix before production.
Ruling: T6 customer tracking polls get_order_public every 3s (no anon realtime) — simplest secure option — cost: ≤3s latency.
Ruling: T6 reset_demo re-anchors seed offsets to now() — demo always looks fresh — cost: seed_* tables.
Task 6: implementer DONE (b303c98, 019f430); 236 tests incl 89 pglite SQL
Ruling: T6 reset_demo must shift seed by whole days (date offset), preserving time-of-day — reports' peak-hours chart must stay realistic — goes into fix round.
Ruling: T6 LocalStore listCoupons/listCustomers/listCampaigns/getCustomer require staff to match Supabase RLS — backend parity — goes into fix round.
Ruling: T6 place_order returning the unmasked order to its own submitter (and idempotent replay keyed by a client-random key) is acceptable — submitter supplied that phone — cost: none.
Task 6: review (019f430) Needs fixes — rulings A (whole-day reseed) & B (LocalStore staff gating) missing → fix round 1 sent (+ ruled-in: poll try/finally, loyalty settings validation, default table privileges revoke + JWT-expired mapping, docs pre-live items)
Ruling: T6 reseed skips historical rows that land in the future after whole-day shift; 3 live orders re-stamped relative to now — realistic times + non-empty board — cost: slightly fewer orders "today" after reset.
Task 6: minor (deferred): subscribe mode chosen once at subscribe time (session vs staff); idempotency keys must be crypto.randomUUID() in T8 (replay returns full order) — carry to T8
Task 6: fix round 1/5 (6 addressed, 0 open — whole-day reseed, LocalStore staff reads, poll finally, loyalty validation, default privs + JWT map, docs; commits 019f430..8101824)
Task 6: minor (deferred): reseed copies coupon used_count (not recomputed after skips); loyalty jsonb non-object scalar untested; place_order returns full order (phone) to submitter/replay; public_settings exposes all Settings fields; live Supabase (REST/Auth/Realtime) untested — manual checks in docs
Task 6: complete (commits 0fb3847..8101824, review clean)
Ruling: T7 /t QR landing page + its E2E move to T8 — T7 step 3 consumes useCart which T8 creates — cost: none.
Task 7: dispatched (BASE 8101824, implementer a5f1fe08daa1f8e3b, opus)
Ruling: T7 typographic Wordmark (Bevan/Alfa Slab style) recreates the real logo — no clean logo file exists — cost: replace with client vector later.
Ruling: T7 highlights (Tiramisu Fest, Mango Mania, Events) are CSS/SVG illustrated cards, no fake photos — honesty — cost: less photographic.
Task 7: implementer DONE (ea8fd46) after rate-limit resume; controller viewed screenshots (hero/menu look premium)
Task 7: review (ea8fd46) Needs fixes — 2 Important (menu scroll-reset breaks deep links; footer seeds demo DB on public pages) → fix round 1 sent (+ ruled-in: footer heading order, header wordmark contrast, content-visibility)
Ruling: T7 public pages never instantiate the store; delivery links from static cafe config — perf + no surprise localStorage — cost: owner can't change delivery links from Settings until wired (T13 may revisit).
Task 7: minor (deferred): kcal line wraps awkwardly on mobile; egg DietMark timber 3:1 check; postbuild script comment re Linux no-op
Task 7: fix round 1/5 (5 addressed, 0 open — deep links, no store on public pages, footer h2, header scrim, content-visibility; commits ea8fd46..aac6a57)
Task 7: minor (deferred): scrollToSettled may briefly fight user scroll (≤330ms); deep-link E2E doesn't check sticky-header occlusion; seed defaultSettings duplicates cafe.delivery
Task 7: complete (commits 8101824..aac6a57, review clean)
Task 8: brief extended with /t requirements from T7
Task 8: dispatched (BASE aac6a57, implementer a732a7b40c21581f5, opus)
Ruling: T8 payment-brand badges are text/initial badges, no hotlinked third-party logos — trademark/hotlink safety — cost: slightly less recognisable.
Ruling: T8 carries T5 razorpay fixes (resolve failure on dismiss, 15s load timeout, missing Razorpay → failed result) — needed before wiring UI — cost: none.
Ruling: T8 idempotency via crypto.randomUUID with getRandomValues fallback — T6 replay returns full order to key holder; LAN http testing — cost: none.
Task 8: implementer DONE (e2ae870, 21c5dca, 63f189b); controller viewed screenshots — polished. Note: odd tax split shows CGST 13 / SGST 14 (whole-rupee ruling) — revisit in T14 (paise display?)
Task 8: review (63f189b) Needs fixes — 1 Important (COUPON_* at placement invisible; checkout dead-ends) → fix round 1 sent (+ ruled-in: cancel abandoned takeaway payment, settle busyRef, QR dark-on-light, dedupe SINGLE_CHOICE_GROUPS, catch resume getOrder)
Ruling: T8 abandoned pending takeaway payment can be cancelled / new cart preferred — a stuck checkout would kill a live pitch — cost: orphan unpaid orders in staff board (staff can reject).
Task 8: minor (deferred): ITEM_UNAVAILABLE fallback highlights lines[0] (store should return itemId); inline stepper live when ordering paused; split-invalid button label shows full total; card form Enter doesn't submit
Task 8: fix round 1/5 (6 addressed, 0 open — coupon rejection UX, abandoned payment cancel, settle guard, QR colours, dedupe const, resume catch; commits 63f189b..c625a84)
Task 8: minor (deferred): onPaid setTimeout not cleared on unmount; reload during 1.3s success hold loses track redirect; cancelled unpaid orders stay "placed"
Task 8: complete (commits aac6a57..c625a84, review clean)
Task 9: dispatched (BASE c625a84, implementer a74ef45e73191421c, sonnet)
Ruling: T9 LocalStore anon listMessages → to_customer for given order only; anon listOrders → UNAUTHENTICATED — parity with Supabase / privacy — cost: none.
Ruling: T9 E2E staff actions via window.__ggStore bridge only when NEXT_PUBLIC_E2E=1 at build — avoids bypassing store logic; never in production build — cost: separate e2e build flag.
Ruling: T9 WhatsApp preview renders *bold* only, all else escaped — XSS safety for customer-supplied names/notes — cost: none.
Task 9: implementer DONE_WITH_CONCERNS (a3b534a, c5c33a1); flaky T8 takeaway E2E masked with retries:1 (root cause unknown)
Task 9: review (c5c33a1) Needs fixes — 2 Important (retries:1 masks /t redirect >5s under load = real QR-scan perf bug; WhatsApp preview tie ordering) → fix round 1 sent (+ ruled-in: refund wording on rejected, FAB overlap on /track, no-bridge build guard)
Ruling: T9 slow /t is a product perf bug (first-visit seed generation suspected) — fix root cause, retries back to 0, prove with repeat-each=3 workers=4 — cost: implementer time.
Task 9: minor (deferred): every E2E run rebuilds (reuseExistingServer false); Card heading id from title could collide; stray JSX space in TrackSkeleton
Ruling: T9 cold first-test latency 2.7–4.7s under 4 contended workers accepted — real-world GitHub Pages serves compressed/cached; suite stable 3×105/105 with retries 0 — cost: none.
Task 9: fix round 1/5 (5 addressed, 0 open — cold-start perf (1MB /order HTML, serve gzip), msg order, refund copy, FAB hidden on /track, no-bridge guard; commits c5c33a1..c4446e2)
Task 9: minor (deferred → T15): wire check:no-bridge into CI after the plain build; /order static HTML has no dish cards (no-JS/SEO) — acceptable
Task 9: complete (commits c625a84..c4446e2, review clean)
Task 10: dispatched (BASE c4446e2, implementer a062622fcd8570dca, opus)
Ruling: T10 kitchen role nav: Orders, Menu, Tables, Customers; owner adds Loyalty, Campaigns, Reports, Settings — spec says kitchen can't edit coupons/campaigns/settings; reports are owner info — cost: kitchen can't see reports.
Ruling: T10 one-tap demo sign-in buttons only for LocalStore; hidden under Supabase — real accounts — cost: none.
Ruling: T10 Complete disabled while cash due; settle records the due amount and shows change — prevents closing unpaid tables — cost: one extra tap.
Ruling (user asked "asap before session ends"): T11–T13 run in parallel isolated worktrees on sonnet after T10 lands; per-task reviews skipped; final whole-branch review + security audit cover them — cost: bugs found later, merge conflicts to resolve.
User approved (2026-10-12): create PUBLIC repo gluttons-garage on countriario-neni + GitHub Pages deploy.
Task 10: complete (commits c4446e2..509576c) — review deferred to final review (speed ruling)
Task 10: minor (deferred): pending online payment doesn't block Complete; settle only on Ready cards; tabs below 1280px
Controller infra commit: E2E_PORT override for parallel worktrees
Task 12: DONE in worktree branch worktree-agent-ae357947ed31da707 (13fe570); 301 unit, 51 e2e; awaiting merge
Task 13: DONE (64cc835) merged; note: staff.spec new-order-pops timing flaked 2/3 full runs under parallel worktree load — verify on merged tree
Task 11: DONE (fc6618f) merged
Full-suite verification on merged tree f117daf+lint fix: tsc clean, lint clean, 319 unit, 68/68 e2e (retries 0)
Deployed: repo github.com/countriario-neni/gluttons-garage (public), Pages build_type=workflow; URL portfolio.hirerockysolutions.com/gluttons-garage/
Security audit: no Critical; High (Supabase-only, pre-live): anon confirm_online_payment unverified, phone-as-identity — documented pre-live. Fix-wave: idempotent replay returns public subset; shadcn → devDependencies. Rest documented/can-wait.
Final review: Ready after fixes — must-fix: unpaid complete guard (UI+stores), stale seed auto-reseed, MenuEditor group key, /menu copy, T14 essentials (favicon, noindex, OG, 404, README, axe), input border contrast; config: Supabase for cross-device (user action). One fix wave dispatched (+ security: replay public subset, shadcn→devDeps; DEMO_SCRIPT.md).
Final fix wave: re-review all addressed (81af70f..34c6e8e); redeployed run 38201493845 success; live noindex, 404, icon verified
