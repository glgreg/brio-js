import { describe, expect, it } from "vitest";
import { BrioSpriteSheet } from "../../src/assets/BrioSpriteSheet";
import { BrioTileMap, TILE_MAP_LIMITS } from "../../src/assets/BrioTileMap";

interface TiledLayerFixture {
    type?: string;
    name?: string;
    data?: unknown;
    encoding?: string;
    compression?: string;
    layers?: TiledLayerFixture[];
    [key: string]: unknown;
}

function tiledMap(
    layers: TiledLayerFixture[],
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        type: "map",
        orientation: "orthogonal",
        infinite: false,
        width: 2,
        height: 2,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [{ firstgid: 1, source: "tiles.tsj" }],
        layers,
        ...overrides,
    };
}

describe("BrioTileMap grid, helpers and snapshots", () => {
    it("keeps the matrix constructor behavior and accepts a flat grid", () => {
        const map = new BrioTileMap("m", 16, 8, [
            [1, 2, 3],
            [0, -4, 5.7],
        ]);
        expect(map.columns).toBe(3);
        expect(map.rows).toBe(2);
        expect(map.getTile(2, 0)).toBe(3);
        expect(map.getTile(1, 1)).toBe(0); // negative ids are empty
        expect(map.getTile(2, 1)).toBe(5);
        expect(map.getTile(-1, 0)).toBe(0);
        expect(map.getTile(3, 0)).toBe(0);
        expect(map.widthInPixels).toBe(48);
        expect(map.heightInPixels).toBe(16);

        const flat = new BrioTileMap("f", 16, 16, { columns: 2, rows: 2, tiles: [1, 0, 0, 7] });
        expect(flat.getTile(1, 1)).toBe(7);
        expect(flat.captureTiles()).toEqual(new Uint32Array([1, 0, 0, 7]));
    });

    it("bumps version on visual changes only", () => {
        const map = new BrioTileMap("m", 16, 16, [[1, 1]]);
        let v = map.version;
        map.setTile(0, 0, 1);
        expect(map.version).toBe(v); // unchanged value
        map.setTile(5, 5, 2);
        expect(map.version).toBe(v); // out of bounds
        map.setTile(0, 0, 2);
        expect(map.version).toBe(++v);
        map.position.x = 10;
        expect(map.version).toBe(++v);
        map.position = { x: 10, y: 0 };
        expect(map.version).toBe(v); // same position
        map.visible = false;
        expect(map.version).toBe(++v);
        map.opacity = 0.5;
        expect(map.version).toBe(++v);
        map.opacity = 3;
        expect(map.opacity).toBe(1);
        expect(map.version).toBe(++v);
        map.tileset = new BrioSpriteSheet("sht_v", "./tilemap_version.png", 16, 16, 2, 2);
        expect(map.version).toBe(++v);
    });

    it("invalidates only the chunk holding a changed tile", () => {
        const map = new BrioTileMap("m", 16, 16, { columns: 40, rows: 20, tiles: [] });
        expect(map.chunkWidth).toBe(16);
        expect(map.chunkColumns).toBe(3);
        expect(map.chunkRows).toBe(2);
        const before = [0, 1, 2, 3, 4, 5].map((i) => map.getChunkVersion(i));
        map.setTile(20, 17, 3); // chunk (1, 1)
        const after = [0, 1, 2, 3, 4, 5].map((i) => map.getChunkVersion(i));
        expect(after.map((v, i) => v !== before[i])).toEqual([
            false,
            false,
            false,
            false,
            true,
            false,
        ]);
    });

    it("uses fewer tiles per chunk for very large tiles", () => {
        const map = new BrioTileMap("m", 512, 300, { columns: 10, rows: 10, tiles: [] });
        expect(map.chunkWidth).toBe(4);
        expect(map.chunkHeight).toBe(6);
        expect(map.chunkColumns).toBe(3);
        expect(map.chunkRows).toBe(2);
    });

    it("fills a clipped rectangle and invalidates the touched chunks", () => {
        const map = new BrioTileMap("m", 16, 16, { columns: 40, rows: 4, tiles: [] });
        const v = map.version;
        map.fill(2, 14, 1, 100, 2);
        expect(map.getTile(13, 1)).toBe(0);
        expect(map.getTile(14, 1)).toBe(2);
        expect(map.getTile(39, 2)).toBe(2);
        expect(map.getTile(39, 3)).toBe(0);
        expect(map.version).toBe(v + 1);
        expect(map.getChunkVersion(0)).toBe(2);
        expect(map.getChunkVersion(1)).toBe(2);
        expect(map.getChunkVersion(2)).toBe(2);
        map.fill(2, 14, 1, 100, 2);
        expect(map.version).toBe(v + 1); // nothing changed
        map.fill(1, 50, 0, 3, 3);
        expect(map.version).toBe(v + 1); // fully outside
    });

    it("converts world positions to tiles accounting for position", () => {
        const map = new BrioTileMap("m", 16, 8, [
            [1, 2],
            [3, 4],
        ]);
        map.position = { x: 100, y: -8 };
        const out = { col: 0, row: 0 };
        expect(map.worldToTile(117, 0, out)).toBe(out);
        expect(out).toEqual({ col: 1, row: 1 });
        expect(map.worldToTile(99, -9)).toEqual({ col: -1, row: -1 });
        expect(map.getTileAtWorld(117, 0)).toBe(4);
        expect(map.getTileAtWorld(100, -8)).toBe(1);
        expect(map.getTileAtWorld(10, 0)).toBe(0);
    });

    it("offsets merged colliders by position", () => {
        const map = new BrioTileMap("m", 16, 16, [
            [1, 1, 0],
            [1, 1, 1],
        ]);
        map.position = { x: 32, y: 64 };
        const merged = map.buildMergedColliders();
        expect(merged).toEqual([
            { x: 32, y: 64, width: 32, height: 32 },
            { x: 64, y: 80, width: 16, height: 16 },
        ]);
    });

    it("captures and restores tiles", () => {
        const map = new BrioTileMap("m", 16, 16, [
            [1, 2],
            [3, 4],
        ]);
        const saved = map.captureTiles();
        expect(saved).toEqual(new Uint32Array([1, 2, 3, 4]));
        saved[0] = 9;
        expect(map.getTile(0, 0)).toBe(1); // a copy

        map.setTile(1, 1, 0);
        const v = map.version;
        const chunk = map.getChunkVersion(0);
        map.restoreTiles(new Uint32Array([5, 6, 7, 8]));
        expect(map.getTile(1, 1)).toBe(8);
        expect(map.version).toBe(v + 1);
        expect(map.getChunkVersion(0)).not.toBe(chunk);

        expect(() => map.restoreTiles(new Uint32Array(3))).toThrow(Error);
        expect(() => map.restoreTiles([1, 2, 3, 4] as unknown as Uint32Array)).toThrow(
            /Uint32Array/,
        );
        expect(map.getTile(0, 0)).toBe(5);
    });
});

