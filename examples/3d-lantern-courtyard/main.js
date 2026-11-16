// Lantern Courtyard: a small night scene that shows the 3D look of BrioJS.
// Shows: "standard" metallic-roughness materials, point lanterns and a sweeping spot light, a moon that casts
// shadows, a water pool driven by a custom GLSL shader loaded from water.glsl, exponential fog, tone mapping, an
// orbit camera, 3D prefabs spawned with game.instantiate(), and a BrioText HUD over the 3D view ("hybrid" preset).
import {
    BrioGame,
    BrioLayer,
    BrioText,
    BrioMesh,
    BrioMaterial,
    BrioShader,
    BrioObject3D,
    BrioCamera3D,
    BrioLight,
    BrioInputMap,
} from "../../dist/index.js";

const WIDTH = 960;
const HEIGHT = 540;
const WATER_LEVEL = 0.12;
const TONE_MAPPINGS = ["agx", "aces", "neutral", "reinhard", "none"];

const game = new BrioGame({
    width: WIDTH,
    height: HEIGHT,
    container: document.getElementById("game"),
    dimension: "hybrid",
    fixedTimestep: 1 / 60,
    interpolate: true,
    seed: 11,
});
game.useFullScreen("fit");
game.useKeyboard();
game.useMouse();
game.input
    .bind("orbitLeft", "ArrowLeft", "a")
    .bind("orbitRight", "ArrowRight", "d")
    .bind("orbitUp", "ArrowUp", "w")
    .bind("orbitDown", "ArrowDown", "s")
    .bind("drop", " ", BrioInputMap.mouseButton("right"))
    .bind("toneMapping", "t")
    .bind("fog", "f")
    .bind("lanterns", "l");

// -> ASSETS (procedural meshes; the water shader is a .glsl file loaded by preload())
game.preload(() => [
    // Subdivided so the Canvas2D fallback can depth-sort it and the water vertex hook has vertices to move
    BrioMesh.createPlane("mesh_ground", 40, 40, 40),
    BrioMesh.createPlane("mesh_water", 5, 5, 64),
    BrioMesh.createBox("mesh_box"),
    BrioMesh.createSphere("mesh_sphere", 1, 32),
    BrioMesh.createCylinder("mesh_pillar", 0.32, 0.38, 2.4, 20),
    BrioMesh.createCylinder("mesh_cone", 0, 0.6, 1.5, 32),
    new BrioShader("shd_water", { url: "./water.glsl" }),
    new BrioMaterial("mat_ground", { shading: "standard", color: "#394150", roughness: 0.92 }),
    new BrioMaterial("mat_stone", { shading: "standard", color: "#8b9099", roughness: 0.7 }),
    new BrioMaterial("mat_crate", { shading: "standard", color: "#9a6a3a", roughness: 0.8 }),
    new BrioMaterial("mat_chrome", {
        shading: "standard",
        color: "#e5e7eb",
        metalness: 1,
        roughness: 0.12,
    }),
    new BrioMaterial("mat_gold", {
        shading: "standard",
        color: "#f2c14e",
        metalness: 1,
        roughness: 0.35,
    }),
    new BrioMaterial("mat_bulb", {
        shading: "unlit",
        color: "#ffcf87",
        emissive: "#ffb35c",
        emissiveIntensity: 2.5,
    }),
    new BrioMaterial("mat_water", {
        shading: "standard",
        color: "#3a8fb7",
        opacity: 0.85,
        shader: "shd_water",
        parameters: {
            uDeepColor: "#0b2f45",
            uFoamColor: "#bfe9ff",
            uLevel: WATER_LEVEL,
            uWaveHeight: 0.06,
            uWaveScale: 2.2,
        },
    }),
]);

