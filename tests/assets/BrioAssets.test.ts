import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioSprite } from "../../src/assets/BrioSprite";
import { BrioAudio } from "../../src/assets/BrioAudio";
import { BrioAtlas } from "../../src/assets/BrioAtlas";

describe("BrioSprite, BrioAtlas & BrioAudio", () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    });

    it("initializes BrioSprite, updates src and size, and clones it with isClone and size", () => {
        const sprite = new BrioSprite("spr_knight", "./knight.png");
        expect(sprite.name).toBe("spr_knight");
        expect(sprite.src).toBe("./knight.png");
        expect(sprite.isClone).toBe(false);
        expect(() => sprite.size).toThrow("Sprite size was not initialized");

        sprite.size = { x: 32, y: 48 };
        expect(sprite.size).toEqual({ x: 32, y: 48 });

        // Updating size after initialization should succeed
        sprite.size = { x: 64, y: 64 };
        expect(sprite.size).toEqual({ x: 64, y: 64 });

        // Updating src should also update the underlying HTMLImageElement
        sprite.src = "./knight_upgraded.png";
        expect(sprite.src).toBe("./knight_upgraded.png");
        expect(sprite.element.src).toContain("knight_upgraded.png");

        const clone = BrioSprite.clone(sprite);
        expect(clone.name).toBe("spr_knight");
        expect(clone.isClone).toBe(true);
        expect(clone.size).toEqual({ x: 64, y: 64 });

        // Empty instance must have initialized size { x: 0, y: 0 } so it never throws
        const empty = BrioSprite.getEmptyInstance();
        expect(empty.size).toEqual({ x: 0, y: 0 });
    });

    it("exposes BrioAtlas metadata and getters", () => {
        const atlas = new BrioAtlas("atl_world", 1024, 512, "./world.png");
        expect(atlas.name).toBe("atl_world");
        expect(atlas.width).toBe(1024);
        expect(atlas.height).toBe(512);
        expect(atlas.src).toBe("./world.png");
        expect(atlas.bitmap).toBeUndefined();
        expect(atlas.element).toBeInstanceOf(HTMLImageElement);
    });

    it("plays BrioAudio in single, loop, many (with delay cleanup and edge cases), playManyAtTime, and together modes", async () => {
        vi.useFakeTimers();

        const audio = new BrioAudio("aud_hit", "./hit.wav");
        expect(audio.name).toBe("aud_hit");
        expect(audio.src).toBe("./hit.wav");

        // playMany with <= 0 does nothing, playMany with 1 plays once without adding ended listener
        const addListenerSpy = vi.spyOn(audio.element, "addEventListener");
        audio.playMany(0);
        expect(addListenerSpy).not.toHaveBeenCalled();

        audio.playMany(1);
        expect(addListenerSpy).not.toHaveBeenCalled();

        const removeListenerSpy = vi.spyOn(audio.element, "removeEventListener");

        audio.playMany(2, 100);
        // Trigger first ended event
        audio.element.dispatchEvent(new Event("ended"));
        vi.advanceTimersByTime(100);

        expect(removeListenerSpy).toHaveBeenCalledWith("ended", expect.any(Function));

        // playManyAtTime clones node via play() for simultaneous overlapping playback
        const playSpy = vi.spyOn(audio, "play");
        audio.playManyAtTime(3);
        expect(playSpy).toHaveBeenCalledTimes(3);

        const aud2 = new BrioAudio("aud_jump", "./jump.wav");
        BrioAudio.playTogether([audio, aud2], {
            iterationType: "loop",
            startingTime: [
                { name: "aud_hit", time: 0.5 },
                { name: "aud_jump", time: 1.25 },
            ],
        });
        expect(audio.element.loop).toBe(true);
        expect(aud2.element.loop).toBe(true);
        expect(audio.element.currentTime).toBe(0.5);
        expect(aud2.element.currentTime).toBe(1.25);

        vi.useRealTimers();
    });
});
