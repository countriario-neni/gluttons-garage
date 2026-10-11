// Postbuild fix for a Next.js 16 static-export bug on Windows.
// The exporter builds segment prefetch filenames with path.relative(), which yields "menu\__PAGE__"
// on Windows, so `out/menu/__next.menu.__PAGE__.txt` is written as `out/menu/__next.menu/__PAGE__.txt`
// and every client prefetch of a nested route 404s. This flattens such directories back into the
// dot-joined filenames the client router requests. On Linux/macOS the output is already flat (no-op).
import { existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));

const filesUnder = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));

let moved = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (!e.isDirectory() || e.name === "_next") continue;
    if (e.name.startsWith("__next.")) {
      for (const f of filesUnder(p)) {
        renameSync(f, join(dir, `${e.name}.${relative(p, f).split(sep).join(".")}`));
        moved++;
      }
      rmSync(p, { recursive: true });
    } else {
      walk(p);
    }
  }
}

if (existsSync(out) && statSync(out).isDirectory()) walk(out);
if (moved) console.log(`fix-export-segments: flattened ${moved} segment file(s)`);
