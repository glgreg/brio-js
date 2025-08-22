export class BaseEvent {
	#state: Map<string, boolean>;

	constructor(stateMap: Map<string, boolean>) {
		this.#state = stateMap;
	}
}
