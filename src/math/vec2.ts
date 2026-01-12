// #region TYPES-INTERFACES

export interface Vec2 {
    x: number;
    y: number;
}

export interface Vec2Bool {
    x: boolean;
    y: boolean;
}

// #endregion TYPES-INTERFACES

export function create(x: number = 0, y: number = 0): Vec2 {
    return { x: x, y: y };
}

export function multiply(out: Vec2, a: Readonly<Vec2>, b: Readonly<Vec2>) {
    out.x = a.x * b.x;
    out.y = a.y * b.y;
    return out;
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
}

// TODO: Check this one
export function normalize(out: Vec2, v: Vec2): Vec2 {
    const magnitude = Math.sqrt(out.x * out.x + out.y * out.y);

    if (magnitude === 0) {
        out.x = 0;
        out.y = 0;
    } else {
        out.x = out.x / magnitude;
        out.y = out.y / magnitude;
    }
    return out;
}

// TODO: Check this one
export function clamp(out: Vec2, min: Vec2, max: Vec2) {
    if (min.x > max.x || min.y > max.y) return;

    const minX = Math.min(min.x, max.x);
    const minY = Math.min(min.y, max.y);

    out.x = Math.max(min.x, Math.min(max.x, out.x));
    out.y = Math.max(min.y, Math.min(max.y, out.y));
    return out;
}

// TODO: Check this one
export function distanceTo(out: Vec2, target: Vec2) {
    out.x = Math.abs(target.x - out.x);
    out.y = Math.abs(target.y - out.y);
    return out;
}

// Vec2 self mutating functions
// #region VEC2-SELF

export function multiplySelf(self: Vec2, v: Vec2) {
    return multiply(self, self, v);
}

export function addSelf(self: Vec2, v: Vec2) {
    return add(self, self, v);
}

export function normalizeSelf(self: Vec2): Vec2 {
    const magnitude = Math.sqrt(self.x * self.x + self.y * self.y);

    if (magnitude === 0) {
        self.x = 0;
        self.y = 0;
    } else {
        self.x = self.x / magnitude;
        self.y = self.y / magnitude;
    }
    return self;
}

// #endregion VEC2-SELF
