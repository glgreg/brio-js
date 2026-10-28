import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioAudioMixer } from "../../src/audio/BrioAudioMixer";
import { BrioAudio } from "../../src/assets/BrioAudio";
import { BrioGame } from "../../src/game/BrioGame";
import { FakeAudioContext } from "../helpers/fakeWebAudio";
import { createRecordingContext } from "../helpers/recordingContext";

function ctx(): FakeAudioContext {
    return BrioAudioMixer.context as unknown as FakeAudioContext;
}

/** Lets fire-and-forget mixer promises settle. */
async function flush(): Promise<void> {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("BrioAudioMixer suspend / resume", () => {
    beforeEach(() => {
        BrioAudioMixer.reset();
        FakeAudioContext.instances = [];
        vi.stubGlobal("AudioContext", FakeAudioContext);
    });

    afterEach(() => {
        BrioAudioMixer.reset();
        vi.unstubAllGlobals();
    });

    it("holds the context suspended against auto-unlock gestures until resume()", async () => {
        expect(ctx().state).toBe("suspended");
        await BrioAudioMixer.suspend();
        expect(BrioAudioMixer.isSuspended).toBe(true);

        document.dispatchEvent(new Event("pointerdown"));
        await flush();
        expect(ctx().state).toBe("suspended");

        expect(await BrioAudioMixer.resume()).toBe(true);
        expect(BrioAudioMixer.isSuspended).toBe(false);
        expect(ctx().state).toBe("running");
    });

    it("suspends a running context and resumes it", async () => {
        await BrioAudioMixer.unlock();
        expect(ctx().state).toBe("running");
        await BrioAudioMixer.suspend();
        expect(ctx().state).toBe("suspended");
        await BrioAudioMixer.resume();
        expect(ctx().state).toBe("running");
    });

    it("never creates a context from suspend() or resume()", async () => {
        await BrioAudioMixer.suspend();
        expect(await BrioAudioMixer.resume()).toBe(true);
        expect(FakeAudioContext.instances).toHaveLength(0);
    });

    it("explicit unlock() releases the hold and reset() clears it", async () => {
        await BrioAudioMixer.suspend();
        await BrioAudioMixer.unlock();
        expect(BrioAudioMixer.isSuspended).toBe(false);
        expect(ctx().state).toBe("running");

        await BrioAudioMixer.suspend();
        BrioAudioMixer.reset();
        expect(BrioAudioMixer.isSuspended).toBe(false);
    });

    it("lets auto-unlock gestures resume the context when not held", async () => {
        expect(ctx().state).toBe("suspended");
        document.dispatchEvent(new Event("keydown"));
        await flush();
        expect(ctx().state).toBe("running");
    });
});

describe("BrioGame pause / resume / end and the audio mixer", () => {
    let frames: Array<(t: number) => void>;

    beforeEach(() => {
        BrioAudioMixer.reset();
        FakeAudioContext.instances = [];
        vi.stubGlobal("AudioContext", FakeAudioContext);
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                status: 200,
                arrayBuffer: async () => new ArrayBuffer(100),
            })),
        );
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
            () => createRecordingContext().ctx as any,
        );
        frames = [];
        vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
            frames.push(cb as (t: number) => void);
            return frames.length;
        });
        vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
    });

    afterEach(() => {
        BrioAudioMixer.reset();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    async function runningGame(assets: BrioAudio[] = []): Promise<BrioGame> {
        const game = new BrioGame(320, 240, document.createElement("div"));
        if (assets.length > 0) game.preload(() => assets);
        game.update(() => {});
        await game.ready();
        await BrioAudioMixer.unlock();
        return game;
    }

    it("suspends audio on pause() and resumes it on resume()", async () => {
        const game = await runningGame();
        expect(ctx().state).toBe("running");

        game.pause();
        await flush();
        expect(ctx().state).toBe("suspended");
        expect(BrioAudioMixer.isSuspended).toBe(true);

        game.resume();
        await flush();
        expect(ctx().state).toBe("running");
        expect(BrioAudioMixer.isSuspended).toBe(false);
        game.end();
    });

    it("does not touch the mixer when resume() follows no pause()", async () => {
        const game = new BrioGame(320, 240, document.createElement("div"));
        await BrioAudioMixer.suspend();
        game.resume();
        await flush();
        // The hold belongs to whoever called suspend(): this game never paused
        expect(BrioAudioMixer.isSuspended).toBe(true);
        game.end();
    });

    it("end() stops registered audios and releases the mixer for the next game", async () => {
        const music = new BrioAudio("aud_theme", "./theme.wav", { bus: "bgm" });
        const game = await runningGame([music]);
        music.playLoop();
        const source = ctx().sources[0];
        expect(source.stopped).toBe(false);

        game.pause();
        await flush();
        game.end();
        await flush();
        expect(source.stopped).toBe(true);
        expect(BrioAudioMixer.isSuspended).toBe(false);
        expect(ctx().state).toBe("running");
    });
});
