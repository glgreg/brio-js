import { describe, it, expect } from "vitest";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioCollision } from "../../src/math/BrioCollision";

describe("BrioCollision", () => {
    it("detects AABB rectangle and square collisions accurately", () => {
        const a = new BrioObject2D("obj_a", "spr_a", 1);
        const b = new BrioObject2D("obj_b", "spr_b", 1);

        a.transform.position = { x: 10, y: 10 };
        b.transform.position = { x: 30, y: 30 };

        BrioCollision.addSquare({
            object: a,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 25,
        });
        BrioCollision.addRectangle({
            object: b,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: { x: 20, y: 20 },
        });

        expect(BrioCollision.isColliding(a, b)).toBe(true);

        b.transform.position = { x: 100, y: 100 };
        expect(BrioCollision.isColliding(a, b)).toBe(false);
    });

    it("detects circle-to-circle collisions accurately", () => {
        const c1 = new BrioObject2D("c1", "spr", 1);
        const c2 = new BrioObject2D("c2", "spr", 1);

        c1.transform.position = { x: 0, y: 0 };
        c2.transform.position = { x: 15, y: 0 };

        BrioCollision.addCircle({
            object: c1,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 20, // diameter 20 -> radius 10
        });
        BrioCollision.addCircle({
            object: c2,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 20, // diameter 20 -> radius 10
        });

        expect(BrioCollision.isColliding(c1, c2)).toBe(true);

        c2.transform.position = { x: 25, y: 0 };
        expect(BrioCollision.isColliding(c1, c2)).toBe(false);
    });

    it("detects circle-to-rectangle collisions symmetrically regardless of parameter order", () => {
        const circle = new BrioObject2D("circle", "spr", 1);
        const rect = new BrioObject2D("rect", "spr", 1);

        circle.transform.position = { x: 50, y: 50 };
        rect.transform.position = { x: 60, y: 50 };

        BrioCollision.addCircle({
            object: circle,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 30, // radius 15
        });
        BrioCollision.addRectangle({
            object: rect,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: { x: 40, y: 40 },
        });

        // Both argument orders must return true when overlapping
        expect(BrioCollision.isColliding(rect, circle)).toBe(true);
        expect(BrioCollision.isColliding(circle, rect)).toBe(true);

        // Move circle far away: both argument orders must return false
        circle.transform.position = { x: 200, y: 200 };
        expect(BrioCollision.isColliding(rect, circle)).toBe(false);
        expect(BrioCollision.isColliding(circle, rect)).toBe(false);

        // Wide platform test: rect is 300x20 at (0, 100), circle is 20x20 at (250, 90)
        rect.transform.position = { x: 0, y: 100 };
        BrioCollision.addRectangle({
            object: rect,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: { x: 300, y: 20 },
        });
        circle.transform.position = { x: 250, y: 90 };
        BrioCollision.addCircle({
            object: circle,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 20,
        });

        expect(BrioCollision.isColliding(rect, circle)).toBe(true);
        expect(BrioCollision.isColliding(circle, rect)).toBe(true);
    });
});
