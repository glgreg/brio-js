import { errors, exceptions } from "./game_logs.js";
export class GameLogger {
    static #storedErrors;
    static #storedExceptions;
    static #errors = errors;
    static #exceptions = exceptions;
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
                console.error(`${err.title}\n\n${err.message}\n\nError id: ${err.id}`);
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
                console.warn(`${ex.title}\n\n${ex.message}\n\nException id: ${ex.id}`);
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
