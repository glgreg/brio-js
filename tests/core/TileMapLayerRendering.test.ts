import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrioSpriteSheet } from "../../src/assets/BrioSpriteSheet";
import { BrioTileMap } from "../../src/assets/BrioTileMap";
import { BrioLayer } from "../../src/core/BrioLayer";
import {
    cachedChunkCount,
    drawTileMaps,
    MAX_CACHED_CHUNKS_PER_MAP,
} from "../../src/rendering/BrioTileMapRenderer";
import { createRecordingContext, RecordedCall } from "../helpers/recordingContext";

type Recorder = ReturnType<typeof createRecordingContext>;

let sheetCounter = 0;

/** A 4x4-cell sheet of 16 px cells whose image reports a loaded size (jsdom never loads images). */
function readySheet(loaded: boolean = true): BrioSpriteSheet {
    const sheet = new BrioSpriteSheet(
        "sht",
        `./tilemap_render_${sheetCounter++}.png`,
        16,
        16,
        4,
        4,
    );
    Object.defineProperty(sheet.texture.element, "naturalWidth", {
        value: loaded ? 64 : 0,
        configurable: true,
    });
    return sheet;
}

function setLoaded(sheet: BrioSpriteSheet): void {
    Object.defineProperty(sheet.texture.element, "naturalWidth", { value: 64, configurable: true });
}

function draws(calls: RecordedCall[]): RecordedCall[] {
    return calls.filter((c) => c.name === "drawImage");
}

describe("BrioLayer tile maps", () => {
    it("keeps tile maps in insertion order without duplicates", () => {
        const layer = new BrioLayer({ name: "ground", order: 0, policy: "static" });
        const a = new BrioTileMap("a", 16, 16, [[1]]);
        const b = new BrioTileMap("b", 16, 16, [[1]]);
        layer.addTileMap(b);
        layer.addTileMap(a);
        layer.addTileMap(b);
        expect(layer.tileMaps).toEqual([b, a]);
        expect(layer.hasTileMap(a)).toBe(true);
        expect(layer.removeTileMap(b)).toBe(true);
        expect(layer.removeTileMap(b)).toBe(false);
        expect(layer.hasTileMap(b)).toBe(false);
        expect(layer.tileMaps).toEqual([a]);
    });

    it("reports itself dirty when a tile map changed since clearDirty", () => {
        const layer = new BrioLayer({ name: "ground", order: 0, policy: "static" });
        const map = new BrioTileMap("m", 16, 16, [[1, 0]]);
        layer.clearDirty();
        expect(layer.isDirty).toBe(false);

        layer.addTileMap(map);
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();
        expect(layer.isDirty).toBe(false);

        map.setTile(1, 0, 1);
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();
        expect(layer.isDirty).toBe(false);

        map.setTile(1, 0, 1); // same value
        expect(layer.isDirty).toBe(false);
        map.position.y = 4;
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();
        map.opacity = 0.5;
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();
        map.restoreTiles(map.captureTiles());
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();

        layer.removeTileMap(map);
        expect(layer.isDirty).toBe(true);
        layer.clearDirty();
        map.setTile(0, 0, 0); // no longer a member
        expect(layer.isDirty).toBe(false);
    });

    it("stays dirty for dynamic layers", () => {
        const layer = new BrioLayer({ name: "fx", order: 0 });
        layer.addTileMap(new BrioTileMap("m", 16, 16, [[1]]));
        layer.clearDirty();
        expect(layer.isDirty).toBe(true);
    });
});

