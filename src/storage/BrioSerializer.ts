import {
    COLLIDER_STRIDE,
    DirtyFlag,
    RIGIDBODY_STRIDE,
    StorageLayoutFlag,
    TRANSFORM_2D_STRIDE,
    TRANSFORM_3D_STRIDE,
    VISUAL_STRIDE,
} from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";

/** Magic 32-bit little-endian integer for `"BRIO"` (`0x4F495242`). */
const BRIO_SNAPSHOT_MAGIC = 0x4f495242;

/**
 * Current binary snapshot format version.
 * - `1`: 5-word header, always contains both 2D and 3D transform sections.
 * - `2`: 6-word header whose last word is the `StorageLayoutFlag` bitmask; absent transform sections are omitted.
 * - `3`: 11-word header that also records the stride (floats per entity) of every component section, so a
 *   snapshot stays readable after a later engine version appends fields to a component.
 *
 * Compatibility contract: every release reads all earlier versions. Component fields are only ever appended to a
 * stride, never reordered or removed; when a snapshot was written with a shorter stride, the missing trailing fields
 * of each entity are filled with `0` (and a longer stride is truncated).
 */
const BRIO_SNAPSHOT_VERSION = 3;

/** Layout flags implied by version `1` snapshots (both transform buffers present). */
const LEGACY_LAYOUT_FLAGS = StorageLayoutFlag.TRANSFORM_2D | StorageLayoutFlag.TRANSFORM_3D;

/** Number of `Uint32` words in the version `1` header. */
const HEADER_V1_UINT32_COUNT = 5;

/** Number of `Uint32` words in the version `2` header. */
const HEADER_V2_UINT32_COUNT = 6;

/** Number of `Uint32` words in the current binary snapshot header. */
const HEADER_UINT32_COUNT = 11;

/** Component strides of the current storage, in header order (2D, 3D, collider, rigid body, visual). */
const CURRENT_STRIDES: readonly number[] = [
    TRANSFORM_2D_STRIDE,
    TRANSFORM_3D_STRIDE,
    COLLIDER_STRIDE,
    RIGIDBODY_STRIDE,
    VISUAL_STRIDE,
];

/** Header words of a snapshot version (`0` for unknown versions). */
function headerWordsOf(version: number): number {
    if (version === 1) return HEADER_V1_UINT32_COUNT;
    if (version === 2) return HEADER_V2_UINT32_COUNT;
    if (version === 3) return HEADER_UINT32_COUNT;
    return 0;
}

/**
 * Header facts of a binary snapshot, returned by `BrioSerializer.inspect()` without restoring it.
 */
export interface SnapshotInfo {
    /** Format version the snapshot was written with. */
    version: number;
    /** `StorageLayoutFlag` bitmask of the transform buffers included. */
    layout: number;
    /** High-water mark of entity ids included. */
    highWaterMark: number;
    /** Number of entities alive at capture time. */
    activeCount: number;
    /** Floats (or words) per entity of each section: 2D transform, 3D transform, collider, rigid body, visual. */
    strides: {
        transform2D: number;
        transform3D: number;
        collider: number;
        rigidBody: number;
        visual: number;
    };
    /** Whether this engine version can restore the snapshot (possibly migrating its strides). */
    supported: boolean;
}

/**
 * Copies `count` entities of `strideFrom` values from `source` into `target` laid out with `strideTo`, zero-filling
 * fields the snapshot does not have and dropping the ones the current storage does not have.
 */
function copyStrided(
    target: Float32Array | Uint32Array,
    source: Float32Array | Uint32Array,
    count: number,
    strideFrom: number,
    strideTo: number,
): void {
    if (strideFrom === strideTo) {
        target.set(source.subarray(0, count * strideTo), 0);
        return;
    }
    const common = Math.min(strideFrom, strideTo);
    target.fill(0, 0, count * strideTo);
    for (let e = 0; e < count; e++) {
        target.set(source.subarray(e * strideFrom, e * strideFrom + common), e * strideTo);
    }
}

