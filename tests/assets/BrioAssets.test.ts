import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrioSprite } from "../../src/assets/BrioSprite";
import { BrioAudio } from "../../src/assets/BrioAudio";

describe("BrioSprite & BrioAudio", () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    });

    it("initializes BrioSprite and clones it with isClone flag", () => {
        const sprite = new BrioSprite("spr_knight", "./knight.png");
        expect(sprite.name).toBe("spr_knight");
        expect(sprite.src).toBe("./knight.png");
        expect(sprite.isClone).toBe(false);
        expect(() => sprite.size).toThrow("Sprite size was not initialized");

        sprite.size = { x: 32, y: 48 };
        expect(sprite.size).toEqual({ x: 32, y: 48 });

        const clone = BrioSprite.clone(sprite);
        expect(clone.name).toBe("spr_knight");
        expect(clone.isClone).toBe(true);
    });

    it("plays BrioAudio in single, loop, many (with delay cleanup), and together modes", async () => {
        vi.useFakeTimers();

        const audio = new BrioAudio("aud_hit", "./hit.wav");
        expect(audio.name).toBe("aud_hit");
        expect(audio.src).toBe("./hit.wav");

        const removeListenerSpy = vi.spyOn(audio.element, "removeEventListener");

        audio.playMany(2, 100);
        // Trigger first ended event
        audio.element.dispatchEvent(new Event("ended"));
        vi.advanceTimersByTime(100);

        expect(removeListenerSpy).toHaveBeenCalledWith("ended", expect.any(Function));

        const aud2 = new BrioAudio("aud_jump", "./jump.wav");
        BrioAudio.playTogether([audio, aud2], { iterationType: "loop" });
        expect(audio.element.loop).toBe(true);
        expect(aud2.element.loop).toBe(true);

        vi.useRealTimers();
    });
});
