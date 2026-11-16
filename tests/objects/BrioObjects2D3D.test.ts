import { describe, expect, it } from "vitest";
import { Matrix4, Vector3 } from "../../src/math/index";
import { BrioCollision } from "../../src/math/BrioCollision";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";

describe("BrioObject2D, BrioObject3D, Hierarchies & 2D/3D Collision Resolution", () => {
    it("computes parent-child hierarchy world transforms for 2D and 3D objects", () => {
        const parent2D = new BrioObject2D("parent_2d", "spr_parent", 1);
        parent2D.transform.position = { x: 100, y: 50 };
        parent2D.transform.scale = { x: 2, y: 2 };

        const child2D = new BrioObject2D("child_2d", "spr_child", 2);
        child2D.transform.position = { x: 15, y: 10 };
        parent2D.transform.addChild(child2D.transform);

        expect(child2D.transform.worldPosition).toEqual({ x: 130, y: 70 });
        expect(child2D.transform.worldScale).toEqual({ x: 2, y: 2 });

        const parent3D = new BrioObject3D("parent_3d");
        parent3D.transform.position = { x: 10, y: 20, z: 30 };

        const child3D = new BrioObject3D("child_3d");
        child3D.transform.position = { x: 5, y: -5, z: 10 };
        parent3D.transform.addChild(child3D.transform);

        const worldOrigin = Matrix4.transformPoint(
            Vector3.create(),
            { x: 0, y: 0, z: 0 },
            child3D.transform.worldMatrix,
        );
        expect(worldOrigin.x).toBeCloseTo(15, 5);
        expect(worldOrigin.y).toBeCloseTo(15, 5);
        expect(worldOrigin.z).toBeCloseTo(40, 5);
    });

    it("resolves 2D solid collisions via MTV and detects 3D Box/Sphere collisions", () => {
        const player = new BrioObject2D("player", "", 1);
        player.transform.position = { x: 10, y: 10 };
        player.transform.size = { x: 20, y: 20 };
        player.addCollisionMask("rectangle", "solid", 0, 0, 20, 20);

        const wall = new BrioObject2D("wall", "", 1);
        wall.transform.position = { x: 25, y: 10 };
        wall.transform.size = { x: 20, y: 20 };
        wall.addCollisionMask("rectangle", "solid", 0, 0, 20, 20);

        const mtv = BrioCollision.computeMTV(player, wall);
        expect(mtv).not.toBeNull();
        expect(mtv!.x).toBeCloseTo(-5);

        const resolved = BrioCollision.resolveCollision(player, wall);
        expect(resolved).not.toBeNull();
        expect(player.transform.position.x).toBeCloseTo(5);
        expect(BrioCollision.isColliding(player, wall)).toBe(false);

        // 3D Box vs Sphere collision
        const box3D = new BrioObject3D("box_3d");
        box3D.transform.position = { x: 0, y: 0, z: 0 };
        box3D.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });

        const sphere3D = new BrioObject3D("sphere_3d");
        sphere3D.transform.position = { x: 1.5, y: 0, z: 0 };
        sphere3D.addCollider3D("sphere", "trigger", { x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });

        expect(BrioCollision.isColliding3D(box3D, sphere3D)).toBe(true);
        expect(BrioCollision.isColliding3D(sphere3D, box3D)).toBe(true);

        sphere3D.transform.position = { x: 5, y: 0, z: 0 };
        expect(BrioCollision.isColliding3D(box3D, sphere3D)).toBe(false);
    });
});