/**
 * Reads the layout flags stored in a snapshot header (version `1` snapshots imply both 2D and 3D).
 */
function readSnapshotLayout(header: Uint32Array): number {
    return header[1] === 1 ? LEGACY_LAYOUT_FLAGS : header[5];
}

/**
 * Human-readable JSON representation of a binary ECS snapshot for external inspection or export.
 *
 * @example
 * ```ts
 * const jsonStr = BrioSerializer.toJSON(snapshotBytes);
 * ```
 */
export interface SerializedSnapshotJSON {
    /** Snapshot format version. */
    version: number;
    /** `StorageLayoutFlag` bitmask of the transform buffers included (defaults to both 2D and 3D when absent). */
    layout?: number;
    /** High-water mark of entity IDs included in the snapshot. */
    highWaterMark: number;
    /** Number of active entities at capture time. */
    activeCount: number;
    /** Recycled entity IDs in the pool free-list. */
    freeList: number[];
    /** Alive flags for entities `0 .. highWaterMark - 1`. */
    aliveFlags: number[];
    /** Component bitmasks for entities `0 .. highWaterMark - 1`. */
    componentMasks: number[];
    /** Flattened 2D transform floats. */
    transform2D: number[];
    /** Flattened 3D transform floats. */
    transform3D: number[];
    /** Flattened collider floats. */
    collider: number[];
    /** Flattened rigid-body floats. */
    rigidBody: number[];
    /** Flattened visual metadata uint32s. */
    visual: number[];
}

/**
 * High-speed binary state serializer for `ECSWorld` (ADR-0005).
 * Captures and restores complete entity/component memory in sub-millisecond time using
 * direct `TypedArray` memory copies without `JSON.stringify` or object graph traversal.
 * Also provides an optional translation layer (`toJSON` / `fromJSON`) for human-readable exports.
 *
 * @example
 * ```ts
 * const checkpoint: Uint8Array = BrioSerializer.captureSnapshot(world);
 * // Later, restore the exact world state in < 1ms:
 * BrioSerializer.restoreSnapshot(world, checkpoint);
 * ```
 */
export class BrioSerializer {
    /** Format version written by `captureSnapshot()`; `restoreSnapshot()` reads this and every earlier version. */
    public static readonly FORMAT_VERSION: number = BRIO_SNAPSHOT_VERSION;

