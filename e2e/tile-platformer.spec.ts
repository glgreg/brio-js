import {
    advanceFrames,
    canvasStats,
    expect,
    hideTexts,
    openExample,
    test,
    textOf,
} from "./fixtures";
import type { Page } from "@playwright/test";

const PAGE = "/examples/2d-tile-platformer/";

function hero(page: Page) {
    return page.evaluate(() => {
        const t = window.brioGame!.gameObjects.get("obj_hero")!.transform.position;
        return { x: t.x, y: t.y };
    });
}

function teleport(page: Page, x: number, y: number) {
    return page.evaluate(
        ([px, py]) => {
            window.brioGame!.gameObjects.get("obj_hero")!.transform.position = { x: px, y: py };
        },
        [x, y],
    );
}

test.describe("2d-tile-platformer", () => {
    test("draws the tile map in chunks, fitted to the window", async ({ page }) => {
        await openExample(page, PAGE);
        await page.waitForTimeout(300);
        const info = await page.evaluate(() => {
            const game = window.brioGame!;
            return {
                chunks: game.renderStats.tileChunksDrawn,
                logical: [game.width, game.height],
                cssWidth: game.canvas.getBoundingClientRect().width,
            };
        });
        expect(info.chunks).toBeGreaterThan(0);
        expect(info.logical).toEqual([320, 180]);
        // "fit" keeps 320x180 and scales it to the 1280x900 viewport (width-bound: 4x)
        expect(info.cssWidth).toBeCloseTo(1280, 0);
        const stats = await canvasStats(page);
        expect(stats.opaqueRatio).toBeGreaterThan(0.1);
    });

    test("matches the level golden frame", async ({ page }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 30);
        await hideTexts(page);
        await expect(page.locator("#game canvas")).toHaveScreenshot("level.png");
    });

    test("runs, jumps, collects coins and returns to the checkpoint on spikes", async ({
        page,
    }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 10);
        const start = await hero(page);

        // The first ledge ends at x = 64: a short run keeps the hero on it
        await page.keyboard.down("ArrowRight");
        await advanceFrames(page, 8);
        await page.keyboard.up("ArrowRight");
        await advanceFrames(page, 2);
        expect((await hero(page)).x).toBeGreaterThan(start.x + 8);

        const grounded = await hero(page);
        await page.keyboard.press("Space");
        await advanceFrames(page, 8);
        expect((await hero(page)).y).toBeLessThan(grounded.y - 20);
        await advanceFrames(page, 60);

        // A coin floats at tile (7, 7)
        await teleport(page, 112, 110);
        await advanceFrames(page, 2);
        expect(await textOf(page, "txt_hud")).toBe("Coins 1/8");

        // The flag stores a checkpoint; a coin collected afterwards comes back after touching the spikes
        await teleport(page, 494, 140);
        await advanceFrames(page, 3);
        await teleport(page, 560, 78);
        await advanceFrames(page, 2);
        expect(await textOf(page, "txt_hud")).toBe("Coins 2/8");
        await teleport(page, 378, 160);
        await advanceFrames(page, 6);
        expect(await textOf(page, "txt_hud")).toBe("Coins 1/8");
        expect((await hero(page)).x).toBeCloseTo(494, 0);
        const coins = await page.evaluate(
            () =>
                [...window.brioGame!.gameObjects.keys()].filter((n) => n.startsWith("obj_coin"))
                    .length,
        );
        expect(coins).toBe(7);
    });
});
