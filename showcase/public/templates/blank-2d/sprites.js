// GPU sprites for BrioJS: every 2D thing in Lumen Vigil is a textured quad drawn by the WebGL2 backend, so it can
// be lit by point lights, flashed by a shader and depth-sorted for free. One shared quad mesh, one material per
// sprite-sheet frame (or a material whose uFrame changes every frame).
import { BrioMesh, BrioMaterial, BrioObject3D, BrioShader, BrioTexture } from "@brio-js/core";

export const QUAD = "mesh_quad";
export const SPRITE_SHADER = "shd_sprite";

/** A 1x1 quad on the XY plane facing +Z (the camera), with UV (0, 0) at its top-left corner. */
export function quadMesh() {
    const positions = new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0]);
    const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint16Array([0, 3, 2, 0, 2, 1]);
    return new BrioMesh(QUAD, positions, normals, uvs, indices);
}

export function spriteShader() {
    return new BrioShader(SPRITE_SHADER, { url: new URL("./sprite.glsl", import.meta.url).href });
}

/** Loads a texture for pixel art: nearest filtering (crisp pixels) and clamped edges. */
export async function pixelTexture(url) {
    const texture = new BrioTexture(new URL(url, import.meta.url).href);
    texture.filter = "nearest";
    texture.wrap = "clamp";
    await texture.decode();
    return texture;
}

/** UV rectangle of cell (col, row) in a grid of `cw` x `ch` pixel cells. */
export function cell(texture, cw, ch, col, row, out = [0, 0, 0, 0]) {
    const inset = 0.02;
    out[0] = (col * cw + inset) / texture.width;
    out[1] = (row * ch + inset) / texture.height;
    out[2] = (cw - inset * 2) / texture.width;
    out[3] = (ch - inset * 2) / texture.height;
    return out;
}

/**
 * A material that shows one frame of `texture`. `lit` sprites react to the lights of the scene; glowing ones
 * (`glow` > 0, or `lit: false`) do not.
 */
export function spriteMaterial(name, texture, frame, options = {}) {
    return new BrioMaterial(name, {
        shading: options.lit === false ? "unlit" : "lambert",
        texture,
        alphaCutoff: options.alphaCutoff ?? 0.5,
        opacity: options.opacity ?? 1,
        doubleSided: true,
        shader: SPRITE_SHADER,
        parameters: {
            uFrame: frame,
            uTint: options.tint ?? [1, 1, 1, 1],
            uFlash: options.flash ?? 0,
            uGlow: options.glow ?? 0,
        },
    });
}

/** A sprite object: the shared quad scaled to `w` x `h` world units at depth `z`. */
export function sprite(name, material, w, h, z = 0) {
    const object = new BrioObject3D(name, QUAD, material);
    object.transform.scale = { x: w, y: h, z: 1 };
    object.transform.position.z = z;
    object.castShadow = false;
    object.receiveShadow = false;
    return object;
}