    /**
     * Reads the header of a snapshot without restoring it: format version, layout, entity counts and component
     * strides. Useful to decide whether a save stored by an older (or newer) game build can be loaded.
     *
     * @param snapshot Binary snapshot
     * @returns Header facts of the snapshot
     * @throws {Error} When the buffer is too small or does not start with the BrioJS magic number
     * @example
     * ```ts
     * const info = BrioSerializer.inspect(savedBytes);
     * if (!info.supported) showWarning("This save was made by a newer version of the game.");
     * ```
     */
    public static inspect(snapshot: Uint8Array): SnapshotInfo {
        if (snapshot.byteLength < HEADER_V1_UINT32_COUNT * 4) {
            throw new Error("Invalid BrioSnapshot: buffer is too small to contain header.");
        }
        const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
        const word = (i: number): number =>
            i * 4 + 4 <= snapshot.byteLength ? view.getUint32(i * 4, true) : 0;
        if (word(0) !== BRIO_SNAPSHOT_MAGIC) {
            throw new Error("Invalid BrioSnapshot: unrecognized magic header.");
        }
        const version = word(1);
        const v3 = version >= 3;
        return {
            version,
            layout: version === 1 ? LEGACY_LAYOUT_FLAGS : word(5),
            highWaterMark: word(2),
            activeCount: word(3),
            strides: {
                transform2D: v3 ? word(6) : TRANSFORM_2D_STRIDE,
                transform3D: v3 ? word(7) : TRANSFORM_3D_STRIDE,
                collider: v3 ? word(8) : COLLIDER_STRIDE,
                rigidBody: v3 ? word(9) : RIGIDBODY_STRIDE,
                visual: v3 ? word(10) : VISUAL_STRIDE,
            },
            supported: headerWordsOf(version) > 0,
        };
    }
    /**
     * Captures a compact binary `Uint8Array` snapshot of all active and pooled slots in `world`.
     * Only the transform buffers allocated by the world's storage layout are written.
     *
     * @param world Source `ECSWorld` to serialize
     * @returns Contiguous `Uint8Array` binary snapshot
     * @example
     * ```ts
     * const snapshot = BrioSerializer.captureSnapshot(world);
     * ```
     */
    public static captureSnapshot(world: ECSWorld): Uint8Array {
        const count = world.highWaterMark;
        const activeCount = world.activeCount;
        const freeList = world.getFreeListSnapshot();
        const storage = world.storage;
        const has2D = storage.has2D;
        const has3D = storage.has3D;

        const headerBytes = HEADER_UINT32_COUNT * 4;
        const freeListBytes = freeList.length * 4;
        const alivePaddedBytes = Math.ceil(count / 4) * 4;
        const masksBytes = count * 4;
        const t2Bytes = has2D ? count * TRANSFORM_2D_STRIDE * 4 : 0;
        const t3Bytes = has3D ? count * TRANSFORM_3D_STRIDE * 4 : 0;
        const colBytes = count * COLLIDER_STRIDE * 4;
        const rbBytes = count * RIGIDBODY_STRIDE * 4;
        const visBytes = count * VISUAL_STRIDE * 4;

        const totalBytes =
            headerBytes +
            freeListBytes +
            alivePaddedBytes +
            masksBytes +
            t2Bytes +
            t3Bytes +
            colBytes +
            rbBytes +
            visBytes;

        const buffer = new ArrayBuffer(totalBytes);
        const header = new Uint32Array(buffer, 0, HEADER_UINT32_COUNT);
        header[0] = BRIO_SNAPSHOT_MAGIC;
        header[1] = BRIO_SNAPSHOT_VERSION;
        header[2] = count;
        header[3] = activeCount;
        header[4] = freeList.length;
        header[5] = storage.layoutFlags;
        for (let i = 0; i < CURRENT_STRIDES.length; i++) header[6 + i] = CURRENT_STRIDES[i];

        let byteOffset = headerBytes;

        if (freeList.length > 0) {
            const freeView = new Uint32Array(buffer, byteOffset, freeList.length);
            freeView.set(freeList);
            byteOffset += freeListBytes;
        }

        if (count > 0) {
            const aliveView = new Uint8Array(buffer, byteOffset, count);
            aliveView.set(storage.aliveFlags.subarray(0, count));
            byteOffset += alivePaddedBytes;

            const masksView = new Uint32Array(buffer, byteOffset, count);
            masksView.set(storage.componentMasks.subarray(0, count));
            byteOffset += masksBytes;

            if (has2D) {
                const t2Len = count * TRANSFORM_2D_STRIDE;
                new Float32Array(buffer, byteOffset, t2Len).set(
                    storage.transform2D.subarray(0, t2Len),
                );
                byteOffset += t2Bytes;
            }

            if (has3D) {
                const t3Len = count * TRANSFORM_3D_STRIDE;
                new Float32Array(buffer, byteOffset, t3Len).set(
                    storage.transform3D.subarray(0, t3Len),
                );
                byteOffset += t3Bytes;
            }

            const colLen = count * COLLIDER_STRIDE;
            new Float32Array(buffer, byteOffset, colLen).set(storage.collider.subarray(0, colLen));
            byteOffset += colBytes;

            const rbLen = count * RIGIDBODY_STRIDE;
            new Float32Array(buffer, byteOffset, rbLen).set(storage.rigidBody.subarray(0, rbLen));
            byteOffset += rbBytes;

            const visLen = count * VISUAL_STRIDE;
            new Uint32Array(buffer, byteOffset, visLen).set(storage.visual.subarray(0, visLen));
        }

        return new Uint8Array(buffer);
    }