// -> LIGHTS
const moon = new BrioLight("light_moon", "directional", {
    color: "#9db4ff",
    intensity: 0.9,
    direction: { x: -0.5, y: -1, z: -0.35 },
    castShadow: true,
    shadow: { size: 12, resolution: 2048 },
});
const sky = new BrioLight("light_sky", "hemisphere", {
    color: "#30466f",
    groundColor: "#17120e",
    intensity: 0.55,
});
const PILLARS = [
    { x: -5, z: -5 },
    { x: 5, z: -5 },
    { x: -5, z: 5 },
    { x: 5, z: 5 },
];
const lanterns = PILLARS.map(
    (p, i) =>
        new BrioLight(`light_lantern_${i}`, "point", {
            color: "#ffb35c",
            intensity: 5,
            range: 10,
            position: { x: p.x, y: 2.75, z: p.z },
        }),
);
const spot = new BrioLight("light_spot", "spot", {
    color: "#cfe3ff",
    intensity: 40,
    range: 22,
    position: { x: 0, y: 8, z: 0 },
    angle: 0.32,
    penumbra: 0.45,
});

const camera = new BrioCamera3D("cam_orbit", {
    fov: Math.PI / 3.4,
    near: 0.1,
    far: 120,
    clearColor: "#0d1320",
    toneMapping: "agx",
    exposure: 1.15,
    fog: { mode: "exponential2", color: "#0d1320", density: 0.035 },
});

// -> SCENE
const hud = new BrioText("txt_hud", "", {
    size: 15,
    color: "#e5e7eb",
    strokeColor: "#0d1320",
    strokeWidth: 4,
});
game.load(() => {
    const ui = new BrioLayer({ name: "ui", order: 100, policy: "ui" });
    hud.transform.position = { x: 14, y: 12 };
    ui.addObject(hud);

    const objects = [];
    const add = (name, mesh, material, x, y, z, scale) => {
        const object = new BrioObject3D(name, mesh, material);
        object.transform.position = { x, y, z };
        if (scale) object.transform.scale = scale;
        objects.push(object);
        return object;
    };

    add("obj_ground", "mesh_ground", "mat_ground", 0, 0, 0);
    const water = add("obj_water", "mesh_water", "mat_water", 0, WATER_LEVEL, 0);
    water.castShadow = false;
    // Stone rim around the pool
    add("obj_rim_n", "mesh_box", "mat_stone", 0, 0.2, -2.7, { x: 5.8, y: 0.4, z: 0.4 });
    add("obj_rim_s", "mesh_box", "mat_stone", 0, 0.2, 2.7, { x: 5.8, y: 0.4, z: 0.4 });
    add("obj_rim_w", "mesh_box", "mat_stone", -2.7, 0.2, 0, { x: 0.4, y: 0.4, z: 5 });
    add("obj_rim_e", "mesh_box", "mat_stone", 2.7, 0.2, 0, { x: 0.4, y: 0.4, z: 5 });

    // Pillars with glowing lantern bulbs (the bulbs do not cast shadows: the light sits inside them)
    PILLARS.forEach((p, i) => {
        add(`obj_pillar_${i}`, "mesh_pillar", "mat_stone", p.x, 1.2, p.z);
        const bulb = add(`obj_bulb_${i}`, "mesh_sphere", "mat_bulb", p.x, 2.75, p.z, {
            x: 0.2,
            y: 0.2,
            z: 0.2,
        });
        bulb.castShadow = false;
    });

    // Props
    add("obj_chrome", "mesh_sphere", "mat_chrome", 4, 0.8, 0.5, { x: 0.8, y: 0.8, z: 0.8 });
    add("obj_cone", "mesh_cone", "mat_gold", -4, 0.75, 1.5);
    const crates = [
        add("obj_crate_a", "mesh_box", "mat_crate", -3.6, 0.4, -3.1, { x: 0.8, y: 0.8, z: 0.8 }),
        add("obj_crate_b", "mesh_box", "mat_crate", -2.7, 0.4, -3.6, { x: 0.8, y: 0.8, z: 0.8 }),
        add("obj_crate_c", "mesh_box", "mat_crate", -3.2, 1.2, -3.35, { x: 0.8, y: 0.8, z: 0.8 }),
    ];
    crates[1].transform.rotation.y = 0.4;
    crates[2].transform.rotation.y = -0.25;

    return [camera, moon, sky, spot, ...lanterns, ui, hud, ...objects];
});

