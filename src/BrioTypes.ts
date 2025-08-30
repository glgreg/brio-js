export interface Vector2 {
	x: number;
	y: number;
}

export interface BaseObject {
	name: string;
	getEmptyInstance(): this;
}
