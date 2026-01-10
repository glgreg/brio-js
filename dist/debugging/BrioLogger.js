import { errors, exceptions } from "./game_logs.js";
export class BrioLogger {
    #storedErrors;
    #storedExceptions;
    #errors = errors;
    #exceptions = exceptions;
    enabled = false;
    stackTrace = false;
    internalStackTrace = false;
    constructor(storeErrors, storeExceptions) { }
    get #stackTrace() {
        const error = new Error();
        if (!error.stack)
            return;
        const pattern = /([a-zA-Z0-9_\-]+\.js:\d+:\d+|[a-zA-Z0-9_\-]+\.ts:\d+:\d+)/gm;
        const match = error.stack.match(pattern);
        if (!match)
            return;
        const filtered = match.filter((path) => !(path.startsWith("GameLogger") ||
            (!this.internalStackTrace && path.startsWith("Game"))));
        const singlefied = new Set(filtered);
        const result = Array.from(singlefied)
            .sort()
            .reverse()
            .reduce((prev, next) => prev + "\n" + next);
        return `\n\n${result}`;
    }
    out(type, message) {
        if (!this.enabled)
            return;
        let finalMessage = message;
        if (this.stackTrace)
            finalMessage += this.#stackTrace;
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
                throw new Error(`Incorrect logging type: ${type} ${this.#stackTrace}`);
                break;
        }
    }
    fatalError(message) {
        return new Error(`${message} ${this.#stackTrace}`);
    }
    error(errorId) {
        if (!this.enabled)
            return;
        if (!this.#errors || !this.#storedErrors || this.#storedErrors.has(errorId))
            return;
        let wasFound = false;
        for (const err of this.#errors) {
            if (err.id === errorId) {
                this.out("error", `${err.title}\n\n${err.message}\n\nError id: ${err.id}`);
                this.#storedErrors.add(errorId);
                wasFound = true;
                break;
            }
        }
        if (!wasFound)
            this.out("error", `Error id ${errorId} not found.`);
        return;
    }
    exception(exceptionId) {
        if (!this.enabled)
            return;
        if (!this.#exceptions || !this.#storedExceptions || this.#storedExceptions.has(exceptionId))
            return;
        let isFound = false;
        for (const ex of this.#exceptions) {
            if (ex.id === exceptionId) {
                this.out("warn", `${ex.title}\n\n${ex.message}\n\nException id: ${ex.id}`);
                this.#storedExceptions.add(exceptionId);
                isFound = true;
                break;
            }
        }
        if (isFound)
            true;
        this.out("warn", `Exception id ${exceptionId} not found.`);
    }
}
