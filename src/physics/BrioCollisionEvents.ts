/**
 * Callback of a collision event: `other` is the object touched, `self` the object the listener belongs to (useful
 * for listeners shared by every clone of a prefab).
 */
export type CollisionListener<T> = (other: T, self: T) => void;

/** Phase of a contact between two colliders. */
export type CollisionPhase = "enter" | "stay" | "exit";

/**
 * Collision listeners registered on one `BrioObject2D` or `BrioObject3D` (`onCollisionEnter`, `onCollisionStay`,
 * `onCollisionExit`). Created lazily by the object, so objects without listeners carry no extra arrays.
 */
export class CollisionListeners<T> {
    /** Listeners called on the first frame two colliders overlap. */
    public readonly enter: CollisionListener<T>[] = [];
    /** Listeners called on every later frame the colliders keep overlapping. */
    public readonly stay: CollisionListener<T>[] = [];
    /** Listeners called on the first frame the colliders stop overlapping (or the other object is removed). */
    public readonly exit: CollisionListener<T>[] = [];

    /** Whether no listener is registered. */
    public get isEmpty(): boolean {
        return this.enter.length === 0 && this.stay.length === 0 && this.exit.length === 0;
    }

    /**
     * Adds `listener` to `phase` and returns a function that removes it again.
     *
     * @param phase Contact phase
     * @param listener Callback to add
     * @returns Unsubscribe function
     */
    public add(phase: CollisionPhase, listener: CollisionListener<T>): () => void {
        const list = this[phase];
        list.push(listener);
        return () => {
            const index = list.indexOf(listener);
            if (index >= 0) list.splice(index, 1);
        };
    }

    /**
     * Appends every listener of `source` (used when a prefab is instantiated).
     *
     * @param source Listeners to copy
     */
    public copyFrom(source: CollisionListeners<T>): void {
        for (let i = 0; i < source.enter.length; i++) this.enter.push(source.enter[i]);
        for (let i = 0; i < source.stay.length; i++) this.stay.push(source.stay[i]);
        for (let i = 0; i < source.exit.length; i++) this.exit.push(source.exit[i]);
    }

    /** Removes every listener. */
    public clear(): void {
        this.enter.length = 0;
        this.stay.length = 0;
        this.exit.length = 0;
    }
}

/** Object that can take part in collision events. */
export interface CollisionParticipant<T> {
    /** Listeners of the object, or `undefined` when it never registered one. */
    readonly collisionListeners: CollisionListeners<T> | undefined;
}

/** Contact sets of one object: overlaps of the previous frame and of the frame being evaluated. */
interface ContactState<T> {
    previous: Set<T>;
    current: Set<T>;
    /** Frame number in which the object was last a candidate (removed objects receive no callbacks). */
    seenFrame: number;
}

/** Candidate collider with its cached X extent for the sweep. */
interface SweepEntry<T> {
    object: T | undefined;
    minX: number;
    maxX: number;
}

function compareSweep<T>(a: SweepEntry<T>, b: SweepEntry<T>): number {
    return a.minX - b.minX;
}

/**
 * Per-frame contact tracker that turns narrow-phase overlap tests into `enter` / `stay` / `exit` events
 * (`BrioGame` runs one for 2D objects and one for 3D objects, after the `update()` callback).
 *
 * Candidates are sorted by the left edge of their collider and swept along X (sort and sweep), so only pairs whose X
 * extents overlap reach the narrow phase. Pairs where neither object has listeners are skipped. Events are queued
 * first and dispatched afterwards, so listeners may destroy objects or register new ones safely. Steady-state frames
 * allocate nothing: sweep entries, contact sets and the event queue are pooled and reused.
 *
 * @internal
 */
export class CollisionEventSystem<T extends CollisionParticipant<T>> {
    readonly #overlaps: (a: T, b: T) => boolean;
    readonly #extentX: (object: T, out: SweepEntry<T>) => boolean;
    readonly #states = new WeakMap<T, ContactState<T>>();
    /** Objects with a non-empty contact set (their exits must be reported even after they stop being candidates). */
    readonly #tracked = new Set<T>();
    readonly #entries: SweepEntry<T>[] = [];
    #entryCount: number = 0;
    /** Flat event queue: `[phase, self, other]` triples, dispatched after detection. */
    readonly #queuePhase: CollisionPhase[] = [];
    readonly #queueSelf: T[] = [];
    readonly #queueOther: T[] = [];
    #queueLength: number = 0;
    #frame: number = 0;

