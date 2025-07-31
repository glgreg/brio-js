export class GameMouse {
    /** @type {Map<string, boolean>} A map that stores the keyboard overall state of keys that are being pressed (true) or not (false) */
    #mouseState;
    #keyDownListenerId;
    #keyUpListenerId;
    constructor(keyboardStateMap) {
        this.#mouseState = keyboardStateMap;
        this.#addListener();
    }
    #addListener() {
        this.#keyDownListenerId = (event) => {
            event.preventDefault();
            if (!this.#mouseState.has(event.key)) {
                this.#mouseState.set(event.key, true);
            }
            if (this.#mouseState.get(event.key) === false) {
                this.#mouseState.set(event.key, true);
            }
        };
        this.#keyUpListenerId = (event) => {
            event.preventDefault();
            if (this.#mouseState.get(event.key) === true) {
                this.#mouseState.set(event.key, false);
            }
        };
        window.addEventListener("keydown", this.#keyDownListenerId);
        window.addEventListener("keyup", this.#keyUpListenerId);
        console.info("Keyboard Event Listener sucessfuly created");
    }
    removeListener() {
        if (this.#keyDownListenerId !== undefined && this.#keyUpListenerId !== undefined) {
            window.removeEventListener("keydown", this.#keyDownListenerId);
            window.removeEventListener("keyup", this.#keyUpListenerId);
            console.info("Keyboard Event Listener sucessfuly removed");
        }
    }
    isDown(key) {
        if (this.#mouseState.has(key)) {
            if (this.#mouseState.get(key) === true) {
                return true;
            }
        }
        return false;
    }
}