    /**
     * Restores a binary `Uint8Array` snapshot directly into `world` in $O(1)$ bulk memory copies.
     * Snapshots of every earlier format version are accepted (see `BrioSerializer.FORMAT_VERSION`); sections written
     * with a different component stride are migrated entity by entity. Version `2`+ snapshots must match the
     * world's storage layout; version `1` snapshots (both dimensions) can be restored into any layout, skipping the
     * sections the world does not allocate.
     * All previously issued entity handles become stale (`ECSWorld.clear()` advances every generation).
     *
     * @param world Target `ECSWorld` to restore into
     * @param snapshot Binary `Uint8Array` previously created by `captureSnapshot` or `fromJSON`
     * Every check (header, capacity, layout, body length, free-list ids) runs before `world` is cleared, so a
     * rejected snapshot leaves `world` untouched.
     *
     * @throws {Error} When the header is invalid, the body is shorter than the header claims, a free-list id is
     * out of range, alive or duplicated, the entity count exceeds `world` capacity, or the layout is incompatible
     * @example
     * ```ts
     * BrioSerializer.restoreSnapshot(world, checkpointBytes);
     * ```
     */
    public static restoreSnapshot(world: ECSWorld, snapshot: Uint8Array): void {
        if (snapshot.byteLength < HEADER_V1_UINT32_COUNT * 4 || snapshot.byteLength % 4 !== 0) {
            throw new Error("Invalid BrioSnapshot: buffer is too small to contain header.");
        }

        const alignedBuffer =
            snapshot.byteOffset % 4 === 0
                ? snapshot.buffer.slice(
                      snapshot.byteOffset,
                      snapshot.byteOffset + snapshot.byteLength,
                  )
                : new Uint8Array(snapshot).buffer;

        const header = new Uint32Array(alignedBuffer, 0, HEADER_V1_UINT32_COUNT);
        if (header[0] !== BRIO_SNAPSHOT_MAGIC) {
            throw new Error("Invalid BrioSnapshot: unrecognized magic header.");
        }
        const version = header[1];
        const headerWords = headerWordsOf(version);
        if (headerWords === 0) {
            throw new Error(
                `Unsupported BrioSnapshot version: ${version} (this engine reads versions 1 to ${BRIO_SNAPSHOT_VERSION}).`,
            );
        }
        if (alignedBuffer.byteLength < headerWords * 4) {
            throw new Error("Invalid BrioSnapshot: buffer is too small to contain header.");
        }
        const fullHeader = new Uint32Array(alignedBuffer, 0, headerWords);
        const snapshotLayout = readSnapshotLayout(fullHeader);
        const snapshotHas2D = (snapshotLayout & StorageLayoutFlag.TRANSFORM_2D) !== 0;
        const snapshotHas3D = (snapshotLayout & StorageLayoutFlag.TRANSFORM_3D) !== 0;
        // Versions 1 and 2 were written with the strides this engine still uses
        const s2D = version >= 3 ? fullHeader[6] : TRANSFORM_2D_STRIDE;
        const s3D = version >= 3 ? fullHeader[7] : TRANSFORM_3D_STRIDE;
        const sCol = version >= 3 ? fullHeader[8] : COLLIDER_STRIDE;
        const sRB = version >= 3 ? fullHeader[9] : RIGIDBODY_STRIDE;
        const sVis = version >= 3 ? fullHeader[10] : VISUAL_STRIDE;
        if (s2D === 0 || s3D === 0 || sCol === 0 || sRB === 0 || sVis === 0) {
            throw new Error("Invalid BrioSnapshot: a component stride is zero.");
        }

        const count = fullHeader[2];
        const activeCount = fullHeader[3];
        const freeListLength = fullHeader[4];
        const storage = world.storage;

        if (count > storage.capacity) {
            throw new Error(
                `BrioSnapshot entity count (${count}) exceeds ECSWorld capacity (${storage.capacity}).`,
            );
        }
        if (version !== 1 && snapshotLayout !== storage.layoutFlags) {
            throw new Error(
                `BrioSnapshot layout (${snapshotLayout}) does not match ECSWorld storage layout (${storage.layoutFlags}).`,
            );
        }

        if (activeCount > count || freeListLength > count) {
            throw new Error(
                `Invalid BrioSnapshot: activeCount (${activeCount}) or free-list length (${freeListLength}) exceeds the high-water mark (${count}).`,
            );
        }

        // Compute every section offset and validate the body length before touching `world`, so a
        // truncated or corrupted snapshot leaves the world exactly as it was.
        const freeListOffset = headerWords * 4;
        const aliveOffset = freeListOffset + freeListLength * 4;
        const masksOffset = aliveOffset + Math.ceil(count / 4) * 4;
        const t2Offset = masksOffset + count * 4;
        const t2Len = snapshotHas2D ? count * s2D : 0;
        const t3Offset = t2Offset + t2Len * 4;
        const t3Len = snapshotHas3D ? count * s3D : 0;
        const colOffset = t3Offset + t3Len * 4;
        const colLen = count * sCol;
        const rbOffset = colOffset + colLen * 4;
        const rbLen = count * sRB;
        const visOffset = rbOffset + rbLen * 4;
        const visLen = count * sVis;
        const requiredBytes = count > 0 ? visOffset + visLen * 4 : aliveOffset;

        if (alignedBuffer.byteLength < requiredBytes) {
            throw new Error(
                `Invalid BrioSnapshot: body is truncated (${alignedBuffer.byteLength} bytes, header requires ${requiredBytes}).`,
            );
        }

        const aliveView = new Uint8Array(alignedBuffer, aliveOffset, count);
        const freeList: number[] = [];
        if (freeListLength > 0) {
            const freeView = new Uint32Array(alignedBuffer, freeListOffset, freeListLength);
            const seen = new Uint8Array(count);
            for (let i = 0; i < freeListLength; i++) {
                const id = freeView[i];
                if (id >= count || aliveView[id] !== 0 || seen[id] !== 0) {
                    throw new Error(
                        `Invalid BrioSnapshot: free-list entry ${id} is out of range, alive or duplicated.`,
                    );
                }
                seen[id] = 1;
                freeList.push(id);
            }
        }

        world.clear();

        if (count > 0) {
            storage.aliveFlags.set(aliveView, 0);
            storage.componentMasks.set(new Uint32Array(alignedBuffer, masksOffset, count), 0);

            if (t2Len > 0 && storage.has2D) {
                copyStrided(
                    storage.transform2D,
                    new Float32Array(alignedBuffer, t2Offset, t2Len),
                    count,
                    s2D,
                    TRANSFORM_2D_STRIDE,
                );
            }
            if (t3Len > 0 && storage.has3D) {
                copyStrided(
                    storage.transform3D,
                    new Float32Array(alignedBuffer, t3Offset, t3Len),
                    count,
                    s3D,
                    TRANSFORM_3D_STRIDE,
                );
            }

            copyStrided(
                storage.collider,
                new Float32Array(alignedBuffer, colOffset, colLen),
                count,
                sCol,
                COLLIDER_STRIDE,
            );
            copyStrided(
                storage.rigidBody,
                new Float32Array(alignedBuffer, rbOffset, rbLen),
                count,
                sRB,
                RIGIDBODY_STRIDE,
            );
            copyStrided(
                storage.visual,
                new Uint32Array(alignedBuffer, visOffset, visLen),
                count,
                sVis,
                VISUAL_STRIDE,
            );

            storage.dirtyFlags.fill(
                DirtyFlag.TRANSFORM | DirtyFlag.COLLIDER | DirtyFlag.RENDER,
                0,
                count,
            );
        }

        world.restoreInternalState(count, activeCount, freeList);
    }

