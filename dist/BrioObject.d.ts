import { BrioSprite } from "../assets/BrioSprite.js";
import { Vector2 } from "../BrioVector2.js";
export type KeyActions = {
	[key: string]: () => void;
};
export interface CollisionType {
	enabled: boolean;
	colliderType: CollisionColliderType;
	shape: CollisionShapeType;
	pos: Vector2<number>;
	size: Vector2<number>;
}
export type CollisionColliderType = "solid" | "intangible";
export type CollisionShapeType = "square" | "circle" | "rectangle";
export declare class BrioObject {
	#private;
	/** Used to check if the object is the original object or a instance of itself  */
	static instanceOfObject: boolean;
	/** An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
	instanceId: number;
	/** An object that contains collision properties of the game object, such as shape, position and size */
	collision?: CollisionType;
	/**
	 * @param name The name of the game object
	 * @param sprite The Sprite that will be attached to the game object
	 * @example game.load((assets) => {
	 *
	 * const spr_player = assets.preloaded("spr_player");
	 * const player = new BrioObject("player", spr_player);
	 * return [player]; // now the "player" BrioObject can be used in the 'update' step
	 * });
	 */
	constructor(name: string, sprite: BrioSprite, layer: number);
	/**
	 * GETTER AND SETTERS ---------------------------------------------------------------
	 */
	get transform(): import("./base/BrioTransform.js").default;
	set layer(layerLevel: number);
	get layer(): number;
	/** Returns the attached Sprite used in the game object
	 */
	get sprite(): BrioSprite;
	/** Returns the attached Sprite used in the game object
	 */
	set sprite(newSprite: BrioSprite);
	/** Returns the name of the game object */
	get name(): string;
	set clonesInstantiatedValue(value: number);
	get clonesInstantiatedValue(): number;
	/**
	 * METHODS --------------------------------------------------------------------------
	 */
	addCollisionMask(
		shape: CollisionShapeType | undefined,
		collisionType: CollisionColliderType | undefined,
		px: number,
		py: number,
		sw: number,
		sh: number,
	): void;
	static getEmptyInstance(): BrioObject;
	static clone(gameObject: BrioObject): BrioObject;
}
//# sourceMappingURL=BrioObject.d.ts.map
