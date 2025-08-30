export class BrioVector2 {
    x;
    y;
    /**
     * @property {number} x
     * @property {number} y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    /**
     * Returns a normalized version of this vector
     * @example const vec2 = new BrioVector2(10, 10);
     *
     * @returns {Vector2}
     */
    get normalized() {
        const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
        if (magnitude === 0)
            return { x: 0, y: 0 };
        return { x: this.x / magnitude, y: this.y / magnitude };
    }
}
