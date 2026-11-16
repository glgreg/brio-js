import type { BrioSpriteSheet } from "../assets/BrioSpriteSheet";
import type { BrioTileMap } from "../assets/BrioTileMap";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;
type TileSource = CanvasImageSource;

/**
 * Number of chunk surfaces kept per map before reuse. Beyond it, the least recently drawn chunk outside the
 * current view gives its surface to the new chunk, which bounds memory on large maps (256 chunks of
 * 256x256 px is 64 MiB). When more chunks than this are visible at once, the cache grows to the visible count
 * instead of re-rasterizing every frame.
 *
 * @internal
 */
export const MAX_CACHED_CHUNKS_PER_MAP = 256;

/** Chunk rasters of one `BrioTileMap`, allocated once per map and reused every frame. */
interface ChunkCache {
    /** Chunk surfaces by row-major chunk index (`null` until first visible or after eviction). */
    readonly surfaces: (Surface | null)[];
    /** 2D contexts matching `surfaces`. */
    readonly contexts: (Context2D | null)[];
    /** `map.getChunkVersion(i)` at the last rasterization (`0` = never rasterized). */
    readonly rasterVersions: Uint32Array;
    /** Draw stamp of the last call that drew each chunk. */
    readonly lastUsed: Float64Array;
    /** Number of non-null `surfaces`. */
    live: number;
    /** `true` once a surface had no 2D context (jsdom, no canvas support): tiles are drawn directly. */
    direct: boolean;
}

const chunkCaches = new WeakMap<BrioTileMap, ChunkCache>();
let drawStamp = 0;

