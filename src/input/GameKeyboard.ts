import { BrioLogger } from "../logging/BrioLogger";

export class GameKeyboard {
	/** @type {Map<string, boolean>} A map that stores the keyboard overall state of keys that are being pressed (true) or not (false) */
	#keyboardState: Map<string, boolean>;
	#keyDownListenerId?: (event: KeyboardEvent) => void;
	#keyUpListenerId?: (event: KeyboardEvent) => void;

	#customEventMaps: Map<string, Function> = new Map();

	constructor(keyboardStateMap: Map<string, boolean>) {
		this.#keyboardState = keyboardStateMap;
		this.#addListener();
	}

	#addListener() {
		this.#keyDownListenerId = (event: KeyboardEvent) => {
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
		this.#keyUpListenerId = (event: KeyboardEvent) => {
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
	public removeListener(): void {
		if (this.#keyDownListenerId !== undefined && this.#keyUpListenerId !== undefined) {
			window.removeEventListener("keydown", this.#keyDownListenerId);
			window.removeEventListener("keyup", this.#keyUpListenerId);
			BrioLogger.out("info", "Keyboard Event Listener sucessfuly removed.");
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
	public isDown(key: string): boolean {
		if (this.#keyboardState.has(key)) {
			if (this.#keyboardState.get(key) === true) {
				return true;
			}
		}
		return false;
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
	 * @returns {Map<string, Function>}
	 */
	public get customActions(): Map<string, Function> {
		return this.#customEventMaps;
	}
}
