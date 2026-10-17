import { BrioCollision } from "../../dist/index.js";
import { Entity } from "./Entity.js";

/**
 * Slime Enemy actor extending Entity.
 */
export class Enemy extends Entity {
    /** @type {"green" | "purple"} */
    enemyType = "green";
    /** @type {number} */
    moveSpeed = 45;
    /** @type {number} */
    direction = 1;
    /** @type {number} */
    patrolMinX = 0;
    /** @type {number} */
    patrolMaxX = 0;
    /** @type {number} */
    animTimer = 0;
    /** @type {number} */
    animFrame = 0;
    /** @type {boolean} */
    isSquished = false;
    /** @type {number} */
    squishTimer = 0;

    /**
     * @param {string} name
     * @param {"green" | "purple"} enemyType
     * @param {number} x
     * @param {number} y
     * @param {number} patrolRange
     */
    constructor(name, enemyType, x, y, patrolRange = 70) {
        const initialSprite =
            enemyType === "green" ? "spr_slime_green_idle_0" : "spr_slime_purple_idle_0";
        super(name, initialSprite, 3, 1);

        this.enemyType = enemyType;
        this.moveSpeed = enemyType === "green" ? 45 : 70;
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = 24;
        this.transform.size.y = 24;

        this.patrolMinX = x - patrolRange;
        this.patrolMaxX = x + patrolRange;

        BrioCollision.addRectangle({
            object: this,
            colliderType: "solid",
            pos: { x: 3, y: 8 },
            size: { x: 18, y: 16 },
        });
    }

    /**
     * Updates enemy patrol movement and animation state.
     * @param {number} dt
     */
    update(dt) {
        if (this.isDead) {
            if (this.isSquished) {
                this.squishTimer += dt;
                const hitPrefix =
                    this.enemyType === "green" ? "spr_slime_green_hit_" : "spr_slime_purple_hit_";
                const hitFrame = Math.min(3, Math.floor(this.squishTimer * 8));
                this.sprite = `${hitPrefix}${hitFrame}`;
                if (this.squishTimer > 0.4) {
                    this.transform.visibility = false;
                }
            }
            return;
        }

        // Patrol movement
        this.transform.position.x += this.direction * this.moveSpeed * dt;
        if (this.transform.position.x > this.patrolMaxX) {
            this.transform.position.x = this.patrolMaxX;
            this.direction = -1;
            this.transform.flip.x = true;
        } else if (this.transform.position.x < this.patrolMinX) {
            this.transform.position.x = this.patrolMinX;
            this.direction = 1;
            this.transform.flip.x = false;
        }

        // Animation
        this.animTimer += dt;
        if (this.animTimer >= 0.16) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
            const idlePrefix =
                this.enemyType === "green" ? "spr_slime_green_idle_" : "spr_slime_purple_idle_";
            this.sprite = `${idlePrefix}${this.animFrame}`;
        }
    }

    /**
     * Triggers enemy defeat by stomp.
     * @param {import("../../dist/assets/BrioAudio.js").BrioAudio} [defeatSound]
     * @returns {number} Score awarded for defeating this enemy
     */
    defeat(defeatSound) {
        if (this.isDead) return 0;

        this.isDead = true;
        this.isSquished = true;
        this.squishTimer = 0;

        if (this.collision) {
            this.collision.enabled = false;
        }

        if (defeatSound) {
            defeatSound.play();
        }

        return this.enemyType === "green" ? 100 : 200;
    }
}
