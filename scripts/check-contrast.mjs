// Verifies WCAG contrast (>= 4.5:1 text, >= 3:1 UI) for token pairs in src/app/globals.css.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const block = (sel) => css.match(new RegExp(`${sel}\\s*\\{([\\s\\S]*?)\\n\\}`))[1];
const vars = (body) => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const prim = vars(block("@theme"));
const themes = { light: { ...prim, ...vars(block(":root")) }, kitchen: { ...prim, ...vars(block("\\.theme-kitchen")) } };

const resolve = (t, v) => {
  const m = v.match(/^var\((--[\w-]+)\)$/);
  return m ? resolve(t, t[m[1]]) : v;
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground token, background token, minimum ratio]
const pairs = [
  ["--foreground", "--background", 4.5],
  ["--card-foreground", "--card", 4.5],
  ["--popover-foreground", "--popover", 4.5],
  ["--primary-foreground", "--primary", 4.5],
  ["--secondary-foreground", "--secondary", 4.5],
  ["--muted-foreground", "--muted", 4.5],
  ["--muted-foreground", "--background", 4.5],
  ["--muted-foreground", "--card", 4.5],
  ["--accent-foreground", "--accent", 4.5],
  ["--destructive-foreground", "--destructive", 4.5],
  ["--success-foreground", "--success", 4.5],
  ["--warning-foreground", "--warning", 4.5],
  ["--primary", "--background", 4.5], // maroon/orange used as text or link colour on the page
  ["--ring", "--background", 3],
];

let failed = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(resolve(t, t[fg]), resolve(t, t[bg]));
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name.padEnd(7)} ${fg} on ${bg}: ${r.toFixed(2)}:1 (min ${min})`);
  }
}
process.exit(failed ? 1 : 0);