describe("drawTileMaps", () => {
    let surfaces: Recorder[];
    let main: Recorder;

    beforeEach(() => {
        vi.stubGlobal("OffscreenCanvas", undefined);
        surfaces = [];
        main = createRecordingContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
            const rec = createRecordingContext();
            surfaces.push(rec);
            return rec.ctx as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("maps tile id n to spritesheet cell n - 1 and skips empty or out-of-sheet ids", () => {
        const sheet = readySheet();
        const map = new BrioTileMap("m", 32, 32, [
            [1, 6],
            [0, 17],
        ]);
        map.tileset = sheet;

        expect(drawTileMaps(main.ctx, [map], 0, 0, 640, 480)).toBe(1);
        expect(surfaces).toHaveLength(1);
        const source = sheet.texture.element;
        expect(draws(surfaces[0].calls).map((c) => c.args)).toEqual([
            [source, 0, 0, 16, 16, 0, 0, 32, 32],
            [source, 16, 16, 16, 16, 32, 0, 32, 32],
        ]);
        const chunkDraw = draws(main.calls);
        expect(chunkDraw).toHaveLength(1);
        expect(chunkDraw[0].args[1]).toBe(0);
        expect(chunkDraw[0].args[2]).toBe(0);
    });

    it("prefers the decoded bitmap as the tile source", () => {
        const sheet = readySheet();
        const bitmap = { width: 64, height: 64 } as unknown as ImageBitmap;
        vi.spyOn(sheet.texture, "bitmap", "get").mockReturnValue(bitmap);
        const map = new BrioTileMap("m", 16, 16, [[1]]);
        map.tileset = sheet;
        drawTileMaps(main.ctx, [map], 0, 0, 100, 100);
        expect(draws(surfaces[0].calls)[0].args[0]).toBe(bitmap);
    });

    it("rasterizes each chunk once and re-rasterizes only the chunk a setTile touched", () => {
        const map = new BrioTileMap("m", 16, 16, { columns: 40, rows: 40, tiles: [] });
        map.fill(1, 0, 0, 40, 40);
        map.tileset = readySheet();

        expect(drawTileMaps(main.ctx, [map], 0, 0, 640, 640)).toBe(9);
        expect(surfaces).toHaveLength(9);
        expect(surfaces.map((s) => s.count("clearRect"))).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
        // Edge chunks are smaller (40 = 16 + 16 + 8 tiles)
        expect(draws(surfaces[2].calls)).toHaveLength(8 * 16);

        drawTileMaps(main.ctx, [map], 0, 0, 640, 640);
        expect(surfaces.map((s) => s.count("clearRect"))).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
        expect(draws(main.calls)).toHaveLength(18);

        map.setTile(20, 5, 2); // chunk (1, 0)
        drawTileMaps(main.ctx, [map], 0, 0, 640, 640);
        expect(surfaces).toHaveLength(9);
        expect(surfaces.map((s) => s.count("clearRect"))).toEqual([1, 2, 1, 1, 1, 1, 1, 1, 1]);
    });

    it("re-rasterizes every chunk after restoreTiles or a tileset change", () => {
        const map = new BrioTileMap("m", 16, 16, { columns: 32, rows: 16, tiles: [] });
        map.tileset = readySheet();
        drawTileMaps(main.ctx, [map], 0, 0, 640, 640);
        map.restoreTiles(map.captureTiles());
        drawTileMaps(main.ctx, [map], 0, 0, 640, 640);
        expect(surfaces.map((s) => s.count("clearRect"))).toEqual([2, 2]);
        map.tileset = readySheet();
        drawTileMaps(main.ctx, [map], 0, 0, 640, 640);
        expect(surfaces.map((s) => s.count("clearRect"))).toEqual([3, 3]);
    });

    it("draws only the chunks inside the visible rectangle, accounting for position", () => {
        const map = new BrioTileMap("m", 16, 16, { columns: 64, rows: 64, tiles: [] });
        map.fill(1, 0, 0, 64, 64);
        map.tileset = readySheet();

        // Chunks are 256x256 world px
        expect(drawTileMaps(main.ctx, [map], 0, 0, 100, 100)).toBe(1);
        expect(drawTileMaps(main.ctx, [map], 300, 10, 400, 20)).toBe(1);
        expect(drawTileMaps(main.ctx, [map], 250, 250, 260, 260)).toBe(4);
        expect(drawTileMaps(main.ctx, [map], 256, 0, 512, 256)).toBe(1); // edges are exclusive
        expect(drawTileMaps(main.ctx, [map], -500, -500, -1, -1)).toBe(0);
        expect(drawTileMaps(main.ctx, [map], 2000, 0, 3000, 100)).toBe(0);
        expect(cachedChunkCount(map)).toBe(4);
        const placed = draws(main.calls).map((c) => [c.args[1], c.args[2]]);
        expect(placed).toEqual([
            [0, 0],
            [256, 0],
            [0, 0],
            [256, 0],
            [0, 256],
            [256, 256],
            [256, 0],
        ]);

        main.clear();
        map.position = { x: 1000, y: 0 };
        expect(drawTileMaps(main.ctx, [map], 0, 0, 999, 100)).toBe(0);
        expect(drawTileMaps(main.ctx, [map], 1000, 0, 1100, 100)).toBe(1);
        expect(draws(main.calls)[0].args.slice(1)).toEqual([1000, 0]);
    });

    it("skips hidden maps, maps without a tileset and maps whose image is not loaded yet", () => {
        const sheet = readySheet(false);
        const map = new BrioTileMap("m", 16, 16, [[1]]);
        const hidden = new BrioTileMap("h", 16, 16, [[1]]);
        const transparent = new BrioTileMap("t", 16, 16, [[1]]);
        const untiled = new BrioTileMap("u", 16, 16, [[1]]);
        map.tileset = sheet;
        hidden.tileset = readySheet();
        hidden.visible = false;
        transparent.tileset = readySheet();
        transparent.opacity = 0;

        const all = [map, hidden, transparent, untiled];
        expect(drawTileMaps(main.ctx, all, 0, 0, 100, 100)).toBe(0);
        expect(surfaces).toHaveLength(0);

        setLoaded(sheet);
        expect(drawTileMaps(main.ctx, all, 0, 0, 100, 100)).toBe(1);
        expect(surfaces).toHaveLength(1);
        expect(draws(surfaces[0].calls)).toHaveLength(1);
    });

    it("applies opacity through globalAlpha and restores it", () => {
        const map = new BrioTileMap("m", 16, 16, [[1]]);
        map.tileset = readySheet();
        map.opacity = 0.5;
        const alphas: number[] = [];
        const ctx = main.ctx as unknown as { globalAlpha: number; drawImage: () => void };
        ctx.globalAlpha = 0.8;
        ctx.drawImage = () => {
            alphas.push(ctx.globalAlpha);
        };
        drawTileMaps(main.ctx, [map], 0, 0, 100, 100);
        expect(alphas).toEqual([0.4]);
        expect(ctx.globalAlpha).toBe(0.8);
    });

    it("scales around the draw when a world scale is given", () => {
        const map = new BrioTileMap("m", 16, 16, [[1]]);
        map.tileset = readySheet();
        drawTileMaps(main.ctx, [map], 0, 0, 100, 100, 2);
        expect(main.calls.map((c) => c.name)).toEqual(["save", "scale", "drawImage", "restore"]);
        expect(main.calls[1].args).toEqual([2, 2]);
    });

    it("copies image smoothing from the destination into chunk rasters", () => {
        const map = new BrioTileMap("m", 16, 16, [[1]]);
        map.tileset = readySheet();
        main.ctx.imageSmoothingEnabled = false;
        drawTileMaps(main.ctx, [map], 0, 0, 100, 100);
        expect(surfaces[0].ctx.imageSmoothingEnabled).toBe(false);
    });

    it("draws visible tiles directly when chunk surfaces have no 2D context", () => {
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
        const map = new BrioTileMap("m", 16, 16, { columns: 20, rows: 1, tiles: [] });
        map.fill(1, 0, 0, 20, 1);
        map.position.x = 8;
        map.tileset = readySheet();

        expect(drawTileMaps(main.ctx, [map], 0, 0, 100, 16)).toBe(1);
        const tiles = draws(main.calls);
        expect(tiles).toHaveLength(16); // the whole first chunk
        expect(tiles[1].args.slice(5)).toEqual([24, 0, 16, 16]);

        main.clear();
        expect(drawTileMaps(main.ctx, [map], 0, 0, 400, 16)).toBe(2);
        expect(draws(main.calls)).toHaveLength(20);
        expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledTimes(1);
    });

    it("bounds the chunk cache by reusing the least recently drawn surfaces", () => {
        const columns = 17 * 16;
        const map = new BrioTileMap("m", 16, 16, { columns, rows: 256, tiles: [] });
        map.tileset = readySheet();
        expect(map.chunkColumns * map.chunkRows).toBe(272);

        // First 16 chunk columns: 256 chunks
        expect(drawTileMaps(main.ctx, [map], 0, 0, 16 * 256, 16 * 256)).toBe(256);
        expect(cachedChunkCount(map)).toBe(MAX_CACHED_CHUNKS_PER_MAP);
        // Last chunk column: 16 new chunks take the surfaces of the oldest ones
        expect(drawTileMaps(main.ctx, [map], 16 * 256, 0, 17 * 256, 16 * 256)).toBe(16);
        expect(cachedChunkCount(map)).toBe(MAX_CACHED_CHUNKS_PER_MAP);
        expect(surfaces).toHaveLength(MAX_CACHED_CHUNKS_PER_MAP);

        // Everything visible at once: chunks drawn in this call are never evicted, so the cache grows
        expect(drawTileMaps(main.ctx, [map], 0, 0, 17 * 256, 16 * 256)).toBe(272);
        expect(cachedChunkCount(map)).toBe(272);
    });
});
