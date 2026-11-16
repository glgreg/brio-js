import type { Page } from "@playwright/test";
import {
    advanceFrames,
    canvasStats,
    expect,
    openExample,
    recordWebGL2Contexts,
    test,
} from "./fixtures";

const PAGE = "/examples/3d-orbit-gallery/";

function backendType(page: Page) {
    return page.evaluate(() => window.brioGame!.renderBackend?.backendType);
}

test.describe("3d-orbit-gallery", () => {
    for (const { query, backend } of [
        { query: "", backend: "webgl2" },
        { query: "?backend=canvas2d", backend: "canvas2d" },
    ]) {
        test(`renders the scene with the ${backend} backend`, async ({ page }) => {
            await openExample(page, PAGE + query);
            await expect(page.locator("#hud")).toContainText(`Backend: ${backend}`);
            expect(await backendType(page)).toBe(backend);

            // Let the real requestAnimationFrame loop run a few frames
            await page.waitForTimeout(500);
            const stats = await canvasStats(page);
            expect(stats.width).toBe(960);
            expect(stats.opaqueRatio).toBeGreaterThan(0.99);
            expect(stats.distinctColors).toBeGreaterThan(32);
            expect(stats.dominantRatio).toBeLessThan(0.9);
        });

        test(`matches the ${backend} golden frame`, async ({ page }) => {
            await openExample(page, PAGE + query, { frozen: true });
            expect(await backendType(page)).toBe(backend);
            await advanceFrames(page, 60);
            await expect(page.locator("#game canvas")).toHaveScreenshot(`scene-${backend}.png`);
        });
    }

    test("renders again after the WebGL context is lost and restored", async ({ page }) => {
        await recordWebGL2Contexts(page);
        await openExample(page, PAGE, { frozen: true });
        expect(await backendType(page)).toBe("webgl2");
        await advanceFrames(page, 20);
        const before = await canvasStats(page);
        expect(before.dominantRatio).toBeLessThan(0.9);

        // PlatformAdapter probes WebGL2 with a throwaway context (released right away); the backend owns the
        // only live one, sized like the game canvas
        const live = await page.evaluate(() => {
            const contexts = window.__brioWebGL2Contexts!.filter((gl) => !gl.isContextLost());
            (window as any).__brioBackendGL = contexts[0];
            return contexts.map((gl) => gl.canvas.width);
        });
        expect(live).toEqual([960]);

        // Keep the extension: getExtension() returns null once the context is lost
        await page.evaluate(() => {
            const gl: WebGL2RenderingContext = (window as any).__brioBackendGL;
            const ext = gl.getExtension("WEBGL_lose_context")!;
            (window as any).__brioLoseContext = ext;
            const lost = new Promise((resolve) =>
                (gl.canvas as HTMLCanvasElement).addEventListener("webglcontextlost", resolve, {
                    once: true,
                }),
            );
            ext.loseContext();
            return lost;
        });
        expect(await page.evaluate(() => (window as any).__brioBackendGL.isContextLost())).toBe(
            true,
        );
        // While lost, the 3D pass is skipped without throwing
        await advanceFrames(page, 20);

        await page.evaluate(() => {
            const gl: WebGL2RenderingContext = (window as any).__brioBackendGL;
            const restored = new Promise((resolve) =>
                (gl.canvas as HTMLCanvasElement).addEventListener("webglcontextrestored", resolve, {
                    once: true,
                }),
            );
            (window as any).__brioLoseContext.restoreContext();
            return restored;
        });
        await advanceFrames(page, 20);

        const after = await canvasStats(page);
        expect(after.opaqueRatio).toBeGreaterThan(0.99);
        expect(after.distinctColors).toBeGreaterThan(32);
        expect(after.dominantRatio).toBeLessThan(0.9);
        // 60 frames in total: the restored context draws exactly what an uninterrupted run draws
        await expect(page.locator("#game canvas")).toHaveScreenshot("scene-webgl2.png");
    });
});
