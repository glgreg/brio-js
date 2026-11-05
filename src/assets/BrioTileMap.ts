import { BrioCollision } from "../math/BrioCollision";
import { BrioVec2, Vec2 } from "../math/vec2";
import { BrioObject2D } from "../objects/BrioObject2D";
import type { BrioSpriteSheet } from "./BrioSpriteSheet";

/**
 * Rectangular merged collider generated automatically by `BrioTileMap.buildMergedColliders()`.
 */
export interface MergedTileCollider {
    /** World X coordinate of the merged rectangle in pixels. */
    x: number;
    /** World Y coordinate of the merged rectangle in pixels. */
    y: number;
    /** Width of the merged rectangle in pixels. */
    width: number;
    /** Height of the merged rectangle in pixels. */
    height: number;
}

/**
 * Tile grid coordinates (`col`, `row`) returned by `BrioTileMap.worldToTile()`.
 */
export interface TileCoord {
    /** Zero-based column index (may lie outside the map). */
    col: number;
    /** Zero-based row index (may lie outside the map). */
    row: number;
}

/**
 * Flat, row-major tile grid accepted by the `BrioTileMap` constructor in place of a `number[][]` matrix.
 *
 * @example
 * ```ts
 * const map = new BrioTileMap("map_room", 16, 16, { columns: 3, rows: 2, tiles: [1, 1, 1, 1, 0, 1] });
 * ```
 */
export interface FlatTileGrid {
    /** Number of tile columns. */
    columns: number;
    /** Number of tile rows. */
    rows: number;
    /** `columns * rows` tile IDs in row-major order (`0` = empty); missing entries are empty. */
    tiles: ArrayLike<number>;
}

/**
 * Options of `BrioTileMap.fromTiled()`.
 */
export interface TiledImportOptions {
    /** Name of the created map (defaults to the Tiled layer name, or `"tilemap"`). */
    name?: string;
    /** Tile layer to import, by name or by index among the tile layers (defaults to the first tile layer). */
    layer?: string | number;
    /** Spritesheet assigned as `tileset`; tile ID `n` draws its cell `n - 1`. */
    tileset?: BrioSpriteSheet;
    /** Tile IDs treated as solid by `buildMergedColliders()` (every ID `> 0` when omitted). */
    solidTileIds?: number[];
}

/**
 * Limits enforced by `BrioTileMap.fromTiled()` and `BrioTileMap.fromCSV()` against malformed or hostile files,
 * so a corrupt map fails with a clear `Error` instead of exhausting memory.
 */
export const TILE_MAP_LIMITS = {
    /** Maximum number of columns or rows of an imported map. */
    maxDimension: 4096,
    /** Maximum width or height of an imported tile, in pixels. */
    maxTileSize: 4096,
    /** Maximum length of a CSV source string, in characters (128 Mi). */
    maxCSVLength: 128 * 1024 * 1024,
    /** Maximum nesting depth of Tiled group layers. */
    maxGroupDepth: 32,
} as const;

/** Tiles per chunk side used by the chunked renderer (reduced for very large tiles). */
const CHUNK_TILES = 16;
/** Maximum chunk raster size in pixels, which keeps chunk surfaces under common canvas size limits. */
const MAX_CHUNK_PIXELS = 2048;
/** Tiled gid flag bits: horizontal, vertical and diagonal flips plus the hexagonal 120-degree rotation. */
const TILED_FLAG_MASK = 0x0fffffff;

