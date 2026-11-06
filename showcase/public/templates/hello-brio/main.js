import { BrioGame, BrioMesh, BrioMaterial, BrioObject3D, BrioCamera3D, BrioLight } from "@brio-js/core";

const game = new BrioGame({ width: 640, height: 360, container: document.getElementById("game"), dimension: "3d" });
game.useFullScreen("fit");
game.useKeyboard();
game.input.bind("left", "ArrowLeft", "a").bind("right", "ArrowRight", "d");

// 1. preload: meshes, materials, textures, sounds
game.preload(() => [
    BrioMesh.createBox("mesh_box"),
    BrioMesh.createPlane("mesh_floor", 14, 14),
    new BrioMaterial("mat_yuzu", { shading: "standard", color: "#f19a32", roughness: 0.35 }),
    new BrioMaterial("mat_grass", { shading: "lambert", color: "#7fa36a" }),
]);

// 2. load: build the world once
game.load(() => {
    const player = new BrioObject3D("player", "mesh_box", "mat_yuzu");
    player.transform.position.y = 0.5;
    return [
        new BrioCamera3D("camera", { position: { x: 0, y: 5, z: 8 }, clearColor: "#f5eddf", toneMapping: "agx" }),
        new BrioLight("sun", "directional", { direction: { x: -1, y: -2, z: -1 }, intensity: 2, castShadow: true }),
        new BrioLight("sky", "hemisphere", { color: "#fff1dc", groundColor: "#6b4a33", intensity: 0.6 }),
        new BrioObject3D("floor", "mesh_floor", "mat_grass"),
        player,
    ];
});

// 3. update: change it every frame (dt = seconds since the last frame)
game.update((updater, dt) => {
    const player = game.gameObjects3D.get("player");
    player.transform.position.x += game.input.axis("left", "right") * 4 * dt;
    player.transform.rotation.y += dt;
});
