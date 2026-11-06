import { defineConfig, devices } from "@playwright/test";

// Smoke tests of the showcase: every page and demo game loads on the WebGL2 backend without errors, and the
// playground runs a project from IndexedDB through its service worker. Uses the repository's Playwright
// (`npx playwright test -c showcase/playwright.config.ts` from the root, or `npm test` here).
const PORT = Number(process.env.SHOWCASE_E2E_PORT ?? 4317);

export default defineConfig({
    testDir: "./e2e",
    outputDir: "../test-results/showcase",
    fullyParallel: true,
    // Each test renders WebGL2 on the CPU (SwiftShader); more workers make frames too slow and timings flaky
    workers: 2,
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    timeout: 60_000,
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1280, height: 800 },
                launchOptions: {
                    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
                },
            },
        },
    ],
    webServer: {
        command: `node scripts/build-engine.mjs && node scripts/build-manifests.mjs && npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
