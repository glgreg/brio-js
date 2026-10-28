/**
 * Seed accepted by `BrioRandom`: an integer, or a string hashed into one (e.g. a level name or a replay id).
 */
export type BrioRandomSeed = number | string;

/** FNV-1a hash of a string into an unsigned 32-bit integer. */
function hashString(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** One SplitMix32 step: spreads a 32-bit seed into well-mixed state words. */
function splitMix32(state: { value: number }): number {
    state.value = (state.value + 0x9e3779b9) | 0;
    let z = state.value;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
}

/**
 * Deterministic pseudo-random number generator (`BrioRandom`) based on **xoshiro128\*\*** with SplitMix32
 * seeding. The same seed always yields the same sequence on every platform, so gameplay that draws from a
 * `BrioRandom` (instead of `Math.random()`) can be replayed exactly. The 128-bit `state` can be captured and
 * restored (checkpoints, replays, network rollback).
 *
 * Not suitable for cryptography.
 *
 * @example
 * ```ts
 * const rng = new BrioRandom("level-1");
 * const damage = rng.int(5, 10);
 * const loot = rng.pick(["sword", "shield", "potion"]);
 * ```
 */
export class BrioRandom {
    readonly #s = new Uint32Array(4);
    #seed: number;

    /**
     * Creates a generator from `seed` (defaults to a time-based seed).
     *
     * @param seed Integer or string seed
     */
    constructor(seed: BrioRandomSeed = BrioRandom.createSeed()) {
        this.#seed = 0;
        this.reseed(seed);
    }

    /**
     * Returns a non-deterministic 32-bit seed (time and `Math.random` based) for runs that need no replay.
     *
     * @returns Unsigned 32-bit seed
     */
    public static createSeed(): number {
        return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    }

    /** The 32-bit seed of the current sequence (strings are reported as their hash). */
    public get seed(): number {
        return this.#seed;
    }

    /**
     * Copy of the 128-bit generator state (four unsigned 32-bit words).
     * Assigning a captured state resumes the sequence exactly from that point.
     */
    public get state(): Uint32Array {
        return new Uint32Array(this.#s);
    }
    public set state(value: ArrayLike<number>) {
        if (value.length !== 4) throw new Error("BrioRandom state must contain 4 unsigned 32-bit words.");
        for (let i = 0; i < 4; i++) this.#s[i] = value[i] >>> 0;
        if ((this.#s[0] | this.#s[1] | this.#s[2] | this.#s[3]) === 0) this.#s[0] = 1;
    }

    /**
     * Restarts the generator from `seed`.
     *
     * @param seed Integer or string seed
     * @returns This `BrioRandom` instance
     */
    public reseed(seed: BrioRandomSeed): this {
        this.#seed = typeof seed === "string" ? hashString(seed) : Math.floor(seed) >>> 0;
        const mixer = { value: this.#seed };
        for (let i = 0; i < 4; i++) this.#s[i] = splitMix32(mixer);
        // xoshiro must never hold the all-zero state
        if ((this.#s[0] | this.#s[1] | this.#s[2] | this.#s[3]) === 0) this.#s[0] = 1;
        return this;
    }

    /**
     * Next unsigned 32-bit integer of the sequence.
     *
     * @returns Integer in `[0, 2^32)`
     */
    public nextUint32(): number {
        const s = this.#s;
        const result = Math.imul(BrioRandom.#rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
        const t = s[1] << 9;
        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = BrioRandom.#rotl(s[3], 11);
        return result;
    }

    /**
     * Next float of the sequence, a drop-in replacement for `Math.random()`.
     *
     * @returns Float in `[0, 1)`
     */
    public next(): number {
        return this.nextUint32() / 0x100000000;
    }

    /**
     * Uniform float in `[min, max)`.
     *
     * @param min Inclusive lower bound
     * @param max Exclusive upper bound
     */
    public float(min: number = 0, max: number = 1): number {
        return min + this.next() * (max - min);
    }

    /**
     * Uniform integer in `[min, max]` (both inclusive).
     *
     * @param min Inclusive lower bound
     * @param max Inclusive upper bound
     */
    public int(min: number, max: number): number {
        const lo = Math.ceil(Math.min(min, max));
        const hi = Math.floor(Math.max(min, max));
        return lo + Math.floor(this.next() * (hi - lo + 1));
    }

    /**
     * Returns `true` with probability `probability`.
     *
     * @param probability Chance in `[0, 1]` (defaults to `0.5`)
     */
    public chance(probability: number = 0.5): boolean {
        return this.next() < probability;
    }

    /** Returns `1` or `-1` with equal probability. */
    public sign(): 1 | -1 {
        return this.next() < 0.5 ? -1 : 1;
    }

    /**
     * Uniformly picks one element of `items`.
     *
     * @param items Non-empty array
     * @returns The chosen element, or `undefined` for an empty array
     */
    public pick<T>(items: readonly T[]): T | undefined {
        if (items.length === 0) return undefined;
        return items[Math.floor(this.next() * items.length)];
    }

    /**
     * Shuffles `items` in place (Fisher-Yates).
     *
     * @param items Array to shuffle
     * @returns The same array
     */
    public shuffle<T>(items: T[]): T[] {
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            const tmp = items[i];
            items[i] = items[j];
            items[j] = tmp;
        }
        return items;
    }

    /**
     * Independent generator continuing from the same state.
     *
     * @returns A new `BrioRandom` with a copy of this state
     */
    public clone(): BrioRandom {
        const copy = new BrioRandom(this.#seed);
        copy.state = this.#s;
        return copy;
    }

    static #rotl(x: number, k: number): number {
        return ((x << k) | (x >>> (32 - k))) >>> 0;
    }
}
