import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrioAudio } from "../../src/assets/BrioAudio";
import { BrioAudioMixer } from "../../src/audio/BrioAudioMixer";
import { FakeAudioContext, FakeBufferSource } from "../helpers/fakeWebAudio";

function ctx(): FakeAudioContext {
    return BrioAudioMixer.context as unknown as FakeAudioContext;
}

async function loadedAudio(name: string, options = {}): Promise<BrioAudio> {
    const audio = new BrioAudio(name, `./${name}.wav`, options);
    await audio.load();
    return audio;
}

describe("BrioAudio over the Web Audio API", () => {
    beforeEach(() => {
        BrioAudioMixer.reset();
        FakeAudioContext.instances = [];
        vi.stubGlobal("AudioContext", FakeAudioContext);
        // 100 bytes -> 10 s buffer in the fake decoder
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(100) })),
        );
    });

    afterEach(() => {
        BrioAudioMixer.reset();
        vi.unstubAllGlobals();
    });

    it("builds master <- bgm/sfx buses and routes voices through the audio gain and its bus", async () => {
        const sfx = await loadedAudio("aud_hit");
        const music = await loadedAudio("aud_theme", { bus: "bgm", volume: 0.5 });
        expect(sfx.usesWebAudio).toBe(true);
        expect(sfx.duration).toBe(10);

        const master = BrioAudioMixer.busInput("master")!;
        const bgm = BrioAudioMixer.busInput("bgm")!;
        expect((master as any).connections).toContain(ctx().destination);
        expect((bgm as any).connections).toContain(master);

        music.playLoop();
        const source = ctx().sources[0];
        expect(source.loop).toBe(true);
        const audioGain = source.connections[0] as any;
        expect(audioGain.gain.value).toBe(0.5);
        expect(audioGain.connections).toContain(bgm);
        expect(music.isPaused).toBe(false);
        expect(sfx.isPaused).toBe(true);
    });

    it("applies bus volumes and mutes to the gain nodes", async () => {
        BrioAudioMixer.setVolume("sfx", 0.25);
        const sfxGain = BrioAudioMixer.busInput("sfx")!;
        expect(sfxGain.gain.value).toBe(0.25);
        BrioAudioMixer.mute("sfx");
        expect(sfxGain.gain.value).toBe(0);
        expect(BrioAudioMixer.effectiveVolume("sfx")).toBe(0);
        BrioAudioMixer.mute("sfx", false);
        BrioAudioMixer.setVolume("master", 0.5);
        expect(BrioAudioMixer.effectiveVolume("sfx")).toBe(0.125);
        BrioAudioMixer.setVolume("bgm", 7);
        expect(BrioAudioMixer.getVolume("bgm")).toBe(1);
    });

    it("overlaps play() voices up to maxVoices, stopping the oldest", async () => {
        const audio = await loadedAudio("aud_shot", { maxVoices: 2 });
        audio.play();
        audio.play();
        expect(audio.activeVoices).toBe(2);
        audio.play();
        expect(audio.activeVoices).toBe(2);
        expect(ctx().sources[0].stopped).toBe(true);

        ctx().sources[1].finish();
        expect(audio.activeVoices).toBe(1);
        audio.stop();
        expect(audio.activeVoices).toBe(0);
    });

    it("playOnce does not overlap, and pause/resume continue from the paused offset", async () => {
        const audio = await loadedAudio("aud_song");
        audio.playOnce();
        audio.playOnce();
        expect(ctx().sources).toHaveLength(1);

        ctx().currentTime = 3.5;
        audio.pause();
        expect(audio.isPaused).toBe(true);
        expect(ctx().sources[0].stopped).toBe(true);

        audio.resume();
        expect(ctx().sources[1].started!.offset).toBeCloseTo(3.5);
        expect(audio.isPaused).toBe(false);

        ctx().sources[1].finish();
        expect(audio.isPaused).toBe(true);
    });

    it("pausing a loop wraps the offset inside the buffer duration", async () => {
        const audio = await loadedAudio("aud_loop");
        audio.playLoop(2);
        expect(ctx().sources[0].started!.offset).toBe(2);
        ctx().currentTime = 21;
        audio.pause();
        audio.resume();
        const resumed = ctx().sources[1];
        expect(resumed.loop).toBe(true);
        expect(resumed.started!.offset).toBeCloseTo(3);
    });

    it("playMany chains the requested number of plays", async () => {
        const audio = await loadedAudio("aud_beep");
        audio.playMany(3);
        expect(ctx().sources).toHaveLength(1);
        ctx().sources[0].finish();
        ctx().sources[1].finish();
        ctx().sources[2].finish();
        expect(ctx().sources).toHaveLength(3);
        expect(audio.isPaused).toBe(true);
    });

    it("playInSequence waits for each track to end", async () => {
        const a = await loadedAudio("aud_a");
        const b = await loadedAudio("aud_b");
        let done = false;
        const sequence = BrioAudio.playInSequence([a, b]).then(() => (done = true));
        await Promise.resolve();
        expect(ctx().sources).toHaveLength(1);
        ctx().sources[0].finish();
        await Promise.resolve();
        await Promise.resolve();
        expect(ctx().sources).toHaveLength(2);
        expect(done).toBe(false);
        ctx().sources[1].finish();
        await sequence;
        expect(done).toBe(true);
    });

    it("unlocks the suspended context on the first user gesture", async () => {
        await loadedAudio("aud_any");
        expect(BrioAudioMixer.isUnlocked).toBe(false);
        document.dispatchEvent(new Event("pointerdown"));
        await Promise.resolve();
        await Promise.resolve();
        expect(BrioAudioMixer.isUnlocked).toBe(true);
    });

    it("rejects load() when the file cannot be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
        await expect(new BrioAudio("aud_missing", "./missing.wav").load()).rejects.toThrow("HTTP 404");
    });
});

describe("BrioAudio fallback (no Web Audio)", () => {
    beforeEach(() => BrioAudioMixer.reset());

    it("applies bus and master volumes to the HTMLAudioElement", () => {
        expect(BrioAudioMixer.isSupported).toBe(false);
        const music = new BrioAudio("aud_bg", "./bg.ogg", { bus: "bgm", volume: 0.8 });
        expect(music.element.volume).toBeCloseTo(0.8);
        BrioAudioMixer.setVolume("bgm", 0.5);
        expect(music.element.volume).toBeCloseTo(0.4);
        BrioAudioMixer.mute("master");
        expect(music.element.volume).toBe(0);
        BrioAudioMixer.mute("master", false);
        music.volume = 1;
        expect(music.element.volume).toBeCloseTo(0.5);
        expect(music.usesWebAudio).toBe(false);
        expect(FakeBufferSource).toBeDefined();
    });
});
