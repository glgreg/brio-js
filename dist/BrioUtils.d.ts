import { BrioObject } from "./base/BrioObject.js";
import { BrioSprite } from "./assets/BrioSprite.js";
import { BrioGame } from "./game/BrioGame.js";
export declare class BrioUtils {
	/** A function that loops throught a given callback until it stops at given time
	 * @param callbackFn The callback that will be looped
	 * @param animationDuration The timeout for stoping the animation
	 * @example const player = new BrioObject("player", spr_gato);
	 * player.setActions({ onKeyDown: {
	 * ArrowUp: () => { Utils.timedAnimation(() => {
	 * player.sprite.posY -= 10;
	 * }, 300)
	 * }}})
	 */
	static timedAnimation(callbackFn: () => void, animationDuration: number): void;
	/**
	 * An method used for safely (in the 'strict mode' JS sense) adding new properties into an object
	 * @param object The target object (can be of any class and literals)
	 * @param propertyKey The property key
	 * @param propertyValue The initial value (obligatory adding is needed for type cohersion)
	 * @example const player = new BrioObject("player", spr_player);
	 *
	 * Utils.addProperty(player, "health", 100);
	 * console.log(player.health); // 100
	 */
	static addProperty<T extends BrioSprite | BrioObject, K>(
		object: T,
		propertyKey: string,
		propertyValue: K,
	): void;
	static wait(callbackFn: () => void, timInMiliseconds: number): void;
	static mapRestrainOffbound(game: BrioGame, target: BrioObject): void;
}
//# sourceMappingURL=BrioUtils.d.ts.map
