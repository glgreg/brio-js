import { describe, expect, it } from "vitest";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioRigidBody } from "../../src/physics/BrioRigidBody";
import { SpatialHash2D } from "../../src/physics/SpatialHash2D";
import { SpatialOctree3D } from "../../src/physics/SpatialOctree3D";

describe("Physics (SpatialHash2D, SpatialOctree3D & BrioRigidBody)", () => {
    it("partitions 2D and 3D space for broadphase candidate queries", () => {
        const hash2D = new SpatialHash2D(64);
        const o1 = new BrioObject2D("o1", "", 1);
        o1.addCollisionMask("rectangle", "solid", 0, 0, 32, 32);
        const o2 = new BrioObject2D("o2", "", 1);
        o2.transform.position = { x: 16, y: 16 };
        o2.addCollisionMask("rectangle", "solid", 0, 0, 32, 32);
        const o3 = new BrioObject2D("o3", "", 1);
        o3.transform.position = { x: 500, y: 500 };
        o3.addCollisionMask("rectangle", "solid", 0, 0, 32, 32);

        const pairs2D = hash2D.getPotentialPairs([o1, o2, o3]);
        expect(pairs2D.length).toBe(1);
        expect(pairs2D[0]).toEqual([o1, o2]);

        const octree3D = new SpatialOctree3D(32);
        const b1 = new BrioObject3D("b1");
        b1.addCollider3D("box", "solid", { x: -5, y: -5, z: -5 }, { x: 10, y: 10, z: 10 });
        const b2 = new BrioObject3D("b2");
        b2.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });
        const b3 = new BrioObject3D("b3");
        b3.transform.position = { x: 50, y: 50, z: 50 };
        b3.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, { x: 10, y: 10, z: 10 });

        const pairs3D = octree3D.getPotentialPairs([b1, b2, b3]);
        expect(pairs3D.length).toBe(1);
        expect(pairs3D[0]).toEqual([b1, b2]);
    });

    it("integrates 2D and 3D Semi-Implicit Euler dynamics on BrioRigidBody", () => {
        const obj2D = new BrioObject2D("crate", "", 1);
        const rb2D = new BrioRigidBody({ mass: 2, gravity: { x: 0, y: 100, z: 0 }, friction: 0 });
        rb2D.applyImpulse({ x: 20, y: 0 }); // velocity.x = 20 / 2 = 10
        rb2D.integrate2D(obj2D.transform, 1.0);

        expect(obj2D.transform.position.x).toBeCloseTo(10);
        expect(obj2D.transform.position.y).toBeCloseTo(100);

        const obj3D = new BrioObject3D("ball_3d");
        const rb3D = new BrioRigidBody({ mass: 1, gravity: { x: 0, y: -10, z: 0 }, friction: 0 });
        rb3D.applyForce({ x: 0, y: 20, z: -5 });
        rb3D.integrate3D(obj3D.transform, 0.5);

        expect(obj3D.transform.position.y).toBeCloseTo(2.5);
        expect(obj3D.transform.position.z).toBeCloseTo(-1.25);
    });
});
