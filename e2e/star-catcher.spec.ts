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

const PAGE = "/examples/2d-star-catcher/?seed=7";

/** Horizontal position of the player ship in the play scene. */
function playerX(page: Page) {
    return page.evaluate(
        () => window.brioGame!.activeScene!.objects2D.get("obj_player")!.transform.position.x,
    );
}

/** From the title scene of a frozen page: starts a run and waits until its scene is active. */
async function startRun(page: Page) {
    await page.keyboard.press("Space");
    await advanceFrames(page, 1);
    // The title scene switches with setScene("play") and starts the run once the scene finished loading
    await page.evaluate(() => window.brioGame!.ready());
    await advanceFrames(page, 1);
    await expect.poll(() => textOf(page, "txt_hud")).toContain("Score 0");
}

test.describe("2d-star-catcher", () => {
    test("loads and draws the title scene with engine text", async ({ page }) => {
        await openExample(page, PAGE);
        expect(await textOf(page, "txt_title")).toBe("Star Catcher");
        expect(await page.evaluate(() => window.brioGame!.activeScene?.name)).toBe("title");

        // Let the real requestAnimationFrame loop run a few frames
        await page.waitForTimeout(500);
        const stats = await canvasStats(page);
        expect(stats.width).toBe(480);
        // The sky gradient is a CSS background: the canvas holds the title text and the background stars
        expect(stats.opaqueRatio).toBeGreaterThan(0.01);
        expect(stats.distinctColors).toBeGreaterThan(4);
    });

    test("matches the play scene golden frame", async ({ page }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 2);
        await startRun(page);
        await advanceFrames(page, 90);
        await hideTexts(page);
        // The sprites cover only a few percent of the canvas: a tighter budget still catches a misplaced one
        await expect(page.locator("#game canvas")).toHaveScreenshot("play.png", {
            maxDiffPixelRatio: 0.005,
        });
    });

    test("starts a run with Space and steers the ship through the input map", async ({ page }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 2);
        expect(await textOf(page, "txt_hud")).toContain("Best: 0");

        await startRun(page);
        expect(await page.evaluate(() => window.brioGame!.activeScene?.name)).toBe("play");
        expect(await textOf(page, "txt_hud")).toBe("Score 0   Lives ***   Best 0");

        const start = await playerX(page);
        await page.keyboard.down("ArrowRight");
        await advanceFrames(page, 15);
        await page.keyboard.up("ArrowRight");
        const right = await playerX(page);
        expect(right).toBeGreaterThan(start + 40);

        await page.keyboard.down("a");
        await advanceFrames(page, 30);
        await page.keyboard.up("a");
        expect(await playerX(page)).toBeLessThan(right - 80);
    });

    test("scores through collision events when a star touches the ship", async ({ page }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 2);
        await startRun(page);
        await page.evaluate(() => {
            const play = window.brioGame!.activeScene!;
            const player = play.objects2D.get("obj_player")!;
            const star = [...play.objects2D.values()].find((o) => o.tag === "star")!;
            star.transform.position = {
                x: player.transform.position.x + 12,
                y: player.transform.position.y,
            };
        });
        await advanceFrames(page, 2);
        expect(await textOf(page, "txt_hud")).toContain("Score 1");
    });
});

test.describe("2d-star-catcher on a high-DPI screen", () => {
    test.use({ deviceScaleFactor: 2 });

    test("renders at twice the resolution with logical coordinates", async ({ page }) => {
        await openExample(page, PAGE);
        const size = await page.evaluate(() => {
            const game = window.brioGame!;
            return {
                ratio: game.pixelRatio,
                backing: [game.canvas.width, game.canvas.height],
                logical: [game.width, game.height],
                css: game.canvas.getBoundingClientRect().width,
            };
        });
        expect(size.ratio).toBe(2);
        expect(size.backing).toEqual([960, 1280]);
        expect(size.logical).toEqual([480, 640]);
        expect(size.css).toBeCloseTo(480, 0);
    });
});
