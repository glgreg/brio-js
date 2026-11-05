import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    buildShaderSources,
    SHADER_FEATURE_COMBINATIONS,
    SHADOW_DEPTH_SHADERS,
} from "../../src/rendering/WebGL2Backend";

// The fake WebGL2 context used by the other tests cannot compile GLSL. When the Khronos reference compiler is
// installed (`glslangValidator`, package `glslang`), every program variant is compiled offline as GLSL ES 3.00,
// so shader errors show up without a browser. CI images without it skip this suite.
const validator = spawnSync("glslangValidator", ["--version"], { encoding: "utf8" });
const available = validator.status === 0;

describe.skipIf(!available)("WebGL2 shader sources (glslangValidator)", () => {
    it("compiles every vertex and fragment variant", () => {
        const dir = mkdtempSync(join(tmpdir(), "brio-shaders-"));
        try {
            const failures: string[] = [];
            const variants = SHADER_FEATURE_COMBINATIONS.map((features) => ({
                name: `features ${features}`,
                sources: buildShaderSources(features),
            }));
            variants.push({ name: "shadow depth", sources: SHADOW_DEPTH_SHADERS });
            for (const { name, sources } of variants) {
                for (const [stage, source] of [
                    ["vert", sources.vertex],
                    ["frag", sources.fragment],
                ] as const) {
                    const file = join(dir, `${name.replace(/\W+/g, "_")}.${stage}`);
                    writeFileSync(file, source);
                    const result = spawnSync("glslangValidator", ["-S", stage, file], {
                        encoding: "utf8",
                    });
                    if (result.status !== 0) {
                        failures.push(`${name} (${stage}):\n${result.stdout}`);
                    }
                }
            }
            expect(failures).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
