export type LoggerLogType = {
	id: number;
	title: string;
	message: string;
};

export const errors: LoggerLogType[] = [
	{
		id: 0,
		title: "COULDN'T APPEND CANVAS TO ELEMENT",
		message:
			"A Game object needs a working HTMLElement in order to work. Try 'new Game(600, 400, document.body)'",
	},
	{
		id: 1,
		title: "COULDN'T APPEND CANVAS TO ELEMENT",
		message:
			"A Game object needs a working HTMLElement in order to work. Try 'new Game(600, 400, document.body)'",
	},
];

export const exceptions: LoggerLogType[] = [
	{
		id: 0,
		title: "NEGATIVE VALUES FOUND",
		message:
			"A negative value was given in a place where it shouldn't. By default, the value was turned into an absolute of itself",
	},
];
