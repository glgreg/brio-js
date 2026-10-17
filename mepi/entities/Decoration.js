import { BrioObject } from "../../dist/index.js";

/**
 * Scenery decoration entity extending BrioObject for grass tufts, flowers, and props.
 */
export class Decoration extends BrioObject {
    /**
     * @param {string} name
     * @param {string} sprite
     * @param {number} x
     * @param {number} y
     * @param {number} [width=16]
     * @param {number} [height=16]
     * @param {number} [layer=1]
     */
    constructor(name, sprite, x, y, width = 16, height = 16, layer = 1) {
        super(name, sprite, layer);
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = width;
        this.transform.size.y = height;
    }
}
