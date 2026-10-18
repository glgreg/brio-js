import { errors, exceptions, ConsoleLogEntry } from "./game_logs";

/**
 * Diagnostic console utility for BrioJS supporting deduplicated error/exception reporting
 * and configurable stack-trace filtering (user code vs internal BrioJS engine frames).
 *
 * @example
 * ```ts
 * game.debugging.console.enabled = true;
 * game.debugging.console.showStackTrace = true;
 * ```
 */
export class BrioConsole {
    /** Enables or disables console log output for this `BrioGame` instance. */
    enabled: boolean = false;
    /** Appends user-code stack traces to log messages when `true`. */
    showStackTrace: boolean = false;
    /** Appends internal BrioJS class stack traces to log messages when `true`. */
    showInternalStackTrace: boolean = false;

    #loggedErrors: Set<string> = new Set<string>();
    #storedErrors: Set<number> = new Set<number>();
    #storedExceptions: Set<number> = new Set<number>();
    #errors: ConsoleLogEntry[] = errors;
    #exceptions: ConsoleLogEntry[] = exceptions;

    /**
     * Set of string keys for runtime lookup errors already logged once during the session,
     * preventing console spam inside the 60 FPS `update()` loop.
     */
    public get loggedErrors(): Set<string> {
        return this.#loggedErrors;
    }

    /**
     * Formats and filters the current call stack according to `showStackTrace` and `showInternalStackTrace`.
     *
     * @returns Formatted stack trace string, or `""` if no frames match
     */
    public get stackTrace(): string {
        const error = new Error();

        if (!error.stack) return "";

        const pattern = /([a-zA-Z0-9_\-]+\.js:\d+:\d+|[a-zA-Z0-9_\-]+\.ts:\d+:\d+)/gm;
        const match = error.stack.match(pattern);

        if (!match) return "";

        const external = match.filter((path) => !path.includes("Brio"));
        const internal = match.filter((path) => path.includes("Brio"));

        const filtered: string[] = [];

        if (this.showStackTrace) filtered.push(...external);
        if (this.showInternalStackTrace) filtered.push(...internal);
        if (filtered.length < 1) return "";

        const filteredSet = new Set(filtered);
        const result = Array.from(filteredSet)
            .sort()
            .reverse()
            .reduce((prev, next) => prev + "\n" + next);

        return `\n\n${result}`;
    }

    /**
     * Outputs a formatted diagnostic message to the native `console` when `enabled` is `true`.
     *
     * @param type Severity level (`"log"`, `"warn"`, `"info"`, or `"error"`)
     * @param message Message text to output
     * @throws {Error} When an unsupported `type` is provided
     * @example
     * ```ts
     * brioConsole.enabled = true;
     * brioConsole.out("info", "Level 1 loaded.");
     * ```
     */
    public out(type: "log" | "warn" | "info" | "error", message: string): void {
        if (!this.enabled) return;

        let finalMessage = message;

        if (this.showStackTrace || this.showInternalStackTrace) finalMessage += this.stackTrace;

        switch (type) {
            case "log":
                console.log(finalMessage);
                break;
            case "info":
                console.info(finalMessage);
                break;
            case "warn":
                console.warn(finalMessage);
                break;
            case "error":
                console.error(finalMessage);
                break;
            default:
                throw new Error(`Incorrect logging type: ${type} ${this.stackTrace}`);
        }
    }

    /**
     * Constructs an `Error` instance enriched with the filtered `stackTrace`.
     *
     * @param message Fatal error description
     * @returns A throwable `Error` instance
     * @example
     * ```ts
     * throw brioConsole.fatalError("Invalid container element.");
     * ```
     */
    public fatalError(message: string): Error {
        return new Error(`${message} ${this.stackTrace}`);
    }

    /**
     * Logs a predefined engine error by `errorId` once per session (deduplicated).
     *
     * @param errorId Numeric error identifier from `game_logs.ts`
     * @example
     * ```ts
     * brioConsole.error(0);
     * ```
     */
    public error(errorId: number): void {
        if (!this.enabled) return;
        if (!this.#errors || !this.#storedErrors || this.#storedErrors.has(errorId)) return;

        let isFound = false;

        for (const err of this.#errors) {
            if (err.id === errorId) {
                this.out("error", `${err.title}\n\n${err.message}\n\nError id: ${err.id}`);
                this.#storedErrors.add(errorId);
                isFound = true;
                break;
            }
        }

        if (isFound) return;

        this.out("error", `Error id ${errorId} not found.`);
    }

    /**
     * Logs a predefined engine warning/exception by `exceptionId` once per session (deduplicated).
     *
     * @param exceptionId Numeric exception identifier from `game_logs.ts`
     * @example
     * ```ts
     * brioConsole.exception(0);
     * ```
     */
    public exception(exceptionId: number): void {
        if (!this.enabled) return;
        if (
            !this.#exceptions ||
            !this.#storedExceptions ||
            this.#storedExceptions.has(exceptionId)
        ) {
            return;
        }

        let isFound = false;

        for (const ex of this.#exceptions) {
            if (ex.id === exceptionId) {
                this.out("warn", `${ex.title}\n\n${ex.message}\n\nException id: ${ex.id}`);
                this.#storedExceptions.add(exceptionId);
                isFound = true;
                break;
            }
        }

        if (isFound) return;
        this.out("warn", `Exception id ${exceptionId} not found.`);
    }
}

