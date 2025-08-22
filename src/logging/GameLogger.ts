import { errors, exceptions, LoggerLogType } from "./game_logs";

export class GameLogger {
	static #storedErrors?: Set<number>;
	static #storedExceptions?: Set<number>;
	static #errors: LoggerLogType[] = errors;
	static #exceptions: LoggerLogType[] = exceptions;
	static logsEnabled: boolean = false;
	static logsCallerEnabled: boolean = false;
	static logsCallerClassesEnabled: boolean = false;

	public static get callerInfo() {
		const error = new Error();

		if (!error.stack) return;

		const pattern = /([a-zA-Z0-9_\-]+\.js:\d+:\d+|[a-zA-Z0-9_\-]+\.ts:\d+:\d+)/gm;
		const match = error.stack.match(pattern);

		if (!match) return;

		const filtered = match.filter(
			(path) =>
				!(
					path.startsWith("GameLogger") ||
					(!this.logsCallerClassesEnabled && path.startsWith("Game"))
				),
		);
		const singlefied = new Set(filtered);
		const result = Array.from(singlefied)
			.sort()
			.reverse()
			.reduce((prev, next) => prev + "\n" + next);

		return `\n\n${result}`;
	}

	public static out(type: "log" | "warn" | "info" | "error", message: string) {
		if (!this.logsEnabled) return;

		let finalMessage = message;

		if (this.logsCallerEnabled) finalMessage += this.callerInfo;

		switch (type) {
			case "log":
				console.log(finalMessage);
				break;
			case "info":
				console.info(finalMessage);
				break;
			case "warn":
				console.warn(finalMessage);
				break;
			case "error":
				console.error(finalMessage);
				break;
			default:
				throw new Error(`Incorrect logging type: ${type} ${this.callerInfo}`);
				break;
		}
	}

	public static fatalError(message: string) {
		return new Error(`${message} ${this.callerInfo}`);
	}

	public static setErrorsStore(errorsSet: Set<number>) {
		if (this.#storedErrors) return;
		this.#storedErrors = errorsSet;
	}

	public static setExceptionsStore(exceptionsSet: Set<number>) {
		if (this.#storedExceptions) return;
		this.#storedExceptions = exceptionsSet;
	}

	public static error(errorId: number) {
		if (!this.logsEnabled) return;
		if (!this.#errors || !this.#storedErrors || this.#storedErrors.has(errorId)) return;

		let isFound = false;

		for (const err of this.#errors) {
			if (err.id === errorId) {
				this.out("error", `${err.title}\n\n${err.message}\n\nError id: ${err.id}`);
				this.#storedErrors.add(errorId);
				isFound = true;
				break;
			}
		}

		if (isFound) return;

		this.out("error", `Error id ${errorId} not found.`);
	}

	public static exception(exceptionId: number) {
		if (!this.logsEnabled) return;
		if (!this.#exceptions || !this.#storedExceptions || this.#storedExceptions.has(exceptionId))
			return;

		let isFound = false;

		for (const ex of this.#exceptions) {
			if (ex.id === exceptionId) {
				this.out("warn", `${ex.title}\n\n${ex.message}\n\nException id: ${ex.id}`);
				this.#storedExceptions.add(exceptionId);
				isFound = true;
				break;
			}
		}

		if (isFound) true;
		this.out("warn", `Exception id ${exceptionId} not found.`);
	}
}
