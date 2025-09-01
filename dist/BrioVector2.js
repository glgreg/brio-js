import { BrioLogger } from "./logging/BrioLogger.js";
export class BrioVector2 {
    x;
    y;
    /**
     * @param {number} x
     * @param {number} y
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
    normalize() {
        const magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
        if (magnitude === 0) {
            this.x = 0;
            this.y = 0;
        }
        else {
            this.x = this.x / magnitude;
            this.y = this.y / magnitude;
        }
        return this;
    }
    clamp(min, max) {
        if (min.x > max.x || min.y > max.y) {
            throw BrioLogger.fatalError(`Vector2 Min is greater than Max:\nmin(${min.x}, ${min.y})\nmax(${max.x}, ${max.y})`);
        }
        this.x = Math.max(min.x, Math.min(max.x, this.x));
        this.y = Math.max(min.x, Math.min(max.y, this.y));
        return this;
    }
    distanceTo(target) {
        this.x = Math.abs(target.x - this.x);
        this.y = Math.abs(target.y - this.y);
        return this;
    }
}
