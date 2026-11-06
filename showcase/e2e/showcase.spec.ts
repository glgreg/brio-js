import { test, expect, type Page } from "@playwright/test";

const GAMES = ["lumen-vigil", "araucaria-run", "prism-stack", "comet-garden"];

/** Collects uncaught errors and console errors of a page (ignoring network noise unrelated to the game). */
function watchErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error" && !/favicon|fonts\.g/.test(message.text())) errors.push(message.text());
    });
    return errors;
}

for (const id of GAMES) {
    test(`${id} runs its attract mode on WebGL2`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(`/games/${id}/index.html?demo=1`);
        await page.waitForFunction(() => (window as any).brioGame?.renderBackend !== undefined, null, { timeout: 30_000 });
        expect(await page.evaluate(() => (window as any).brioGame.renderBackend.backendType)).toBe("webgl2");
        await page.waitForTimeout(2500);
        const drawn = await page.evaluate(() => (window as any).brioGame.renderStats.objects3DDrawn);
        expect(drawn).toBeGreaterThan(3);
        expect(errors).toEqual([]);
    });
}

for (const lang of ["en", "pt"]) {
    test(`landing page renders in ${lang} with the live scene and the gallery`, async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(`/?lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lang === "pt" ? "pt-BR" : "en");
        await expect(page.locator(".game-card")).toHaveCount(GAMES.length);
        await expect(page.locator("#hero-stage")).toHaveClass(/live/, { timeout: 30_000 });
        // No key may be left untranslated (a missing key renders as its own name)
        const text = await page.locator("main").innerText();
        expect(text).not.toMatch(/\b(hero|games|bridge|features|teaser|tcc|code|mascot|stats)\.(?!png\b)[a-z]/);
        expect(errors).toEqual([]);
    });
}

test("player page loads a game and credits its assets", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/play?game=araucaria-run");
    await expect(page.locator("#play-title")).toHaveText("Araucária Run");
    await expect(page.locator("#play-credits li")).not.toHaveCount(0);
    await page.locator("#play-start").click();
    await expect(page.locator(".play-frame")).toBeVisible();
    expect(errors).toEqual([]);
});

test("playground copies a template into IndexedDB and runs it in the sandbox", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/playground?template=hello-brio");
    await expect(page.locator(".tree-row.file", { hasText: "main.js" })).toBeVisible({ timeout: 30_000 });
    const frame = page.frameLocator(".game-frame");
    await expect(page.locator(".game-frame")).toBeVisible({ timeout: 30_000 });
    await expect(frame.locator("canvas")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".log-system").first()).toBeVisible();
    await expect(page.locator(".log-error, .log-uncaught")).toHaveCount(0);
    expect(errors).toEqual([]);
});

test("playground reports errors from the game with a link to the source line", async ({ page }) => {
    await page.goto("/playground?template=blank-3d");
    await expect(page.locator(".tree-row.file", { hasText: "main.js" })).toBeVisible({ timeout: 30_000 });
    // Wait for Monaco, break the first line of the code, then run
    await expect(page.locator("#editor-loading")).toHaveCount(0, { timeout: 30_000 });
    await page.locator(".monaco-editor .view-lines").first().click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type("undefinedThing();\n");
    await page.keyboard.press("Control+Enter");
    const link = page.locator(".log-uncaught .src-link");
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toContainText("main.js:1");
});
