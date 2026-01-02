import { BrioSprite, SpriteManipulation } from "./assets/BrioSprite.js";
import { Vector2 } from "./BrioVector2.js";
export type KeyActions = {
    [key: string]: () => void;
};
export interface CollisionType {
    enabled: boolean;
    colliderType: CollisionColliderType;
    shape: CollisionShapeType;
    pos: Vector2;
    size: Vector2;
}
export type CollisionColliderType = "solid" | "intangible";
export type CollisionShapeType = "square" | "circle" | "rectangle";
export declare class BrioObject implements SpriteManipulation {
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
    get flip(): {
        x: boolean;
        y: boolean;
    };
    get skew(): {
        x: number;
        y: number;
    };
    set scale(value: number);
    get scale(): number;
    set rotate(value: number);
    get rotate(): number;
    set layer(layerLevel: number);
    get layer(): number;
    /** Returns the attached Sprite used in the game object
     */
    get sprite(): BrioSprite;
    /** Returns the attached Sprite used in the game object
     */
    set sprite(newSprite: BrioSprite);
    /** Sets and returns the size of the game object Width and Height
     * @example const player = new BrioObject("player", spr_player);
     * player.size.w = 128;
     * player.size.h = 128;
     * console.log(player.size.w, player.size.h); // 128, 128 (attention: it will be multiplied by the game "scale" property)
     */
    get size(): Vector2;
    /** Returns the name of the game object */
    get name(): string;
    /** Sets and returns the position of the game object in the X and Y axis
     * @example const player = new BrioObject("player", spr_player);
     * player.pos.x = 0;
     * player.pos.y = 0;
     * console.log(player.pos.x, player.pos.y); // 0, 0
     */
    get pos(): Vector2;
    set clonesInstantiatedValue(value: number);
    get clonesInstantiatedValue(): number;
    /**
     * METHODS --------------------------------------------------------------------------
     */
    addCollisionMask(shape: CollisionShapeType | undefined, collisionType: CollisionColliderType | undefined, px: number, py: number, sw: number, sh: number): void;
    static getEmptyInstance(): BrioObject;
    static clone(gameObject: BrioObject): BrioObject;
}
//# sourceMappingURL=BrioObject.d.ts.map