// Dropped balls are clones of one prefab (game.instantiate deep-clones 3D objects)
const ballPrefab = new BrioObject3D("obj_ball", "mesh_sphere", "mat_chrome");
ballPrefab.transform.scale = { x: 0.3, y: 0.3, z: 0.3 };
const balls = [];

// -> CONTROLS AND ANIMATION
let yaw = 0.75;
let pitch = 0.42;
let distance = 14;
let toneIndex = 0;

function dropBall() {
    const ball = game.instantiate(ballPrefab);
    ball.transform.position = {
        x: game.random.float(-2, 2),
        y: 6,
        z: game.random.float(-2, 2),
    };
    balls.push({ object: ball, velocity: 0 });
    if (balls.length > 8) game.destroy(balls.shift().object);
}

// Simulation at a fixed rate: falling balls bounce on the ground (or float on the water)
game.fixedUpdate((updater, dt) => {
    for (const ball of balls) {
        const t = ball.object.transform;
        ball.velocity -= 9.8 * dt;
        t.position.y += ball.velocity * dt;
        const inPool = Math.abs(t.position.x) < 2.5 && Math.abs(t.position.z) < 2.5;
        const floor = (inPool ? WATER_LEVEL : 0) + 0.3;
        if (t.position.y < floor) {
            t.position.y = floor;
            ball.velocity = inPool ? 0 : -ball.velocity * 0.55;
        }
    }
});

game.update((updater, dt) => {
    const input = game.input;
    const mouse = game.mouse;

    // Orbit with a left drag or the arrows / WASD, zoom with the wheel
    if (mouse.isDown("left")) {
        yaw += mouse.delta.x * 0.006;
        pitch += mouse.delta.y * 0.006;
    }
    yaw += input.axis("orbitLeft", "orbitRight") * 1.4 * dt;
    pitch += input.axis("orbitDown", "orbitUp") * 1.1 * dt;
    pitch = Math.min(1.35, Math.max(0.08, pitch));
    distance = Math.min(30, Math.max(5, distance + mouse.wheelDelta * 0.01));
    camera.position = {
        x: Math.cos(yaw) * Math.cos(pitch) * distance,
        y: 0.5 + Math.sin(pitch) * distance,
        z: Math.sin(yaw) * Math.cos(pitch) * distance,
    };
    camera.lookAt({ x: 0, y: 0.5, z: 0 });

    if (input.isPressed("drop")) dropBall();
    if (input.isPressed("toneMapping")) {
        toneIndex = (toneIndex + 1) % TONE_MAPPINGS.length;
        camera.toneMapping = TONE_MAPPINGS[toneIndex];
    }
    if (input.isPressed("fog")) {
        camera.fog = camera.fog
            ? undefined
            : { mode: "exponential2", color: "#0d1320", density: 0.035 };
    }
    if (input.isPressed("lanterns"))
        for (const lantern of lanterns) lantern.enabled = !lantern.enabled;

    // Lanterns flicker (seeded noise, so runs are reproducible) and the spot sweeps the courtyard
    const time = game.time;
    for (let i = 0; i < lanterns.length; i++) {
        lanterns[i].intensity =
            4.4 + Math.sin(time * 9 + i * 1.7) * 0.4 + game.random.float(-0.25, 0.25);
    }
    spot.direction = { x: Math.cos(time * 0.5) * 0.45, y: -1, z: Math.sin(time * 0.5) * 0.45 };

    hud.text =
        `Lantern Courtyard   ${game.renderBackend?.backendType ?? "starting"}   tone mapping: ${camera.toneMapping}\n` +
        "Drag / arrows: orbit   Wheel: zoom   Space: drop a ball   T: tone mapping   F: fog   L: lanterns";
});

window.brioGame = game;
