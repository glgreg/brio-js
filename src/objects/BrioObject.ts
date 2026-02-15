import { BrioSprite } from "../assets/BrioSprite";
import BrioTransform from "../base/BrioTransform";
import { BrioCollision } from "../math/BrioCollision";
import { Vec2 } from "../math/index";
import { create } from "../math/vec2";

export type KeyActions = {
    [key: string]: () => void;
};

export interface CollisionType {
    enabled: boolean;
    colliderType: CollisionColliderType;
    shape: CollisionShapeType;
    pos: Vec2;
    size: Vec2;
}
export type CollisionColliderType = "solid" | "intangible";
export type CollisionShapeType = "square" | "circle" | "rectangle";

export class BrioObject {
    // Basic properites
    #transform: BrioTransform = new BrioTransform(create(0, 0), create(0, 0));
    /** The name of the game object */
    #name: string;
    /** The sprite attached to the game object */
    #sprite: BrioSprite["name"];
    /** The layer level the object is located */

    // Cloning and identification logic
    /** Used to check if the object is the original object or a instance of itself  */
    public static instanceOfObject: boolean = false;
    /** An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
    public instanceId: number;
    /** The number of instantiated clones of this object (clones can also be cloned) */
    #clonesInstantiatedValue: number = 0;
    /** An empty instance for singleton logic */ // todo: remove this
    static #emptyInstance?: BrioObject;

    // COLLISION LOGIC
    /** An object that contains collision properties of the game object, such as shape, position and size */
    public collision?: CollisionType;

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
    constructor(name: string, sprite: BrioSprite["name"], layer: number) {
        // Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the same game object)
        if (/-[0-9]+$/.test(name) && !BrioObject.instanceOfObject) {
            throw new Error(
                "Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)",
            );
        }

        this.#name = name;
        // clones the Sprite so that more than one game object can have the same one
        this.#sprite = sprite;
        this.transform.layer = Math.round(Math.abs(layer));
        this.instanceId = 0;
    }

    /**
     * GETTER AND SETTERS ---------------------------------------------------------------
     */

    public get transform() {
        return this.#transform;
    }

    /** Returns the attached Sprite used in the game object
     */
    public get sprite(): string {
        return this.#sprite;
    }
    /** Returns the attached Sprite used in the game object
     */
    public set sprite(newSprite) {
        this.#sprite = newSprite;
    }

    /** Returns the name of the game object */
    public get name() {
        return this.#name;
    }

    public set clonesInstantiatedValue(value: number) {
        if (!BrioObject.instanceOfObject) {
            throw new Error(
                "The number of clones can't be hard coded, their amount increases automatically when new instances are created.",
            );
        }

        this.#clonesInstantiatedValue += value;
    }
    public get clonesInstantiatedValue() {
        return this.#clonesInstantiatedValue;
    }

    /**
     * METHODS --------------------------------------------------------------------------
     */

    public addCollisionMask(
        shape: CollisionShapeType = "square",
        collisionType: CollisionColliderType = "solid",
        px: number,
        py: number,
        sw: number,
        sh: number,
    ) {
        if (this.collision) {
            return;
        }

        this.collision = {
            enabled: true,
            shape: shape,
            colliderType: collisionType,
            pos: { x: px, y: py },
            size: { x: sw, y: sh },
        };
    }

    static getEmptyInstance(): BrioObject {
        if (!this.#emptyInstance) {
            const instance = new BrioObject("", "", 1);

            this.#emptyInstance = instance;
        }

        return this.#emptyInstance;
    }

    public static clone(gameObject: BrioObject) {
        const object = new BrioObject(
            gameObject.#name,
            gameObject.#sprite,
            gameObject.transform.layer,
        );

        if (object.collision) {
            switch (object.collision.shape) {
                case "square":
                    BrioCollision.addSquare({
                        object: object,
                        colliderType: "solid",
                        pos: object.collision.pos,
                        size: object.collision.size.x,
                    });
                    break;
                case "rectangle":
                    BrioCollision.addRectangle({
                        object: object,
                        colliderType: "solid",
                        pos: object.collision.pos,
                        size: object.collision.size,
                    });
                    break;
                case "circle":
                    BrioCollision.addCircle({
                        object: object,
                        colliderType: "solid",
                        pos: object.collision.pos,
                        size: object.collision.size.x,
                    });
                    break;
            }
        }

        return object;
    }
}
