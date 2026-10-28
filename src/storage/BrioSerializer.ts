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
 */
const BRIO_SNAPSHOT_VERSION = 2;

/** Layout flags implied by version `1` snapshots (both transform buffers present). */
const LEGACY_LAYOUT_FLAGS = StorageLayoutFlag.TRANSFORM_2D | StorageLayoutFlag.TRANSFORM_3D;

/** Number of `Uint32` words in the version `1` header. */
const HEADER_V1_UINT32_COUNT = 5;

/** Number of `Uint32` words in the current binary snapshot header. */
const HEADER_UINT32_COUNT = 6;

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
     * Version `2` snapshots must match the world's storage layout; version `1` snapshots (both dimensions)
     * can be restored into any layout, skipping the sections the world does not allocate.
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
        if (snapshot.byteLength < HEADER_V1_UINT32_COUNT * 4) {
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
        if (version !== 1 && version !== BRIO_SNAPSHOT_VERSION) {
            throw new Error(`Unsupported BrioSnapshot version: ${version}.`);
        }

        const headerWords = version === 1 ? HEADER_V1_UINT32_COUNT : HEADER_UINT32_COUNT;
        const fullHeader = new Uint32Array(alignedBuffer, 0, headerWords);
        const snapshotLayout = readSnapshotLayout(fullHeader);
        const snapshotHas2D = (snapshotLayout & StorageLayoutFlag.TRANSFORM_2D) !== 0;
        const snapshotHas3D = (snapshotLayout & StorageLayoutFlag.TRANSFORM_3D) !== 0;

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
        const t2Len = snapshotHas2D ? count * TRANSFORM_2D_STRIDE : 0;
        const t3Offset = t2Offset + t2Len * 4;
        const t3Len = snapshotHas3D ? count * TRANSFORM_3D_STRIDE : 0;
        const colOffset = t3Offset + t3Len * 4;
        const colLen = count * COLLIDER_STRIDE;
        const rbOffset = colOffset + colLen * 4;
        const rbLen = count * RIGIDBODY_STRIDE;
        const visOffset = rbOffset + rbLen * 4;
        const visLen = count * VISUAL_STRIDE;
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
                storage.transform2D.set(new Float32Array(alignedBuffer, t2Offset, t2Len), 0);
            }
            if (t3Len > 0 && storage.has3D) {
                storage.transform3D.set(new Float32Array(alignedBuffer, t3Offset, t3Len), 0);
            }

            storage.collider.set(new Float32Array(alignedBuffer, colOffset, colLen), 0);
            storage.rigidBody.set(new Float32Array(alignedBuffer, rbOffset, rbLen), 0);
            storage.visual.set(new Uint32Array(alignedBuffer, visOffset, visLen), 0);

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
        const header = new Uint32Array(
            snapshot.buffer.slice(
                snapshot.byteOffset,
                snapshot.byteOffset + HEADER_UINT32_COUNT * 4,
            ),
        );
        const layout = readSnapshotLayout(header);
        const tempWorld = new ECSWorld(Math.max(1, header[2] || 1), false, {
            transform2D: (layout & StorageLayoutFlag.TRANSFORM_2D) !== 0,
            transform3D: (layout & StorageLayoutFlag.TRANSFORM_3D) !== 0,
        });
        this.restoreSnapshot(tempWorld, snapshot);

        const count = tempWorld.highWaterMark;
        const storage = tempWorld.storage;

        const payload: SerializedSnapshotJSON = {
            version: header[1],
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
