import {
    COLLIDER_STRIDE,
    DirtyFlag,
    RIGIDBODY_STRIDE,
    TRANSFORM_2D_STRIDE,
    TRANSFORM_3D_STRIDE,
    VISUAL_STRIDE,
} from "../ecs/ComponentStorage";
import { ECSWorld } from "../ecs/ECSWorld";

/** Magic 32-bit little-endian integer for `"BRIO"` (`0x4F495242`). */
const BRIO_SNAPSHOT_MAGIC = 0x4f495242;

/** Current binary snapshot format version. */
const BRIO_SNAPSHOT_VERSION = 1;

/** Number of `Uint32` words in the binary snapshot header. */
const HEADER_UINT32_COUNT = 5;

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

        const headerBytes = HEADER_UINT32_COUNT * 4;
        const freeListBytes = freeList.length * 4;
        const alivePaddedBytes = Math.ceil(count / 4) * 4;
        const masksBytes = count * 4;
        const t2Bytes = count * TRANSFORM_2D_STRIDE * 4;
        const t3Bytes = count * TRANSFORM_3D_STRIDE * 4;
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

            const t2Len = count * TRANSFORM_2D_STRIDE;
            new Float32Array(buffer, byteOffset, t2Len).set(storage.transform2D.subarray(0, t2Len));
            byteOffset += t2Bytes;

            const t3Len = count * TRANSFORM_3D_STRIDE;
            new Float32Array(buffer, byteOffset, t3Len).set(storage.transform3D.subarray(0, t3Len));
            byteOffset += t3Bytes;

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
     *
     * @param world Target `ECSWorld` to restore into
     * @param snapshot Binary `Uint8Array` previously created by `captureSnapshot` or `fromJSON`
     * @throws {Error} When the snapshot header is invalid, corrupted, or exceeds `world` capacity
     * @example
     * ```ts
     * BrioSerializer.restoreSnapshot(world, checkpointBytes);
     * ```
     */
    public static restoreSnapshot(world: ECSWorld, snapshot: Uint8Array): void {
        if (snapshot.byteLength < HEADER_UINT32_COUNT * 4) {
            throw new Error("Invalid BrioSnapshot: buffer is too small to contain header.");
        }

        const alignedBuffer =
            snapshot.byteOffset % 4 === 0
                ? snapshot.buffer.slice(
                      snapshot.byteOffset,
                      snapshot.byteOffset + snapshot.byteLength,
                  )
                : new Uint8Array(snapshot).buffer;

        const header = new Uint32Array(alignedBuffer, 0, HEADER_UINT32_COUNT);
        if (header[0] !== BRIO_SNAPSHOT_MAGIC) {
            throw new Error("Invalid BrioSnapshot: unrecognized magic header.");
        }
        if (header[1] !== BRIO_SNAPSHOT_VERSION) {
            throw new Error(`Unsupported BrioSnapshot version: ${header[1]}.`);
        }

        const count = header[2];
        const activeCount = header[3];
        const freeListLength = header[4];
        const storage = world.storage;

        if (count > storage.capacity) {
            throw new Error(
                `BrioSnapshot entity count (${count}) exceeds ECSWorld capacity (${storage.capacity}).`,
            );
        }

        world.clear();

        let byteOffset = HEADER_UINT32_COUNT * 4;
        const freeList: number[] = [];

        if (freeListLength > 0) {
            const freeView = new Uint32Array(alignedBuffer, byteOffset, freeListLength);
            for (let i = 0; i < freeListLength; i++) {
                freeList.push(freeView[i]);
            }
            byteOffset += freeListLength * 4;
        }

        if (count > 0) {
            const alivePaddedBytes = Math.ceil(count / 4) * 4;
            storage.aliveFlags.set(new Uint8Array(alignedBuffer, byteOffset, count), 0);
            byteOffset += alivePaddedBytes;

            storage.componentMasks.set(new Uint32Array(alignedBuffer, byteOffset, count), 0);
            byteOffset += count * 4;

            const t2Len = count * TRANSFORM_2D_STRIDE;
            storage.transform2D.set(new Float32Array(alignedBuffer, byteOffset, t2Len), 0);
            byteOffset += t2Len * 4;

            const t3Len = count * TRANSFORM_3D_STRIDE;
            storage.transform3D.set(new Float32Array(alignedBuffer, byteOffset, t3Len), 0);
            byteOffset += t3Len * 4;

            const colLen = count * COLLIDER_STRIDE;
            storage.collider.set(new Float32Array(alignedBuffer, byteOffset, colLen), 0);
            byteOffset += colLen * 4;

            const rbLen = count * RIGIDBODY_STRIDE;
            storage.rigidBody.set(new Float32Array(alignedBuffer, byteOffset, rbLen), 0);
            byteOffset += rbLen * 4;

            const visLen = count * VISUAL_STRIDE;
            storage.visual.set(new Uint32Array(alignedBuffer, byteOffset, visLen), 0);

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
     *
     * @param snapshot Binary `Uint8Array` snapshot
     * @returns JSON string representation of the snapshot
     * @example
     * ```ts
     * const json = BrioSerializer.toJSON(snapshot);
     * ```
     */
    public static toJSON(snapshot: Uint8Array): string {
        const tempWorld = new ECSWorld(
            Math.max(1, new Uint32Array(snapshot.buffer, snapshot.byteOffset, 5)[2] || 1),
        );
        this.restoreSnapshot(tempWorld, snapshot);

        const count = tempWorld.highWaterMark;
        const storage = tempWorld.storage;

        const payload: SerializedSnapshotJSON = {
            version: BRIO_SNAPSHOT_VERSION,
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
        const tempWorld = new ECSWorld(Math.max(1, count));
        const storage = tempWorld.storage;

        if (count > 0) {
            storage.aliveFlags.set(parsed.aliveFlags, 0);
            storage.componentMasks.set(parsed.componentMasks, 0);
            storage.transform2D.set(parsed.transform2D, 0);
            storage.transform3D.set(parsed.transform3D, 0);
            storage.collider.set(parsed.collider, 0);
            storage.rigidBody.set(parsed.rigidBody, 0);
            storage.visual.set(parsed.visual, 0);
        }

        tempWorld.restoreInternalState(count, parsed.activeCount, parsed.freeList);
        return this.captureSnapshot(tempWorld);
    }
}
