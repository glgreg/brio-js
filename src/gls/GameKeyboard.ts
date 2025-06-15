export type KeyboardKeys =
	| "a"
	| "w"
	| "s"
	| "d"
	| ""
	| "ArrowLeft"
	| "ArrowRigth"
	| "ArrowUp"
	| "ArrowDown";

export class GameKeyboard {
	#event: KeyboardEvent;
	#keyboardState: Map<string, boolean>;

	constructor(event: KeyboardEvent, keyboardStateMap: Map<string, boolean>) {
		this.#event = event;
		this.#keyboardState = keyboardStateMap;
	}

	public isDown(key: string): boolean {
		if (this.#event.key === key) {
			return true;
		}

		return false;
	}
}
