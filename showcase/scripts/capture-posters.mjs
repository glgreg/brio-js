// Captures public/games/<id>/poster.webp from each game's attract mode (?demo=1). A local tool, not part of the
// build: run the dev server (npm run dev) and then `node scripts/capture-posters.mjs` from showcase/.
// Uses the repository's Playwright (root devDependency) with a headless Chromium that has WebGL2.
import { chromium } from "../../node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.BASE ?? "http://localhost:5173";
const games = { "lumen-vigil": "?demo=1&t=95", "araucaria-run": "?demo=1", "prism-stack": "?demo=1" };
const waits = { "lumen-vigil": 14000, "araucaria-run": 9000, "prism-stack": 26000 };
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "games");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [id, query] of Object.entries(games)) {
    if (process.argv[2] && process.argv[2] !== id) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/games/${id}/index.html${query}`);
    await page.waitForTimeout(waits[id]);
    const png = join(root, id, "poster.png");
    await page.screenshot({ path: png });
    execFileSync("python3", ["-c", `from PIL import Image; im=Image.open("${png}").convert("RGB"); im.thumbnail((960,600)); im.save("${png.replace(".png", ".webp")}", quality=82)`]);
    execFileSync("rm", [png]);
    console.log(`${id}: poster.webp`);
    await page.close();
}
await browser.close();