function createSurface(width: number, height: number): Surface {
    if (typeof OffscreenCanvas !== "undefined") {
        return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function getChunkCache(map: BrioTileMap): ChunkCache {
    let cache = chunkCaches.get(map);
    if (!cache) {
        const count = map.chunkColumns * map.chunkRows;
        cache = {
            surfaces: new Array<Surface | null>(count).fill(null),
            contexts: new Array<Context2D | null>(count).fill(null),
            rasterVersions: new Uint32Array(count),
            lastUsed: new Float64Array(count),
            live: 0,
            direct: false,
        };
        chunkCaches.set(map, cache);
    }
    return cache;
}

/**
 * Draws the tiles `[col0, col1] x [row0, row1]` of `map` with their top-left tile at `(baseX + col0 * tw, ...)`.
 * Tile ID `n > 0` draws cell `n - 1` of `sheet`; IDs beyond the sheet are skipped.
 */
function drawTileRange(
    target: Context2D,
    map: BrioTileMap,
    sheet: BrioSpriteSheet,
    source: TileSource,
    col0: number,
    row0: number,
    col1: number,
    row1: number,
    baseX: number,
    baseY: number,
): void {
    const tiles = map.tileData;
    const columns = map.columns;
    const tw = map.tileWidth;
    const th = map.tileHeight;
    const sheetColumns = sheet.columns;
    const cellCount = sheet.totalCells;
    const cw = sheet.cellWidth;
    const ch = sheet.cellHeight;
    for (let r = row0; r <= row1; r++) {
        const base = r * columns;
        const dy = baseY + r * th;
        for (let c = col0; c <= col1; c++) {
            const id = tiles[base + c];
            if (id === 0 || id > cellCount) continue;
            const cell = id - 1;
            const sx = (cell % sheetColumns) * cw;
            const sy = Math.floor(cell / sheetColumns) * ch;
            target.drawImage(source, sx, sy, cw, ch, baseX + c * tw, dy, tw, th);
        }
    }
}

/**
 * Returns a surface for chunk `index`, creating one or taking the least recently drawn one when the cache is
 * full. Returns `null` (and switches the cache to direct drawing) when surfaces have no 2D context.
 */
function acquireChunkSurface(
    cache: ChunkCache,
    index: number,
    width: number,
    height: number,
): Context2D | null {
    let surface: Surface | null = null;
    let cctx: Context2D | null = null;

    if (cache.live >= MAX_CACHED_CHUNKS_PER_MAP) {
        let victim = -1;
        let oldest = Infinity;
        const surfaces = cache.surfaces;
        for (let i = 0; i < surfaces.length; i++) {
            if (
                surfaces[i] !== null &&
                cache.lastUsed[i] < oldest &&
                cache.lastUsed[i] !== drawStamp
            ) {
                oldest = cache.lastUsed[i];
                victim = i;
            }
        }
        if (victim !== -1) {
            surface = surfaces[victim];
            cctx = cache.contexts[victim];
            surfaces[victim] = null;
            cache.contexts[victim] = null;
            cache.rasterVersions[victim] = 0;
            cache.live--;
            if (surface && (surface.width !== width || surface.height !== height)) {
                surface.width = width;
                surface.height = height;
            }
        }
    }

    if (!surface) {
        surface = createSurface(width, height);
        cctx = surface.getContext("2d") as Context2D | null;
        if (!cctx) {
            cache.direct = true;
            return null;
        }
    }

    cache.surfaces[index] = surface;
    cache.contexts[index] = cctx;
    cache.live++;
    return cctx;
}

/**
 * Draws `BrioTileMap`s in cached chunks onto a 2D context whose transform already maps world pixels to the
 * screen (camera transform applied).
 *
 * Each map is split into chunks of `map.chunkWidth x map.chunkHeight` tiles (16x16 for tiles up to 128 px).
 * A chunk is rasterized at one pixel per world pixel into its own offscreen surface the first time it is
 * visible and again only after `setTile`, `fill`, `restoreTiles` or a tileset change invalidated it; every
 * visible chunk then costs one `drawImage`. Maps without a tileset, hidden maps, maps with `opacity` 0, and
 * maps whose tileset texture has no pixel size yet (not loaded) are skipped, and their chunks stay pending,
 * so they are rasterized as soon as the image is ready. When chunk surfaces have no 2D context (jsdom), the
 * visible tiles are drawn directly onto `ctx`. Allocation happens only when a chunk surface is first created.
 *
 * @param ctx Destination context in world space
 * @param maps Maps to draw, in order
 * @param left Left edge of the visible world rectangle
 * @param top Top edge of the visible world rectangle
 * @param right Right edge of the visible world rectangle
 * @param bottom Bottom edge of the visible world rectangle
 * @param scale World-to-context scale applied around the draw (e.g. `game.scale`, since the camera transform
 * of the compositor works in scaled pixels); the visible rectangle stays in world pixels (defaults to `1`)
 * @returns Number of chunks drawn (chunk images, or chunks drawn tile by tile in direct mode)
 * @example
 * ```ts
 * // inside a camera pass, after the camera transform
 * stats.tileChunksDrawn += drawTileMaps(ctx, layer.tileMaps, camX, camY, camX + viewW, camY + viewH);
 * ```
 * @internal
 */
export function drawTileMaps(
    ctx: Context2D,
    maps: readonly BrioTileMap[],
    left: number,
    top: number,
    right: number,
    bottom: number,
    scale: number = 1,
): number {
    if (maps.length === 0) return 0;
    drawStamp++;
    let drawn = 0;
    const scaled = scale !== 1;
    if (scaled) {
        ctx.save();
        ctx.scale(scale, scale);
    }

    for (let m = 0; m < maps.length; m++) {
        const map = maps[m];
        const sheet = map.tileset;
        if (!sheet || !map.visible || map.opacity <= 0) continue;
        if (map.chunkColumns === 0 || map.chunkRows === 0) continue;
        const texture = sheet.texture;
        if (!(texture.width > 0)) continue;
        const source: TileSource = texture.bitmap ?? texture.element;

        const tw = map.tileWidth;
        const th = map.tileHeight;
        const chunkW = map.chunkWidth;
        const chunkH = map.chunkHeight;
        const chunkPxW = chunkW * tw;
        const chunkPxH = chunkH * th;
        const ox = map.position.x;
        const oy = map.position.y;
        const cx0 = Math.max(0, Math.floor((left - ox) / chunkPxW));
        const cy0 = Math.max(0, Math.floor((top - oy) / chunkPxH));
        const cx1 = Math.min(map.chunkColumns - 1, Math.ceil((right - ox) / chunkPxW) - 1);
        const cy1 = Math.min(map.chunkRows - 1, Math.ceil((bottom - oy) / chunkPxH) - 1);
        if (!(cx0 <= cx1 && cy0 <= cy1)) continue;

        const cache = getChunkCache(map);
        if (!cache.direct) {
            // Stamps every visible chunk first, so evictions only take surfaces of chunks outside the view
            for (let cy = cy0; cy <= cy1; cy++) {
                for (let cx = cx0; cx <= cx1; cx++) {
                    cache.lastUsed[cy * map.chunkColumns + cx] = drawStamp;
                }
            }
        }
        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * map.opacity;

        for (let cy = cy0; cy <= cy1; cy++) {
            const row0 = cy * chunkH;
            const row1 = Math.min(map.rows, row0 + chunkH) - 1;
            for (let cx = cx0; cx <= cx1; cx++) {
                const col0 = cx * chunkW;
                const col1 = Math.min(map.columns, col0 + chunkW) - 1;

                if (cache.direct) {
                    drawTileRange(ctx, map, sheet, source, col0, row0, col1, row1, ox, oy);
                    drawn++;
                    continue;
                }

                const index = cy * map.chunkColumns + cx;
                const version = map.getChunkVersion(index);
                let cctx = cache.contexts[index];
                if (!cctx || cache.rasterVersions[index] !== version) {
                    const width = (col1 - col0 + 1) * tw;
                    const height = (row1 - row0 + 1) * th;
                    if (!cctx) cctx = acquireChunkSurface(cache, index, width, height);
                    if (!cctx) {
                        drawTileRange(ctx, map, sheet, source, col0, row0, col1, row1, ox, oy);
                        drawn++;
                        continue;
                    }
                    cctx.setTransform(1, 0, 0, 1, 0, 0);
                    cctx.clearRect(0, 0, width, height);
                    cctx.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
                    cctx.imageSmoothingQuality = ctx.imageSmoothingQuality;
                    drawTileRange(
                        cctx,
                        map,
                        sheet,
                        source,
                        col0,
                        row0,
                        col1,
                        row1,
                        -col0 * tw,
                        -row0 * th,
                    );
                    cache.rasterVersions[index] = version;
                }

                ctx.drawImage(
                    cache.surfaces[index] as CanvasImageSource,
                    ox + col0 * tw,
                    oy + row0 * th,
                );
                drawn++;
            }
        }

        ctx.globalAlpha = prevAlpha;
    }

    if (scaled) ctx.restore();
    return drawn;
}

/**
 * Number of chunk surfaces currently cached for `map` (for tests and diagnostics).
 *
 * @param map Tile map
 * @returns Cached chunk surface count
 * @example
 * ```ts
 * console.log(cachedChunkCount(level)); // 4
 * ```
 * @internal
 */
export function cachedChunkCount(map: BrioTileMap): number {
    return chunkCaches.get(map)?.live ?? 0;
}
