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
});