    /**
     * Translates a binary `Uint8Array` snapshot into a formatted JSON string for external export or debugging.
     * `version` reports the format version of the input (a version `1` snapshot reports `1`, with `layout` set to
     * both 2D and 3D); `fromJSON` always re-encodes into the current format.
     *
     * @param snapshot Binary `Uint8Array` snapshot
     * @returns JSON string representation of the snapshot
     * @example
     * ```ts
     * const json = BrioSerializer.toJSON(snapshot);
     * ```
     */
    public static toJSON(snapshot: Uint8Array): string {
        const info = this.inspect(snapshot);
        const layout = info.layout;
        const tempWorld = new ECSWorld(Math.max(1, info.highWaterMark || 1), false, {
            transform2D: (layout & StorageLayoutFlag.TRANSFORM_2D) !== 0,
            transform3D: (layout & StorageLayoutFlag.TRANSFORM_3D) !== 0,
        });
        this.restoreSnapshot(tempWorld, snapshot);

        const count = tempWorld.highWaterMark;
        const storage = tempWorld.storage;

        const payload: SerializedSnapshotJSON = {
            version: info.version,
            layout: storage.layoutFlags,
            highWaterMark: count,
            activeCount: tempWorld.activeCount,
            freeList: tempWorld.getFreeListSnapshot(),
            aliveFlags: Array.from(storage.aliveFlags.subarray(0, count)),
            componentMasks: Array.from(storage.componentMasks.subarray(0, count)),
            transform2D: Array.from(storage.transform2D.subarray(0, count * TRANSFORM_2D_STRIDE)),
            transform3D: Array.from(storage.transform3D.subarray(0, count * TRANSFORM_3D_STRIDE)),
            collider: Array.from(storage.collider.subarray(0, count * COLLIDER_STRIDE)),
            rigidBody: Array.from(storage.rigidBody.subarray(0, count * RIGIDBODY_STRIDE)),
            visual: Array.from(storage.visual.subarray(0, count * VISUAL_STRIDE)),
        };

        return JSON.stringify(payload);
    }

