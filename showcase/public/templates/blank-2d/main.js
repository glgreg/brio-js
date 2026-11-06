// A 2D starting point drawn on the GPU: the knight is a textured quad seen by an orthographic camera, so it can be
// lit, tinted and flashed by a shader. Edit anything and press Run (Ctrl+Enter).
import { BrioGame, BrioCamera3D, BrioLight, BrioMaterial } from "@brio-js/core";
import { quadMesh, spriteShader, pixelTexture, cell, spriteMaterial, sprite } from "./sprites.js";

const game = new BrioGame({ width: 640, height: 360, container: document.getElementById("game"), dimension: "3d" });
game.useFullScreen("fit");
game.useKeyboard();
game.input
    .bind("left", "ArrowLeft", "a")
    .bind("right", "ArrowRight", "d")
    .bind("up", "ArrowUp", "w")
    .bind("down", "ArrowDown", "s");

// The knight sheet has 32x32 cells: idle on row 0, running on rows 2 and 3
const knightTexture = await pixelTexture("./assets/knight.png");
const frame = cell(knightTexture, 32, 32, 0, 0);

game.preload(() => [
    quadMesh(),
    spriteShader(),
    spriteMaterial("mat_knight", knightTexture, frame),
    new BrioMaterial("mat_grass", { shading: "lambert", color: "#5f8a4a" }),
]);

const camera = new BrioCamera3D("camera", {
    projection: "orthographic",
    orthoSize: 90, // half of the visible height, in world units (pixels of art)
    position: { x: 0, y: 0, z: 100 },
    clearColor: "#1e1913",
});
const lantern = new BrioLight("lantern", "point", { color: "#ffd18a", intensity: 60, range: 160, decay: 1, position: { x: 0, y: 0, z: 40 } });

game.load(() => [
    camera,
    new BrioLight("sky", "hemisphere", { color: "#8aa0d0", groundColor: "#2a2018", intensity: 0.45 }),
    lantern,
    sprite("grass", "mat_grass", 1000, 1000, 0),
    sprite("knight", "mat_knight", 64, 64, 1),
]);

const speed = 80;
let time = 0;
game.update((updater, dt) => {
    time += dt;
    const knight = game.gameObjects3D.get("knight");
    const mx = game.input.axis("left", "right");
    const my = game.input.axis("down", "up");
    knight.transform.position.x += mx * speed * dt;
    knight.transform.position.y += my * speed * dt;
    if (mx !== 0) knight.transform.scale.x = mx > 0 ? 64 : -64;

    // Animate: change which cell of the sheet the material shows
    const moving = mx !== 0 || my !== 0;
    const index = Math.floor(time * (moving ? 14 : 6)) % (moving ? 16 : 4);
    cell(knightTexture, 32, 32, index % 8, moving ? 2 + Math.floor(index / 8) : 0, frame);

    // The lantern follows the knight
    lantern.position.x = knight.transform.position.x;
    lantern.position.y = knight.transform.position.y + 10;
});
