// A 3D starting point: lit shapes, a shadow-casting sun and an orbiting camera.
// Try changing colors, adding objects in load(), or moving things in update(). Run with Ctrl+Enter.
import { BrioGame, BrioMesh, BrioMaterial, BrioObject3D, BrioCamera3D, BrioLight } from "@brio-js/core";

const game = new BrioGame({ width: 800, height: 450, container: document.getElementById("game"), dimension: "3d" });
game.useFullScreen("fit");

game.preload(() => [
    BrioMesh.createBox("mesh_box"),
    BrioMesh.createSphere("mesh_ball", 0.6, 24),
    BrioMesh.createCylinder("mesh_cone", 0, 0.7, 1.4, 24),
    BrioMesh.createPlane("mesh_floor", 20, 20),
    new BrioMaterial("mat_floor", { shading: "standard", color: "#e9dcc6", roughness: 0.9 }),
    new BrioMaterial("mat_orange", { shading: "standard", color: "#f19a32", roughness: 0.35 }),
    new BrioMaterial("mat_teal", { shading: "standard", color: "#2c7a7b", roughness: 0.2, metalness: 0.4 }),
    new BrioMaterial("mat_berry", { shading: "flat", color: "#b8436b" }),
]);

const camera = new BrioCamera3D("camera", {
    fov: Math.PI / 4,
    position: { x: 6, y: 5, z: 8 },
    clearColor: "#f5eddf",
    toneMapping: "agx",
    fog: { mode: "linear", color: "#f5eddf", near: 12, far: 30 },
});

game.load(() => {
    const box = new BrioObject3D("box", "mesh_box", "mat_orange");
    box.transform.position = { x: -1.6, y: 0.5, z: 0 };
    const ball = new BrioObject3D("ball", "mesh_ball", "mat_teal");
    ball.transform.position = { x: 0.4, y: 0.6, z: 0.6 };
    const cone = new BrioObject3D("cone", "mesh_cone", "mat_berry");
    cone.transform.position = { x: 2, y: 0.7, z: -0.4 };
    return [
        camera,
        new BrioLight("sun", "directional", { direction: { x: -0.6, y: -1, z: -0.4 }, intensity: 2.2, castShadow: true }),
        new BrioLight("sky", "hemisphere", { color: "#fff1dc", groundColor: "#6b4a33", intensity: 0.6 }),
        new BrioObject3D("floor", "mesh_floor", "mat_floor"),
        box,
        ball,
        cone,
    ];
});

game.update((updater, dt) => {
    const t = game.time;
    // Orbit the camera around the scene
    camera.position = { x: Math.sin(t * 0.3) * 9, y: 5, z: Math.cos(t * 0.3) * 9 };
    camera.target = { x: 0, y: 0.5, z: 0 };
    // Bounce the ball and spin the box
    game.gameObjects3D.get("ball").transform.position.y = 0.6 + Math.abs(Math.sin(t * 3)) * 1.2;
    game.gameObjects3D.get("box").transform.rotation.y += dt;
});
