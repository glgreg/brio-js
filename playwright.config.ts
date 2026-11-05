import { defineConfig, devices } from "@playwright/test";

// Browser end-to-end tests: the examples run against the built `dist/` in real browsers.
// Chromium always runs; Firefox and WebKit are opt-in (`BRIO_E2E_ALL_BROWSERS=1`) because they need host
// libraries that not every development machine provides.
const PORT = Number(process.env.BRIO_E2E_PORT ?? 4173);
const ALL_BROWSERS = process.env.BRIO_E2E_ALL_BROWSERS === "1";
const viewport = { width: 1280, height: 900 };

export default defineConfig({
    testDir: "./e2e",
    outputDir: "./test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        viewport,
        deviceScaleFactor: 1,
        trace: "retain-on-failure",
    },
    expect: {
        // Frozen frames are pixel-identical across Linux hosts; the per-pixel color threshold is kept low because
        // the default (0.2) cannot tell the WebGL2 frame from the Canvas2D one
        toHaveScreenshot: {
            maxDiffPixelRatio: 0.02,
            threshold: 0.05,
            animations: "disabled",
            scale: "css",
        },
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport,
                deviceScaleFactor: 1,
                launchOptions: {
                    // SwiftShader (CPU) WebGL2: identical pixels on any host, no GPU required in CI
                    args: [
                        "--use-gl=angle",
                        "--use-angle=swiftshader",
                        "--enable-unsafe-swiftshader",
                        "--ignore-gpu-blocklist",
                    ],
                },
            },
        },
        ...(ALL_BROWSERS
            ? [
                  {
                      name: "firefox",
                      use: {
                          ...devices["Desktop Firefox"],
                          viewport,
                          deviceScaleFactor: 1,
                          launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true } },
                      },
                  },
                  {
                      name: "webkit",
                      use: { ...devices["Desktop Safari"], viewport, deviceScaleFactor: 1 },
                  },
              ]
            : []),
    ],
    webServer: {
        command: `node e2e/serve.mjs ${PORT}`,
        url: `http://127.0.0.1:${PORT}/examples/2d-star-catcher/`,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
    },
});
