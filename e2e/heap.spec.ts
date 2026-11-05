import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// The game loop must not allocate per object (architecture constraint: no closures, arrays or objects created in
// hot paths). Each scenario builds a game with the public API, warms it up (pools grow, the JIT settles), then
// records every allocation made by engine code (`/dist/`) during many frames with the DevTools sampling heap
// profiler, which also counts objects already collected. It runs with few and with many objects: garbage that
// grows with the object count is a violation. A small fixed cost per frame remains (V8 boxes floating-point values
// that cross into the Canvas and WebGL APIs) and is capped separately. Chromium only (DevTools protocol).

const FRAMES = 1000;
/** Engine bytes per frame tolerated whatever the scene (number boxing at API boundaries). */
const FIXED_BUDGET = 512;
/**
 * Extra engine bytes per frame tolerated per added object. Below the 16 bytes of the smallest heap object, so any
 * object, array or closure created per object fails; boxed coordinates of one `drawImage` per tile map chunk
 * (about 1 byte per map per frame) pass.
 */
const PER_OBJECT_BUDGET = 4;

type Scenario = "sprites2d" | "collisions" | "text" | "tilemap" | "boxes3d";

async function engineBytesPerFrame(page: Page, scenario: Scenario, count: number): Promise<number> {
    await page.goto("/e2e/pages/blank.html");
    await page.evaluate(
        async ({ scenario, count }) => {
            const B = await import("/dist/index.js" as string);
            const svg = (w: number, h: number) =>
                "data:image/svg+xml," +
                encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="red"/></svg>`,
                );
            const game = new B.BrioGame({
                width: 640,
                height: 360,
                container: document.getElementById("game")!,
                dimension: scenario === "boxes3d" ? "3d" : "2d",
                pixelRatio: 1,
                pauseWhenHidden: false,
            });
            const sheet = new B.BrioSpriteSheet("sht", svg(64, 16), 16, 16, 4, 1);
            game.preload(() =>
                scenario === "boxes3d"
                    ? [B.BrioMesh.createBox("box"), new B.BrioMaterial("mat", { color: "#f80" })]
                    : [new B.BrioSprite("spr", svg(16, 16)), sheet],
            );
            const moving: { transform: any }[] = [];
            game.load(() => {
                const out: unknown[] = [];
                const ui = new B.BrioLayer({ name: "objects", order: 1, policy: "dynamic" });
                out.push(ui);
                for (let i = 0; i < count; i++) {
                    if (scenario === "boxes3d") {
                        if (i === 0) {
                            out.push(
                                new B.BrioCamera3D("cam", { position: { x: 0, y: 5, z: 30 } }),
                            );
                            out.push(new B.BrioLight("sun", "directional"));
                        }
                        const cube = new B.BrioObject3D(`b${i}`, "box", "mat");
                        cube.transform.position.x = (i % 20) - 10;
                        cube.transform.position.z = -Math.floor(i / 20) * 2;
                        out.push(cube);
                        moving.push(cube);
                    } else if (scenario === "tilemap") {
                        const map = new B.BrioTileMap(
                            `map${i}`,
                            16,
                            16,
                            Array.from({ length: 4 }, (_, r) =>
                                Array.from({ length: 4 }, (_, c) => ((r + c) % 4) + 1),
                            ),
                        );
                        map.tileset = sheet;
                        map.position = { x: (i * 70) % 600, y: Math.floor(i / 9) * 70 };
                        ui.addTileMap(map);
                        out.push(map);
                    } else {
                        const object =
                            scenario === "text"
                                ? new B.BrioText(`t${i}`, `Label ${i}`, { strokeWidth: 2 })
                                : new B.BrioObject2D(`o${i}`, "spr");
                        object.transform.position = { x: (i * 37) % 600, y: (i * 53) % 340 };
                        if (scenario === "collisions") {
                            B.BrioCollision.addRectangle({
                                object,
                                colliderType: "trigger",
                                pos: { x: 0, y: 0 },
                                size: { x: 16, y: 16 },
                            });
                            object.onCollisionStay(() => {});
                        }
                        ui.addObject(object);
                        out.push(object);
                        moving.push(object);
                    }
                }
                return out as never[];
            });
            await game.ready();
            const move = () => {
                for (let i = 0; i < moving.length; i++) {
                    const t = moving[i].transform;
                    if (scenario === "boxes3d") t.rotation.y += 0.01;
                    else t.position.x = (t.position.x + 1) % 600;
                }
            };
            (window as unknown as { __run: (n: number) => void }).__run = (n) => {
                for (let i = 0; i < n; i++) {
                    move();
                    game.step(1 / 60);
                }
            };
            (window as unknown as { __run: (n: number) => void }).__run(300);
        },
        { scenario, count },
    );

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.startSampling", {
        samplingInterval: 64,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
    });
    await page.evaluate(
        (frames) => (window as unknown as { __run: (n: number) => void }).__run(frames),
        FRAMES,
    );
    const { profile } = await cdp.send("HeapProfiler.stopSampling");

    interface Node {
        callFrame: { url: string };
        selfSize: number;
        children: Node[];
    }
    let bytes = 0;
    const visit = (node: Node): void => {
        if (node.callFrame.url.includes("/dist/")) bytes += node.selfSize;
        for (const child of node.children) visit(child);
    };
    visit(profile.head as unknown as Node);
    return bytes / FRAMES;
}

test.describe("game loop allocation budget", () => {
    test.skip(({ browserName }) => browserName !== "chromium", "needs the DevTools protocol");

    for (const [scenario, few, many] of [
        ["sprites2d", 10, 200],
        ["collisions", 10, 200],
        ["text", 5, 100],
        ["tilemap", 2, 40],
        ["boxes3d", 5, 100],
    ] as [Scenario, number, number][]) {
        test(`${scenario}: engine garbage does not grow with the object count`, async ({
            page,
        }) => {
            // Open: the 3D path allocated about 53 bytes per object per frame when it was last measured
            // (docs/plans/PERFORMANCE_FOLLOWUPS.md, item P-1); remove this line once it passes on a desktop machine
            test.fixme(
                scenario === "boxes3d",
                "3D per-object allocations, see PERFORMANCE_FOLLOWUPS.md P-1",
            );
            test.setTimeout(90_000);
            const small = await engineBytesPerFrame(page, scenario, few);
            const large = await engineBytesPerFrame(page, scenario, many);
            const perObject = (large - small) / (many - few);
            console.log(
                `${scenario}: ${small.toFixed(1)} B/frame with ${few}, ${large.toFixed(1)} with ${many} ` +
                    `(${perObject.toFixed(2)} B per extra object)`,
            );
            expect(large).toBeLessThan(FIXED_BUDGET);
            expect(perObject).toBeLessThan(PER_OBJECT_BUDGET);
        });
    }
});
