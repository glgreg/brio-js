import { GameSprite } from "./asset/GameSprite.js";
import { GameCollision } from "./GameCollision.js";
import { BrioLogger } from "./logging/BrioLogger.js";
export class GameObject {
    // Basic properites
    /** @type {string} The name of the game object */
    #name;
    /** @type {Sprite} The sprite attached to the game object */
    #sprite;
    /** @type {number} The layer level the object is located */
    #layer;
    // Cloning and identification logic
    /** @type {boolean} Used to check if the object is the original object or a instance of itself  */
    static instanceOfObject = false;
    /** @type {string} An instance ID used when a game object is a instance of the same game object, defaults to 0 if it's the original object */
    instanceId;
    /** @type {number} The number of instantiated clones of this object (clones can also be cloned) */
    #clonesInstantiated = 0;
    /** @type {GameObject} */
    static #emptyInstance;
    // COLLISION LOGIC
    /** @type {import("./../src/GameObject.ts").CollisionType} An object that contains collision properties of the game object, such as shape, position and size */
    collision;
    /**
     * @param {string} name The name of the game object
     * @param {Sprite} sprite The Sprite that will be attached to the game object
     * @example game.load((assets) => {
     *
     * const spr_player = assets.preloaded("spr_player");
     * const player = new GameObject("player", spr_player);
     * return [player]; // now the "player" GameObject can be used in the 'update' step
     * });
     */
    constructor(name, sprite, layer) {
        // Checks if the given name have -[0-9] at the end (so it doesn't conflict with instances of the same game object)
        if (/-[0-9]+$/.test(name) && !GameObject.instanceOfObject) {
            throw new Error("Game objects can't end with '-number', try using underline instead (bot-5 -> bot_5)");
        }
        this.#name = name;
        // clones the Sprite so that more than one game object can have the same one
        this.#sprite = GameSprite.clone(sprite);
        this.#layer = Math.round(Math.abs(layer));
        this.instanceId = 0;
    }
    /**
     * GETTER AND SETTERS ---------------------------------------------------------------
     */
    get flip() {
        const self = this;
        return {
            set x(value) {
                self.#sprite.flip.x = value;
            },
            get x() {
                return self.#sprite.flip.x;
            },
            set y(value) {
                self.#sprite.flip.y = value;
            },
            get y() {
                return self.#sprite.flip.y;
            },
        };
    }
    get skew() {
        const self = this;
        return {
            set x(value) {
                self.#sprite.skew.x = value;
            },
            get x() {
                return self.#sprite.skew.x;
            },
            set y(value) {
                self.#sprite.skew.y = value;
            },
            get y() {
                return self.#sprite.skew.y;
            },
        };
    }
    set scale(value) {
        this.#sprite.scale = value;
    }
    get scale() {
        return this.#sprite.scale;
    }
    set rotate(value) {
        this.#sprite.rotate = value;
    }
    get rotate() {
        return this.#sprite.rotate;
    }
    set layer(layerLevel) {
        layerLevel = Math.round(Math.abs(layerLevel));
        this.#layer = layerLevel;
    }
    get layer() {
        return this.#layer;
    }
    /** Returns the attached Sprite used in the game object
     * @returns {GameSprite}
     */
    get sprite() {
        return this.#sprite;
    }
    /** Sets and returns the size of the game object Width and Height
     * @example const player = new GameObject("player", spr_player);
     * player.size.w = 128;
     * player.size.h = 128;
     * console.log(player.size.w, player.size.h); // 128, 128 (attention: it will be multiplied by the game "scale" property)
     */
    get size() {
        const self = this;
        return {
            get x() {
                return self.#sprite.size.x;
            },
            set x(value) {
                self.#sprite.size.x = value;
            },
            get y() {
                return self.#sprite.size.y;
            },
            set y(value) {
                self.#sprite.size.y = value;
            },
        };
    }
    /** Returns the name of the game object */
    get name() {
        return this.#name;
    }
    /** Sets and returns the position of the game object in the X and Y axis
     * @example const player = new GameObject("player", spr_player);
     * player.pos.x = 0;
     * player.pos.y = 0;
     * console.log(player.pos.x, player.pos.y); // 0, 0
     */
    get pos() {
        const self = this;
        return {
            get x() {
                return self.#sprite.pos.x;
            },
            set x(value) {
                self.#sprite.pos.x = value;
            },
            get y() {
                return self.#sprite.pos.y;
            },
            set y(value) {
                self.#sprite.pos.y = value;
            },
        };
    }
    set clonesInstantiated(value) {
        if (!GameObject.instanceOfObject) {
            throw BrioLogger.fatalError("The number of clones can't be hard coded, their amount increases automatically when new instances are created.");
        }
        this.#clonesInstantiated += value;
    }
    get clonesInstantiated() {
        return this.#clonesInstantiated;
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
            const instance = new GameObject("", GameSprite.getEmptyInstance(), 1);
            this.#emptyInstance = instance;
            return this.#emptyInstance;
        }
        else {
            return this.#emptyInstance;
        }
    }
    static clone(gameObject) {
        const object = new GameObject(gameObject.#name, gameObject.#sprite, gameObject.#layer);
        if (object.collision) {
            GameCollision.addSquare({
                object: object,
                pos: object.collision.pos,
                size: object.collision.size.x,
                colliderType: object.collision.colliderType,
            });
        }
        return object;
    }
}
