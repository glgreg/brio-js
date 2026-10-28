/**
 * Synchronous key-value storage adapter interface used by `BrioStorage.state`, `BrioStorage.session`, and `BrioStorage.local`.
 */
export interface SyncStorageAdapter {
    /**
     * Retrieves a typed value by `key`, or `undefined` if not present.
     *
     * @param key Storage key
     * @returns Stored value or `undefined`
     */
    get<T = unknown>(key: string): T | undefined;

    /**
     * Stores `value` under `key`.
     *
     * @param key Storage key
     * @param value Value to store
     */
    set<T = unknown>(key: string, value: T): void;

    /**
     * Checks whether `key` exists in this storage tier.
     *
     * @param key Storage key
     * @returns `true` if present
     */
    has(key: string): boolean;

    /**
     * Removes `key` from this storage tier.
     *
     * @param key Storage key
     */
    delete(key: string): void;

    /**
     * Clears all keys in this storage tier.
     */
    clear(): void;
}

/**
 * Asynchronous database storage adapter backed by `IndexedDB` (with automatic in-memory fallback
 * in headless or restricted environments). Supports storing both structured values and raw binary
 * `Uint8Array` ECS snapshots without Base64 overhead.
 */
export class AsyncDatabaseStorage {
    readonly #dbName: string;
    readonly #storeName: string;
    readonly #fallbackMap = new Map<string, unknown>();
    #dbPromise?: Promise<IDBDatabase | null>;

    constructor(dbName: string = "brio_game_db", storeName: string = "brio_kv_store") {
        this.#dbName = dbName;
        this.#storeName = storeName;
    }

