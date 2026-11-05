import { advanceFrames, canvasStats, expect, hideTexts, openExample, test } from "./fixtures";

const PAGE = "/examples/3d-lantern-courtyard/";

test.describe("3d-lantern-courtyard", () => {
    test("loads the water shader and renders the lit scene on WebGL2 without errors", async ({
        page,
    }) => {
        await openExample(page, PAGE);
        // Shader compile or link errors are logged with console.error, which fails the test (fixtures.ts)
        await page.waitForTimeout(800);
        const info = await page.evaluate(() => {
            const game = window.brioGame!;
            return {
                backend: game.renderBackend?.backendType,
                shader: game.loadedShaders.get("shd_water")?.isLoaded,
                drawn: game.renderStats.objects3DDrawn,
                time: game.time,
            };
        });
        expect(info.backend).toBe("webgl2");
        expect(info.shader).toBe(true);
        expect(info.drawn).toBeGreaterThan(10);
        expect(info.time).toBeGreaterThan(0);
        const stats = await canvasStats(page);
        expect(stats.opaqueRatio).toBeGreaterThan(0.9);
        expect(stats.distinctColors).toBeGreaterThan(20);
    });

    test("drops balls from a 3D prefab with Space", async ({ page }) => {
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 5);
        const count = () =>
            page.evaluate(
                () =>
                    [...window.brioGame!.gameObjects3D.keys()].filter((n) =>
                        n.startsWith("obj_ball-"),
                    ).length,
            );
        expect(await count()).toBe(0);
        await page.keyboard.press("Space");
        await advanceFrames(page, 2);
        await page.keyboard.press("Space");
        await advanceFrames(page, 60);
        expect(await count()).toBe(2);
    });

    test("matches the courtyard golden frame", async ({ page }) => {
        // To generate on a desktop machine (docs/plans/PERFORMANCE_FOLLOWUPS.md, P-3): remove this line and run
        // `npm run test:e2e:update`, then review the image
        test.fixme(true, "golden not generated yet");
        await openExample(page, PAGE, { frozen: true });
        await advanceFrames(page, 90);
        await hideTexts(page);
        await expect(page.locator("#game canvas")).toHaveScreenshot("courtyard.png");
    });
});
