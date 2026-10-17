import { BrioObject, BrioCollision } from "../../dist/index.js";

/**
 * Hazard entity extending BrioObject for spikes and environmental damage.
 */
export class Hazard extends BrioObject {
    /** @type {number} */
    damage = 1;

    /**
     * @param {string} name
     * @param {string} sprite
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} [damage=1]
     */
    constructor(name, sprite, x, y, width = 16, height = 16, damage = 1) {
        super(name, sprite, 2);
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = width;
        this.transform.size.y = height;
        this.damage = damage;

        BrioCollision.addRectangle({
            object: this,
            colliderType: "intangible",
            pos: { x: 2, y: 4 },
            size: { x: width - 4, y: height - 4 },
        });
    }
}
