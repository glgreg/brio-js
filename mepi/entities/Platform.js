import { BrioObject, BrioCollision } from "../../dist/index.js";

/**
 * Platform entity extending BrioObject for solid ground, floating tiles, and moving platforms.
 */
export class Platform extends BrioObject {
    /** @type {boolean} */
    isMoving = false;
    /** @type {number} */
    moveSpeed = 40;
    /** @type {number} */
    moveRange = 80;
    /** @type {number} */
    startX = 0;
    /** @type {number} */
    startY = 0;
    /** @type {"x" | "y"} */
    moveAxis = "x";
    /** @type {number} */
    moveDirection = 1;
    /** @type {number} */
    deltaX = 0;
    /** @type {number} */
    deltaY = 0;

    /**
     * @param {string} name
     * @param {string} sprite
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {boolean} [isMoving=false]
     * @param {number} [moveRange=80]
     * @param {number} [moveSpeed=40]
     * @param {"x" | "y"} [moveAxis="x"]
     */
    constructor(
        name,
        sprite,
        x,
        y,
        width,
        height,
        isMoving = false,
        moveRange = 80,
        moveSpeed = 40,
        moveAxis = "x",
    ) {
        super(name, sprite, 2);
        this.transform.position.x = x;
        this.transform.position.y = y;
        this.transform.size.x = width;
        this.transform.size.y = height;

        this.startX = x;
        this.startY = y;
        this.isMoving = isMoving;
        this.moveRange = moveRange;
        this.moveSpeed = moveSpeed;
        this.moveAxis = moveAxis;

        BrioCollision.addRectangle({
            object: this,
            colliderType: "solid",
            pos: { x: 0, y: 0 },
            size: { x: width, y: height },
        });
    }

    /**
     * Updates moving platform coordinates.
     * @param {number} dt
     */
    update(dt) {
        if (!this.isMoving) {
            this.deltaX = 0;
            this.deltaY = 0;
            return;
        }

        if (this.moveAxis === "x") {
            const movement = this.moveDirection * this.moveSpeed * dt;
            this.transform.position.x += movement;
            this.deltaX = movement;
            this.deltaY = 0;

            if (this.transform.position.x > this.startX + this.moveRange) {
                this.transform.position.x = this.startX + this.moveRange;
                this.moveDirection = -1;
            } else if (this.transform.position.x < this.startX - this.moveRange) {
                this.transform.position.x = this.startX - this.moveRange;
                this.moveDirection = 1;
            }
        } else {
            const movement = this.moveDirection * this.moveSpeed * dt;
            this.transform.position.y += movement;
            this.deltaX = 0;
            this.deltaY = movement;

            if (this.transform.position.y > this.startY + this.moveRange) {
                this.transform.position.y = this.startY + this.moveRange;
                this.moveDirection = -1;
            } else if (this.transform.position.y < this.startY - this.moveRange) {
                this.transform.position.y = this.startY - this.moveRange;
                this.moveDirection = 1;
            }
        }
    }
}
