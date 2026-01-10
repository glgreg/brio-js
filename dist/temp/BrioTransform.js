export default class BrioTransform {
    #position;
    #size;
    #rotation = 0;
    #scale = { x: 1, y: 1 };
    #pivot = { x: 0.5, y: 0.5 };
    #skew = { x: 0, y: 0 };
    #flip = { x: false, y: false };
    constructor(position, size) {
        this.#position = position;
        this.#size = size;
    }
    get position() {
        const self = this;
        return {
            get x() {
                return self.#position.x;
            },
            set x(value) {
                self.#position.x = Number(value.toFixed(2));
            },
            get y() {
                return self.#position.y;
            },
            set y(value) {
                self.#position.y = Number(value.toFixed(2));
            },
        };
    }
    get size() {
        const self = this;
        return {
            get x() {
                return self.#size.x;
            },
            set x(value) {
                self.#flipSprite("x", value);
                self.#size.x = Math.abs(value);
            },
            get y() {
                return self.#size.y;
            },
            set y(value) {
                self.#flipSprite("y", value);
                self.#size.y = Math.abs(value);
            },
        };
    }
    set rotation(degree) {
        this.#rotation = degree * (Math.PI / 180);
    }
    get rotation() {
        return this.#rotation;
    }
    get scale() {
        const self = this;
        return {
            set x(scaleX) {
                const naturalX = Math.abs(scaleX);
                self.#size.x *= naturalX;
                self.#scale.x = naturalX;
            },
            get x() {
                return self.#scale.x;
            },
            set y(scaleY) {
                const naturalY = Math.abs(scaleY);
                self.#size.y *= naturalY;
                self.#scale.y = naturalY;
            },
            get y() {
                return self.#scale.y;
            },
        };
    }
    get flip() {
        const self = this;
        return {
            set x(flipX) {
                self.#flip.x = flipX;
            },
            get x() {
                return self.#flip.x;
            },
            set y(flipY) {
                self.#flip.y = flipY;
            },
            get y() {
                return self.#flip.y;
            },
        };
    }
    get skew() {
        const self = this;
        return {
            get x() {
                return self.#skew.x;
            },
            set x(value) {
                self.#skew.x = value;
            },
            get y() {
                return self.#skew.y;
            },
            set y(value) {
                self.#skew.y = value;
            },
        };
    }
    get pivot() {
        const self = this;
        return {
            set x(pivotX) {
                const normalX = Math.min(Math.abs(pivotX), 1);
                self.#pivot.x = normalX;
            },
            get x() {
                return self.#pivot.x;
            },
            set y(pivotY) {
                const normalY = Math.min(Math.abs(pivotY), 1);
                self.#pivot.y = normalY;
            },
            get y() {
                return self.#pivot.y;
            },
        };
    }
    #flipSprite(axis, value) {
        switch (axis) {
            case "x":
                if (value < 0 && this.#flip.x === false)
                    this.#flip.x = true;
                else
                    this.#flip.x = false;
                break;
            case "y":
                if (value < 0 && this.#flip.y === false)
                    this.#flip.y = true;
                else
                    this.#flip.y = false;
                break;
        }
    }
}
