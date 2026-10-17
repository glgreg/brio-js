import { BrioObject, BrioCollision } from "../../dist/index.js";

/**
 * Collectible entity extending BrioObject for coins and score/healing fruits.
 */
export class Collectible extends BrioObject {
    /** @type {"coin" | "fruit"} */
    type = "coin";
    /** @type {string} */
    fruitName = "";
    /** @type {number} */
    value = 100;
    /** @type {number} */
    heals = 0;
    /** @type {number} */
    animTimer = 0;
    /** @type {number} */
    animFrame = 0;
    /** @type {boolean} */
    isCollected = false;
    /** @type {number} */
    collectEffectTimer = 0;

    /**
     * @param {string} name
     * @param {"coin" | "fruit"} type
     * @param {number} x
     * @param {number} y
     * @param {string} [fruitName="apple"]
     */
    constructor(name, type, x, y, fruitName = "apple") {
        const sprite = type === "coin" ? "spr_coin_0" : `spr_fruit_${fruitName}`;
        super(name, sprite, 3);

        this.type = type;
        this.fruitName = fruitName;
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = 16;
        this.transform.size.y = 16;

        if (type === "coin") {
            this.value = 100;
            this.heals = 0;
        } else {
            this.value = 250;
            this.heals = 1;
        }

        BrioCollision.addRectangle({
            object: this,
            colliderType: "intangible",
            pos: { x: 2, y: 2 },
            size: { x: 12, y: 12 },
        });
    }

    /**
     * Updates collectible animation and collection visual effects.
     * @param {number} dt
     */
    update(dt) {
        if (this.isCollected) {
            this.collectEffectTimer += dt;
            this.transform.position.y -= 30 * dt;
            this.transform.opacity = Math.max(0, 1 - this.collectEffectTimer * 3);
            if (this.collectEffectTimer >= 0.35) {
                this.transform.visibility = false;
            }
            return;
        }

        if (this.type === "coin") {
            this.animTimer += dt;
            if (this.animTimer >= 0.08) {
                this.animTimer = 0;
                this.animFrame = (this.animFrame + 1) % 12;
                this.sprite = `spr_coin_${this.animFrame}`;
            }
        }
    }

    /**
     * Triggers item collection.
     * @param {import("../../dist/assets/BrioAudio.js").BrioAudio} [coinAudio]
     * @param {import("../../dist/assets/BrioAudio.js").BrioAudio} [powerupAudio]
     * @returns {{ value: number, heals: number, isCoin: boolean }}
     */
    collect(coinAudio, powerupAudio) {
        if (this.isCollected) {
            return { value: 0, heals: 0, isCoin: false };
        }

        this.isCollected = true;
        this.collectEffectTimer = 0;

        if (this.collision) {
            this.collision.enabled = false;
        }

        if (this.type === "coin") {
            if (coinAudio) coinAudio.play();
        } else {
            if (powerupAudio) powerupAudio.play();
        }

        return {
            value: this.value,
            heals: this.heals,
            isCoin: this.type === "coin",
        };
    }
}
