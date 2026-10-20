import { BrioMaterial } from "../assets/BrioMaterial";
import { BrioMesh } from "../assets/BrioMesh";
import { BrioCamera2D } from "../cameras/BrioCamera2D";
import { BrioCamera3D } from "../cameras/BrioCamera3D";
import { BrioLayer } from "../core/BrioLayer";
import { BrioRegistry } from "../core/BrioRegistry";
import { BrioViewport } from "../core/BrioViewport";
import { DirtyFlag } from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";
import { BrioSpriteRenderer } from "../game/BrioSpriteRenderer";
import { BrioObject2D } from "../objects/BrioObject2D";
import { BrioObject3D } from "../objects/BrioObject3D";
import { Mat4 } from "../math/index";
import { RenderBackend } from "./contracts/RenderBackend";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Renderable content consumed by `BrioCompositor` each frame: the layers, cameras, and 3D objects of
 * a `BrioGame` or of its active `BrioScene`, plus the `ECSWorld` whose dirty flags drive `"static"` layer caching.
 */
export interface CompositorSource {
    /** `ECSWorld` the source objects are bound to. */
    readonly world: ECSWorld;
    /** Layers of the source (sorted by `order` by the compositor). */
    readonly layers: BrioRegistry<BrioLayer>;
    /** 2D cameras; when empty, a full-screen camera at the world origin is used. */
    readonly cameras2D: readonly BrioCamera2D[];
    /** 3D cameras; each one renders `objects3D` into its viewport. */
    readonly cameras3D: readonly BrioCamera3D[];
    /** Root 3D objects (children are rendered through `BrioObject3D.children`). */
    readonly objects3D: readonly BrioObject3D[];
}

/**
 * Debug overlays drawn inside each 2D camera pass.
 */
export interface CompositorDebugOptions {
    /** Draws render bounds of world-space objects. */
    showRenderBounds: boolean;
    /** Draws collider outlines of world-space objects. */
    showCollisionBounds: boolean;
}

/**
 * Per-frame rendering counters exposed through `game.renderStats` (reset at the start of every frame,
 * except `staticRedrawsTotal`, which accumulates).
 */
export interface CompositorStats {
    /** 2D camera passes rendered in the last frame. */
    passes2D: number;
    /** 3D camera passes rendered in the last frame. */
    passes3D: number;
    /** `BrioObject2D` draw calls issued in the last frame (including static cache rasterization). */
    objectsDrawn: number;
    /** `BrioObject2D` skipped by 2D frustum culling in the last frame. */
    objectsCulled: number;
    /** `"static"` layer caches re-rasterized in the last frame. */
    staticRedraws: number;
    /** `"static"` layer caches re-rasterized since the compositor was created. */
    staticRedrawsTotal: number;
}

/** Cached raster of a `"static"` layer for one camera, valid while the camera state below is unchanged. */
interface StaticLayerCache {
    surface: HTMLCanvasElement | OffscreenCanvas;
    ctx: Context2D | null;
    valid: boolean;
    x: number;
    y: number;
    zoom: number;
    rotation: number;
    width: number;
    height: number;
    scale: number;
}

function compareLayerOrder(a: BrioLayer, b: BrioLayer): number {
    return a.order - b.order;
}

/**
 * Frame compositor for `BrioGame` (ADR-0003). For every `CompositorSource` it renders, in order:
 * 1. one **2D world pass per `BrioCamera2D`**, clipped to the camera `BrioViewport` (split-screen / picture-in-picture),
 *    drawing every non-`"ui"` `BrioLayer` by ascending `order`:
 *    - `"dynamic"`: redrawn every frame with frustum culling;
 *    - `"parallax"`: redrawn every frame with the camera offset multiplied by `scrollFactor`;
 *    - `"static"`: rasterized into an offscreen cache per camera and only re-rasterized when the layer, one of its objects,
 *      the camera, or `game.scale` changes;
 * 2. one **3D pass per `BrioCamera3D`** through the active `RenderBackend`;
 * 3. every **`"ui"` layer** once in canvas (screen) space, on top of all viewports.
 *
 * @example
 * ```ts
 * const compositor = new BrioCompositor(spriteRenderer);
 * compositor.renderFrame(ctx, 1280, 720, game.scale, [gameSource], debugOptions);
 * ```
 */
