/**
 * Name-keyed registry that keeps both a `Map` for $O(1)$ lookups and a dense array for
 * allocation-free iteration inside the game loop (no `Map` iterators, no `Array.from`).
 *
 * @example
 * ```ts
 * const cameras = new BrioRegistry<BrioCamera2D>();
 * cameras.add(new BrioCamera2D("cam_p1"));
 * for (let i = 0; i < cameras.list.length; i++) cameras.list[i].update(dt);
 * ```
 */
export class BrioRegistry<T extends { readonly name: string }> {
    readonly #map = new Map<string, T>();
    readonly #list: T[] = [];

    /** Read-only name-keyed view of the registered items. */
    public get map(): ReadonlyMap<string, T> {
        return this.#map;
    }

    /** Dense read-only array of the registered items (insertion order unless `sortIfNeeded` reorders it). */
    public get list(): readonly T[] {
        return this.#list;
    }

    /** Number of registered items. */
    public get size(): number {
        return this.#list.length;
    }

    /**
     * Retrieves an item by name.
     *
     * @param name Item name
     * @returns Matching item or `undefined`
     */
    public get(name: string): T | undefined {
        return this.#map.get(name);
    }

    /**
     * Checks whether an item named `name` is registered.
     *
     * @param name Item name
     * @returns `true` if registered
     */
    public has(name: string): boolean {
        return this.#map.has(name);
    }

    /**
     * Registers `item`, replacing any previous item with the same name.
     *
     * @param item Item to register
     * @returns The registered item
     */
    public add(item: T): T {
        const previous = this.#map.get(item.name);
        if (previous === item) return item;
        if (previous) {
            this.#list[this.#list.indexOf(previous)] = item;
        } else {
            this.#list.push(item);
        }
        this.#map.set(item.name, item);
        return item;
    }

    /**
     * Unregisters `item` (only if it is the instance currently registered under its name).
     *
     * @param item Item to remove
     * @returns `true` if removed
     */
    public remove(item: T): boolean {
        if (this.#map.get(item.name) !== item) return false;
        this.#map.delete(item.name);
        this.#list.splice(this.#list.indexOf(item), 1);
        return true;
    }

    /**
     * Removes every registered item.
     */
    public clear(): void {
        this.#map.clear();
        this.#list.length = 0;
    }

    /**
     * Sorts `list` in place with `compare`, only when an $O(n)$ scan finds it out of order.
     *
     * @param compare Comparator used for ordering
     * @returns The sorted `list`
     */
    public sortIfNeeded(compare: (a: T, b: T) => number): readonly T[] {
        const list = this.#list;
        for (let i = 1; i < list.length; i++) {
            if (compare(list[i - 1], list[i]) > 0) {
                list.sort(compare);
                break;
            }
        }
        return list;
    }
}