describe("BrioTileMap.fromTiled", () => {
    it("subtracts firstgid - 1 and strips the flip flag bits", () => {
        const flipH = 0x80000000;
        const flipV = 0x40000000;
        const flipD = 0x20000000;
        const json = tiledMap(
            [
                {
                    type: "tilelayer",
                    name: "ground",
                    data: [0, 5, (flipH | 6) >>> 0, (flipV | flipD | 8) >>> 0],
                },
            ],
            { tilesets: [{ firstgid: 5, columns: 4, tilecount: 16 }] },
        );
        const map = BrioTileMap.fromTiled(json);
        expect(map.name).toBe("ground");
        expect(map.tileWidth).toBe(16);
        expect(map.captureTiles()).toEqual(new Uint32Array([0, 1, 2, 4]));
    });

    it("maps gids below firstgid to empty and keeps ids of later tilesets", () => {
        const json = tiledMap([{ type: "tilelayer", name: "a", data: [3, 10, 30, 0] }], {
            tilesets: [{ firstgid: 10 }, { firstgid: 26 }],
        });
        expect(BrioTileMap.fromTiled(json).captureTiles()).toEqual(new Uint32Array([0, 1, 21, 0]));
    });

    it("selects tile layers by name or index, flattening groups", () => {
        const json = tiledMap([
            { type: "objectgroup", name: "spawns", objects: [] },
            { type: "tilelayer", name: "back", data: [1, 1, 1, 1] },
            { type: "imagelayer", name: "sky" },
            {
                type: "group",
                name: "fg",
                layers: [{ type: "tilelayer", name: "walls", data: [2, 0, 0, 2] }],
            },
        ]);
        expect(BrioTileMap.tiledLayerNames(json)).toEqual(["back", "walls"]);
        expect(BrioTileMap.fromTiled(json).name).toBe("back");
        expect(BrioTileMap.fromTiled(json, { layer: 1 }).getTile(1, 1)).toBe(2);
        const walls = BrioTileMap.fromTiled(json, { layer: "walls", name: "map_walls" });
        expect(walls.name).toBe("map_walls");
        expect(walls.getTile(0, 0)).toBe(2);
        expect(() => BrioTileMap.fromTiled(json, { layer: "sky" })).toThrow(/not found/);
        expect(() => BrioTileMap.fromTiled(json, { layer: 2 })).toThrow(/not found/);
    });

    it("applies the tileset, solid ids, layer visibility, opacity and offset", () => {
        const sheet = new BrioSpriteSheet("sht_tiled", "./tilemap_tiled.png", 16, 16, 4, 4);
        const json = tiledMap([
            {
                type: "tilelayer",
                name: "ground",
                data: [1, 2, 0, 1],
                visible: false,
                opacity: 0.25,
                offsetx: 8,
                offsety: -4,
            },
        ]);
        const map = BrioTileMap.fromTiled(json, { tileset: sheet, solidTileIds: [1] });
        expect(map.tileset).toBe(sheet);
        expect(map.visible).toBe(false);
        expect(map.opacity).toBe(0.25);
        expect({ ...map.position }).toEqual({ x: 8, y: -4 });
        expect(map.isSolidTile(1)).toBe(true);
        expect(map.isSolidTile(2)).toBe(false);
    });

    it("accepts explicit csv encoding", () => {
        const json = tiledMap([
            { type: "tilelayer", name: "g", encoding: "csv", data: [1, 0, 0, 1] },
        ]);
        expect(BrioTileMap.fromTiled(json).getTile(1, 1)).toBe(1);
    });

    it("rejects unsupported formats with clear errors", () => {
        const layer = { type: "tilelayer", name: "g", data: [1, 0, 0, 1] };
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([{ type: "tilelayer", name: "g", encoding: "base64", data: "AQAAAA==" }]),
            ),
        ).toThrow(/base64/);
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([
                    {
                        type: "tilelayer",
                        name: "g",
                        encoding: "base64",
                        compression: "zlib",
                        data: "eJ",
                    },
                ]),
            ),
        ).toThrow(/zlib/);
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { infinite: true }))).toThrow(
            /infinite/,
        );
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([{ type: "tilelayer", name: "g", chunks: [] }], { infinite: false }),
            ),
        ).toThrow(/chunks/);
        expect(() =>
            BrioTileMap.fromTiled(tiledMap([layer], { orientation: "isometric" })),
        ).toThrow(/isometric/);
        expect(() => BrioTileMap.fromTiled(null)).toThrow(/object/);
        expect(() => BrioTileMap.fromTiled([])).toThrow(/object/);
        expect(() => BrioTileMap.fromTiled(tiledMap([]))).toThrow(/no tile layer/);
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { layers: "x" }))).toThrow(/layers/);
    });

    it("validates structure and gids", () => {
        const layer = { type: "tilelayer", name: "g", data: [1, 0, 0, 1] };
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { width: 0 }))).toThrow(/width/);
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { height: 1.5 }))).toThrow(/height/);
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { tilewidth: "16" }))).toThrow(
            /tilewidth/,
        );
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { tileheight: -1 }))).toThrow(
            /tileheight/,
        );
        expect(() =>
            BrioTileMap.fromTiled(tiledMap([{ type: "tilelayer", name: "g", data: [1, 0, 0] }])),
        ).toThrow(/expected 4/);
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([{ type: "tilelayer", name: "g", data: [1, 0, -1, 0] }]),
            ),
        ).toThrow(/invalid gid/);
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([{ type: "tilelayer", name: "g", data: [1, 0, "2", 0] }]),
            ),
        ).toThrow(/invalid gid/);
        expect(() =>
            BrioTileMap.fromTiled(tiledMap([layer], { tilesets: [{ firstgid: 0 }] })),
        ).toThrow(/firstgid/);
    });

    it("enforces size limits before allocating", () => {
        const max = TILE_MAP_LIMITS.maxDimension;
        // A hostile header with a tiny data array fails on the limit, not after allocating width * height
        const layer = { type: "tilelayer", name: "g", data: [1] };
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { width: max + 1 }))).toThrow(/limit/);
        expect(() => BrioTileMap.fromTiled(tiledMap([layer], { height: 1e9 }))).toThrow(/limit/);
        expect(() =>
            BrioTileMap.fromTiled(
                tiledMap([layer], { tilewidth: TILE_MAP_LIMITS.maxTileSize + 1 }),
            ),
        ).toThrow(/limit/);

        let nested: TiledLayerFixture = { type: "tilelayer", name: "deep", data: [1, 1, 1, 1] };
        for (let i = 0; i <= TILE_MAP_LIMITS.maxGroupDepth + 1; i++) {
            nested = { type: "group", name: `g${i}`, layers: [nested] };
        }
        expect(() => BrioTileMap.fromTiled(tiledMap([nested]))).toThrow(/nested/);
    });
});

