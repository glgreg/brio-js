/**
 * Contract for multi-tier persistence providers in BrioJS.
 */
export interface Storage {
    /** In-memory runtime state storage. */
    get state(): Record<string, unknown>;
    /** Browser `sessionStorage` adapter. */
    get session(): Record<string, unknown>;
    /** Browser `localStorage` adapter. */
    get local(): Record<string, unknown>;
    /** Asynchronous `IndexedDB` adapter for binary and structured game saves. */
    get db(): Record<string, unknown>;
}

/**
 * Multi-tier storage facade providing unified access to `state`, `session`, `local`, and `db` persistence.
 */
export class BrioStorage {
    /** In-memory runtime state storage. */
    public static get state(): Record<string, unknown> {
        return {};
    }
    /** Browser `sessionStorage` adapter. */
    public static get session(): Record<string, unknown> {
        return {};
    }
    /** Browser `localStorage` adapter. */
    public static get local(): Record<string, unknown> {
        return {};
    }
    /** Asynchronous `IndexedDB` adapter. */
    public static get db(): Record<string, unknown> {
        return {};
    }
}

