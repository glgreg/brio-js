// Lists where the engine allocates during the game loop, for e2e/heap.spec.ts failures.
// Records every allocation (including garbage already collected) with the DevTools sampling heap profiler while a
// minimal game runs, then prints the allocation sites in engine code (dist/) per object per frame.
//
// Usage (from the repository root, after `npm run build`):
//   node e2e/tools/profile-allocations.mjs [boxes3d|sprites2d] [objects=60] [frames=500]
// It starts e2e/serve.mjs on port 4190 itself and opens one headless Chromium page.
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const scenario = process.argv[2] ?? "boxes3d";
const count = Number(process.argv[3] ?? 60);
const frames = Number(process.argv[4] ?? 500);
const port = 4190;

const server = spawn(process.execPath, ["e2e/serve.mjs", String(port)], { stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 500));
const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/e2e/pages/blank.html`);
    await page.evaluate(
        async ({ scenario, count }) => {
            const B = await import("/dist/index.js");
            const is3D = scenario === "boxes3d";
            const game = new B.BrioGame({
                width: 320,
                height: 180,
                container: document.getElementById("game"),
                dimension: is3D ? "3d" : "2d",
                pixelRatio: 1,
                pauseWhenHidden: false,
            });
            const svg =
                "data:image/svg+xml," +
                encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>`,
                );
            game.preload(() =>
                is3D
                    ? [B.BrioMesh.createBox("box"), new B.BrioMaterial("mat")]
                    : [new B.BrioSprite("spr", svg)],
            );
            const objects = [];
            game.load(() => {
                const out = is3D
                    ? [new B.BrioCamera3D("cam", { position: { x: 0, y: 5, z: 30 } })]
                    : [];
                for (let i = 0; i < count; i++) {
                    const object = is3D
                        ? new B.BrioObject3D(`b${i}`, "box", "mat")
                        : new B.BrioObject2D(`o${i}`, "spr");
                    object.transform.position.x = is3D ? (i % 20) - 10 : (i * 37) % 300;
                    out.push(object);
                    objects.push(object);
                }
                return out;
            });
            await game.ready();
            window.__run = (n) => {
                for (let i = 0; i < n; i++) {
                    for (const object of objects) {
                        if (is3D) object.transform.rotation.y += 0.01;
                        else object.transform.position.x = (object.transform.position.x + 1) % 300;
                    }
                    game.step(1 / 60);
                }
            };
            window.__run(300);
        },
        { scenario, count },
    );
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: 64,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
    });
    await page.evaluate((n) => window.__run(n), frames);
    const { profile } = await cdp.send("HeapProfiler.stopSampling");

    const sites = new Map();
    const walk = (node, parent) => {
        const f = node.callFrame;
        const name = `${f.functionName || "(anonymous)"} ${f.url.replace(/.*\/dist\//, "dist/")}:${f.lineNumber + 1}`;
        if (node.selfSize > 0 && f.url.includes("/dist/")) {
            const key = `${name}  <-  ${parent}`;
            sites.set(key, (sites.get(key) ?? 0) + node.selfSize);
        }
        for (const child of node.children) walk(child, name);
    };
    walk(profile.head, "");
    let total = 0;
    for (const bytes of sites.values()) total += bytes;
    console.log(
        `${scenario}, ${count} objects, ${frames} frames: ${(total / frames).toFixed(1)} engine bytes/frame`,
    );
    for (const [site, bytes] of [...sites].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
        console.log(`${(bytes / frames / count).toFixed(2).padStart(8)} B/object/frame  ${site}`);
    }
} finally {
    await browser.close();
    server.kill();
}
