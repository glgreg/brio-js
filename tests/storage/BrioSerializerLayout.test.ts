import { describe, it, expect } from "vitest";
import { ECSWorld } from "../../src/ecs/ECSWorld";
import {
    COLLIDER_STRIDE,
    ComponentMask,
    RIGIDBODY_STRIDE,
    StorageLayoutFlag,
    TRANSFORM_2D_STRIDE,
    TRANSFORM_3D_STRIDE,
    VISUAL_STRIDE,
} from "../../src/ecs/ComponentStorage";
import { BrioSerializer } from "../../src/storage/BrioSerializer";

/** Builds a version 1 snapshot (5-word header, both transform sections) by hand. */
function buildV1Snapshot(x2D: number): Uint8Array {
    const count = 1;
    const bytes =
        5 * 4 +
        4 + // alive (padded)
        4 + // masks
        count * TRANSFORM_2D_STRIDE * 4 +
        count * TRANSFORM_3D_STRIDE * 4 +
        count * COLLIDER_STRIDE * 4 +
        count * RIGIDBODY_STRIDE * 4 +
        count * VISUAL_STRIDE * 4;
    const buffer = new ArrayBuffer(bytes);
    const header = new Uint32Array(buffer, 0, 5);
    header[0] = 0x4f495242;
    header[1] = 1;
    header[2] = count;
    header[3] = 1;
    header[4] = 0;
    let offset = 20;
    new Uint8Array(buffer, offset, 1)[0] = 1;
    offset += 4;
    new Uint32Array(buffer, offset, 1)[0] = ComponentMask.TRANSFORM_2D;
    offset += 4;
    new Float32Array(buffer, offset, TRANSFORM_2D_STRIDE)[0] = x2D;
    return new Uint8Array(buffer);
}

describe("BrioSerializer storage layouts (snapshot v2)", () => {
    it("omits the 3D section for 2D-only worlds and records the layout in the header", () => {
        const world2D = new ECSWorld(16, false, { transform3D: false });
        const worldBoth = new ECSWorld(16);
        for (const world of [world2D, worldBoth]) {
            const id = world.createEntity(ComponentMask.TRANSFORM_2D);
            world.storage.transform2D[world.storage.getTransform2DOffset(id)] = 12;
        }

        const snap2D = BrioSerializer.captureSnapshot(world2D);
        const snapBoth = BrioSerializer.captureSnapshot(worldBoth);
        expect(snapBoth.byteLength - snap2D.byteLength).toBe(TRANSFORM_3D_STRIDE * 4);

        const header = new Uint32Array(snap2D.buffer, 0, 6);
        expect(header[1]).toBe(2);
        expect(header[5]).toBe(StorageLayoutFlag.TRANSFORM_2D);

        const restored = new ECSWorld(16, false, { transform3D: false });
        BrioSerializer.restoreSnapshot(restored, snap2D);
        expect(restored.storage.transform2D[0]).toBe(12);
        expect(restored.activeCount).toBe(1);
    });

    it("refuses to restore a v2 snapshot into a world with a different layout", () => {
        const world2D = new ECSWorld(8, false, { transform3D: false });
        world2D.createEntity();
        const snap = BrioSerializer.captureSnapshot(world2D);
        expect(() => BrioSerializer.restoreSnapshot(new ECSWorld(8), snap)).toThrow(/layout/);
    });

    it("still restores version 1 snapshots, into both full and 2D-only worlds", () => {
        const full = new ECSWorld(8);
        BrioSerializer.restoreSnapshot(full, buildV1Snapshot(33));
        expect(full.storage.transform2D[0]).toBe(33);
        expect(full.isAlive(0)).toBe(true);

        const only2D = new ECSWorld(8, false, { transform3D: false });
        BrioSerializer.restoreSnapshot(only2D, buildV1Snapshot(44));
        expect(only2D.storage.transform2D[0]).toBe(44);
        expect(only2D.storage.componentMasks[0]).toBe(ComponentMask.TRANSFORM_2D);
    });

    it("round-trips the layout through toJSON / fromJSON", () => {
        const world2D = new ECSWorld(8, false, { transform3D: false });
        const id = world2D.createEntity(ComponentMask.TRANSFORM_2D);
        world2D.storage.transform2D[world2D.storage.getTransform2DOffset(id) + 1] = 7;

        const json = BrioSerializer.toJSON(BrioSerializer.captureSnapshot(world2D));
        expect(JSON.parse(json).layout).toBe(StorageLayoutFlag.TRANSFORM_2D);

        const back = BrioSerializer.fromJSON(json);
        const restored = new ECSWorld(8, false, { transform3D: false });
        BrioSerializer.restoreSnapshot(restored, back);
        expect(restored.storage.transform2D[1]).toBe(7);
    });
});
