import { BrioSprite } from "./assets/BrioSprite.js";
import { BrioCollision } from "./BrioCollision.js";
import { BrioLogger } from "./debugging/BrioLogger.js";
export class BrioObject {
    // Basic properites
    /** The name of the game object */
    #name;
    /** The sprite attached to the game object */
    #sprite;
    /** The layer level the object is located */
    #layer;
    // Cloning and identification logic
    /** Used to check if the object is the original object or a instance of itself  */
    static instanceOfObject = false;
    /** An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
    instanceId;
    /** The number of instantiated clones of this object (clones can also be cloned) */
    #clonesInstantiatedValue = 0;
    /** An empty instance for singleton logic */ // todo: remove this
    static #emptyInstance;
    // COLLISION LOGIC
    /** An object that contains collision properties of the game object, such as shape, position and size */
    collision;
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
    constructor(name, sprite, layer) {
        // Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the same game object)
        if (/-[0-9]+$/.test(name) && !BrioObject.instanceOfObject) {
            throw new Error("Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)");
        }
        this.#name = name;
        // clones the Sprite so that more than one game object can have the same one
        this.#sprite = BrioSprite.clone(sprite);
        this.#layer = Math.round(Math.abs(layer));
        this.instanceId = 0;
    }
    /**
     * GETTER AND SETTERS ---------------------------------------------------------------
     */
    get transform() {
        return this.#sprite.transform;
    }
    set layer(layerLevel) {
        layerLevel = Math.round(Math.abs(layerLevel));
        this.#layer = layerLevel;
    }
    get layer() {
        return this.#layer;
    }
    /** Returns the attached Sprite used in the game object
     */
    get sprite() {
        return this.#sprite;
    }
    /** Returns the attached Sprite used in the game object
     */
    set sprite(newSprite) {
        this.#sprite = newSprite;
    }
    /** Returns the name of the game object */
    get name() {
        return this.#name;
    }
    set clonesInstantiatedValue(value) {
        if (!BrioObject.instanceOfObject) {
            throw BrioLogger.fatalError("The number of clones can't be hard coded, their amount increases automatically when new instances are created.");
        }
        this.#clonesInstantiatedValue += value;
    }
    get clonesInstantiatedValue() {
        return this.#clonesInstantiatedValue;
    }
    /**
     * METHODS --------------------------------------------------------------------------
     */
    addCollisionMask(shape = "square", collisionType = "solid", px, py, sw, sh) {
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
    static getEmptyInstance() {
        if (this.#emptyInstance === undefined) {
            const instance = new BrioObject("", BrioSprite.getEmptyInstance(), 1);
            this.#emptyInstance = instance;
            return this.#emptyInstance;
        }
        else {
            return this.#emptyInstance;
        }
    }
    static clone(gameObject) {
        const object = new BrioObject(gameObject.#name, gameObject.#sprite, gameObject.#layer);
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
