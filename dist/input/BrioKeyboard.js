import { BrioLogger } from "../logging/BrioLogger.js";
export class BrioKeyboard {
    /** A map storing keys that were pressed */
    #keyboardState;
    /** A map storing keys that were pressed and will be memorized */
    #keyboardPrevState;
    #keyDownListenerId;
    #keyUpListenerId;
    #customEventMaps = new Map();
    constructor(keyboardStateMap, keyboardPrevStateMap) {
        this.#keyboardState = keyboardStateMap;
        this.#keyboardPrevState = keyboardPrevStateMap;
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
        BrioLogger.out("info", "Keyboard Event Listener sucessfuly created.");
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
            BrioLogger.out("info", "Keyboard Event Listener sucessfuly removed.");
        }
    }
    /**
     * Checks if the given KeyboardKey is pressed down.
     * @param key
     * @example game.update((updater, dt) => {
     * const obj_player = updater.getObject("obj_player");
     *
     * if(game.keyboard.isDown(" ")) {
     * obj_player.pos.y += -100 * dt; // makes the object go up when space is pressed
     * }
     * });
     */
    isDown(key) {
        if (!this.#keyboardState.get(key) === true)
            return false;
        const isKeyDown = this.#keyboardState.has(key);
        return isKeyDown;
    }
    /**
     * Checks if the given KeyboardKey was pressed.
     * @param key
     * @example game.update((updater, dt) => {
     * const obj_player = updater.getObject("obj_player");
     *
     * if(game.keyboard.isUp("z")) {
     * obj_player.flip.x += !obj_player.flip.x; // makes the player sprite flip in the x axis
     * }
     * });
     */
    isUp(key) {
        if (!this.#keyboardState.has(key))
            return false;
        const wasKeyDown = this.#keyboardPrevState.get(key) === true;
        const isKeyDown = this.#keyboardState.get(key) === false;
        return wasKeyDown && isKeyDown;
    }
    /**
     * Returns a Map that stores functions that will be called when the given Keyboard key is pressed.
     * Map keys should be the same as the ones JS accepts in the KeyboardEvent.key.
     * Map values shoud be callable functions (callbacks, arrow functions, anonymous functions)
     * @example game.useKeyboard();
     * game.keyboard.globalCustomEvents.set("Escape", () => {
     *
     * console.log(game.keyboard.globalCustomEvents); // Map(Escape -> ())
     * });
     */
    get customActions() {
        return this.#customEventMaps;
    }
}
