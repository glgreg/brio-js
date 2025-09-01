export class BrioCollision {
    static isColliding(one, two) {
        if (!one.collision || !two.collision)
            return false;
        const oneShape = one.collision.shape;
        const twoShape = two.collision.shape;
        if (oneShape === "circle" || twoShape === "circle") {
            if (oneShape !== "circle" || twoShape !== "circle") {
                // Posição do círculo (dinâmica) e raio
                const cx = two.pos.x + two.collision.pos.x;
                const cy = two.pos.y + two.collision.pos.y;
                const radius = Math.min(two.collision.size.x, two.collision.size.y) / 2;
                // Limites do quadrado
                const minX = one.pos.x + one.collision.pos.x;
                const maxX = minX + one.collision.size.x;
                const minY = one.pos.y + one.collision.pos.y;
                const maxY = minY + one.collision.size.y;
                // Verificação AABB inicial
                const aabbCircleMinX = cx - radius;
                const aabbCircleMaxX = cx + radius;
                const aabbCircleMinY = cy - radius;
                const aabbCircleMaxY = cy + radius;
                if (aabbCircleMaxX < minX ||
                    aabbCircleMinX > maxX ||
                    aabbCircleMaxY < minY ||
                    aabbCircleMinY > maxY) {
                    return false;
                }
                // Encontrar o ponto mais próximo no quadrado
                const closestX = Math.max(minX, Math.min(cx, maxX));
                const closestY = Math.max(minY, Math.min(cy, maxY));
                // Calcular a distância entre o centro do círculo e o ponto mais próximo
                const dx = cx - closestX;
                const dy = cy - closestY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Colisão ocorre se a distância for menor que o raio
                return distance < radius;
            }
            const oneCenterX = one.pos.x + one.collision.pos.x;
            const oneCenterY = one.pos.y + one.collision.pos.y;
            const twoCenterX = two.pos.x + two.collision.pos.x;
            const twoCenterY = two.pos.y + two.collision.pos.y;
            const oneRadius = Math.min(one.collision.size.x, one.collision.size.y) / 2;
            const twoRadius = Math.min(two.collision.size.x, two.collision.size.y) / 2;
            const oneAabbMinX = oneCenterX - oneRadius;
            const oneAabbMaxX = oneCenterX + oneRadius;
            const oneAabbMinY = oneCenterY - oneRadius;
            const oneAabbMaxY = oneCenterY + oneRadius;
            const twoAabbMinX = twoCenterX - twoRadius;
            const twoAabbMaxX = twoCenterX + twoRadius;
            const twoAabbMinY = twoCenterY - twoRadius;
            const twoAabbMaxY = twoCenterY + twoRadius;
            if (oneAabbMaxX < twoAabbMinX ||
                twoAabbMaxX < oneAabbMinX ||
                oneAabbMaxY < twoAabbMinY ||
                twoAabbMaxY < oneAabbMinY) {
                return false;
            }
            const dx = oneCenterX - twoCenterX;
            const dy = oneCenterY - twoCenterY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < oneRadius + twoRadius;
        }
        else {
            const rect1 = {
                x: one.pos.x + one.collision.pos.x,
                y: one.pos.y + one.collision.pos.y,
                w: one.collision.size.x,
                h: one.collision.size.y,
            };
            const rect2 = {
                x: two.pos.x + two.collision.pos.x,
                y: two.pos.y + two.collision.pos.y,
                w: two.collision.size.x,
                h: two.collision.size.y,
            };
            return !(rect1.x + rect1.w <= rect2.x ||
                rect2.x + rect2.w <= rect1.x ||
                rect1.y + rect1.h <= rect2.y ||
                rect2.y + rect2.h <= rect1.y);
        }
        // if ((oneShape === "square" || oneShape === "rectangle") && twoShape === "circle") {
        // } else if (oneShape === "circle" && (twoShape === "square" || twoShape === "rectangle")) {
        // }
        return false;
        // switch (one.collision.shape && two.collision.shape) {
        // 	case "square":
        // 	case "rectangle":
        // 		const rect1 = {
        // 			x: one.pos.x + one.collision.pos.x,
        // 			y: one.pos.y + one.collision.pos.y,
        // 			w: one.collision.size.x,
        // 			h: one.collision.size.y,
        // 		};
        // 		const rect2 = {
        // 			x: two.pos.x + two.collision.pos.x,
        // 			y: two.pos.y + two.collision.pos.y,
        // 			w: two.collision.size.x,
        // 			h: two.collision.size.y,
        // 		};
        // 		return !(
        // 			rect1.x + rect1.w <= rect2.x ||
        // 			rect2.x + rect2.w <= rect1.x ||
        // 			rect1.y + rect1.h <= rect2.y ||
        // 			rect2.y + rect2.h <= rect1.y
        // 		);
        // 		break;
        // 	case "circle": // FIX THIS
        // 		const oneCenterX = one.pos.x + one.collision.pos.x;
        // 		const oneCenterY = one.pos.y + one.collision.pos.y;
        // 		const twoCenterX = two.pos.x + two.collision.pos.x;
        // 		const twoCenterY = two.pos.y + two.collision.pos.y;
        // 		const oneRadius = Math.min(one.collision.size.x, one.collision.size.y) / 2;
        // 		const twoRadius = Math.min(two.collision.size.x, two.collision.size.y) / 2;
        // 		const oneAabbMinX = oneCenterX - oneRadius;
        // 		const oneAabbMaxX = oneCenterX + oneRadius;
        // 		const oneAabbMinY = oneCenterY - oneRadius;
        // 		const oneAabbMaxY = oneCenterY + oneRadius;
        // 		const twoAabbMinX = twoCenterX - twoRadius;
        // 		const twoAabbMaxX = twoCenterX + twoRadius;
        // 		const twoAabbMinY = twoCenterY - twoRadius;
        // 		const twoAabbMaxY = twoCenterY + twoRadius;
        // 		if (
        // 			oneAabbMaxX < twoAabbMinX ||
        // 			twoAabbMaxX < oneAabbMinX ||
        // 			oneAabbMaxY < twoAabbMinY ||
        // 			twoAabbMaxY < oneAabbMinY
        // 		) {
        // 			return false;
        // 		}
        // 		const dx = oneCenterX - twoCenterX;
        // 		const dy = oneCenterY - twoCenterY;
        // 		const distance = Math.sqrt(dx * dx + dy * dy);
        // 		return distance < oneRadius + twoRadius;
        // 		break;
        // 	default:
        // 		BrioLogger.out("warn", "Collision: something went wrong.");
        // 		return false;
        // }
    }
    static addSquare(configurationObject) {
        const config = configurationObject;
        config.object.collision = {
            enabled: true,
            shape: "square",
            colliderType: config.colliderType,
            pos: config.pos,
            size: {
                x: config.size,
                y: config.size,
            },
        };
    }
    static addRectangle(configurationObject) {
        const config = configurationObject;
        config.object.collision = {
            enabled: true,
            shape: "rectangle",
            colliderType: config.colliderType,
            pos: config.pos,
            size: config.size,
        };
    }
    static addCircle(configurationObject) {
        const config = configurationObject;
        config.object.collision = {
            enabled: true,
            shape: "circle",
            colliderType: config.colliderType,
            pos: config.pos,
            size: {
                x: config.size,
                y: config.size,
            },
        };
    }
}
