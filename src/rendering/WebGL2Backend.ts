import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioTexture } from "../assets/BrioTexture";
import { ViewportRect } from "../core/BrioViewport";
import { Mat4, Vec3, Vector3 } from "../math/index";
import { parseCanvasColor, srgbToLinear } from "./color";
import { RenderBackend, RenderBackendType } from "./contracts/RenderBackend";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Directional light shared with the Canvas2D backend, so both backends light scenes from the same side. */
const LIGHT_DIRECTION: Vec3 = Vector3.normalizeSelf(Vector3.create(0.4, 0.8, 0.44));
/** Linear-light radiance of the directional light. */
const SUN_COLOR = [0.78, 0.76, 0.72] as const;
/** Hemisphere ambient: sky color (normals pointing up) and ground color (normals pointing down). */
const SKY_COLOR = [0.56, 0.58, 0.62] as const;
const GROUND_COLOR = [0.26, 0.25, 0.24] as const;
/** Upper bound of anisotropic filtering samples requested for textures. */
const MAX_ANISOTROPY = 8;

/** Fixed attribute locations, so one VAO per mesh works with every program variant. */
const ATTR_POSITION = 0;
const ATTR_NORMAL = 1;
const ATTR_UV = 2;

/** Program variant feature bits (one compiled program per combination in use). */
const FEATURE_MAP = 1;
const FEATURE_LIT = 2;
const FEATURE_FLAT = 4;
const FEATURE_ALPHA_TEST = 8;

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uViewProj;
uniform mat4 uWorld;
uniform mat3 uNormalMatrix;
out vec3 vNormal;
out vec3 vWorldPosition;
out vec2 vUv;
void main() {
    vec4 worldPosition = uWorld * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormal = uNormalMatrix * aNormal;
    vUv = aUv;
    gl_Position = uViewProj * worldPosition;
}`;

const FRAGMENT_SHADER = `
precision highp float;
in vec3 vNormal;
in vec3 vWorldPosition;
in vec2 vUv;
uniform vec4 uColor;
uniform sampler2D uMap;
uniform float uAlphaCutoff;
uniform vec3 uLightDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
out vec4 fragColor;

vec3 linearToSrgb(vec3 c) {
    return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}

