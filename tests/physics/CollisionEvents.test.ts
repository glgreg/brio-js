import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject2D } from "../../src/objects/BrioObject2D";
import { BrioObject3D } from "../../src/objects/BrioObject3D";
import { BrioCollision } from "../../src/math/BrioCollision";
import { createRecordingContext } from "../helpers/recordingContext";

function box(name: string, x: number, colliderType: "solid" | "trigger" = "solid"): BrioObject2D {
    const object = new BrioObject2D(name, "", 1);
    object.transform.position = { x, y: 0 };
    object.transform.size = { x: 10, y: 10 };
    BrioCollision.addRectangle({
        object,
        colliderType,
        pos: { x: 0, y: 0 },
        size: { x: 10, y: 10 },
    });
    return object;
}

describe("collision events", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("reports enter, stay and exit once per frame on both objects", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        const player = game.addObject(box("obj_player", 0));
        const coin = game.addObject(box("obj_coin", 50, "trigger"));
        const log: string[] = [];
        player.onCollisionEnter((other, self) => log.push(`enter:${self.name}>${other.name}`));
        player.onCollisionStay((other) => log.push(`stay:${other.name}`));
        player.onCollisionExit((other) => log.push(`exit:${other.name}`));
        coin.onCollisionEnter((other) => log.push(`coin-enter:${other.name}`));

        game.step(1 / 60);
        expect(log).toEqual([]);

        player.transform.position.x = 45;
        game.step(1 / 60);
        expect(log).toEqual(["enter:obj_player>obj_coin", "coin-enter:obj_player"]);

        log.length = 0;
        game.step(1 / 60);
        game.step(1 / 60);
        expect(log).toEqual(["stay:obj_coin", "stay:obj_coin"]);

        log.length = 0;
        player.transform.position.x = 0;
        game.step(1 / 60);
        expect(log).toEqual(["exit:obj_coin"]);
    });

    it("lets listeners destroy objects and reports the exit to the survivor", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        const player = game.addObject(box("obj_player", 0));
        const coin = game.addObject(box("obj_coin", 5, "trigger"));
        coin.tag = "coin";
        const exits: string[] = [];
        let collected = 0;
        player.onCollisionEnter((other) => {
            if (other.tag === "coin") {
                collected++;
                game.destroy(other);
            }
        });
        player.onCollisionExit((other) => exits.push(other.name));
        const coinExit = vi.fn();
        coin.onCollisionExit(coinExit);

        game.step(1 / 60);
        expect(collected).toBe(1);
        expect(game.gameObjects.has("obj_coin")).toBe(false);

        game.step(1 / 60);
        expect(exits).toEqual(["obj_coin"]);
        expect(coinExit).not.toHaveBeenCalled();
        expect(collected).toBe(1);
    });

    it("skips disabled colliders and unsubscribes listeners", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        const a = game.addObject(box("obj_a", 0));
        const b = game.addObject(box("obj_b", 5));
        const enter = vi.fn();
        const off = a.onCollisionEnter(enter);

        b.collision!.enabled = false;
        game.step(1 / 60);
        expect(enter).not.toHaveBeenCalled();

        b.collision!.enabled = true;
        off();
        game.step(1 / 60);
        expect(enter).not.toHaveBeenCalled();
    });

    it("clones made by instantiate() inherit the prefab listeners and tag", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        const enemy = box("obj_enemy", 200);
        enemy.tag = "enemy";
        const hits: string[] = [];
        enemy.onCollisionEnter((other, self) => hits.push(`${self.name}>${other.name}`));
        game.addObject(box("obj_player", 0));

        const clone = game.instantiate(enemy);
        expect(clone.tag).toBe("enemy");
        clone.transform.position.x = 5;
        game.step(1 / 60);
        expect(hits).toEqual([`${clone.name}>obj_player`]);
    });

    it("dispatches 3D events in 3D games", () => {
        const game = new BrioGame({ width: 100, height: 100, container, dimension: "3d" });
        const ship = game.addObject(new BrioObject3D("obj_ship"));
        const rock = game.addObject(new BrioObject3D("obj_rock"));
        ship.addCollider3D("sphere", "solid");
        rock.addCollider3D("sphere", "solid");
        rock.transform.position.x = 5;
        const enter = vi.fn();
        ship.onCollisionEnter(enter);

        game.step(1 / 60);
        expect(enter).not.toHaveBeenCalled();
        rock.transform.position.x = 0.5;
        game.step(1 / 60);
        expect(enter).toHaveBeenCalledWith(rock, ship);
    });

    it("only tests pairs whose X extents overlap (sort and sweep)", () => {
        const game = new BrioGame({ width: 100, height: 100, container });
        const objects = Array.from({ length: 40 }, (_, i) =>
            game.addObject(box(`obj_${i}`, i * 100)),
        );
        objects[0].onCollisionEnter(() => {});
        const spy = vi.spyOn(BrioCollision, "isColliding");
        game.step(1 / 60);
        // Every box is 10 px wide and 100 px apart: no X extents overlap, so no narrow-phase test runs
        expect(spy).not.toHaveBeenCalled();
    });
});

describe("game.instantiate() with 3D prefabs", () => {
    beforeEach(() => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("deep-clones the prefab with its parts, each bound to its own ECS slot", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: document.createElement("div"),
            dimension: "3d",
        });
        const prefab = new BrioObject3D("ship", "mesh_hull", "mat_hull");
        prefab.tag = "ship";
        prefab.addChild(new BrioObject3D("ship/wing", "mesh_wing"));
        prefab.transform.position.y = 2;

        const first = game.instantiate(prefab);
        const second = game.instantiate(prefab);
        expect(first.name).toBe("ship-1");
        expect(second.name).toBe("ship-2");
        expect(first).toBeInstanceOf(BrioObject3D);
        expect(first.tag).toBe("ship");
        expect(first.children[0].name).toBe("ship-1/wing");
        expect(first.transform.position.y).toBe(2);
        expect(game.gameObjects3D.get("ship-2")).toBe(second);
        expect(first.entityId).not.toBe(second.entityId);
        expect(first.children[0].entityId).toBeGreaterThanOrEqual(0);
        expect(first.children[0].entityId).not.toBe(second.children[0].entityId);

        first.transform.position.x = 7;
        expect(second.transform.position.x).toBe(0);
    });

    it("throws in a 2d game", () => {
        const game = new BrioGame({
            width: 100,
            height: 100,
            container: document.createElement("div"),
        });
        expect(() => game.instantiate(new BrioObject3D("crate"))).toThrow();
    });
});
