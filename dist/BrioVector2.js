export class BrioVector2 {
    x;
    y;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    /**
     * A functions that receives a Vector2 and returns a normalized Vector2
     * @param {Vector2} vec2
     * @returns {Vector2}
     */
    get normalized() {
        const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
        if (magnitude === 0)
            return { x: 0, y: 0 };
        return { x: this.x / magnitude, y: this.y / magnitude };
    }
}
