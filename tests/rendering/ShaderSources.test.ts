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
            // A custom BrioShader using both hooks, every built-in, a uniform of each kind and the BrioSurface fields
            const hooks = {
                vertex: `uniform float uWaveHeight;
void vertex(inout vec3 position, inout vec3 normal) {
    position.y += sin(position.x * 2.0 + TIME) * uWaveHeight;
    normal = normalize(normal + vec3(0.0, 0.1, 0.0) * distance(CAMERA_POSITION, position));
}`,
                fragment: `uniform vec3 uDeepColor;
uniform vec4 uParams;
void surface(inout BrioSurface s) {
    s.baseColor = mix(uDeepColor, s.baseColor, 0.5 + 0.5 * sin(s.worldPosition.x + TIME));
    s.emissive += vec3(uParams.x) * s.uv.x;
    s.roughness = 0.1;
    s.metalness = uParams.y;
    s.opacity *= 0.9;
    s.normal = normalize(s.normal + vec3(0.0, uParams.z, 0.0));
}`,
            };
            for (const features of SHADER_FEATURE_COMBINATIONS) {
                variants.push({
                    name: `hooks ${features}`,
                    sources: buildShaderSources(features, hooks),
                });
            }
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
