import { errors, exceptions } from "./game_logs.js";
export class BrioConsole {
    /** If true, enables logs for this Brio Game instance */
    enabled = false;
    /** If true, enables stack traces for archives that are calling logs */
    showStackTrace = false;
    /** If true, enables stack traces in the Brio classes */
    showInternalStackTrace = false;
    // temp
    #loggedErrors = new Set();
    #storedErrors;
    #storedExceptions;
    #errors = errors;
    #exceptions = exceptions;
    get loggedErrors() {
        return this.#loggedErrors;
    }
    get stackTrace() {
        const error = new Error();
        if (!error.stack)
            return "";
        const pattern = /([a-zA-Z0-9_\-]+\.js:\d+:\d+|[a-zA-Z0-9_\-]+\.ts:\d+:\d+)/gm;
        const match = error.stack.match(pattern);
        if (!match)
            return "";
        const external = match.filter((path) => !path.includes("Brio"));
        const internal = match.filter((path) => path.includes("Brio"));
        const filtered = new Array();
        if (this.showStackTrace)
            filtered.push(...external);
        if (this.showInternalStackTrace)
            filtered.push(...internal);
        if (filtered.length < 1)
            return "";
        const filteredSet = new Set(filtered);
        const result = Array.from(filteredSet)
            .sort()
            .reverse()
            .reduce((prev, next) => prev + "\n" + next);
        return `\n\n${result}`;
    }
    out(type, message) {
        if (!this.enabled)
            return;
        let finalMessage = message;
        if (this.showStackTrace || this.showInternalStackTrace)
            finalMessage += this.stackTrace;
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
    fatalError(message) {
        return new Error(`${message} ${this.stackTrace}`);
    }
    error(errorId) {
        if (!this.enabled)
            return;
        if (!this.#errors || !this.#storedErrors || this.#storedErrors.has(errorId))
            return;
        let isFound = false;
        for (const err of this.#errors) {
            if (err.id === errorId) {
                this.out("error", `${err.title}\n\n${err.message}\n\nError id: ${err.id}`);
                this.#storedErrors.add(errorId);
                isFound = true;
                break;
            }
        }
        if (isFound)
            return;
        this.out("error", `Error id ${errorId} not found.`);
    }
    exception(exceptionId) {
        if (!this.enabled)
            return;
        if (!this.#exceptions ||
            !this.#storedExceptions ||
            this.#storedExceptions.has(exceptionId)) {
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
        if (isFound)
            true;
        this.out("warn", `Exception id ${exceptionId} not found.`);
    }
}
