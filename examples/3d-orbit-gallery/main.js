// Orbit Gallery: a simple 3D BrioJS scene. Drag to orbit, scroll to zoom, click a shape to select it.
// Shows: procedural meshes (box, sphere, cylinder, cone, plane), configurable lights, BrioCamera3D orbit,
// mouse picking with screenToRay, the GPU backend cascade (`?backend=canvas2d` forces the fallback), and audio.
import {
    BrioGame,
    BrioMesh,
    BrioMaterial,
    BrioObject3D,
    BrioCamera3D,
    BrioLight,
    BrioAudio,
} from "../../dist/index.js";
import { synthWav } from "../shared/procedural-assets.js";

const WIDTH = 960;
const HEIGHT = 540;
const params = new URLSearchParams(location.search);

const game = new BrioGame({
    width: WIDTH,
    height: HEIGHT,
    container: document.getElementById("game"),
    dimension: "3d",
    renderBackend: /** @type {any} */ (params.get("backend")) ?? "auto",
    seed: 2026,
});
game.useMouse();
game.useKeyboard();
const hud = document.getElementById("hud");

const SHAPES = [
    { name: "box", mesh: () => BrioMesh.createBox("mesh_box", 1.4, 1.4, 1.4), radius: 1.2, color: "#f97316" },
    { name: "sphere", mesh: () => BrioMesh.createSphere("mesh_sphere", 0.9, 32), radius: 0.9, color: "#22d3ee" },
    { name: "cylinder", mesh: () => BrioMesh.createCylinder("mesh_cylinder", 0.6, 0.6, 1.8, 32), radius: 1.1, color: "#a3e635" },
    { name: "cone", mesh: () => BrioMesh.createCylinder("mesh_cone", 0, 0.9, 1.8, 32), radius: 1.1, color: "#f472b6" },
    { name: "pillar", mesh: () => BrioMesh.createCylinder("mesh_pillar", 0.35, 0.6, 2.4, 6), radius: 1.3, color: "#facc15" },
];

game.preload(() => [
    // Subdivided so the Canvas2D fallback depth-sorts the ground behind the shapes
    BrioMesh.createPlane("mesh_ground", 30, 30, 12),
    new BrioMaterial("mat_ground", { color: "#334155" }),
    new BrioMaterial("mat_selected", { color: "#ffffff", shading: "flat" }),
    ...SHAPES.flatMap((s) => [s.mesh(), new BrioMaterial(`mat_${s.name}`, { color: s.color })]),
    new BrioAudio("aud_select", synthWav({ duration: 0.12, frequency: (t) => 880 - t * 2000 })),
]);

const sun = new BrioLight("light_sun", "directional", { color: "#fff4e0", intensity: 2.2 });
const sky = new BrioLight("light_sky", "hemisphere", { color: "#9cc3ff", groundColor: "#2b2118", intensity: 0.7 });
const fill = new BrioLight("light_fill", "directional", { color: "#7aa2ff", intensity: 0.4, direction: { x: 1, y: -0.3, z: 1 } });
const camera = new BrioCamera3D("cam_orbit", { fov: Math.PI / 3.5, clearColor: "#0b1220", near: 0.1, far: 200 });

/** @type {{ object: any, radius: number }[]} */
const pickables = [];

game.load(() => {
    const ground = new BrioObject3D("obj_ground", "mesh_ground", "mat_ground");
    ground.transform.position = { x: 0, y: -1.2, z: 0 };

    const shapes = SHAPES.map((shape, i) => {
        const angle = (i / SHAPES.length) * Math.PI * 2;
        const obj = new BrioObject3D(`obj_${shape.name}`, `mesh_${shape.name}`, `mat_${shape.name}`);
        obj.transform.position = { x: Math.cos(angle) * 4, y: 0, z: Math.sin(angle) * 4 };
        pickables.push({ object: obj, radius: shape.radius });
        return obj;
    });
    return [camera, sun, sky, fill, ground, ...shapes];
});

// Orbit state
let yaw = 0.6;
let pitch = 0.45;
let distance = 12;
let dragDistance = 0;
/** @type {any} */
let selected;
let time = 0;

/**
 * Distance along `ray` to the sphere `(center, radius)`, or `Infinity` when missed.
 *
 * @param {import("../../dist/index.js").BrioRay3D} ray
 * @param {{ x: number, y: number, z: number }} center
 * @param {number} radius
 */
function raySphere(ray, center, radius) {
    const ox = ray.origin.x - center.x;
    const oy = ray.origin.y - center.y;
    const oz = ray.origin.z - center.z;
    const b = ox * ray.direction.x + oy * ray.direction.y + oz * ray.direction.z;
    const c = ox * ox + oy * oy + oz * oz - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : Infinity;
}

game.update((updater, dt) => {
    time += dt;
    const mouse = game.mouse;
    const keys = game.keyboard;

    // Orbit with the mouse (drag) or the arrow keys, zoom with the wheel
    if (mouse.isDown("left")) {
        yaw += mouse.delta.x * 0.008;
        pitch += mouse.delta.y * 0.008;
        dragDistance += Math.abs(mouse.delta.x) + Math.abs(mouse.delta.y);
    }
    if (keys.isDown("ArrowLeft")) yaw -= 1.5 * dt;
    if (keys.isDown("ArrowRight")) yaw += 1.5 * dt;
    if (keys.isDown("ArrowUp")) pitch += 1.2 * dt;
    if (keys.isDown("ArrowDown")) pitch -= 1.2 * dt;
    distance = Math.min(30, Math.max(4, distance + mouse.wheelDelta * 0.01));
    pitch = Math.min(1.45, Math.max(-0.2, pitch));
    camera.position = {
        x: Math.cos(yaw) * Math.cos(pitch) * distance,
        y: Math.sin(pitch) * distance,
        z: Math.sin(yaw) * Math.cos(pitch) * distance,
    };
    camera.lookAt({ x: 0, y: 0, z: 0 });

    // Click (without dragging) to select the shape under the cursor
    if (mouse.isPressed("left")) dragDistance = 0;
    if (mouse.isUp("left") && dragDistance < 4) {
        const ray = camera.screenToRay(mouse.position.x, mouse.position.y, game.width, game.height);
        let best = Infinity;
        let hit;
        for (const p of pickables) {
            const t = raySphere(ray, p.object.transform.position, p.radius);
            if (t < best) {
                best = t;
                hit = p.object;
            }
        }
        if (selected) selected.material = `mat_${selected.name.replace("obj_", "")}`;
        selected = hit && hit !== selected ? hit : undefined;
        if (selected) {
            selected.material = "mat_selected";
            updater.getAudio("aud_select").play();
        }
    }

    // Shapes spin; the sun circles the scene; L toggles it
    for (const p of pickables) p.object.transform.rotation.y += dt * (p.object === selected ? 2.5 : 0.4);
    sun.direction = { x: Math.cos(time * 0.3), y: -1, z: Math.sin(time * 0.3) };
    if (keys.isPressed("l")) sun.enabled = !sun.enabled;

    hud.textContent =
        `Backend: ${game.renderBackend?.backendType ?? "starting"}  |  drag/arrows: orbit  |  wheel: zoom  |  ` +
        `click: select ${selected ? `(${selected.name.replace("obj_", "")})` : ""}  |  L: sun ${sun.enabled ? "on" : "off"}`;
});

window.brioGame = game;
