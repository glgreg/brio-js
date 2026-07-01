// #region TYPES-INTERFACES
// #endregion TYPES-INTERFACES
export function create(x = 0, y = 0) {
    return { x: x, y: y };
}
export function multiply(out, a, b) {
    out.x = a.x * b.x;
    out.y = a.y * b.y;
    return out;
}
export function add(out, a, b) {
    out.x = a.x + b.x;
    out.y = a.y + b.y;
    return out;
}
// TODO: Check this one
export function normalize(out, v) {
    const magnitude = Math.sqrt(out.x * out.x + out.y * out.y);
    if (magnitude === 0) {
        out.x = 0;
        out.y = 0;
    }
    else {
        out.x = out.x / magnitude;
        out.y = out.y / magnitude;
    }
    return out;
}
// TODO: Check this one
export function clamp(out, min, max) {
    if (min.x > max.x || min.y > max.y)
        return;
    const minX = Math.min(min.x, max.x);
    const minY = Math.min(min.y, max.y);
    out.x = Math.max(min.x, Math.min(max.x, out.x));
    out.y = Math.max(min.y, Math.min(max.y, out.y));
    return out;
}
// TODO: Check this one
export function distanceTo(out, target) {
    out.x = Math.abs(target.x - out.x);
    out.y = Math.abs(target.y - out.y);
    return out;
}
// Vec2 self mutating functions
// #region VEC2-SELF
export function multiplySelf(self, v) {
    return multiply(self, self, v);
}
export function addSelf(self, v) {
    return add(self, self, v);
}
export function normalizeSelf(self) {
    const magnitude = Math.sqrt(self.x * self.x + self.y * self.y);
    if (magnitude === 0) {
        self.x = 0;
        self.y = 0;
    }
    else {
        self.x = self.x / magnitude;
        self.y = self.y / magnitude;
    }
    return self;
}
// #endregion VEC2-SELF
