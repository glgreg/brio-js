import { BrioObject } from "./BrioObject";
import { BrioSprite } from "./asset/BrioSprite";
import { BrioGame } from "./BrioGame";

export class BrioUtils {
	/** A function that loops throught a given callback until it stops at given time
	 * @param {() => void} callbackFn The callback that will be looped
	 * @param {number} animationDuration The timeout for stoping the animation
	 * @example const player = new BrioObject("player", spr_gato);
	 * player.setActions({ onKeyDown: {
	 * ArrowUp: () => { Utils.timedAnimation(() => {
	 * player.sprite.posY -= 10;
	 * }, 300)
	 * }}})
	 */
	public static timedAnimation(callbackFn: () => void, animationDuration: number) {
		let animationFrameId: number;

		const animationLoop = () => {
			callbackFn();
			animationFrameId = requestAnimationFrame(animationLoop);
		};
		animationLoop();

		setTimeout(() => {
			cancelAnimationFrame(animationFrameId);
		}, animationDuration);
	}

	/** An method used for safely (in the 'strict mode' JS sense) adding new properties into an object
	 * @example const player = new BrioObject("player", spr_player);
	 *
	 * Utils.addProperty(player, "health", 100);
	 * console.log(player.health); // 100
	 * @template T, K Generic types for object class type and value type
	 * @param {T} object The target object (can be of any class and literals)
	 * @param {string} propertyKey The property key
	 * @param {K} propertyValue The initial value (obligatory adding is needed for type cohersion)
	 */
	public static addProperty<T extends BrioSprite | BrioObject, K>(
		object: T,
		propertyKey: string,
		propertyValue: K,
	) {
		if (typeof object !== "object") {
			throw new Error("Something other than a object was passed");
		}
		if (object) {
			if (Object.hasOwn(object, propertyKey)) {
				throw new Error(
					`Trying to create a property that alread exists. ${object.name}.${propertyKey}`,
				);
			}
			Object.defineProperty(object, propertyKey, {
				configurable: false,
				value: propertyValue,
				writable: true,
			});
		}
	}

	public static wait(callbackFn: () => void, timInMiliseconds: number) {
		setTimeout(() => {
			callbackFn();
		}, timInMiliseconds);
	}

	public static mapRestrainOffbound(game: BrioGame, target: BrioObject) {
		if (target.pos.x >= 0) {
			target.pos.x = 0;
		} else if (target.pos.x <= -(target.size.x * game.scale - game.width)) {
			target.pos.x = -(target.size.x * game.scale - game.width);
		}
		if (target.pos.y >= 0) {
			target.pos.y = 0;
		} else if (target.pos.y <= -(target.size.y * game.scale - game.height)) {
			target.pos.y = -(target.size.y * game.scale - game.height);
		}
	}
}
