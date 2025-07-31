import { errors, exceptions } from "./game_logs.js";
export class GameLogger {
    static #storedErrors;
    static #storedExceptions;
    static #errors = errors;
    static #exceptions = exceptions;
    static get callerInfo() {
        const error = new Error();
        if (!error.stack)
            return;
        const callerString = error.stack;
        const pattern = /([a-zA-Z0-9_\-]+\.js:\d+:\d+|[a-zA-Z0-9_\-]+\.ts:\d+:\d+)/gm;
        const match = callerString.match(pattern);
        if (!match)
            return;
        const filtered = match.filter((path) => !path.startsWith("GameLogger"));
        const result = filtered.reduce((prev, next) => next + "\n" + prev);
        return `\n\n${result}`;
    }
    static out(type, message) {
        const finalMessage = `${message} ${this.callerInfo}`;
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
                throw new Error(`Incorrect logging type: ${type} ${this.callerInfo}`);
                break;
        }
    }
    static fatalError(message) {
        throw new Error(`${message} ${this.callerInfo}`);
    }
    static setErrorsStore(errorsSet) {
        if (this.#storedErrors)
            return;
        this.#storedErrors = errorsSet;
    }
    static setExceptionsStore(exceptionsSet) {
        if (this.#storedExceptions)
            return;
        this.#storedExceptions = exceptionsSet;
    }
    static error(errorId) {
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
        console.error(`Error id ${errorId} not found.`);
    }
    static exception(exceptionId) {
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
        console.warn(`Exception id ${exceptionId} not found.`);
    }
}
