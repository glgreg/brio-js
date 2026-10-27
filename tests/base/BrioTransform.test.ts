import { describe, it, expect } from "vitest";
import { BrioTransform2D } from "../../src/objects/BrioTransform2D";
import { create } from "../../src/math/vec2";

describe("BrioTransform2D", () => {
    it("initializes position, size, initialSize, and renderSize properly", () => {
        const transform = new BrioTransform2D(create(10, 20), create(64, 32));

        expect(transform.position.x).toBe(10);
        expect(transform.position.y).toBe(20);
        expect(transform.size.x).toBe(64);
        expect(transform.size.y).toBe(32);
        expect(transform.initialSize.x).toBe(64);
        expect(transform.initialSize.y).toBe(32);
        expect(transform.renderSize.x).toBe(64);
        expect(transform.renderSize.y).toBe(32);
    });

    it("updates renderSize and flip when setting scale as an object or via individual x/y setters", () => {
        const transform = new BrioTransform2D(create(0, 0), create(50, 40));

        transform.scale = { x: 2, y: 3 };
        expect(transform.renderSize.x).toBe(100);
        expect(transform.renderSize.y).toBe(120);
        expect(transform.flip.x).toBe(false);
        expect(transform.flip.y).toBe(false);

        // Mutating individual x and y properties directly
        transform.scale.x = -3;
        transform.scale.y = 0.5;
        expect(transform.flip.x).toBe(true);
        expect(transform.flip.y).toBe(false);
        expect(transform.renderSize.x).toBe(150);
        expect(transform.renderSize.y).toBe(20);
    });

    it("updates renderSize and flip when mutating size.x and size.y individually", () => {
        const transform = new BrioTransform2D(create(0, 0), create(32, 32));
        transform.scale = { x: 2, y: 2 };

        transform.size.x = 64;
        transform.size.y = -16;

        expect(transform.flip.y).toBe(true);
        expect(transform.renderSize.x).toBe(128);
        expect(transform.renderSize.y).toBe(32);
    });

    it("clamps pivot and opacity values between 0 and 1 (both object assignment and individual x/y)", () => {
        const transform = new BrioTransform2D(create(0, 0), create(32, 32));

        transform.pivot = { x: -1, y: 5 };
        expect(transform.pivot.x).toBe(0);
        expect(transform.pivot.y).toBe(1);

        transform.pivot.x = 2;
        transform.pivot.y = -0.5;
        expect(transform.pivot.x).toBe(1);
        expect(transform.pivot.y).toBe(0);

        transform.opacity = 3;
        expect(transform.opacity).toBe(1);
        transform.opacity = -1;
        expect(transform.opacity).toBe(0);
    });

    it("normalizes negative layer values to positive", () => {
        const transform = new BrioTransform2D(create(0, 0), create(32, 32));
        transform.layer = -5;
        expect(transform.layer).toBe(5);
    });
});
