export class BrioUtils {
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
    static timedAnimation(callbackFn, animationDuration) {
        let animationFrameId;
        const animationLoop = () => {
            callbackFn();
            animationFrameId = requestAnimationFrame(animationLoop);
        };
        animationLoop();
        setTimeout(() => {
            cancelAnimationFrame(animationFrameId);
        }, animationDuration);
    }
    // TODO: check this unusable gargabe
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
    static addProperty(object, propertyKey, propertyValue) {
        if (typeof object !== "object") {
            throw new Error("Something other than a object was passed");
        }
        if (object) {
            if (Object.hasOwn(object, propertyKey)) {
                throw new Error(`Trying to create a property that alread exists. ${object.name}.${propertyKey}`);
            }
            Object.defineProperty(object, propertyKey, {
                configurable: false,
                value: propertyValue,
                writable: true,
            });
        }
    }
    static wait(callbackFn, timInMiliseconds) {
        setTimeout(() => {
            callbackFn();
        }, timInMiliseconds);
    }
    static mapRestrainOffbound(game, target) {
        if (target.transform.position.x >= 0) {
            target.transform.position.x = 0;
        }
        else if (target.transform.position.x <= -(target.transform.size.x * game.scale - game.width)) {
            target.transform.position.x = -(target.transform.size.x * game.scale - game.width);
        }
        if (target.transform.position.y >= 0) {
            target.transform.position.y = 0;
        }
        else if (target.transform.position.y <= -(target.transform.size.y * game.scale - game.height)) {
            target.transform.position.y = -(target.transform.size.y * game.scale - game.height);
        }
    }
}