export class BrioCompositor {
    readonly #sprites: BrioSpriteRenderer;
    #backend3D?: RenderBackend;
    #meshes: ReadonlyMap<string, BrioMesh> = new Map();
    #materials: ReadonlyMap<string, BrioMaterial> = new Map();
    readonly #defaultMaterial = new BrioMaterial("mat_brio_default", { color: "#9ca3af" });
    readonly #defaultCamera = new BrioCamera2D("cam_brio_default");
    readonly #defaultCameraList: BrioCamera2D[] = [this.#defaultCamera];
    readonly #staticCaches = new WeakMap<BrioLayer, Map<BrioCamera2D, StaticLayerCache>>();
    readonly #stats: CompositorStats = {
        passes2D: 0,
        passes3D: 0,
        objectsDrawn: 0,
        objectsCulled: 0,
        staticRedraws: 0,
        staticRedrawsTotal: 0,
    };

    /**
     * Creates a new `BrioCompositor`.
     *
     * @param sprites 2D sprite renderer used to draw `BrioObject2D` entities
     */
    constructor(sprites: BrioSpriteRenderer) {
        this.#sprites = sprites;
    }

    /** Counters of the most recently rendered frame. */
    public get stats(): Readonly<CompositorStats> {
        return this.#stats;
    }

    /**
     * Sets the backend and asset registries used by the 3D passes.
     *
     * @param backend Initialized `RenderBackend` (3D passes are skipped while `undefined`)
     * @param meshes Mesh registry keyed by `BrioMesh.name`
     * @param materials Material registry keyed by `BrioMaterial.name`
     */
    public configure3D(
        backend: RenderBackend | undefined,
        meshes: ReadonlyMap<string, BrioMesh>,
        materials: ReadonlyMap<string, BrioMaterial>,
    ): void {
        this.#backend3D = backend;
        this.#meshes = meshes;
        this.#materials = materials;
    }

    /**
     * Renders one frame of every source onto `ctx`, then clears layer and ECS dirty state.
     *
     * @param ctx Game canvas 2D context
     * @param width Canvas width in pixels
     * @param height Canvas height in pixels
     * @param gameScale Global `game.scale` multiplier
     * @param sources Sources rendered back-to-front (e.g. the game, then its active scene)
     * @param debug Debug overlays drawn inside 2D camera passes
     */
    public renderFrame(
        ctx: Context2D,
        width: number,
        height: number,
        gameScale: number,
        sources: readonly CompositorSource[],
        debug: CompositorDebugOptions,
    ): void {
        const stats = this.#stats;
        stats.passes2D = 0;
        stats.passes3D = 0;
        stats.objectsDrawn = 0;
        stats.objectsCulled = 0;
        stats.staticRedraws = 0;

        for (let s = 0; s < sources.length; s++) {
            const source = sources[s];
            const layers = source.layers.sortIfNeeded(compareLayerOrder);
            const cameras =
                source.cameras2D.length > 0 ? source.cameras2D : this.#defaultCameraList;

            for (let c = 0; c < cameras.length; c++) {
                this.#renderCameraPass(
                    ctx,
                    width,
                    height,
                    gameScale,
                    source,
                    layers,
                    cameras[c],
                    debug,
                );
            }

            this.#render3DPasses(source, width, height);

            for (let l = 0; l < layers.length; l++) {
                const layer = layers[l];
                if (!layer.visible || layer.policy !== "ui") continue;
                const objects = layer.getSortedObjects();
                for (let i = 0; i < objects.length; i++) {
                    this.#sprites.renderObject(objects[i], ctx);
                }
                stats.objectsDrawn += objects.length;
            }
        }

        for (let s = 0; s < sources.length; s++) {
            const layers = sources[s].layers.list;
            for (let l = 0; l < layers.length; l++) {
                layers[l].clearDirty();
            }
            sources[s].world.clearAllDirty();
        }
    }

    #renderCameraPass(
        ctx: Context2D,
        width: number,
        height: number,
        gameScale: number,
        source: CompositorSource,
        layers: readonly BrioLayer[],
        camera: BrioCamera2D,
        debug: CompositorDebugOptions,
    ): void {
        const viewport = camera.viewport;
        const vx = Math.round(viewport.x * width);
        const vy = Math.round(viewport.y * height);
        const vw = Math.round(viewport.width * width);
        const vh = Math.round(viewport.height * height);
        if (vw <= 0 || vh <= 0) return;
        this.#stats.passes2D++;

        // Keeps follow/deadzone/culling math in sync with the real viewport size (split-screen)
        if (camera.size.x !== vw || camera.size.y !== vh) {
            camera.size.x = vw;
            camera.size.y = vh;
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(vx, vy, vw, vh);
        ctx.clip();

        for (let l = 0; l < layers.length; l++) {
            const layer = layers[l];
            if (!layer.visible || layer.policy === "ui") continue;

            if (layer.policy === "static") {
                this.#renderStaticLayer(ctx, source, layer, camera, vx, vy, vw, vh, gameScale);
            } else {
                ctx.save();
                ctx.translate(vx, vy);
                this.#applyCameraTransform(ctx, camera, layer, vw, vh, gameScale);
                const cull = layer.policy === "dynamic" && camera.rotation === 0 && gameScale === 1;
                this.#drawObjects(ctx, layer.getSortedObjects(), cull ? camera : undefined);
                ctx.restore();
            }
        }

        if (debug.showRenderBounds || debug.showCollisionBounds) {
            ctx.save();
            ctx.translate(vx, vy);
            for (let l = 0; l < layers.length; l++) {
                const layer = layers[l];
                if (!layer.visible || layer.policy === "ui") continue;
                ctx.save();
                this.#applyCameraTransform(ctx, camera, layer, vw, vh, gameScale);
                const objects = layer.getSortedObjects();
                if (debug.showRenderBounds) this.#sprites.renderBounds(objects);
                if (debug.showCollisionBounds) this.#sprites.renderCollisions(objects);
                ctx.restore();
            }
            ctx.restore();
        }

        ctx.restore();
    }

    #applyCameraTransform(
        ctx: Context2D,
        camera: BrioCamera2D,
        layer: BrioLayer,
        vw: number,
        vh: number,
        gameScale: number,
    ): void {
        const zoom = camera.zoom;
        if (camera.rotation !== 0) {
            ctx.translate(vw * 0.5, vh * 0.5);
            ctx.rotate(-camera.rotation);
            ctx.translate(-vw * 0.5, -vh * 0.5);
        }
        if (zoom !== 1) ctx.scale(zoom, zoom);
        const sf = layer.scrollFactor;
        ctx.translate(-camera.renderX * sf.x * gameScale, -camera.renderY * sf.y * gameScale);
    }

    #drawObjects(
        ctx: Context2D,
        objects: readonly BrioObject2D[],
        cullCamera?: BrioCamera2D,
    ): void {
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (cullCamera && !cullCamera.isVisible(obj)) {
                this.#stats.objectsCulled++;
                continue;
            }
            this.#sprites.renderObject(obj, ctx);
            this.#stats.objectsDrawn++;
        }
    }

    #renderStaticLayer(
        ctx: Context2D,
        source: CompositorSource,
        layer: BrioLayer,
        camera: BrioCamera2D,
        vx: number,
        vy: number,
        vw: number,
        vh: number,
        gameScale: number,
    ): void {
        const cache = this.#getStaticCache(layer, camera, vw, vh);
        if (!cache.ctx) {
            // No offscreen support: degrade to a per-frame redraw
            ctx.save();
            ctx.translate(vx, vy);
            this.#applyCameraTransform(ctx, camera, layer, vw, vh, gameScale);
            this.#drawObjects(ctx, layer.getSortedObjects());
            ctx.restore();
            return;
        }

        const sf = layer.scrollFactor;
        const camX = camera.renderX * sf.x;
        const camY = camera.renderY * sf.y;
        const objects = layer.getSortedObjects();
        const stale =
            !cache.valid ||
            layer.isDirty ||
            cache.x !== camX ||
            cache.y !== camY ||
            cache.zoom !== camera.zoom ||
            cache.rotation !== camera.rotation ||
            cache.width !== vw ||
            cache.height !== vh ||
            cache.scale !== gameScale ||
            this.#hasDirtyObject(source.world, objects);

        if (stale) {
            const cctx = cache.ctx;
            cctx.setTransform(1, 0, 0, 1, 0, 0);
            cctx.clearRect(0, 0, vw, vh);
            this.#sprites.applySmoothingTo(cctx);
            cctx.save();
            this.#applyCameraTransform(cctx, camera, layer, vw, vh, gameScale);
            this.#drawObjects(cctx, objects);
            cctx.restore();

            this.#stats.staticRedraws++;
            this.#stats.staticRedrawsTotal++;
            cache.valid = true;
            cache.x = camX;
            cache.y = camY;
            cache.zoom = camera.zoom;
            cache.rotation = camera.rotation;
            cache.width = vw;
            cache.height = vh;
            cache.scale = gameScale;
        }

        ctx.drawImage(cache.surface as CanvasImageSource, vx, vy);
    }

    #hasDirtyObject(world: ECSWorld, objects: readonly BrioObject2D[]): boolean {
        const flags = world.storage.dirtyFlags;
        for (let i = 0; i < objects.length; i++) {
            const id = objects[i].entityId;
            if (id < 0 || (flags[id] & DirtyFlag.RENDER) !== 0) return true;
        }
        return false;
    }

    #getStaticCache(
        layer: BrioLayer,
        camera: BrioCamera2D,
        vw: number,
        vh: number,
    ): StaticLayerCache {
        let perCamera = this.#staticCaches.get(layer);
        if (!perCamera) {
            perCamera = new Map();
            this.#staticCaches.set(layer, perCamera);
        }
        let cache = perCamera.get(camera);
        if (!cache) {
            const surface = BrioCompositor.#createSurface(vw, vh);
            cache = {
                surface,
                ctx: surface.getContext("2d") as Context2D | null,
                valid: false,
                x: 0,
                y: 0,
                zoom: 1,
                rotation: 0,
                width: 0,
                height: 0,
                scale: 1,
            };
            perCamera.set(camera, cache);
        }
        if (cache.surface.width !== vw || cache.surface.height !== vh) {
            cache.surface.width = vw;
            cache.surface.height = vh;
            cache.valid = false;
        }
        return cache;
    }

    static #createSurface(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
        if (typeof OffscreenCanvas !== "undefined") {
            return new OffscreenCanvas(width, height);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    #render3DPasses(source: CompositorSource, width: number, height: number): void {
        const backend = this.#backend3D;
        if (!backend || source.cameras3D.length === 0 || source.objects3D.length === 0) return;

        for (let c = 0; c < source.cameras3D.length; c++) {
            const camera = source.cameras3D[c];
            const viewport: BrioViewport = camera.viewport;
            this.#stats.passes3D++;
            // Keeps the projection undistorted for any viewport shape (split-screen, minimaps)
            const pixelH = viewport.height * height;
            if (pixelH > 0) {
                const aspect = (viewport.width * width) / pixelH;
                if (Math.abs(camera.aspect - aspect) > 1e-6) camera.aspect = aspect;
            }
            backend.beginFrame(viewport, camera.clearColor);
            const viewProj = camera.viewProjectionMatrix;
            for (let i = 0; i < source.objects3D.length; i++) {
                const obj = source.objects3D[i];
                if (!obj.parent) this.#renderObject3D(backend, obj, viewProj);
            }
            backend.endFrame();
        }
    }

    #renderObject3D(backend: RenderBackend, obj: BrioObject3D, viewProj: Mat4): void {
        if (!obj.transform.visibility) return;
        if (obj.mesh) {
            const mesh = this.#meshes.get(obj.mesh);
            if (mesh) {
                const material = this.#materials.get(obj.material) ?? this.#defaultMaterial;
                backend.renderMesh3D(mesh, material, obj.transform.worldMatrix, viewProj);
            }
        }
        const children = obj.children;
        for (let i = 0; i < children.length; i++) {
            this.#renderObject3D(backend, children[i], viewProj);
        }
    }
}
