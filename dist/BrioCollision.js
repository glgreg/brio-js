export class GameCollision {
    static isColliding(game, obj1, obj2) {
        if (!obj1.collision || !obj2.collision)
            return false;
        switch (obj1.collision.shape && obj2.collision.shape) {
            case "square":
                // obj2.collision.pos.x - obj1.collision.pos.x < (obj1.size.x + obj2.size.x) / 2 &&
                // obj2.collision.pos.y - obj1.collision.pos.y < (obj1.size.y + obj2.size.y) / 2
                const rect1 = {
                    x: obj1.pos.x + obj1.collision.pos.x,
                    y: obj1.pos.y + obj1.collision.pos.y,
                    w: obj1.collision.size.x,
                    h: obj1.collision.size.y,
                };
                const rect2 = {
                    x: obj2.pos.x + obj2.collision.pos.x,
                    y: obj2.pos.y + obj2.collision.pos.y,
                    w: obj2.collision.size.x,
                    h: obj2.collision.size.y,
                };
                return !(rect1.x + rect1.w <= rect2.x ||
                    rect2.x + rect2.w <= rect1.x ||
                    rect1.y + rect1.h <= rect2.y ||
                    rect2.y + rect2.h <= rect1.y);
                break;
            default:
                return false;
        }
    }
    static addSquare(configurationObject) {
        const config = configurationObject;
        if (config.object.collision)
            return;
        config.object.collision = {
            enabled: true,
            shape: "square",
            colliderType: config.colliderType,
            pos: config.pos,
            size: { x: config.size, y: config.size },
        };
    }
    static addRectangle(configurationObject) {
        const config = configurationObject;
        if (config.object.collision)
            return;
        config.object.collision = {
            enabled: true,
            shape: "rectangle",
            colliderType: config.collisionType,
            pos: config.pos,
            size: config.size,
        };
    }
    static addCircle(object) { }
}
