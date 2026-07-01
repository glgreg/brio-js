import { Vec2 } from "../math/index.js";
export type SpriteType = "img" | "svg";
export interface SpriteProperties {
    /** A name for the sprite object */
    name: string;
    /** The source URI for the targeted image */
    src: string;
    /** A Vec2 of a Sprite size */
    size: Vec2;
    /** The type of the image (img | svg */
    type: SpriteType;
}
export declare class BrioSprite {
    #private;
    /**
     * @example game.preload(() => {
     * const spr_player = new GameSprite("spr_player", "./sprites/player.png", 0, 0, 32, 32);
     * return [spr_player]; // now the "spr_player" GameSprite can be used in the 'load' step
     * });
     */
    constructor(name: string, src: string);
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
    set size(size: Vec2);
    get size(): Vec2;
    /**
     * Set the source URL of the GameSprite object
     * @example const player = new BrioSprite("spr_player", "./spr_player.png");
     * player.src = "./spr_player_jump.png";
     */
    set src(value: string);
    get isClone(): boolean;
    static getEmptyInstance(): BrioSprite;
    static clone(targetGameSprite: BrioSprite): BrioSprite;
}
//# sourceMappingURL=BrioSprite.d.ts.map
