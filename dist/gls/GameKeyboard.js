export class GameKeyboard {
    /** @type {Map<string, boolean>} A map that stores the keyboard overall state of keys that are being pressed (true) or not (false) */
    #keyboardState;
    #keyDownListenerId;
    #keyUpListenerId;
    #customEventMaps = new Map();
    constructor(keyboardStateMap) {
        this.#keyboardState = keyboardStateMap;
        this.#addListener();
    }
    #addListener() {
        this.#keyDownListenerId = (event) => {
            event.preventDefault();
            if (!this.#keyboardState.has(event.key)) {
                this.#keyboardState.set(event.key, true);
            }
            if (this.#keyboardState.get(event.key) === false) {
                this.#keyboardState.set(event.key, true);
            }
            this.#customEventMaps.forEach((customFunction, customKey) => {
                if (customKey === event.key) {
                    customFunction();
                }
            });
        };
        this.#keyUpListenerId = (event) => {
            event.preventDefault();
            if (this.#keyboardState.get(event.key) === true) {
                this.#keyboardState.set(event.key, false);
            }
        };
        window.addEventListener("keydown", this.#keyDownListenerId);
        window.addEventListener("keyup", this.#keyUpListenerId);
        console.info("Keyboard Event Listener sucessfuly created");
    }
    /**
     * Removes the EventListener created when using the keyboard.
     * @example game.useKeyboard(); // creating the keyboard logic
     * game.keyboard.removeListener(); // removing the listener
     */
    removeListener() {
        if (this.#keyDownListenerId !== undefined && this.#keyUpListenerId !== undefined) {
            window.removeEventListener("keydown", this.#keyDownListenerId);
            window.removeEventListener("keyup", this.#keyUpListenerId);
            console.info("Keyboard Event Listener sucessfuly removed");
        }
    }
    /**
     * Checks if the given KeyboardKey is pressed down.
     * @param {string} key
     * @returns {boolean}
     * @example game.update((updater, dt) => {
     * const obj_player = updater.getObject("obj_player");
     *
     * if(game.keyboard.isDown(" ")) {
     * obj_player.pos.y += -100 * dt; // makes the object go up when space is pressed
     * }
     * });
     */
    isDown(key) {
        if (this.#keyboardState.has(key)) {
            if (this.#keyboardState.get(key) === true) {
                return true;
            }
        }
        return false;
    }
    /**
     * Returns a Map that stores functions that will be called when the given Keyboard key is pressed.
     * Map keys should be the same the ones JS accepts in the KeyboardEvent.key.
     * Map values shoud be callable functions (callbacks, arrow functions, anonymous functionss)
     * @example game.useKeyboard();
     * game.keyboard.globalCustomEvents.set("Escape", () => {
     *
     * console.log(game.keyboard.globalCustomEvents); // Map(Escape -> ())
     * });
     * @returns {Map<string, Function>}
     */
    get customActions() {
        return this.#customEventMaps;
    }
}
