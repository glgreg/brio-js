export class GameGamepad {
    /** @type {Map<string, boolean>} A map that stores the keyboard overall state of keys that are being pressed (true) or not (false) */
    #gamepadState;
    #keyDownListenerId;
    #keyUpListenerId;
    constructor(keyboardStateMap) {
        this.#gamepadState = keyboardStateMap;
        this.#addListener();
    }
    #addListener() {
        this.#keyDownListenerId = (event) => {
            event.preventDefault();
            if (!this.#gamepadState.has(event.key)) {
                this.#gamepadState.set(event.key, true);
            }
            if (this.#gamepadState.get(event.key) === false) {
                this.#gamepadState.set(event.key, true);
            }
        };
        this.#keyUpListenerId = (event) => {
            event.preventDefault();
            if (this.#gamepadState.get(event.key) === true) {
                this.#gamepadState.set(event.key, false);
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
        if (this.#gamepadState.has(key)) {
            if (this.#gamepadState.get(key) === true) {
                return true;
            }
        }
        return false;
    }
}
