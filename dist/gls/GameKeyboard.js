export class GameKeyboard {
    #event;
    #keyboardState;
    constructor(event, keyboardStateMap) {
        this.#event = event;
        this.#keyboardState = keyboardStateMap;
    }
    isDown(key) {
        if (this.#event.key === key) {
            return true;
        }
        return false;
    }
}
