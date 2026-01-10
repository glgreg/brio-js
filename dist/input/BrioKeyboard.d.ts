import { BrioConsole } from "../debugging/BrioConsole.js";
export declare class BrioKeyboard {
    #private;
    constructor(keyboardStateMap: Map<string, boolean>, keyboardPrevStateMap: Map<string, boolean>, console: BrioConsole);
    /**
     * Removes the EventListener created when using the keyboard.
     * @example game.useKeyboard(); // creating the keyboard logic
     * game.keyboard.removeListener(); // removing the listener
     */
    removeListener(): void;
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
    isDown(key: string): boolean;
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
    isUp(key: string): boolean;
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
    get customActions(): Map<string, Function>;
}
//# sourceMappingURL=BrioKeyboard.d.ts.map