    readonly #collectVisitor = (object: T): void => {
        this.#collectEvents(object);
    };
    readonly #rollVisitor = (object: T): void => {
        this.#roll(object);
    };
    /** Object and state visited by `#currentVisitor` / `#previousVisitor` (fields, so no closure per object). */
    #visitSelf?: T;
    #visitState?: ContactState<T>;
    readonly #currentVisitor = (other: T): void => {
        const state = this.#visitState!;
        this.#enqueue(state.previous.has(other) ? "stay" : "enter", this.#visitSelf!, other);
    };
    readonly #previousVisitor = (other: T): void => {
        if (!this.#visitState!.current.has(other)) this.#enqueue("exit", this.#visitSelf!, other);
    };

    /**
     * Creates a new tracker.
     *
     * @param overlaps Narrow-phase test of two enabled colliders
     * @param extentX Writes the world X extent of the object's collider into `out` (`minX`, `maxX`); returns
     * `false` when the object has no enabled collider
     */
    constructor(
        overlaps: (a: T, b: T) => boolean,
        extentX: (object: T, out: { minX: number; maxX: number }) => boolean,
    ) {
        this.#overlaps = overlaps;
        this.#extentX = extentX;
    }

    /** Number of objects currently in contact with at least one other object. */
    public get trackedCount(): number {
        return this.#tracked.size;
    }

    /** Starts a frame: forgets the previous candidates (call `add()` for each object, then `update()`). */
    public begin(): void {
        this.#frame++;
        this.#entryCount = 0;
    }

    /**
     * Adds an object to this frame's candidates (ignored when it has no enabled collider).
     *
     * @param object Candidate object
     */
    public add(object: T): void {
        let entry = this.#entries[this.#entryCount];
        if (!entry) {
            entry = { object: undefined, minX: 0, maxX: 0 };
            this.#entries.push(entry);
        }
        if (!this.#extentX(object, entry)) return;
        entry.object = object;
        this.#entryCount++;
    }

    /** Detects the overlaps of the candidates added since `begin()` and dispatches the resulting events. */
    public update(): void {
        const entries = this.#entries;
        const count = this.#entryCount;
        const frame = this.#frame;

        // Insertion sort: candidates keep their order between frames, so this is close to linear and allocation-free
        for (let i = 1; i < count; i++) {
            const entry = entries[i];
            let j = i - 1;
            while (j >= 0 && compareSweep(entries[j], entry) > 0) {
                entries[j + 1] = entries[j];
                j--;
            }
            entries[j + 1] = entry;
        }

        for (let i = 0; i < count; i++) {
            const a = entries[i].object!;
            this.#stateOf(a).seenFrame = frame;
        }

        for (let i = 0; i < count; i++) {
            const ea = entries[i];
            const a = ea.object!;
            const aListens = a.collisionListeners !== undefined && !a.collisionListeners.isEmpty;
            for (let j = i + 1; j < count; j++) {
                const eb = entries[j];
                if (eb.minX > ea.maxX) break;
                const b = eb.object!;
                const bListens =
                    b.collisionListeners !== undefined && !b.collisionListeners.isEmpty;
                if (!aListens && !bListens) continue;
                if (!this.#overlaps(a, b)) continue;
                this.#stateOf(a).current.add(b);
                this.#stateOf(b).current.add(a);
                this.#tracked.add(a);
                this.#tracked.add(b);
            }
        }

        this.#queueLength = 0;
        this.#tracked.forEach(this.#collectVisitor);
        this.#tracked.forEach(this.#rollVisitor);

        // Dispatch last: listeners may destroy objects or start new contacts without corrupting the sets above
        const length = this.#queueLength;
        for (let i = 0; i < length; i++) {
            const self = this.#queueSelf[i];
            const listeners = self.collisionListeners;
            if (listeners) {
                const list = listeners[this.#queuePhase[i]];
                for (let l = 0; l < list.length; l++) list[l](this.#queueOther[i], self);
            }
        }
        // Drop references so the queue does not keep destroyed objects alive
        for (let i = 0; i < length; i++) {
            this.#queueSelf[i] = undefined as unknown as T;
            this.#queueOther[i] = undefined as unknown as T;
        }
        for (let i = 0; i < count; i++) entries[i].object = undefined;
    }

    /**
     * Forgets every contact of `object` without reporting exits (used when an object is destroyed or the world is
     * restored from a snapshot).
     *
     * @param object Object to forget
     */
    public forget(object: T): void {
        const state = this.#states.get(object);
        if (!state) return;
        state.previous.forEach((other) => this.#states.get(other)?.previous.delete(object));
        state.previous.clear();
        state.current.clear();
        this.#tracked.delete(object);
    }

    /** Forgets every contact (used by `game.end()` and snapshot restores). */
    public clear(): void {
        this.#tracked.forEach((object) => {
            const state = this.#states.get(object);
            state?.previous.clear();
            state?.current.clear();
        });
        this.#tracked.clear();
        for (let i = 0; i < this.#entries.length; i++) this.#entries[i].object = undefined;
        this.#entryCount = 0;
    }

    /**
     * Whether `a` and `b` overlapped during the last `update()`.
     *
     * @param a First object
     * @param b Second object
     * @returns `true` while the two objects are in contact
     */
    public isTouching(a: T, b: T): boolean {
        return this.#states.get(a)?.previous.has(b) ?? false;
    }

    #stateOf(object: T): ContactState<T> {
        let state = this.#states.get(object);
        if (!state) {
            state = { previous: new Set(), current: new Set(), seenFrame: 0 };
            this.#states.set(object, state);
        }
        return state;
    }

    #enqueue(phase: CollisionPhase, self: T, other: T): void {
        const i = this.#queueLength++;
        this.#queuePhase[i] = phase;
        this.#queueSelf[i] = self;
        this.#queueOther[i] = other;
    }

    #collectEvents(object: T): void {
        const state = this.#states.get(object)!;
        // A removed object (not a candidate this frame) gets no callbacks; its partners still see it exit
        if (state.seenFrame !== this.#frame) return;
        const listeners = object.collisionListeners;
        if (!listeners || listeners.isEmpty) return;
        this.#visitSelf = object;
        this.#visitState = state;
        state.current.forEach(this.#currentVisitor);
        state.previous.forEach(this.#previousVisitor);
        this.#visitSelf = undefined;
        this.#visitState = undefined;
    }

    #roll(object: T): void {
        const state = this.#states.get(object)!;
        const previous = state.previous;
        previous.clear();
        state.previous = state.current;
        state.current = previous;
        if (state.previous.size === 0) this.#tracked.delete(object);
    }
}
