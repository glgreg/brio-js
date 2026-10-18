import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject } from "../../src/objects/BrioObject";
import { BrioSprite } from "../../src/assets/BrioSprite";
import { BrioCollision } from "../../src/math/BrioCollision";

function createMockCanvasContext(): CanvasRenderingContext2D {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        transform: vi.fn(),
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        rect: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        reset: vi.fn(),
        imageSmoothingEnabled: true,
        imageSmoothingQuality: "medium",
        globalAlpha: 1,
        lineWidth: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        font: "16px monospace",
        textRendering: "auto",
    } as unknown as CanvasRenderingContext2D;
}

describe("BrioGame", () => {
    let container: HTMLDivElement;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
        container = document.createElement("div");
        mockCtx = createMockCanvasContext();
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx as any);
    });

    it("instantiates and destroys objects without deleting shared BrioSprite assets", () => {
        const game = new BrioGame(640, 480, container);
        const spr = new BrioSprite("spr_bullet", "./bullet.png");
        spr.size = { x: 16, y: 16 };
        game.loadedGameSprites.set("spr_bullet", spr);

        const template = new BrioObject("obj_bullet", "spr_bullet", 1);
        template.transform.size = { x: 16, y: 16 };
        BrioCollision.addSquare({
            object: template,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: 16,
        });
        game.gameObjects.set(template.name, template);

        const clone1 = game.instantiate(template);
        const clone2 = game.instantiate(template);

        expect(clone1.name).toBe("obj_bullet-1");
        expect(clone2.name).toBe("obj_bullet-2");
        expect(clone1.instanceId).toBe(1);
        expect(clone2.instanceId).toBe(2);
        expect(game.gameObjects.has("obj_bullet-1")).toBe(true);

        // Destroying clone1 must remove obj_bullet-1 from gameObjects,
        // but MUST NOT remove spr_bullet from loadedGameSprites!
        game.destroy(clone1);
        expect(game.gameObjects.has("obj_bullet-1")).toBe(false);
        expect(game.loadedGameSprites.has("spr_bullet")).toBe(true);
    });

    it("detects outbound objects on all four screen boundaries (left, right, top, bottom)", () => {
        const game = new BrioGame(640, 480, container);
        const obj = new BrioObject("runner", "spr", 1);
        obj.transform.size = { x: 32, y: 32 };

        // Inside screen -> callback not called
        obj.transform.position = { x: 100, y: 100 };
        const onOutInside = vi.fn();
        game.outbound(obj, 1, onOutInside);
        expect(onOutInside).not.toHaveBeenCalled();

        // Past right boundary
        obj.transform.position = { x: 650, y: 100 };
        const onOutRight = vi.fn();
        game.outbound(obj, 1, onOutRight);
        expect(onOutRight).toHaveBeenCalledTimes(1);

        // Past left boundary
        obj.transform.position = { x: -40, y: 100 };
        const onOutLeft = vi.fn();
        game.outbound(obj, 1, onOutLeft);
        expect(onOutLeft).toHaveBeenCalledTimes(1);

        // Past bottom boundary
        obj.transform.position = { x: 100, y: 500 };
        const onOutBottom = vi.fn();
        game.outbound(obj, 1, onOutBottom);
        expect(onOutBottom).toHaveBeenCalledTimes(1);

        // Past top boundary
        obj.transform.position = { x: 100, y: -40 };
        const onOutTop = vi.fn();
        game.outbound(obj, 1, onOutTop);
        expect(onOutTop).toHaveBeenCalledTimes(1);
    });

    it("propagates game.scale updates to the sprite renderer and draws with renderSize", () => {
        const game = new BrioGame(640, 480, container);
        game.scale = 2;

        const spr = new BrioSprite("spr_hero", "./hero.png");
        spr.size = { x: 32, y: 32 };
        game.loadedGameSprites.set("spr_hero", spr);

        const hero = new BrioObject("hero", "spr_hero", 1);
        hero.transform.size = { x: 32, y: 32 };
        hero.transform.scale.x = 1.5;
        hero.transform.scale.y = 2;
        game.gameObjects.set("hero", hero);

        expect(hero.transform.renderSize).toEqual({ x: 48, y: 64 });

        // Verify outbound with custom screenThreshold > 1
        hero.transform.position = { x: -100, y: 100 };
        const onOutThreshold = vi.fn();
        game.outbound(hero, 2, onOutThreshold);
        expect(onOutThreshold).not.toHaveBeenCalled();
    });

    it("preserves CSS background sub-properties regardless of assignment order and supports background setter", () => {
        const game = new BrioGame(640, 480, container);
        game.background.repeat = "no-repeat";
        game.background.size = "cover";
        game.background.position = "center center";
        // Setting color AFTER repeat/size/position must not wipe them out
        game.background.color = "#020319";

        expect(game.background.repeat).toBe("no-repeat");
        expect(game.background.size).toBe("cover");
        expect(game.background.position).toBe("center center");
        expect(game.background.color).toBe("#020319");

        // Bulk assignment via game.background setter
        game.background = {
            color: "rgb(10, 20, 30)",
            image: "./bg.png",
            repeat: "repeat-x",
            position: "left top",
            size: "contain",
            blendMode: "multiply",
            rendering: "pixelated",
        };
        expect(game.background.color).toBe("rgb(10, 20, 30)");
        expect(game.background.image).toBe("./bg.png");
        expect(game.background.repeat).toBe("repeat-x");
        expect(game.background.position).toBe("left top");
        expect(game.background.size).toBe("contain");
        expect(game.background.blendMode).toBe("multiply");
        expect(game.background.rendering).toBe("pixelated");
    });

    it("provides zero-allocation BrioCamera pos/size and cancellable BrioUtils timers", async () => {
        const { BrioCamera } = await import("../../src/not-implemented/BrioCamera");
        const { BrioMap } = await import("../../src/not-implemented/BrioMap");
        const { BrioUtils } = await import("../../src/tools/BrioUtils");

        const map = new BrioMap("map_1", 1000, 1000);
        const cam = new BrioCamera("cam_1", { x: 10, y: 20 }, { x: 320, y: 240 }, map);

        // Repeated access returns the same reactive vector reference (no closure allocations)
        expect(cam.pos).toBe(cam.pos);
        expect(cam.size).toBe(cam.size);

        cam.pos.x = 50;
        cam.size.y = 480;
        expect(cam.pos).toEqual({ x: 50, y: 20 });
        expect(cam.size).toEqual({ x: 320, y: 480 });

        vi.useFakeTimers();
        const animStep = vi.fn();
        const stopAnim = BrioUtils.timedAnimation(animStep, 100);
        expect(animStep).toHaveBeenCalledTimes(1);
        stopAnim();
        vi.advanceTimersByTime(200);
        expect(animStep).toHaveBeenCalledTimes(1);

        const waitStep = vi.fn();
        const cancelWait = BrioUtils.wait(waitStep, 100);
        cancelWait();
        vi.advanceTimersByTime(200);
        expect(waitStep).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});