void main() {
    vec4 base = uColor;
#ifdef USE_MAP
    // SRGB8_ALPHA8 storage: the sampler already returns linear values
    base *= texture(uMap, vUv);
#endif
#ifdef USE_ALPHA_TEST
    if (base.a < uAlphaCutoff) discard;
#endif
    vec3 color = base.rgb;
#ifdef USE_LIGHTING
#ifdef FLAT_SHADED
    vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
#else
    vec3 normal = normalize(vNormal);
    normal = gl_FrontFacing ? normal : -normal;
#endif
    float hemisphere = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    vec3 irradiance = mix(uGroundColor, uSkyColor, hemisphere);
    irradiance += uSunColor * max(dot(normal, uLightDirection), 0.0);
    color *= irradiance;
#endif
    // Premultiplied output, matching the canvas compositor and the ONE / ONE_MINUS_SRC_ALPHA blend
    fragColor = vec4(linearToSrgb(color) * base.a, base.a);
}`;

/** GPU-resident buffers of one `BrioMesh`, uploaded once and reused every frame. */
interface GpuGeometry {
    vao: WebGLVertexArrayObject;
    buffers: WebGLBuffer[];
    indexType: number;
    indexCount: number;
    /** Line-list edge buffer, built on the first wireframe draw. */
    wireVao?: WebGLVertexArrayObject;
    wireCount: number;
}

interface ProgramInfo {
    program: WebGLProgram;
    uViewProj: WebGLUniformLocation | null;
    uWorld: WebGLUniformLocation | null;
    uNormalMatrix: WebGLUniformLocation | null;
    uColor: WebGLUniformLocation | null;
    uMap: WebGLUniformLocation | null;
    uAlphaCutoff: WebGLUniformLocation | null;
}

/** One queued `renderMesh3D()` call, sorted and drawn by `endFrame()`. */
interface DrawItem {
    mesh: BrioMesh;
    material: BrioMaterial;
    world: Float32Array;
    viewProj: Float32Array;
    features: number;
    materialId: number;
    /** Clip-space `w` of the object origin (view depth), used for sorting. */
    depth: number;
}

/** Opaque items: group by program and material (fewer state changes), then front-to-back (early-z). */
function compareOpaque(a: DrawItem, b: DrawItem): number {
    if (a.features !== b.features) return a.features - b.features;
    if (a.materialId !== b.materialId) return a.materialId - b.materialId;
    return a.depth - b.depth;
}

/** Transparent items: back-to-front so blending composes correctly. */
function compareTransparent(a: DrawItem, b: DrawItem): number {
    return b.depth - a.depth;
}

/**
 * Hardware-accelerated `WebGL2` implementation of `RenderBackend`.
 *
 * Mesh buffers are uploaded to the GPU once (cached per `BrioMesh`, one VAO each) and every frame only
 * issues one draw call per mesh, so per-frame cost no longer grows with triangle count on the CPU. Inside a
 * pass, `renderMesh3D()` only queues draw items; `endFrame()` sorts opaque items by program, material, and
 * depth (front-to-back) and transparent items back-to-front, draws them with redundant GL state changes
 * skipped, and copies the viewport onto the 2D canvas so 2D layers and UI keep compositing on top.
 *
 * Shading: hemisphere ambient plus one directional light (Lambert), per-pixel normals (`"lambert"`),
 * derivative normals (`"flat"`), or none (`"unlit"`). `BrioMaterial.texture` is sampled as sRGB data with
 * mipmaps and anisotropic filtering, lighting runs in linear space, and output is sRGB-encoded.
 * Mesh geometry is treated as immutable after the first draw.
 *
 * @example
 * ```ts
 * const backend = new WebGL2Backend();
 * if (await backend.init(canvas)) {
 *     backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 }, "#0b1220");
 *     backend.renderMesh3D(mesh, material, obj.transform.worldMatrix, cam.viewProjectionMatrix);
 *     backend.endFrame();
 * }
 * ```
 */
export class WebGL2Backend implements RenderBackend {
    public readonly backendType: RenderBackendType = "webgl2";
    #surface?: HTMLCanvasElement | OffscreenCanvas;
    #ctx2d: Context2D | null = null;
    #glCanvas?: HTMLCanvasElement | OffscreenCanvas;
    #gl: WebGL2RenderingContext | null = null;
    #contextLost = false;
    #anisotropy: { ext: any; max: number } | null = null;

    #geometries = new WeakMap<BrioMesh, GpuGeometry>();
    #textures = new WeakMap<BrioTexture, WebGLTexture>();
    /** Every GL resource created, so `dispose()` can free them (WeakMaps are not iterable). */
    #ownedBuffers: WebGLBuffer[] = [];
    #ownedVaos: WebGLVertexArrayObject[] = [];
    #ownedTextures: WebGLTexture[] = [];
    #programs = new Map<number, ProgramInfo>();
    #linearColors = new Map<string, Float32Array>();
    #materialIds = new WeakMap<BrioMaterial, number>();
    #nextMaterialId = 1;

    readonly #itemPool: DrawItem[] = [];
    readonly #opaque: DrawItem[] = [];
    readonly #transparent: DrawItem[] = [];
    #itemCount = 0;

    // Pixel rect of the current pass (top-left origin, as on the 2D canvas)
    #px = 0;
    #py = 0;
    #pw = 0;
    #ph = 0;
    #clearOn2D = false;

    // Cached GL state (mirrors three.js WebGLState: skip calls that would not change anything)
    #currentProgram: WebGLProgram | null = null;
    #currentVao: WebGLVertexArrayObject | null = null;
    #cullEnabled: boolean | null = null;
    #blendEnabled: boolean | null = null;
    #depthMask: boolean | null = null;
    #frontFaceCW: boolean | null = null;

    readonly #normalMatrix = new Float32Array(9);
    readonly #colorScratch = new Float32Array(4);
    #drawCalls = 0;
    #trianglesRendered = 0;

    /**
     * Creates an internal WebGL2 canvas matching `surface`; each pass is composited onto `surface`'s 2D context.
     *
     * @param surface Target canvas (its 2D context receives the rendered viewports)
     * @returns `true` if a WebGL2 context and a 2D target context were acquired
     */
    public async init(surface: HTMLCanvasElement | OffscreenCanvas): Promise<boolean> {
        this.#surface = surface;
        this.#ctx2d = surface.getContext("2d") as Context2D | null;
        if (!this.#ctx2d) return false;

        let glCanvas: HTMLCanvasElement | OffscreenCanvas;
        if (typeof document !== "undefined") {
            glCanvas = document.createElement("canvas");
        } else if (typeof OffscreenCanvas !== "undefined") {
            glCanvas = new OffscreenCanvas(1, 1);
        } else {
            return false;
        }
        glCanvas.width = Math.max(1, surface.width);
        glCanvas.height = Math.max(1, surface.height);

        const gl = glCanvas.getContext("webgl2", {
            alpha: true,
            antialias: true,
            depth: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
        }) as WebGL2RenderingContext | null;
        // Duck-typed check: test doubles and non-WebGL2 contexts lack VAO support
        if (
            !gl ||
            typeof (gl as Partial<WebGL2RenderingContext>).createVertexArray !== "function"
        ) {
            return false;
        }

        this.#glCanvas = glCanvas;
        this.#gl = gl;
        (glCanvas as HTMLCanvasElement).addEventListener?.("webglcontextlost", (event: Event) => {
            event.preventDefault();
            this.#contextLost = true;
        });
        (glCanvas as HTMLCanvasElement).addEventListener?.("webglcontextrestored", () => {
            this.#resetResources();
            this.#setupContext();
            this.#contextLost = false;
        });

        this.#setupContext();
        return true;
    }

    /** Number of draw calls issued by the last `endFrame()`. */
    public get drawCalls(): number {
        return this.#drawCalls;
    }

    /** Number of triangles submitted by the last `endFrame()` (back faces are culled later on the GPU). */
    public get trianglesRendered(): number {
        return this.#trianglesRendered;
    }

    /**
     * Begins a pass: restricts drawing to `viewport` and clears its color (or transparency) and depth.
     *
     * @param viewport Normalized viewport `[0..1]`
     * @param clearColor Optional CSS clear color; without it the viewport stays transparent
     */
    public beginFrame(viewport: ViewportRect, clearColor?: string): void {
        this.#opaque.length = 0;
        this.#transparent.length = 0;
        this.#itemCount = 0;
        const gl = this.#gl;
        if (!gl || !this.#surface || !this.#glCanvas || this.#contextLost) return;

        const w = this.#surface.width;
        const h = this.#surface.height;
        if (this.#glCanvas.width !== w || this.#glCanvas.height !== h) {
            this.#glCanvas.width = Math.max(1, w);
            this.#glCanvas.height = Math.max(1, h);
        }

        this.#px = Math.round(viewport.x * w);
        this.#py = Math.round(viewport.y * h);
        this.#pw = Math.round(viewport.width * w);
        this.#ph = Math.round(viewport.height * h);
        // GL window coordinates start at the bottom-left corner
        const glY = h - this.#py - this.#ph;
        gl.viewport(this.#px, glY, this.#pw, this.#ph);
        gl.scissor(this.#px, glY, this.#pw, this.#ph);

        const rgba = clearColor ? this.#resolveColor(clearColor) : undefined;
        if (rgba) {
            // Clear values are written as-is to the sRGB canvas, premultiplied like the shader output
            gl.clearColor(
                (rgba[0] / 255) * rgba[3],
                (rgba[1] / 255) * rgba[3],
                (rgba[2] / 255) * rgba[3],
                rgba[3],
            );
        } else {
            gl.clearColor(0, 0, 0, 0);
        }
        this.#setDepthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Without an opaque clear color the 2D content under the viewport is erased, like Canvas2DBackend
        this.#clearOn2D = !rgba || rgba[3] < 1;
    }

    /**
     * Queues `mesh` for this pass; `endFrame()` sorts and draws the queue.
     *
     * @param mesh 3D `BrioMesh` geometry
     * @param material `BrioMaterial` appearance
     * @param worldMatrix Object 4x4 world matrix
     * @param viewProjMatrix Camera 4x4 view-projection matrix
     */
    public renderMesh3D(
        mesh: BrioMesh,
        material: BrioMaterial,
        worldMatrix: Mat4,
        viewProjMatrix: Mat4,
    ): void {
        if (!this.#gl || this.#contextLost || mesh.indices.length === 0) return;

        let item = this.#itemPool[this.#itemCount];
        if (!item) {
            item = {
                mesh,
                material,
                world: new Float32Array(16),
                viewProj: new Float32Array(16),
                features: 0,
                materialId: 0,
                depth: 0,
            };
            this.#itemPool.push(item);
        }
        this.#itemCount++;
        item.mesh = mesh;
        item.material = material;
        item.world.set(worldMatrix);
        item.viewProj.set(viewProjMatrix);
        item.features = this.#featuresOf(material);
        item.materialId = this.#materialId(material);
        const vp = viewProjMatrix;
        const x = worldMatrix[12];
        const y = worldMatrix[13];
        const z = worldMatrix[14];
        item.depth = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];

        if (material.opacity < 1) this.#transparent.push(item);
        else this.#opaque.push(item);
    }

    /**
     * Draws the queued items (opaque first, then transparent) and composites the viewport onto the 2D canvas.
     */
    public endFrame(): void {
        const gl = this.#gl;
        if (!gl || this.#contextLost) return;

        this.#drawCalls = 0;
        this.#trianglesRendered = 0;
        this.#opaque.sort(compareOpaque);
        this.#transparent.sort(compareTransparent);

        this.#setBlend(false);
        this.#setDepthMask(true);
        for (let i = 0; i < this.#opaque.length; i++) this.#draw(gl, this.#opaque[i]);

        if (this.#transparent.length > 0) {
            this.#setBlend(true);
            this.#setDepthMask(false);
            for (let i = 0; i < this.#transparent.length; i++) this.#draw(gl, this.#transparent[i]);
            this.#setDepthMask(true);
        }

        this.#opaque.length = 0;
        this.#transparent.length = 0;
        this.#composite();
    }

    /**
     * Frees every GPU resource, the program cache, and the internal WebGL2 canvas.
     */
    public dispose(): void {
        const gl = this.#gl;
        if (gl && !this.#contextLost) {
            for (const buffer of this.#ownedBuffers) gl.deleteBuffer(buffer);
            for (const vao of this.#ownedVaos) gl.deleteVertexArray(vao);
            for (const texture of this.#ownedTextures) gl.deleteTexture(texture);
            for (const info of this.#programs.values()) gl.deleteProgram(info.program);
        }
        this.#resetResources();
        this.#gl = null;
        this.#glCanvas = undefined;
        this.#ctx2d = null;
        this.#surface = undefined;
    }

    #setupContext(): void {
        const gl = this.#gl!;
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.SCISSOR_TEST);
        gl.cullFace(gl.BACK);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        // Constant values used when a mesh has no normals / UVs (that attribute array stays disabled)
        gl.vertexAttrib3f(ATTR_NORMAL, 0, 1, 0);
        gl.vertexAttrib2f(ATTR_UV, 0, 0);
        const ext =
            gl.getExtension("EXT_texture_filter_anisotropic") ??
            gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
        this.#anisotropy = ext
            ? {
                  ext,
                  max: Math.min(
                      MAX_ANISOTROPY,
                      gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number,
                  ),
              }
            : null;
    }

    #resetResources(): void {
        this.#geometries = new WeakMap();
        this.#textures = new WeakMap();
        this.#ownedBuffers = [];
        this.#ownedVaos = [];
        this.#ownedTextures = [];
        this.#programs.clear();
        this.#currentProgram = null;
        this.#currentVao = null;
        this.#cullEnabled = null;
        this.#blendEnabled = null;
        this.#depthMask = null;
        this.#frontFaceCW = null;
    }

    #featuresOf(material: BrioMaterial): number {
        if (material.wireframe) return 0;
        let features = 0;
        if (material.texture && this.#textureFor(material.texture)) features |= FEATURE_MAP;
        if (material.shading !== "unlit") features |= FEATURE_LIT;
        if (material.shading === "flat") features |= FEATURE_FLAT;
        if (material.alphaCutoff > 0) features |= FEATURE_ALPHA_TEST;
        return features;
    }

    #materialId(material: BrioMaterial): number {
        let id = this.#materialIds.get(material);
        if (id === undefined) {
            id = this.#nextMaterialId++;
            this.#materialIds.set(material, id);
        }
        return id;
    }

    #draw(gl: WebGL2RenderingContext, item: DrawItem): void {
        const material = item.material;
        const geometry = this.#geometryFor(gl, item.mesh);
        const info = this.#programFor(gl, item.features);
        if (!info) return;

        if (this.#currentProgram !== info.program) {
            gl.useProgram(info.program);
            this.#currentProgram = info.program;
        }

        gl.uniformMatrix4fv(info.uViewProj, false, item.viewProj);
        gl.uniformMatrix4fv(info.uWorld, false, item.world);
        const det = this.#computeNormalMatrix(item.world);
        gl.uniformMatrix3fv(info.uNormalMatrix, false, this.#normalMatrix);

        const color = this.#linearColor(material.color);
        const rgba = this.#colorScratch;
        rgba[0] = color[0];
        rgba[1] = color[1];
        rgba[2] = color[2];
        rgba[3] = color[3] * material.opacity;
        gl.uniform4fv(info.uColor, rgba);

        if ((item.features & FEATURE_MAP) !== 0) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.#textureFor(material.texture!)!);
            gl.uniform1i(info.uMap, 0);
        }
        if ((item.features & FEATURE_ALPHA_TEST) !== 0) {
            gl.uniform1f(info.uAlphaCutoff, material.alphaCutoff);
        }

        this.#setCull(!material.doubleSided && !material.wireframe);
        // A mirroring transform flips the winding, so front faces become clockwise (as in three.js)
        this.#setFrontFaceCW(det < 0);

        if (material.wireframe) {
            const vao = this.#wireVaoFor(gl, item.mesh, geometry);
            this.#bindVao(gl, vao);
            gl.drawElements(gl.LINES, geometry.wireCount, geometry.indexType, 0);
        } else {
            this.#bindVao(gl, geometry.vao);
            gl.drawElements(gl.TRIANGLES, geometry.indexCount, geometry.indexType, 0);
        }
        this.#drawCalls++;
        this.#trianglesRendered += item.mesh.triangleCount;
    }

    /**
     * Writes the inverse-transpose of the upper 3x3 of `m` to `#normalMatrix` and returns its determinant.
     */
    #computeNormalMatrix(m: Float32Array): number {
        const a00 = m[0],
            a01 = m[1],
            a02 = m[2];
        const a10 = m[4],
            a11 = m[5],
            a12 = m[6];
        const a20 = m[8],
            a21 = m[9],
            a22 = m[10];
        const c00 = a11 * a22 - a12 * a21;
        const c01 = a12 * a20 - a10 * a22;
        const c02 = a10 * a21 - a11 * a20;
        const det = a00 * c00 + a01 * c01 + a02 * c02;
        const inv = det !== 0 ? 1 / det : 0;
        // Cofactor matrix / det = (M^-1)^T, laid out column-major like `m`
        const n = this.#normalMatrix;
        n[0] = c00 * inv;
        n[1] = c01 * inv;
        n[2] = c02 * inv;
        n[3] = (a02 * a21 - a01 * a22) * inv;
        n[4] = (a00 * a22 - a02 * a20) * inv;
        n[5] = (a01 * a20 - a00 * a21) * inv;
        n[6] = (a01 * a12 - a02 * a11) * inv;
        n[7] = (a02 * a10 - a00 * a12) * inv;
        n[8] = (a00 * a11 - a01 * a10) * inv;
        return det;
    }

    #geometryFor(gl: WebGL2RenderingContext, mesh: BrioMesh): GpuGeometry {
        let geometry = this.#geometries.get(mesh);
        if (geometry) return geometry;

        const vao = gl.createVertexArray()!;
        this.#ownedVaos.push(vao);
        this.#bindVao(gl, vao);
        const buffers: WebGLBuffer[] = [];
        const vertexCount = mesh.vertexCount;
        const upload = (location: number, data: Float32Array, size: number): void => {
            if (data.length < vertexCount * size) return;
            const buffer = gl.createBuffer()!;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
            buffers.push(buffer);
        };
        upload(ATTR_POSITION, mesh.positions, 3);
        upload(ATTR_NORMAL, mesh.normals, 3);
        upload(ATTR_UV, mesh.uvs, 2);

        const indexBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        buffers.push(indexBuffer);
        this.#ownedBuffers.push(...buffers);

        geometry = {
            vao,
            buffers,
            indexType: mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
            indexCount: mesh.indices.length,
            wireCount: 0,
        };
        this.#geometries.set(mesh, geometry);
        return geometry;
    }

    /** Builds (once) a VAO sharing the mesh vertex buffers with a line-list index buffer of triangle edges. */
    #wireVaoFor(
        gl: WebGL2RenderingContext,
        mesh: BrioMesh,
        geometry: GpuGeometry,
    ): WebGLVertexArrayObject {
        if (geometry.wireVao) return geometry.wireVao;
        const tri = mesh.indices;
        const lines =
            tri instanceof Uint32Array
                ? new Uint32Array(tri.length * 2)
                : new Uint16Array(tri.length * 2);
        for (let i = 0, o = 0; i + 2 < tri.length; i += 3) {
            lines[o++] = tri[i];
            lines[o++] = tri[i + 1];
            lines[o++] = tri[i + 1];
            lines[o++] = tri[i + 2];
            lines[o++] = tri[i + 2];
            lines[o++] = tri[i];
        }

        const vao = gl.createVertexArray()!;
        this.#ownedVaos.push(vao);
        this.#bindVao(gl, vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffers[0]);
        gl.enableVertexAttribArray(ATTR_POSITION);
        gl.vertexAttribPointer(ATTR_POSITION, 3, gl.FLOAT, false, 0, 0);
        const lineBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);
        this.#ownedBuffers.push(lineBuffer);

        geometry.wireVao = vao;
        geometry.wireCount = lines.length;
        return vao;
    }

    /** Uploads (once) a decoded `BrioTexture` as sRGB with mipmaps; `undefined` while it is still decoding. */
    #textureFor(texture: BrioTexture): WebGLTexture | undefined {
        const cached = this.#textures.get(texture);
        if (cached) return cached;
        const gl = this.#gl!;
        const source: TexImageSource | undefined =
            texture.bitmap ??
            (texture.isDecoded || (texture.element.complete && texture.element.naturalWidth > 0)
                ? texture.element
                : undefined);
        if (!source || texture.width === 0 || texture.height === 0) return undefined;

        const handle = gl.createTexture()!;
        this.#ownedTextures.push(handle);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, handle);
        // glTF UVs put the image origin at the top-left, which is how WebGL reads unflipped rows
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        const levels = Math.floor(Math.log2(Math.max(texture.width, texture.height))) + 1;
        gl.texStorage2D(gl.TEXTURE_2D, levels, gl.SRGB8_ALPHA8, texture.width, texture.height);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        if (this.#anisotropy) {
            gl.texParameterf(
                gl.TEXTURE_2D,
                this.#anisotropy.ext.TEXTURE_MAX_ANISOTROPY_EXT,
                this.#anisotropy.max,
            );
        }
        this.#textures.set(texture, handle);
        return handle;
    }

    #programFor(gl: WebGL2RenderingContext, features: number): ProgramInfo | undefined {
        const cached = this.#programs.get(features);
        if (cached) return cached;

        const defines: string[] = [];
        if (features & FEATURE_MAP) defines.push("#define USE_MAP");
        if (features & FEATURE_LIT) defines.push("#define USE_LIGHTING");
        if (features & FEATURE_FLAT) defines.push("#define FLAT_SHADED");
        if (features & FEATURE_ALPHA_TEST) defines.push("#define USE_ALPHA_TEST");
        const fragmentSource = `#version 300 es\n${defines.join("\n")}\n${FRAGMENT_SHADER}`;

        const vs = this.#compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        const fs = this.#compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`WebGL2Backend: program link failed (features ${features}): ${log}`);
        }

        const info: ProgramInfo = {
            program,
            uViewProj: gl.getUniformLocation(program, "uViewProj"),
            uWorld: gl.getUniformLocation(program, "uWorld"),
            uNormalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
            uColor: gl.getUniformLocation(program, "uColor"),
            uMap: gl.getUniformLocation(program, "uMap"),
            uAlphaCutoff: gl.getUniformLocation(program, "uAlphaCutoff"),
        };
        // Light uniforms are constant per program: set once at link time
        gl.useProgram(program);
        this.#currentProgram = program;
        gl.uniform3f(
            gl.getUniformLocation(program, "uLightDirection"),
            LIGHT_DIRECTION.x,
            LIGHT_DIRECTION.y,
            LIGHT_DIRECTION.z,
        );
        gl.uniform3fv(gl.getUniformLocation(program, "uSunColor"), SUN_COLOR);
        gl.uniform3fv(gl.getUniformLocation(program, "uSkyColor"), SKY_COLOR);
        gl.uniform3fv(gl.getUniformLocation(program, "uGroundColor"), GROUND_COLOR);
        this.#programs.set(features, info);
        return info;
    }

    #compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`WebGL2Backend: shader compilation failed: ${log}`);
        }
        return shader;
    }

    /** Resolves any CSS color to `[r, g, b, a]` through the 2D context (`r, g, b` in `0..255`). */
    #resolveColor(color: string): [number, number, number, number] | undefined {
        const ctx = this.#ctx2d;
        if (!ctx) return parseCanvasColor(color);
        const previous = ctx.fillStyle;
        ctx.fillStyle = "#000000";
        ctx.fillStyle = color;
        const normalized = ctx.fillStyle;
        ctx.fillStyle = previous;
        return typeof normalized === "string" ? parseCanvasColor(normalized) : undefined;
    }

    /** Cached linear-light `[r, g, b, a]` of a CSS color (white when it cannot be resolved). */
    #linearColor(color: string): Float32Array {
        let linear = this.#linearColors.get(color);
        if (!linear) {
            const rgba = this.#resolveColor(color) ?? [255, 255, 255, 1];
            linear = new Float32Array([
                srgbToLinear(rgba[0] / 255),
                srgbToLinear(rgba[1] / 255),
                srgbToLinear(rgba[2] / 255),
                rgba[3],
            ]);
            this.#linearColors.set(color, linear);
        }
        return linear;
    }

    /** Copies the pass viewport from the WebGL2 canvas onto the 2D canvas. */
    #composite(): void {
        const ctx = this.#ctx2d;
        if (!ctx || !this.#glCanvas || this.#pw <= 0 || this.#ph <= 0) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.imageSmoothingEnabled = false;
        if (this.#clearOn2D) ctx.clearRect(this.#px, this.#py, this.#pw, this.#ph);
        ctx.drawImage(
            this.#glCanvas as CanvasImageSource,
            this.#px,
            this.#py,
            this.#pw,
            this.#ph,
            this.#px,
            this.#py,
            this.#pw,
            this.#ph,
        );
        ctx.restore();
    }

    #bindVao(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
        if (this.#currentVao !== vao) {
            gl.bindVertexArray(vao);
            this.#currentVao = vao;
        }
    }

    #setCull(enabled: boolean): void {
        if (this.#cullEnabled === enabled) return;
        const gl = this.#gl!;
        if (enabled) gl.enable(gl.CULL_FACE);
        else gl.disable(gl.CULL_FACE);
        this.#cullEnabled = enabled;
    }

    #setBlend(enabled: boolean): void {
        if (this.#blendEnabled === enabled) return;
        const gl = this.#gl!;
        if (enabled) gl.enable(gl.BLEND);
        else gl.disable(gl.BLEND);
        this.#blendEnabled = enabled;
    }

    #setDepthMask(enabled: boolean): void {
        if (this.#depthMask === enabled) return;
        this.#gl!.depthMask(enabled);
        this.#depthMask = enabled;
    }

    #setFrontFaceCW(cw: boolean): void {
        if (this.#frontFaceCW === cw) return;
        const gl = this.#gl!;
        gl.frontFace(cw ? gl.CW : gl.CCW);
        this.#frontFaceCW = cw;
    }
}
