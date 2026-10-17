import { BrioObject } from "../../dist/index.js";

/**
 * Base Entity class for living or dynamic game objects, extending BrioObject.
 */
export class Entity extends BrioObject {
    /** @type {number} */
    #health;
    /** @type {number} */
    #maxHealth;
    /** @type {boolean} */
    #isDead = false;

    /** @type {{ x: number, y: number }} */
    velocity = { x: 0, y: 0 };
    /** @type {boolean} */
    isGrounded = false;
    /** @type {number} */
    invulnerableTimer = 0;
    /** @type {string} */
    state = "idle";

    /**
     * @param {string} name Object identifier
     * @param {string} sprite Name of preloaded BrioSprite
     * @param {number} layer Rendering layer
     * @param {number} health Initial health points
     */
    constructor(name, sprite, layer, health = 3) {
        super(name, sprite, layer);
        this.#health = health;
        this.#maxHealth = health;
    }

    /**
     * @returns {number}
     */
    get health() {
        return this.#health;
    }

    /**
     * @param {number} value
     */
    set health(value) {
        this.#health = Math.max(0, Math.min(value, this.#maxHealth));
        if (this.#health <= 0) {
            this.#isDead = true;
        }
    }

    /**
     * @returns {number}
     */
    get maxHealth() {
        return this.#maxHealth;
    }

    /**
     * @returns {boolean}
     */
    get isDead() {
        return this.#isDead;
    }

    /**
     * @param {boolean} value
     */
    set isDead(value) {
        this.#isDead = value;
    }

    /**
     * Reduces entity health and triggers invulnerability period if applicable.
     * @param {number} amount
     * @returns {boolean} True if damage was applied, false if entity was invulnerable or dead.
     */
    takeDamage(amount = 1) {
        if (this.#isDead || this.invulnerableTimer > 0) {
            return false;
        }

        this.health -= amount;
        this.invulnerableTimer = 1.0;
        return true;
    }

    /**
     * Restores entity health up to maxHealth.
     * @param {number} amount
     */
    heal(amount = 1) {
        if (this.#isDead) return;
        this.health = Math.min(this.#maxHealth, this.#health + amount);
    }
}
