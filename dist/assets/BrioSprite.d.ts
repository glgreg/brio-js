import { Vector2 } from "../BrioVector2.js";
interface Vector2Bool {
    x: boolean;
    y: boolean;
}
export interface SpriteManipulation {
    size: Vector2;
    pos: Vector2;
    rotate: number;
    scale: number;
    skew: Vector2;
    flip: Vector2Bool;
}
export type SpriteType = "img" | "svg";
export interface SpriteProperties {
    /** A name for the sprite object */
    name: string;
    /** The source URI for the targeted image */
    src: string;
    /** A Vec2 of a Sprite position */
    pos: Vector2;
    /** A Vec2 of a Sprite size */
    size: Vector2;
    /** The type of the image (img | svg */
    type: SpriteType;
}
export declare class BrioSprite implements SpriteProperties, SpriteManipulation {
    #private;
    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(props: SpriteProperties);
    /**
     * GETTERS AND SETTERS -------------------------------------------------------------
     */
    /**
     * Returns the element of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.element); // <img src="./spr_player.png">
     */
    get element(): HTMLImageElement;
    /**
     * Returns the name of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.name); // "spr_player"
     */
    get name(): string;
    /**
     * Returns the source URL of the GameSprite object
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * console.log(player.src); // "./spr_player.png"
     */
    get src(): string;
    get size(): {
        x: number;
        y: number;
    };
    get pos(): {
        x: number;
        y: number;
    };
    get scale(): number;
    set scale(value: number);
    get type(): SpriteType;
    set rotate(value: number);
    get rotate(): number;
    get skew(): {
        x: number;
        y: number;
    };
    /**
     * Flips the Sprite in the x or y axis
     * @example const player = new GLS.GameSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    get flip(): {
        x: boolean;
        y: boolean;
    };
    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    set src(value: string);
    static getEmptyInstance(): BrioSprite;
    static clone(targetGameSprite: BrioSprite): BrioSprite;
}
export {};
//# sourceMappingURL=BrioSprite.d.ts.map