describe("BrioTileMap.fromCSV", () => {
    it("parses rows, trailing commas and negative empties", () => {
        const map = BrioTileMap.fromCSV("csv", 16, 16, "1, 2, 3,\r\n-1,0,4,\n\n", [4]);
        expect(map.columns).toBe(3);
        expect(map.rows).toBe(2);
        expect(map.captureTiles()).toEqual(new Uint32Array([1, 2, 3, 0, 0, 4]));
        expect(map.isSolidTile(4)).toBe(true);
        expect(map.isSolidTile(1)).toBe(false);
    });

    it("rejects ragged rows, invalid values and oversized input", () => {
        expect(() => BrioTileMap.fromCSV("c", 16, 16, "1,2\n3")).toThrow(/line 2/);
        expect(() => BrioTileMap.fromCSV("c", 16, 16, "1,x")).toThrow(/invalid tile ID 'x'/);
        expect(() => BrioTileMap.fromCSV("c", 16, 16, "1,,2")).toThrow(/invalid tile ID/);
        expect(() => BrioTileMap.fromCSV("c", 16, 16, "1.5")).toThrow(/invalid tile ID/);
        const wide = new Array(TILE_MAP_LIMITS.maxDimension + 1).fill("0").join(",");
        expect(() => BrioTileMap.fromCSV("c", 16, 16, wide)).toThrow(/limit/);
    });
});