/** Converts any number to a stored tile ID: a non-negative integer (negative, `NaN` and infinite values become `0`). */
function toTileId(value: number): number {
    if (!(value > 0)) return 0;
    return value >= 0xffffffff ? 0xffffffff : Math.floor(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositiveInteger(json: Record<string, unknown>, key: string, max: number): number {
    const value = json[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        throw new Error(`Tiled map: '${key}' must be a positive integer (got ${String(value)}).`);
    }
    if (value > max) {
        throw new Error(`Tiled map: '${key}' is ${value}, above the limit of ${max}.`);
    }
    return value;
}

function readFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Appends every tile layer of `layers` (recursing into group layers) to `out`, in document order. */
function collectTiledTileLayers(
    layers: unknown,
    out: Record<string, unknown>[],
    depth: number,
): void {
    if (!Array.isArray(layers)) {
        throw new Error("Tiled map: 'layers' must be an array.");
    }
    if (depth > TILE_MAP_LIMITS.maxGroupDepth) {
        throw new Error(
            `Tiled map: group layers are nested deeper than ${TILE_MAP_LIMITS.maxGroupDepth} levels.`,
        );
    }
    for (const layer of layers) {
        if (!isRecord(layer)) continue;
        if (layer.type === "tilelayer") {
            out.push(layer);
        } else if (layer.type === "group" && layer.layers !== undefined) {
            collectTiledTileLayers(layer.layers, out, depth + 1);
        }
    }
}

/**
 * Grid-based 2D spatial map (`BrioTileMap`) of reusable tile IDs (`0` = empty, `n > 0` = cell `n - 1` of its
 * `tileset` spritesheet). It merges solid tiles into minimal AABB colliders (`buildMergedColliders`) and is
 * rendered in cached chunks when added to a `BrioLayer` (`layer.addTileMap(map)`). Tiles are stored as a
 * row-major `Uint32Array`; every visual change bumps `version`, which `BrioLayer` uses to know when a
 * `"static"` cache must be redrawn.
 *
 * Maps can be built from a matrix, from a flat grid, from a Tiled JSON export (`fromTiled`) or from CSV
 * (`fromCSV`). Tile flipping and rotation are not supported: the Tiled flag bits are stripped on import.
 *
 * @example
 * ```ts
 * const tiles = new BrioSpriteSheet("sht_tiles", "./tiles.png", 16, 16, 8, 8);
 * const tilemap = new BrioTileMap("map_level_1", 16, 16, [
 *     [1, 1, 1, 1],
 *     [1, 0, 0, 1],
 *     [1, 1, 1, 1],
 * ]);
 * tilemap.tileset = tiles;
 * groundLayer.addTileMap(tilemap);
 * const wallColliders = tilemap.createColliderObjects();
 * ```
 */
export class BrioTileMap {
    readonly #name: string;
    readonly #tileWidth: number;
    readonly #tileHeight: number;
    readonly #tiles: Uint32Array;
    readonly #rows: number;
    readonly #columns: number;
    readonly #solidTileIds: Set<number>;
    readonly #position: BrioVec2;
    readonly #chunkWidth: number;
    readonly #chunkHeight: number;
    readonly #chunkColumns: number;
    readonly #chunkRows: number;
    readonly #chunkVersions: Uint32Array;
    #tileset?: BrioSpriteSheet;
    #visible: boolean = true;
    #opacity: number = 1;
    #version: number = 0;

    /**
     * Creates a new `BrioTileMap` from a 2D matrix (or a flat grid) of tile IDs.
     * Tile IDs are stored as non-negative integers: negative or non-finite values become `0` (empty).
     *
     * @param name Unique tilemap identifier
     * @param tileWidth Width of each tile cell in pixels
     * @param tileHeight Height of each tile cell in pixels
     * @param grid 2D array (`rows x columns`, columns taken from the first row) or `FlatTileGrid` of tile IDs (`0` = empty)
     * @param solidTileIds Optional list of tile IDs treated as solid obstacles (if omitted, all IDs `> 0` are solid)
     * @example
     * ```ts
     * const map = new BrioTileMap("map_room", 32, 32, [[1, 1], [0, 1]], [1]);
     * ```
     */
    constructor(
        name: string,
        tileWidth: number,
        tileHeight: number,
        grid: number[][] | FlatTileGrid,
        solidTileIds?: number[],
    ) {
        this.#name = name;
        this.#tileWidth = Math.max(1, Math.floor(tileWidth));
        this.#tileHeight = Math.max(1, Math.floor(tileHeight));

        if (Array.isArray(grid)) {
            this.#rows = grid.length;
            this.#columns = this.#rows > 0 ? grid[0].length : 0;
            this.#tiles = new Uint32Array(this.#rows * this.#columns);
            for (let r = 0; r < this.#rows; r++) {
                const row = grid[r];
                const base = r * this.#columns;
                for (let c = 0; c < this.#columns; c++) {
                    this.#tiles[base + c] = toTileId(row[c] ?? 0);
                }
            }
        } else {
            this.#columns = Math.max(0, Math.floor(grid.columns) || 0);
            this.#rows = this.#columns > 0 ? Math.max(0, Math.floor(grid.rows) || 0) : 0;
            this.#tiles = new Uint32Array(this.#rows * this.#columns);
            const source = grid.tiles;
            const count = Math.min(source.length, this.#tiles.length);
            for (let i = 0; i < count; i++) {
                this.#tiles[i] = toTileId(source[i]);
            }
        }
        if (this.#rows === 0) this.#columns = 0;

        this.#solidTileIds = new Set(solidTileIds);
        // Created once per map; component writes (`position.x = ...`) bump the version too
        this.#position = new BrioVec2(0, 0, () => {
            this.#version++;
        });

        this.#chunkWidth = Math.max(
            1,
            Math.min(CHUNK_TILES, Math.floor(MAX_CHUNK_PIXELS / this.#tileWidth)),
        );
        this.#chunkHeight = Math.max(
            1,
            Math.min(CHUNK_TILES, Math.floor(MAX_CHUNK_PIXELS / this.#tileHeight)),
        );
        this.#chunkColumns = Math.ceil(this.#columns / this.#chunkWidth);
        this.#chunkRows = Math.ceil(this.#rows / this.#chunkHeight);
        this.#chunkVersions = new Uint32Array(this.#chunkColumns * this.#chunkRows).fill(1);
    }

    /**
     * Creates a `BrioTileMap` from one tile layer of a Tiled JSON map (`.tmj` / `.json`, already parsed).
     *
     * Supported: `orientation: "orthogonal"`, finite maps (`infinite: false`), tile layers whose `data` is a
     * plain number array (`encoding` absent or `"csv"`), including tile layers nested in group layers. Global
     * tile IDs are made relative to the first tileset (`id = gid - (firstgid - 1)`, so its first tile is ID `1`);
     * gids of later tilesets keep counting past it. The flip and rotation flag bits of each gid are stripped,
     * because `BrioTileMap` does not support flipped tiles. The layer `visible`, `opacity`, `offsetx` and
     * `offsety` become `visible`, `opacity` and `position`.
     *
     * @param json Parsed Tiled JSON document
     * @param options Map name, layer selection, tileset and solid tile IDs
     * @returns The imported tile map
     * @throws Error for base64 or compressed layer data, infinite maps, non-orthogonal orientations, a missing
     * layer, malformed structure, or sizes above `TILE_MAP_LIMITS`
     * @example
     * ```ts
     * const json = await (await fetch("./level1.tmj")).json();
     * const ground = BrioTileMap.fromTiled(json, { layer: "ground", tileset: tiles, solidTileIds: [1, 2] });
     * ```
     */
    public static fromTiled(json: unknown, options: TiledImportOptions = {}): BrioTileMap {
        if (!isRecord(json)) {
            throw new Error("Tiled map: the document must be a JSON object.");
        }
        if (json.orientation !== undefined && json.orientation !== "orthogonal") {
            throw new Error(
                `Tiled map: orientation '${String(json.orientation)}' is not supported (only 'orthogonal').`,
            );
        }
        if (json.infinite === true) {
            throw new Error(
                "Tiled map: infinite maps are not supported; disable 'Infinite' in the map properties.",
            );
        }
        const width = readPositiveInteger(json, "width", TILE_MAP_LIMITS.maxDimension);
        const height = readPositiveInteger(json, "height", TILE_MAP_LIMITS.maxDimension);
        const tileWidth = readPositiveInteger(json, "tilewidth", TILE_MAP_LIMITS.maxTileSize);
        const tileHeight = readPositiveInteger(json, "tileheight", TILE_MAP_LIMITS.maxTileSize);

        const tileLayers: Record<string, unknown>[] = [];
        collectTiledTileLayers(json.layers, tileLayers, 0);
        if (tileLayers.length === 0) {
            throw new Error("Tiled map: the map has no tile layer.");
        }

        const selector = options.layer ?? 0;
        let layer: Record<string, unknown> | undefined;
        if (typeof selector === "number") {
            layer = Number.isInteger(selector) ? tileLayers[selector] : undefined;
        } else {
            layer = tileLayers.find((l) => l.name === selector);
        }
        if (!layer) {
            throw new Error(`Tiled map: tile layer '${String(selector)}' not found.`);
        }
        const layerName = typeof layer.name === "string" ? layer.name : "";

        if (layer.chunks !== undefined) {
            throw new Error(
                `Tiled map: layer '${layerName}' uses chunks (infinite maps are not supported).`,
            );
        }
        if (layer.compression !== undefined && layer.compression !== "") {
            throw new Error(
                `Tiled map: layer '${layerName}' uses '${String(layer.compression)}' compression; export with CSV layer format.`,
            );
        }
        if (layer.encoding !== undefined && layer.encoding !== "csv") {
            throw new Error(
                `Tiled map: layer '${layerName}' uses '${String(layer.encoding)}' encoding; export with CSV layer format.`,
            );
        }
        const data = layer.data;
        if (!Array.isArray(data)) {
            throw new Error(
                `Tiled map: layer '${layerName}' has no plain 'data' array; export with CSV layer format.`,
            );
        }
        if (data.length !== width * height) {
            throw new Error(
                `Tiled map: layer '${layerName}' has ${data.length} tiles, expected ${width * height} (${width}x${height}).`,
            );
        }

        let firstGid = 1;
        if (Array.isArray(json.tilesets) && json.tilesets.length > 0) {
            const first = json.tilesets[0];
            if (isRecord(first) && first.firstgid !== undefined) {
                const gid = first.firstgid;
                if (typeof gid !== "number" || !Number.isInteger(gid) || gid < 1) {
                    throw new Error(
                        "Tiled map: 'firstgid' of the first tileset must be a positive integer.",
                    );
                }
                firstGid = gid;
            }
        }
        const offset = firstGid - 1;

        const tiles = new Uint32Array(width * height);
        for (let i = 0; i < data.length; i++) {
            const gid = data[i];
            if (typeof gid !== "number" || !Number.isInteger(gid) || gid < 0 || gid > 0xffffffff) {
                throw new Error(
                    `Tiled map: layer '${layerName}' has an invalid gid at index ${i} (${String(gid)}).`,
                );
            }
            const id = (gid & TILED_FLAG_MASK) - offset;
            tiles[i] = id > 0 ? id : 0;
        }

        const map = new BrioTileMap(
            options.name ?? (layerName || "tilemap"),
            tileWidth,
            tileHeight,
            { columns: width, rows: height, tiles },
            options.solidTileIds,
        );
        map.#position.set(readFiniteNumber(layer.offsetx, 0), readFiniteNumber(layer.offsety, 0));
        map.#visible = layer.visible !== false;
        map.opacity = readFiniteNumber(layer.opacity, 1);
        if (options.tileset) map.tileset = options.tileset;
        return map;
    }

    /**
     * Lists the names of the tile layers of a Tiled JSON map (group layers flattened, document order), which
     * are the names `fromTiled({ layer })` accepts. Unnamed layers are listed as `""`.
     *
     * @param json Parsed Tiled JSON document
     * @returns Tile layer names
     * @throws Error when the document is not an object or has no `layers` array
     * @example
     * ```ts
     * const maps = BrioTileMap.tiledLayerNames(json).map((layer) => BrioTileMap.fromTiled(json, { layer, tileset }));
     * ```
     */
    public static tiledLayerNames(json: unknown): string[] {
        if (!isRecord(json)) {
            throw new Error("Tiled map: the document must be a JSON object.");
        }
        const tileLayers: Record<string, unknown>[] = [];
        collectTiledTileLayers(json.layers, tileLayers, 0);
        return tileLayers.map((l) => (typeof l.name === "string" ? l.name : ""));
    }

    /**
     * Creates a `BrioTileMap` from CSV text: one row per line, tile IDs separated by commas (`0` = empty;
     * negative values such as `-1` are empty too). Blank lines are ignored and every row must have the same
     * number of values.
     *
     * @param name Unique tilemap identifier
     * @param tileWidth Width of each tile cell in pixels
     * @param tileHeight Height of each tile cell in pixels
     * @param csv CSV text
     * @param solidTileIds Optional list of tile IDs treated as solid obstacles
     * @returns The parsed tile map
     * @throws Error for non-numeric values, ragged rows, or sizes above `TILE_MAP_LIMITS`
     * @example
     * ```ts
     * const map = BrioTileMap.fromCSV("map_room", 16, 16, "1,1,1\n1,0,1\n1,1,1");
     * ```
     */
    public static fromCSV(
        name: string,
        tileWidth: number,
        tileHeight: number,
        csv: string,
        solidTileIds?: number[],
    ): BrioTileMap {
        if (typeof csv !== "string") {
            throw new Error("Tile map CSV: the source must be a string.");
        }
        if (csv.length > TILE_MAP_LIMITS.maxCSVLength) {
            throw new Error(
                `Tile map CSV: the source has ${csv.length} characters, above the limit of ${TILE_MAP_LIMITS.maxCSVLength}.`,
            );
        }
        const max = TILE_MAP_LIMITS.maxDimension;
        const values: number[] = [];
        let columns = -1;
        let rows = 0;
        const lines = csv.split(/\r?\n/);
        for (let l = 0; l < lines.length; l++) {
            const line = lines[l].trim();
            if (line === "") continue;
            const cells = line.split(",");
            // A trailing comma (Tiled layer CSV) does not add a column
            const count = cells[cells.length - 1].trim() === "" ? cells.length - 1 : cells.length;
            if (columns === -1) {
                columns = count;
                if (columns > max) {
                    throw new Error(`Tile map CSV: ${columns} columns, above the limit of ${max}.`);
                }
            } else if (count !== columns) {
                throw new Error(
                    `Tile map CSV: line ${l + 1} has ${count} values, expected ${columns}.`,
                );
            }
            if (++rows > max) {
                throw new Error(`Tile map CSV: more than ${max} rows.`);
            }
            for (let c = 0; c < count; c++) {
                const text = cells[c].trim();
                const value = Number(text);
                if (text === "" || !Number.isInteger(value) || value > 0xffffffff) {
                    throw new Error(
                        `Tile map CSV: invalid tile ID '${text}' at line ${l + 1}, column ${c + 1}.`,
                    );
                }
                values.push(value);
            }
        }
        return new BrioTileMap(
            name,
            tileWidth,
            tileHeight,
            { columns: Math.max(0, columns), rows, tiles: values },
            solidTileIds,
        );
    }

    /** Unique identifier of the tilemap. */
    public get name(): string {
        return this.#name;
    }

    /** Width of a single tile in pixels. */
    public get tileWidth(): number {
        return this.#tileWidth;
    }

    /** Height of a single tile in pixels. */
    public get tileHeight(): number {
        return this.#tileHeight;
    }

    /** Number of tile rows. */
    public get rows(): number {
        return this.#rows;
    }

    /** Number of tile columns. */
    public get columns(): number {
        return this.#columns;
    }

    /** Total map width in pixels (`columns * tileWidth`). */
    public get widthInPixels(): number {
        return this.#columns * this.#tileWidth;
    }

    /** Total map height in pixels (`rows * tileHeight`). */
    public get heightInPixels(): number {
        return this.#rows * this.#tileHeight;
    }

    /**
     * Spritesheet the tiles are drawn from: tile ID `n > 0` draws cell `n - 1` (row-major, see
     * `BrioSpriteSheet.getCellRect`), and IDs beyond the sheet's cells are skipped. Without a tileset the map
     * is not drawn. Assigning a different sheet invalidates every cached chunk.
     *
     * @example
     * ```ts
     * map.tileset = new BrioSpriteSheet("sht_tiles", "./tiles.png", 16, 16, 8, 8);
     * await map.tileset.texture.decode();
     * ```
     */
    public get tileset(): BrioSpriteSheet | undefined {
        return this.#tileset;
    }
    public set tileset(value: BrioSpriteSheet | undefined) {
        if (value === this.#tileset) return;
        this.#tileset = value;
        this.#invalidateAllChunks();
    }

    /**
     * World offset of the map's top-left corner in pixels (defaults to `{ x: 0, y: 0 }`). Rendering, colliders
     * and `worldToTile` account for it; changing it bumps `version`.
     *
     * @example
     * ```ts
     * map.position.x = 320;
     * map.position = { x: 0, y: -64 };
     * ```
     */
    public get position(): Vec2 {
        return this.#position;
    }
    public set position(value: Vec2) {
        if (value.x === this.#position.x && value.y === this.#position.y) return;
        this.#position.set(value.x, value.y);
    }

    /**
     * Controls whether the map is drawn (defaults to `true`). Colliders are not affected.
     *
     * @example
     * ```ts
     * secretRoom.visible = false;
     * ```
     */
    public get visible(): boolean {
        return this.#visible;
    }
    public set visible(value: boolean) {
        if (value === this.#visible) return;
        this.#visible = value;
        this.#version++;
    }

    /**
     * Opacity of the drawn map, clamped to `[0, 1]` (defaults to `1`; `NaN` becomes `0`).
     *
     * @example
     * ```ts
     * foreground.opacity = 0.5;
     * ```
     */
    public get opacity(): number {
        return this.#opacity;
    }
    public set opacity(value: number) {
        const clamped = value > 0 ? (value < 1 ? value : 1) : 0;
        if (clamped === this.#opacity) return;
        this.#opacity = clamped;
        this.#version++;
    }

    /**
     * Change counter, bumped whenever a tile, the tileset, `position`, `visible` or `opacity` changes.
     * `BrioLayer` compares it to decide whether a `"static"` layer cache must be redrawn.
     *
     * @example
     * ```ts
     * const before = map.version;
     * map.setTile(0, 0, 2);
     * console.log(map.version > before); // true
     * ```
     */
    public get version(): number {
        return this.#version;
    }

    /**
     * Returns the tile ID at `(col, row)`, or `0` if out of bounds.
     *
     * @param col Zero-based column index
     * @param row Zero-based row index
     * @returns Tile ID
     * @example
     * ```ts
     * const id = map.getTile(3, 2);
     * ```
     */
    public getTile(col: number, row: number): number {
        if (row < 0 || row >= this.#rows || col < 0 || col >= this.#columns) return 0;
        return this.#tiles[Math.floor(row) * this.#columns + Math.floor(col)];
    }

    /**
     * Updates the tile ID at `(col, row)`. Only the chunk holding that tile is re-rasterized on the next draw;
     * out-of-bounds coordinates and unchanged values are ignored.
     *
     * @param col Zero-based column index
     * @param row Zero-based row index
     * @param tileId New tile ID (`0` = empty; negative or non-finite values become `0`)
     * @example
     * ```ts
     * map.setTile(4, 7, 0); // break a block
     * ```
     */
    public setTile(col: number, row: number, tileId: number): void {
        if (row < 0 || row >= this.#rows || col < 0 || col >= this.#columns) return;
        const c = Math.floor(col);
        const r = Math.floor(row);
        const id = toTileId(tileId);
        const index = r * this.#columns + c;
        if (this.#tiles[index] === id) return;
        this.#tiles[index] = id;
        this.#invalidateChunk(
            Math.floor(r / this.#chunkHeight) * this.#chunkColumns +
                Math.floor(c / this.#chunkWidth),
        );
        this.#version++;
    }

    /**
     * Sets every tile of the rectangle `[col, col + cols) x [row, row + rows)` (clipped to the map) to `tileId`,
     * invalidating only the chunks it touches.
     *
     * @param tileId Tile ID to write (`0` clears)
     * @param col First column
     * @param row First row
     * @param cols Number of columns
     * @param rows Number of rows
     * @example
     * ```ts
     * map.fill(1, 0, 9, map.columns, 1); // floor along row 9
     * ```
     */
    public fill(tileId: number, col: number, row: number, cols: number, rows: number): void {
        const c0 = Math.max(0, Math.floor(col));
        const r0 = Math.max(0, Math.floor(row));
        const c1 = Math.min(this.#columns, Math.floor(col + cols));
        const r1 = Math.min(this.#rows, Math.floor(row + rows));
        if (!(c0 < c1 && r0 < r1)) return;
        const id = toTileId(tileId);
        let changed = false;
        for (let r = r0; r < r1; r++) {
            const base = r * this.#columns;
            for (let c = c0; c < c1; c++) {
                if (this.#tiles[base + c] !== id) {
                    this.#tiles[base + c] = id;
                    changed = true;
                }
            }
        }
        if (!changed) return;
        const cw = this.#chunkWidth;
        const ch = this.#chunkHeight;
        for (let cy = Math.floor(r0 / ch); cy <= Math.floor((r1 - 1) / ch); cy++) {
            for (let cx = Math.floor(c0 / cw); cx <= Math.floor((c1 - 1) / cw); cx++) {
                this.#invalidateChunk(cy * this.#chunkColumns + cx);
            }
        }
        this.#version++;
    }

    /**
     * Converts a world position to tile coordinates, accounting for `position`. The result may lie outside the
     * map; `getTile` returns `0` there.
     *
     * @param x World X in pixels
     * @param y World Y in pixels
     * @param out Optional object written in place, so hot paths do not allocate
     * @returns `out` (or a new object) with `col` and `row`
     * @example
     * ```ts
     * const cell = { col: 0, row: 0 };
     * map.worldToTile(player.transform.position.x, player.transform.position.y + 1, cell);
     * ```
     */
    public worldToTile(x: number, y: number, out?: TileCoord): TileCoord {
        const target = out ?? { col: 0, row: 0 };
        target.col = Math.floor((x - this.#position.x) / this.#tileWidth);
        target.row = Math.floor((y - this.#position.y) / this.#tileHeight);
        return target;
    }

    /**
     * Returns the tile ID under a world position (accounting for `position`), or `0` outside the map.
     *
     * @param x World X in pixels
     * @param y World Y in pixels
     * @returns Tile ID
     * @example
     * ```ts
     * const grounded = map.isSolidTile(map.getTileAtWorld(feetX, feetY + 1));
     * ```
     */
    public getTileAtWorld(x: number, y: number): number {
        return this.getTile(
            Math.floor((x - this.#position.x) / this.#tileWidth),
            Math.floor((y - this.#position.y) / this.#tileHeight),
        );
    }

    /**
     * Returns a copy of every tile ID in row-major order (`row * columns + col`), e.g. for a checkpoint.
     *
     * @returns New `Uint32Array` of `columns * rows` tile IDs
     * @example
     * ```ts
     * const saved = map.captureTiles();
     * // ... later
     * map.restoreTiles(saved);
     * ```
     */
    public captureTiles(): Uint32Array {
        return this.#tiles.slice();
    }

    /**
     * Restores tile IDs captured by `captureTiles()` and invalidates every cached chunk.
     *
     * @param data Row-major tile IDs; its length must be `columns * rows`
     * @throws Error when `data` is not a `Uint32Array` of the map's size
     * @example
     * ```ts
     * map.restoreTiles(checkpointTiles);
     * ```
     */
    public restoreTiles(data: Uint32Array): void {
        if (!(data instanceof Uint32Array) || data.length !== this.#tiles.length) {
            throw new Error(
                `BrioTileMap '${this.#name}': restoreTiles expects a Uint32Array of ${this.#tiles.length} tiles (${this.#columns}x${this.#rows}), got ${data instanceof Uint32Array ? data.length : typeof data}.`,
            );
        }
        this.#tiles.set(data);
        this.#invalidateAllChunks();
    }

    /**
     * Checks whether a given `tileId` is configured as a solid collision tile.
     *
     * @param tileId Tile ID to inspect
     * @returns `true` if solid
     * @example
     * ```ts
     * if (map.isSolidTile(map.getTile(col, row))) stop();
     * ```
     */
    public isSolidTile(tileId: number): boolean {
        if (tileId <= 0) return false;
        return this.#solidTileIds.size === 0 ? true : this.#solidTileIds.has(tileId);
    }

    /**
     * Uses a 2D greedy meshing algorithm to merge adjacent solid tiles horizontally and vertically
     * into the minimum number of rectangular `MergedTileCollider` regions, offset by `position`.
     *
     * @returns Array of merged rectangular collider bounds in world pixel coordinates
     * @example
     * ```ts
     * const merged = tilemap.buildMergedColliders();
     * ```
     */
    public buildMergedColliders(): MergedTileCollider[] {
        const columns = this.#columns;
        const visited = new Uint8Array(this.#rows * columns);
        const colliders: MergedTileCollider[] = [];
        const ox = this.#position.x;
        const oy = this.#position.y;
        const solidAt = (c: number, r: number): boolean =>
            visited[r * columns + c] === 0 && this.isSolidTile(this.#tiles[r * columns + c]);

        for (let r = 0; r < this.#rows; r++) {
            for (let c = 0; c < columns; c++) {
                if (!solidAt(c, r)) continue;

                // Expand width along current row
                let spanCols = 1;
                while (c + spanCols < columns && solidAt(c + spanCols, r)) {
                    spanCols++;
                }

                // Expand height downward across subsequent rows while all columns in [c, c + spanCols) are solid
                let spanRows = 1;
                let canExpandRow = true;
                while (r + spanRows < this.#rows && canExpandRow) {
                    for (let k = 0; k < spanCols; k++) {
                        if (!solidAt(c + k, r + spanRows)) {
                            canExpandRow = false;
                            break;
                        }
                    }
                    if (canExpandRow) {
                        spanRows++;
                    }
                }

                // Mark merged rectangle as visited
                for (let dr = 0; dr < spanRows; dr++) {
                    visited.fill(1, (r + dr) * columns + c, (r + dr) * columns + c + spanCols);
                }

                colliders.push({
                    x: ox + c * this.#tileWidth,
                    y: oy + r * this.#tileHeight,
                    width: spanCols * this.#tileWidth,
                    height: spanRows * this.#tileHeight,
                });
            }
        }

        return colliders;
    }

    /**
     * Generates invisible solid `BrioObject2D` collider entities for all merged solid regions in this tilemap.
     *
     * @returns Array of configured `BrioObject2D` instances with `"solid"` rectangular colliders
     * @example
     * ```ts
     * const walls = tilemap.createColliderObjects();
     * ```
     */
    public createColliderObjects(): BrioObject2D[] {
        const regions = this.buildMergedColliders();
        return regions.map((rect, idx) => {
            const obj = new BrioObject2D(`${this.#name}_collider_${idx}`, "", 0);
            obj.transform.position = { x: rect.x, y: rect.y };
            obj.transform.size = { x: rect.width, y: rect.height };
            obj.transform.visibility = false;
            BrioCollision.addRectangle({
                object: obj,
                colliderType: "solid",
                pos: { x: 0, y: 0 },
                size: { x: rect.width, y: rect.height },
            });
            return obj;
        });
    }

    /**
     * Row-major tile IDs read by the chunk renderer without copying. Writing to it bypasses invalidation.
     *
     * @internal
     */
    public get tileData(): Uint32Array {
        return this.#tiles;
    }

    /**
     * Tiles per chunk horizontally (16, fewer for tiles wider than 128 px).
     *
     * @internal
     */
    public get chunkWidth(): number {
        return this.#chunkWidth;
    }

    /**
     * Tiles per chunk vertically (16, fewer for tiles taller than 128 px).
     *
     * @internal
     */
    public get chunkHeight(): number {
        return this.#chunkHeight;
    }

    /**
     * Number of chunk columns (`ceil(columns / chunkWidth)`).
     *
     * @internal
     */
    public get chunkColumns(): number {
        return this.#chunkColumns;
    }

    /**
     * Number of chunk rows (`ceil(rows / chunkHeight)`).
     *
     * @internal
     */
    public get chunkRows(): number {
        return this.#chunkRows;
    }

    /**
     * Change counter of one chunk (never `0`), bumped when one of its tiles or the tileset changes.
     *
     * @param chunkIndex Row-major chunk index (`chunkRow * chunkColumns + chunkCol`)
     * @returns Chunk version
     * @internal
     */
    public getChunkVersion(chunkIndex: number): number {
        return this.#chunkVersions[chunkIndex];
    }

    #invalidateChunk(chunkIndex: number): void {
        const versions = this.#chunkVersions;
        versions[chunkIndex] = (versions[chunkIndex] + 1) >>> 0 || 1;
    }

    #invalidateAllChunks(): void {
        for (let i = 0; i < this.#chunkVersions.length; i++) {
            this.#invalidateChunk(i);
        }
        this.#version++;
    }
}
