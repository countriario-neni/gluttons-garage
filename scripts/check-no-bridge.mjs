// Guard: a plain production build (NEXT_PUBLIC_E2E unset) must not ship the E2E-only `window.__ggStore` bridge.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
const hits = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|txt|json|map)$/.test(e) && readFileSync(p, "utf8").includes("__ggStore")) hits.push(p);
  }
})(out);
if (hits.length) {
  console.error(`check:no-bridge FAILED: "__ggStore" found in\n${hits.join("\n")}\n(Was out/ built with NEXT_PUBLIC_E2E=1? Rebuild with a plain \`npm run build\`.)`);
  process.exit(1);
}
console.log("check:no-bridge OK: no __ggStore in out/");