    async #getDB(): Promise<IDBDatabase | null> {
        if (typeof indexedDB === "undefined") {
            return null;
        }
        if (!this.#dbPromise) {
            this.#dbPromise = new Promise<IDBDatabase | null>((resolve) => {
                try {
                    const request = indexedDB.open(this.#dbName, 1);
                    request.onupgradeneeded = () => {
                        const db = request.result;
                        if (!db.objectStoreNames.contains(this.#storeName)) {
                            db.createObjectStore(this.#storeName);
                        }
                    };
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
        }
        return this.#dbPromise;
    }

    /**
     * Stores any structured or binary value (`Uint8Array`, `ArrayBuffer`, or object) under `key`.
     *
     * @param key Unique key
     * @param value Structured or binary value to persist
     * @example
     * ```ts
     * await BrioStorage.db.set("player_profile", { level: 5, coins: 120 });
     * ```
     */
    public async set<T = unknown>(key: string, value: T): Promise<void> {
        const db = await this.#getDB();
        if (!db) {
            this.#fallbackMap.set(key, value instanceof Uint8Array ? new Uint8Array(value) : value);
            return;
        }
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.#storeName, "readwrite");
            const store = tx.objectStore(this.#storeName);
            const req = store.put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Retrieves a previously stored value by `key`, or `undefined` if not found.
     *
     * @param key Unique key
     * @returns Promise resolving to the stored value or `undefined`
     * @example
     * ```ts
     * const profile = await BrioStorage.db.get<{ level: number }>("player_profile");
     * ```
     */
    public async get<T = unknown>(key: string): Promise<T | undefined> {
        const db = await this.#getDB();
        if (!db) {
            const val = this.#fallbackMap.get(key);
            if (val instanceof Uint8Array) {
                return new Uint8Array(val) as unknown as T;
            }
            return val as T | undefined;
        }
        return new Promise<T | undefined>((resolve, reject) => {
            const tx = db.transaction(this.#storeName, "readonly");
            const store = tx.objectStore(this.#storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result as T | undefined);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Persists a raw binary ECS snapshot (`Uint8Array`) directly under `key`.
     *
     * @param key Checkpoint identifier
     * @param snapshot Binary `Uint8Array` produced by `BrioSerializer.captureSnapshot`
     * @example
     * ```ts
     * await BrioStorage.db.saveSnapshot("slot_1", BrioSerializer.captureSnapshot(world));
     * ```
     */
    public async saveSnapshot(key: string, snapshot: Uint8Array): Promise<void> {
        await this.set(key, new Uint8Array(snapshot));
    }

    /**
     * Loads a raw binary ECS snapshot (`Uint8Array`) by `key`.
     *
     * @param key Checkpoint identifier
     * @returns Promise resolving to the `Uint8Array` snapshot or `undefined`
     * @example
     * ```ts
     * const snap = await BrioStorage.db.loadSnapshot("slot_1");
     * if (snap) BrioSerializer.restoreSnapshot(world, snap);
     * ```
     */
    public async loadSnapshot(key: string): Promise<Uint8Array | undefined> {
        return this.get<Uint8Array>(key);
    }

    /**
     * Deletes a key from the database.
     *
     * @param key Key to remove
     */
    public async delete(key: string): Promise<void> {
        const db = await this.#getDB();
        if (!db) {
            this.#fallbackMap.delete(key);
            return;
        }
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.#storeName, "readwrite");
            const store = tx.objectStore(this.#storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Clears all entries in the database store.
     */
    public async clear(): Promise<void> {
        const db = await this.#getDB();
        if (!db) {
            this.#fallbackMap.clear();
            return;
        }
        return new Promise<void>((resolve, reject) => {
            const tx = db.transaction(this.#storeName, "readwrite");
            const store = tx.objectStore(this.#storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}

function createWebStorageAdapter(getWebStorage: () => Storage | undefined): SyncStorageAdapter {
    const fallback = new Map<string, string>();

    const resolveStorage = (): Storage | undefined => {
        try {
            return getWebStorage();
        } catch {
            return undefined;
        }
    };

    return {
        get<T = unknown>(key: string): T | undefined {
            const storage = resolveStorage();
            const raw = storage ? storage.getItem(key) : (fallback.get(key) ?? null);
            if (raw === null) return undefined;
            try {
                return JSON.parse(raw) as T;
            } catch {
                return raw as unknown as T;
            }
        },
        set<T = unknown>(key: string, value: T): void {
            const serialized = JSON.stringify(value);
            const storage = resolveStorage();
            if (storage) {
                storage.setItem(key, serialized);
            } else {
                fallback.set(key, serialized);
            }
        },
        has(key: string): boolean {
            const storage = resolveStorage();
            return storage ? storage.getItem(key) !== null : fallback.has(key);
        },
        delete(key: string): void {
            const storage = resolveStorage();
            if (storage) {
                storage.removeItem(key);
            } else {
                fallback.delete(key);
            }
        },
        clear(): void {
            const storage = resolveStorage();
            if (storage) {
                storage.clear();
            } else {
                fallback.clear();
            }
        },
    };
}

const memoryStateMap = new Map<string, unknown>();

/**
 * Multi-platform persistence and state management subsystem for BrioJS.
 * Provides four storage tiers:
 * - `BrioStorage.state`: Fast in-memory runtime state (`Map`)
 * - `BrioStorage.session`: Tab-scoped `sessionStorage` with JSON serialization
 * - `BrioStorage.local`: Persistent `localStorage` with JSON serialization
 * - `BrioStorage.db`: Asynchronous `IndexedDB` store supporting binary `BrioSerializer` snapshots
 *
 * @example
 * ```ts
 * BrioStorage.state.set("score", 1500);
 * BrioStorage.local.set("highScore", 9999);
 * await BrioStorage.db.saveSnapshot("autosave", BrioSerializer.captureSnapshot(world));
 * ```
 */
export class BrioStorage {
    /**
     * In-memory runtime state storage cleared when the page or process reloads.
     */
    public static readonly state: SyncStorageAdapter = {
        get<T = unknown>(key: string): T | undefined {
            return memoryStateMap.get(key) as T | undefined;
        },
        set<T = unknown>(key: string, value: T): void {
            memoryStateMap.set(key, value);
        },
        has(key: string): boolean {
            return memoryStateMap.has(key);
        },
        delete(key: string): void {
            memoryStateMap.delete(key);
        },
        clear(): void {
            memoryStateMap.clear();
        },
    };

    /**
     * Session-scoped storage backed by `window.sessionStorage` (with automatic in-memory fallback).
     */
    public static readonly session: SyncStorageAdapter = createWebStorageAdapter(() =>
        typeof window !== "undefined" ? window.sessionStorage : undefined,
    );

    /**
     * Persistent key-value storage backed by `window.localStorage` (with automatic in-memory fallback).
     */
    public static readonly local: SyncStorageAdapter = createWebStorageAdapter(() =>
        typeof window !== "undefined" ? window.localStorage : undefined,
    );

    /**
     * Asynchronous `IndexedDB` storage supporting structured objects and raw binary `Uint8Array` ECS snapshots.
     */
    public static readonly db: AsyncDatabaseStorage = new AsyncDatabaseStorage();
}
