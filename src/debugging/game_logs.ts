/**
 * Represents a structured diagnostic message entry for `BrioConsole`.
 */
export type ConsoleLogEntry = {
    /** Numeric identifier of the diagnostic entry. */
    id: number;
    /** Uppercase summary title of the error or exception. */
    title: string;
    /** Detailed explanation and remediation hint. */
    message: string;
};

/**
 * Built-in catalog of engine error definitions indexed by ID.
 */
export const errors: ConsoleLogEntry[] = [
    {
        id: 0,
        title: "COULDN'T APPEND CANVAS TO ELEMENT",
        message:
            "A BrioGame object needs a valid HTMLElement in order to work. Try 'new BrioGame(600, 400, document.body)'",
    },
    {
        id: 1,
        title: "EMPTY PRELOAD ASSET LIST",
        message:
            "Zero assets were returned in preload(). Return at least one BrioSprite, BrioAudio, or BrioAtlas instance.",
    },
];

/**
 * Built-in catalog of engine non-fatal exception warnings indexed by ID.
 */
export const exceptions: ConsoleLogEntry[] = [
    {
        id: 0,
        title: "NEGATIVE VALUES FOUND",
        message:
            "A negative value was given in a place where it shouldn't. By default, the value was turned into an absolute of itself",
    },
];

