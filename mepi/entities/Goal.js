import { BrioObject, BrioCollision } from "../../dist/index.js";

/**
 * Goal entity extending BrioObject for level exit gate and victory trigger.
 */
export class Goal extends BrioObject {
    /** @type {boolean} */
    isTriggered = false;

    /**
     * @param {string} name
     * @param {string} sprite
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    constructor(name, sprite, x, y, width = 32, height = 48) {
        super(name, sprite, 2);
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = width;
        this.transform.size.y = height;

        BrioCollision.addRectangle({
            object: this,
            colliderType: "intangible",
            pos: { x: 4, y: 4 },
            size: { x: width - 8, y: height - 4 },
        });
    }

    /**
     * Triggers goal activation.
     * @param {import("../../dist/assets/BrioAudio.js").BrioAudio} [winAudio]
     */
    trigger(winAudio) {
        if (this.isTriggered) return;
        this.isTriggered = true;
        if (winAudio) {
            winAudio.play();
        }
    }
}