    /**
     * Converts a JSON string produced by `BrioSerializer.toJSON` back into a binary `Uint8Array` snapshot.
     *
     * @param json JSON string representation of a snapshot
     * @returns Binary `Uint8Array` snapshot ready for `restoreSnapshot`
     * @example
     * ```ts
     * const binary = BrioSerializer.fromJSON(jsonString);
     * BrioSerializer.restoreSnapshot(world, binary);
     * ```
     */
    public static fromJSON(json: string): Uint8Array {
        const parsed = JSON.parse(json) as SerializedSnapshotJSON;
        const count = parsed.highWaterMark;
        const layout = parsed.layout ?? LEGACY_LAYOUT_FLAGS;
        const tempWorld = new ECSWorld(Math.max(1, count), false, {
            transform2D: (layout & StorageLayoutFlag.TRANSFORM_2D) !== 0,
            transform3D: (layout & StorageLayoutFlag.TRANSFORM_3D) !== 0,
        });
        const storage = tempWorld.storage;

        if (count > 0) {
            storage.aliveFlags.set(parsed.aliveFlags, 0);
            storage.componentMasks.set(parsed.componentMasks, 0);
            if (storage.has2D) storage.transform2D.set(parsed.transform2D, 0);
            if (storage.has3D) storage.transform3D.set(parsed.transform3D, 0);
            storage.collider.set(parsed.collider, 0);
            storage.rigidBody.set(parsed.rigidBody, 0);
            storage.visual.set(parsed.visual, 0);
        }

        tempWorld.restoreInternalState(count, parsed.activeCount, parsed.freeList);
        return this.captureSnapshot(tempWorld);
    }
}
