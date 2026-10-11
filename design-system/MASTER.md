# Gluttons Garage Design System (source of truth)

Industrial "garage" cafe, warm and youthful. Tokens live in `src/app/globals.css`; components use tokens only, never raw hex. Verify contrast with `npm run check:contrast` (reads the CSS, exits 1 on a failing pair).

## Palette

Brand colours come from `research/brand-notes.md`. Ratios are measured by `scripts/check-contrast.mjs`.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `background` (cream) | #F3EBDD | Page | ink text 14.65:1 |
| `foreground` (ink) | #1C1A19 | Body text | |
| `card` (cream-light) | #FBF7EF | Cards, popovers | ink 16.23:1 |
| `primary` (Glutton Maroon) | #5A1F1B | Primary buttons, headings, links | cream text on it 10.77:1 |
| `accent` / `warning` (Garage Orange) | #F08A1C | CTA highlight, badges, warnings; always a fill with ink text | ink on orange 6.90:1 |
| `secondary` / `muted` (cream-dark) | #E6DAC4 | Quiet surfaces | ink 12.54:1 |
| `muted-foreground` (ink-soft) | #5E5249 | Secondary text | 6.38:1 on cream, 5.47:1 on muted |
| `success` (leaf) | #2F6B3A | Paid, ready | cream-light text 5.98:1 |
| `destructive` (brick) | #A32A22 | Errors, cancel | cream-light text 6.75:1 |
| `border` (line) | #D6C7AB | Dividers | decorative |
| `ring` | maroon (light), orange (kitchen) | Focus ring | 10.77:1 / 6.90:1 (needs 3:1) |
| Rust Velvet `rust` | #9A4A30 | Warm secondary, chart | kitchen accent: cream-light text 5.79:1 |
| Timber Brown `timber` | #8A5A2E | Natural support, chart | decorative |
| Reclaimed Teal `teal` | #5E8A86 | Sparingly, decorative only (below 4.5:1 on cream, never text) | |

Orange is never used as text on cream (2.12:1). Use maroon for coloured text.

### Kitchen theme (`.theme-kitchen`, staff board)

Ink background (#1C1A19), cream text 14.65:1, cards `kitchen-surface` #272321 (13.15:1), muted text #BDB1A0 (7.39:1 on card), primary = orange with ink text 6.90:1, accent = rust with cream-light text 5.79:1. Wrap the staff layout in `className="theme-kitchen"`.

## Typography

- Display: Playfair Display (`--font-display`, applied to h1-h4). Body/UI: Karla (`--font-sans`). Both through `next/font/google`.
- Scale (rem, line-height): display 3.5/1.05, h1 2.5/1.1, h2 2/1.15, h3 1.5/1.25, h4 1.25/1.3, body 1/1.6 (min 16px), small 0.875/1.5. Use Playfair weight 600-700 for headings, Karla 400/500/700.
- Body copy max width 65ch.

## Spacing, radius, shadow

- Spacing: 4px base grid (Tailwind scale). Page gutter 16px mobile, 24px tablet, 32px+ desktop. Section padding 48px mobile, 80px desktop.
- Radius: `--radius` 0.75rem. sm 0.45, md 0.6, lg 0.75, xl 1.05, 2xl 1.35rem. Pills use `rounded-full`.
- Shadows: `shadow-card` (resting cards), `shadow-lift` (hover, popovers). Keep subtle and warm (ink-tinted).

## Motion

- Reveal and state transitions 300-450ms, `--duration-reveal` 380ms, ease `--ease-reveal` (cubic-bezier(0.22, 1, 0.36, 1)). Utility: `reveal` (fade up 12px).
- Micro-interactions 150-200ms. Animate only opacity and transform.
- `prefers-reduced-motion: reduce` collapses all animation and transition durations globally (in `globals.css`); do not add JS animation without checking `useReducedMotion`.

## Accessibility

- Body text 4.5:1 minimum; UI boundaries and focus rings 3:1.
- Touch targets 44px minimum: Every Button size is at least `h-11`/`size-11` (lg `h-12`); checkbox, switch and radio use a centred 44px `after:` hit area.
- Focus is always visible (2px ring token, 2px offset). Never remove outlines.
- Keyboard order matches visual order; icons next to text are decorative (`aria-hidden`), icon-only buttons get an `aria-label`.

## Iconography

lucide-react SVG icons only, 1.5-2px stroke, 16/20/24px sizes, colour via `currentColor`. No emoji as icons. The 4.1 Google rating uses a lucide `Star`, not a star glyph.

## Imagery

- Crop the logo watermark (top-left of the studio food shots) out of every photo; skip the `use_for: "skip"` duplicates in `research/photos.json`.
- No identifiable faces (diners, staff) without the owner confirming consent; prefer food, interior and exterior shots.
- Never use `logo-57.jpg` (generic placeholder, not the real logo).
- Motifs for decoration: checkerboard bands (ink/cream), gear outlines, the food-icon ring. Use sparingly.
- Raw `<img>` and `public/` URLs go through `withBase()` from `src/lib/basePath.ts`.
