import { test as base, expect, type Page } from "@playwright/test";
import type { BrioGame } from "../src/index";

declare global {
    interface Window {
        /** Game instance exposed by the examples (`window.brioGame = game`). */
        brioGame?: BrioGame;
        /** WebGL2 contexts created by the page, recorded by `recordWebGL2Contexts()`. */
        __brioWebGL2Contexts?: WebGL2RenderingContext[];
    }
}

/** Fixed wall-clock start of frozen runs, so `Date.now()`-derived values never change between runs. */
const FROZEN_EPOCH = new Date("2026-01-01T00:00:00Z").getTime();

/** Duration of one display frame in the frozen clock (fake timers fire `requestAnimationFrame` every 16 ms). */
export const FRAME_MS = 16;

/**
 * `test` with a fixture that fails the test on any uncaught page error or `console.error` message.
 */
export const test = base.extend<{ pageErrors: string[] }>({
    pageErrors: [
        async ({ page }, use) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
            });
            await use(errors);
            expect(errors, "uncaught page errors or console.error messages").toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };

export interface OpenOptions {
    /**
     * Freezes time before the page loads: `requestAnimationFrame`, timers, `Date` and `performance` only advance
     * through `advanceFrames()`, and `Math.random` is seeded, so every run renders the same frames.
     */
    frozen?: boolean;
}

/**
 * Opens an example page and waits until its `BrioGame` finished `preload`, `load` and the 3D backend setup.
 *
 * @param page Playwright page
 * @param path Page path relative to the server root
 * @param options See `OpenOptions`
 */
export async function openExample(page: Page, path: string, options: OpenOptions = {}) {
    if (options.frozen) {
        await page.addInitScript(seedMathRandom);
        await page.clock.install({ time: FROZEN_EPOCH });
        await page.clock.pauseAt(FROZEN_EPOCH + 1000);
    }
    await page.goto(path);
    // The canvas is centered above the HUD, so the HUD line height (which depends on the installed fonts) would
    // put it on a fractional offset and change the size of element screenshots between hosts
    await page.addStyleTag({ content: "#hud, #help { line-height: 20px; }" });
    await page.waitForFunction(() => window.brioGame !== undefined);
    await page.evaluate(() => window.brioGame!.ready());
}

/**
 * Advances a frozen page by `count` display frames.
 *
 * @param page Page opened with `{ frozen: true }`
 * @param count Number of `requestAnimationFrame` ticks to run
 */
export async function advanceFrames(page: Page, count: number) {
    await page.clock.runFor(count * FRAME_MS);
}

/**
 * Records every WebGL2 context the page creates in `window.__brioWebGL2Contexts`. `WebGL2Backend` keeps its
 * GL canvas private (it is never attached to the DOM), so this is the only way to reach it from a test.
 *
 * @param page Playwright page, before `goto()`
 */
export async function recordWebGL2Contexts(page: Page) {
    await page.addInitScript(() => {
        const contexts: WebGL2RenderingContext[] = [];
        window.__brioWebGL2Contexts = contexts;
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            type: string,
            ...rest: unknown[]
        ) {
            const context = (getContext as Function).call(this, type, ...rest);
            if (type === "webgl2" && context && !contexts.includes(context)) contexts.push(context);
            return context;
        } as typeof getContext;
    });
}

export interface CanvasStats {
    width: number;
    height: number;
    /** Fraction of sampled pixels with a non-zero alpha. */
    opaqueRatio: number;
    /** Fraction of sampled pixels sharing the most common color. */
    dominantRatio: number;
    /** Number of distinct colors among the sampled pixels (quantized to 4 bits per channel). */
    distinctColors: number;
}

/**
 * Samples the game canvas (`#game canvas`, a 2D context onto which every pass is composited).
 *
 * @param page Playwright page
 */
export async function canvasStats(page: Page): Promise<CanvasStats> {
    return page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("#game canvas")!;
        const ctx = canvas.getContext("2d")!;
        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        const counts = new Map<number, number>();
        let samples = 0;
        let opaque = 0;
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x += 2) {
                const i = (y * width + x) * 4;
                const key =
                    ((data[i] >> 4) << 12) |
                    ((data[i + 1] >> 4) << 8) |
                    ((data[i + 2] >> 4) << 4) |
                    (data[i + 3] >> 4);
                counts.set(key, (counts.get(key) ?? 0) + 1);
                if (data[i + 3] > 0) opaque++;
                samples++;
            }
        }
        return {
            width,
            height,
            opaqueRatio: opaque / samples,
            dominantRatio: Math.max(...counts.values()) / samples,
            distinctColors: counts.size,
        };
    });
}

/** Init script: replaces `Math.random` with a seeded mulberry32 generator (default engine seeds use it). */
function seedMathRandom() {
    let state = 0x2f6b_4e1d;
    Math.random = () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Hides every `BrioText` of the game and of its active scene and redraws the frame. Glyphs depend on the fonts
 * installed on the host, so golden screenshots leave text out (text rendering is covered by its own assertions).
 *
 * @param page Playwright page
 */
export async function hideTexts(page: Page) {
    await page.evaluate(() => {
        const game = window.brioGame!;
        const objects = [...game.gameObjects.values()];
        if (game.activeScene) objects.push(...game.activeScene.objects2D.values());
        for (const object of objects) {
            if ("lines" in object) object.transform.visibility = false;
        }
        game.renderFrame();
    });
}

/**
 * Reads the text of a `BrioText` registered in the game or in its active scene.
 *
 * @param page Playwright page
 * @param name Object name
 */
export function textOf(page: Page, name: string): Promise<string> {
    return page.evaluate((objectName) => {
        const game = window.brioGame!;
        const object =
            game.gameObjects.get(objectName) ?? game.activeScene?.objects2D.get(objectName);
        return (object as unknown as { text: string } | undefined)?.text ?? "";
    }, name);
}
