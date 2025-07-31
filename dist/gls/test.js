import { Game, GameAudio, GameObject, GameSprite } from "./index.js";
function main() {
    const game = new Game(600, 480, document.body);
    game.preload(() => {
        const spr = new GameSprite({
            name: "spr_gato",
            src: "./images/gato.png",
            size: { x: 32, y: 32 },
            pos: { x: 0, y: 0 },
            type: "img",
        });
        const aud = new GameAudio("aud_punch", "./audios/punch.wav");
        return [spr, aud];
    });
    game.load((assets) => {
        const spr = assets.getSprite("spr_gato");
        const aud = assets.getAudio("aud_punch");
        const obj_1 = new GameObject("obj_player", spr, 1);
        return [obj_1];
    });
    game.update((updater, dt) => {
        updater.getObject("obj_");
    });
}
main();
