import { describe, expect, it } from "vitest";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioCollision } from "../../src/math/BrioCollision";
import { BrioRigidBody } from "../../src/physics/BrioRigidBody";
import { SpatialHash2D } from "../../src/physics/SpatialHash2D";
import { SpatialOctree3D } from "../../src/physics/SpatialOctree3D";

describe("Spatial grids dedupe pairs by identity", () => {
    it("SpatialHash2D keeps every pair of same-named objects", () => {
        const grid = new SpatialHash2D(64);
        const objs: BrioObject2D[] = [];
        for (let i = 0; i < 3; i++) {
            const o = new BrioObject2D("obj_dup", "", 1);
            o.transform.position = { x: i * 4, y: 0 };
            o.addCollisionMask("rectangle", "solid", 0, 0, 32, 32);
            objs.push(o);
        }

        const pairs = grid.getPotentialPairs(objs);
        expect(pairs.length).toBe(3);
        expect(pairs).toContainEqual([objs[0], objs[1]]);
        expect(pairs).toContainEqual([objs[0], objs[2]]);
        expect(pairs).toContainEqual([objs[1], objs[2]]);

        // Repeated calls reuse internal storage and give the same result.
        expect(grid.getPotentialPairs(objs).length).toBe(3);
    });

    it("SpatialHash2D emits a pair once even when it spans several cells", () => {
        const grid = new SpatialHash2D(16);
        const a = new BrioObject2D("a", "", 1);
        a.addCollisionMask("rectangle", "solid", 0, 0, 64, 64);
        const b = new BrioObject2D("b", "", 1);
        b.transform.position = { x: 8, y: 8 };
        b.addCollisionMask("rectangle", "solid", 0, 0, 64, 64);
        expect(grid.getPotentialPairs([a, b])).toEqual([[a, b]]);
    });

    it("SpatialOctree3D keeps every pair of same-named objects", () => {
        const grid = new SpatialOctree3D(32);
        const a = new BrioObject3D("obj_dup");
        a.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
        const b = new BrioObject3D("obj_dup");
        b.addCollider3D("box", "solid", { x: 2, y: 2, z: 2 }, { x: 10, y: 10, z: 10 });
        const c = new BrioObject3D("obj_dup");
        c.addCollider3D("sphere", "solid", { x: 4, y: 4, z: 4 }, { x: 6, y: 6, z: 6 });

        const pairs = grid.getPotentialPairs([a, b, c]);
        expect(pairs.length).toBe(3);
    });
});

describe("BrioRigidBody.applyCollisionResponse", () => {
    it("reflects the normal velocity scaled by restitution", () => {
        const body = new BrioRigidBody({ restitution: 0.5 });
        body.velocity.set(30, 100, 0);
        // Floor below the body pushes it up (y-down screen space).
        expect(body.applyCollisionResponse({ x: 0, y: -2 })).toBe(true);
        expect(body.velocity.x).toBeCloseTo(30);
        expect(body.velocity.y).toBeCloseTo(-50);
    });

    it("stops normal motion with restitution 0 and bounces fully with 1", () => {
        const soft = new BrioRigidBody({ restitution: 0 });
        soft.velocity.set(-10, 0, 5);
        soft.applyCollisionResponse({ x: 3, y: 0, z: 0 });
        expect(soft.velocity.x).toBeCloseTo(0);
        expect(soft.velocity.z).toBeCloseTo(5);

        const bouncy = new BrioRigidBody({ restitution: 1 });
        bouncy.velocity.set(0, 0, -8);
        bouncy.applyCollisionResponse({ x: 0, y: 0, z: 0.1 });
        expect(bouncy.velocity.z).toBeCloseTo(8);
    });

    it("ignores separating velocities, zero separation and static bodies", () => {
        const body = new BrioRigidBody({ restitution: 1 });
        body.velocity.set(0, -5, 0);
        expect(body.applyCollisionResponse({ x: 0, y: -1 })).toBe(false);
        expect(body.applyCollisionResponse({ x: 0, y: 0 })).toBe(false);
        expect(body.velocity.y).toBe(-5);

        const wall = new BrioRigidBody({ isStatic: true, restitution: 1 });
        expect(wall.applyCollisionResponse({ x: 1, y: 0 })).toBe(false);
    });

    it("bounces a falling body off a solid floor resolved by BrioCollision", () => {
        const ball = new BrioObject2D("ball", "", 1);
        ball.transform.position = { x: 0, y: 95 };
        ball.addCollisionMask("rectangle", "solid", 0, 0, 10, 10);
        const floor = new BrioObject2D("floor", "", 1);
        floor.transform.position = { x: -50, y: 100 };
        floor.addCollisionMask("rectangle", "solid", 0, 0, 200, 20);

        const body = new BrioRigidBody({ restitution: 0.8 });
        body.velocity.set(0, 200, 0);

        const mtv = BrioCollision.resolveCollision(ball, floor);
        expect(mtv).not.toBeNull();
        body.applyCollisionResponse(mtv!);
        expect(body.velocity.y).toBeCloseTo(-160);
        expect(ball.transform.position.y).toBeCloseTo(90);
    });
});
