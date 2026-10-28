import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioRandom } from "../../src/math/BrioRandom";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioCamera2D } from "../../src/cameras/BrioCamera2D";
import { BrioSpriteRenderer } from "../../src/game/BrioSpriteRenderer";
import { createRecordingContext } from "../helpers/recordingContext";

describe("BrioRandom", () => {
    it("produces the same sequence for the same seed and different ones for different seeds", () => {
        const a = new BrioRandom(42);
        const b = new BrioRandom(42);
        const c = new BrioRandom(43);
        const seqA = Array.from({ length: 8 }, () => a.nextUint32());
        const seqB = Array.from({ length: 8 }, () => b.nextUint32());
        const seqC = Array.from({ length: 8 }, () => c.nextUint32());
        expect(seqA).toEqual(seqB);
        expect(seqA).not.toEqual(seqC);
        expect(new BrioRandom("level-1").next()).toBe(new BrioRandom("level-1").next());
    });

    it("keeps values inside the requested ranges with a roughly uniform distribution", () => {
        const rng = new BrioRandom(7);
        const buckets = new Array(6).fill(0);
        for (let i = 0; i < 60000; i++) {
            const f = rng.next();
            expect(f).toBeGreaterThanOrEqual(0);
            expect(f).toBeLessThan(1);
            buckets[rng.int(1, 6) - 1]++;
        }
        for (const count of buckets) expect(Math.abs(count - 10000)).toBeLessThan(500);
        expect(rng.int(5, 5)).toBe(5);
        const x = rng.float(-2, 3);
        expect(x).toBeGreaterThanOrEqual(-2);
        expect(x).toBeLessThan(3);
        expect([1, -1]).toContain(rng.sign());
        expect(rng.pick([])).toBeUndefined();
        expect(["a", "b"]).toContain(rng.pick(["a", "b"]));
    });

    it("restores captured state and clones independent generators", () => {
        const rng = new BrioRandom(1);
        rng.next();
        const state = rng.state;
        const expected = [rng.next(), rng.next(), rng.next()];
        rng.state = state;
        expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);

        rng.state = state;
        const copy = rng.clone();
        expect(copy.next()).toBe(rng.next());
        expect(() => (rng.state = [1, 2])).toThrow();
        rng.state = [0, 0, 0, 0];
        expect(Number.isFinite(rng.next())).toBe(true);
    });

    it("shuffles deterministically and keeps every element", () => {
        const a = new BrioRandom(9).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
        const b = new BrioRandom(9).shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(a).toEqual(b);
        expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
});

describe("BrioGame fixed timestep", () => {
    let container: HTMLDivElement;
    beforeEach(() => {
        container = document.createElement("div");
        vi.restoreAllMocks();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });

    it("runs fixedUpdate at the fixed rate regardless of frame duration", () => {
        const game = new BrioGame({ width: 100, height: 100, container, fixedTimestep: 0.01, maxDeltaTime: 1 });
        const steps: number[] = [];
        const frames: number[] = [];
        game.fixedUpdate((_u, dt) => steps.push(dt));
        game.update((_u, dt) => frames.push(dt));

        game.step(0.025);
        expect(steps).toHaveLength(2);
        expect(game.interpolationAlpha).toBeCloseTo(0.5);
        game.step(0.005);
        expect(steps).toHaveLength(3);
        expect(game.interpolationAlpha).toBeCloseTo(0);
        expect(steps.every((dt) => dt === 0.01)).toBe(true);
        expect(frames).toEqual([0.025, 0.005]);
    });

    it("defaults to 1/60 when fixedUpdate is registered and caps steps per frame", () => {
        const game = new BrioGame({ width: 100, height: 100, container, maxDeltaTime: 0, maxFixedSteps: 3 });
        let steps = 0;
        game.fixedUpdate(() => steps++);
        expect(game.fixedTimestep).toBeCloseTo(1 / 60);
        game.step(1);
        expect(steps).toBe(3);
        expect(game.interpolationAlpha).toBeLessThan(1);
        game.step(0);
        expect(steps).toBe(3);
    });

    it("renders positions interpolated between the last two fixed steps, then restores them", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container,
            dimension: "hybrid",
            fixedTimestep: 0.1,
            interpolate: true,
            maxDeltaTime: 1,
        });
        const ball = game.addObject(new BrioObject2D("obj_ball", "", 1));
        const cube = game.addObject(new BrioObject3D("obj_cube"));
        game.fixedUpdate(() => {
            ball.transform.position.x += 10;
            cube.transform.position.z -= 1;
        });

        const rendered: number[] = [];
        const renderedZ: number[] = [];
        const renderFrame = vi.spyOn(game, "renderFrame").mockImplementation(() => {
            rendered.push(ball.transform.position.x);
            renderedZ.push(cube.transform.position.z);
        });

        game.step(0.1); // one step: 0 -> 10, alpha 0
        game.step(0.05); // no step, alpha 0.5
        game.step(0.075); // one step: 10 -> 20, alpha 0.25
        expect(renderFrame).toHaveBeenCalledTimes(3);
        expect(rendered).toEqual([0, 5, 12.5]);
        expect(renderedZ[1]).toBeCloseTo(-0.5);
        expect(ball.transform.position.x).toBe(20);
        expect(cube.transform.position.z).toBe(-2);
    });

    it("seeds game.random, wires it to camera shake, and restores it with checkpoints", () => {
        const make = () => new BrioGame({ width: 100, height: 100, container, seed: "replay-7" });
        const g1 = make();
        const g2 = make();
        expect(g1.random.next()).toBe(g2.random.next());

        const cam = new BrioCamera2D("cam");
        g1.addCamera(cam);
        expect(cam.random).toBe(g1.random);

        g1.createCheckPoint();
        const after = [g1.random.next(), g1.random.next()];
        g1.restoreCheckPoint();
        expect([g1.random.next(), g1.random.next()]).toEqual(after);
        expect(BrioSpriteRenderer).toBeDefined();
    });
});
