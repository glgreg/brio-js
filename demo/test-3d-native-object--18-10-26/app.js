import {
    BrioMesh,
    BrioMaterial,
    BrioObject3D,
    BrioCamera3D,
    Canvas2DBackend,
    BrioSerializer,
    BrioStorage,
    BrioMath,
    Vector3,
    Quaternion,
    Matrix4,
    ECSWorld,
    ComponentMask,
} from "../../dist/index.js";

// DOM Element references
const canvas = document.getElementById("brio_3d_canvas");
const fpsDisplay = document.getElementById("fps_display");
const deltaDisplay = document.getElementById("delta_display");
const camInfo = document.getElementById("cam_info");
const objCountInfo = document.getElementById("obj_count_info");
const ecsInfo = document.getElementById("ecs_info");
const logOutput = document.getElementById("log_output");

// Controls
const btnSpawnCube = document.getElementById("btn_spawn_cube");
const btnToggleWireframe = document.getElementById("btn_toggle_wireframe");
const btnResetScene = document.getElementById("btn_reset_scene");
const sliderOrbitSpeed = document.getElementById("slider_orbit_speed");
const orbitSpeedVal = document.getElementById("orbit_speed_val");
const sliderCamDistance = document.getElementById("slider_cam_distance");
const camDistanceVal = document.getElementById("cam_distance_val");
const chkAutoRotate = document.getElementById("chk_auto_rotate");
const chkPulseScale = document.getElementById("chk_pulse_scale");

// Telemetry
const mathSmoothstep = document.getElementById("math_smoothstep");
const mathWrap = document.getElementById("math_wrap");
const mathRemap = document.getElementById("math_remap");
const mathRad = document.getElementById("math_rad");

// Storage controls
const btnMemSnapshot = document.getElementById("btn_mem_snapshot");
const btnMemRestore = document.getElementById("btn_mem_restore");
const btnIdbSave1 = document.getElementById("btn_idb_save_1");
const btnIdbLoad1 = document.getElementById("btn_idb_load_1");
const slot1Info = document.getElementById("slot1_info");
const btnIdbSave2 = document.getElementById("btn_idb_save_2");
const btnIdbLoad2 = document.getElementById("btn_idb_load_2");
const slot2Info = document.getElementById("slot2_info");
const btnExportJson = document.getElementById("btn_export_json");
const btnIdbClear = document.getElementById("btn_idb_clear");

// Modal elements
const modalOverlay = document.getElementById("modal_overlay");
const btnCloseModal = document.getElementById("btn_close_modal");
const modalJsonContent = document.getElementById("modal_json_content");

// Helper: Logging with timestamps
function logEvent(message, type = "info") {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
    console.log(`[Brio3D:${type.toUpperCase()}] ${message}`);
}

// -------------------------------------------------------------
// Scene & Engine Initialization
// -------------------------------------------------------------
const backend = new Canvas2DBackend();
await backend.init(canvas);

const ecsWorld = new ECSWorld(256);

const camera = new BrioCamera3D("cam_main", {
    fov: BrioMath.degToRad(60),
    aspect: canvas.width / canvas.height,
    near: 0.1,
    far: 1000,
    position: { x: 0, y: 5, z: 14 },
    target: { x: 0, y: 1, z: 0 },
});

// Reusable Meshes
const meshCore = BrioMesh.createBox("mesh_core", 2.2, 2.2, 2.2);
const meshSphere = BrioMesh.createSphere("mesh_sphere", 0.75, 14, 14);
const meshPlane = BrioMesh.createPlane("mesh_plane", 28, 28);
const meshSub = BrioMesh.createBox("mesh_sub", 0.5, 0.5, 0.5);

// Reusable Materials
const matCore = new BrioMaterial("mat_core", {
    color: "#38bdf8",
    shading: "phong",
    opacity: 0.9,
    wireframe: false,
});

const matSatellite = new BrioMaterial("mat_satellite", {
    color: "#f43f5e",
    shading: "flat",
    opacity: 0.95,
    wireframe: false,
});

const matSubSatellite = new BrioMaterial("mat_sub_satellite", {
    color: "#10b981",
    shading: "flat",
    opacity: 1.0,
    wireframe: false,
});

const matGround = new BrioMaterial("mat_ground", {
    color: "#334155",
    wireframe: true,
});

// Scene Objects Registry
let objects3D = [];
let floatingObjects = [];
let memorySnapshot = null;
let globalWireframe = false;

// Function to bind a 3D object to ECSWorld
function registerEntityToECS(obj) {
    const entityId = ecsWorld.createEntity(ComponentMask.TRANSFORM_3D);
    obj.entityId = entityId;
    obj.transform.bindECS(ecsWorld.storage, entityId);
    return entityId;
}

// Function to construct the default scene
function buildDefaultScene() {
    ecsWorld.clear();
    objects3D = [];
    floatingObjects = [];

    // Ground Plane
    const ground = new BrioObject3D("obj_ground", "mesh_plane", "mat_ground");
    ground.transform.position.set(0, -2, 0);
    // Rotate 90 degrees around X to lay flat
    ground.transform.rotation.set(-BrioMath.degToRad(90), 0, 0);
    registerEntityToECS(ground);
    ground.meshInstance = meshPlane;
    ground.materialInstance = matGround;
    objects3D.push(ground);

    // Central Core Box
    const core = new BrioObject3D("obj_core", "mesh_core", "mat_core");
    core.transform.position.set(0, 1.2, 0);
    registerEntityToECS(core);
    core.meshInstance = meshCore;
    core.materialInstance = matCore;
    objects3D.push(core);

    // Primary Satellite Sphere
    const satellite = new BrioObject3D("obj_satellite", "mesh_sphere", "mat_satellite");
    satellite.transform.position.set(4, 1.2, 0);
    satellite.addCollider3D("sphere", "solid", { x: 0, y: 0, z: 0 }, { x: 1.5, y: 1.5, z: 1.5 });
    registerEntityToECS(satellite);
    satellite.meshInstance = meshSphere;
    satellite.materialInstance = matSatellite;
    objects3D.push(satellite);

    // Hierarchical Child Sub-Satellite (orbits around the satellite)
    const subSatellite = new BrioObject3D("obj_sub_satellite", "mesh_sub", "mat_sub_satellite");
    subSatellite.transform.position.set(1.5, 0, 0);
    satellite.transform.addChild(subSatellite.transform);
    registerEntityToECS(subSatellite);
    subSatellite.meshInstance = meshSub;
    subSatellite.materialInstance = matSubSatellite;
    objects3D.push(subSatellite);

    logEvent("Default 3D scene initialized with Core, Satellite hierarchy, and Ground.", "success");
}

buildDefaultScene();

// -------------------------------------------------------------
// Dynamic Spawn Function
// -------------------------------------------------------------
const FLOATING_COLORS = ["#eab308", "#a855f7", "#06b6d4", "#ec4899", "#84cc16"];

function spawnRandomCube() {
    const id = `cube_${floatingObjects.length + 1}`;
    const size = BrioMath.randomRange(0.6, 1.2);
    const mesh = BrioMesh.createBox(`mesh_${id}`, size, size, size);

    const color = FLOATING_COLORS[BrioMath.randomInt(0, FLOATING_COLORS.length - 1)];
    const material = new BrioMaterial(`mat_${id}`, {
        color,
        shading: "phong",
        opacity: 0.85,
        wireframe: globalWireframe,
    });

    const cube = new BrioObject3D(id, `mesh_${id}`, `mat_${id}`);
    const posX = BrioMath.randomRange(-7, 7);
    const posY = BrioMath.randomRange(0.5, 4.5);
    const posZ = BrioMath.randomRange(-7, 7);
    cube.transform.position.set(posX, posY, posZ);

    cube.rotSpeed = {
        x: BrioMath.randomRange(0.5, 2.0),
        y: BrioMath.randomRange(0.5, 2.0),
        z: BrioMath.randomRange(0.5, 1.5),
    };

    registerEntityToECS(cube);
    cube.meshInstance = mesh;
    cube.materialInstance = material;

    objects3D.push(cube);
    floatingObjects.push(cube);

    logEvent(`Spawned dynamic 3D cube '${id}' at (${posX.toFixed(1)}, ${posY.toFixed(1)}, ${posZ.toFixed(1)}).`, "info");
}

// -------------------------------------------------------------
// Simulation & Animation State
// -------------------------------------------------------------
let lastTimestamp = performance.now();
let frameCount = 0;
let fpsTimer = 0;
let currentFps = 0;
let totalElapsed = 0;
let orbitAngleDeg = 0;
let subOrbitAngleRad = 0;
let targetCamDistance = 14;

// -------------------------------------------------------------
// Storage Slots UI Refresh
// -------------------------------------------------------------
async function refreshSlotInfo() {
    try {
        const meta1 = await BrioStorage.db.get("slot_1_meta");
        if (meta1) {
            slot1Info.textContent = `Saved: ${new Date(meta1.timestamp).toLocaleTimeString()} | Entities: ${meta1.activeEntities} | Bytes: ${meta1.bytes}`;
        } else {
            slot1Info.textContent = "Empty";
        }

        const meta2 = await BrioStorage.db.get("slot_2_meta");
        if (meta2) {
            slot2Info.textContent = `Saved: ${new Date(meta2.timestamp).toLocaleTimeString()} | Entities: ${meta2.activeEntities} | Bytes: ${meta2.bytes}`;
        } else {
            slot2Info.textContent = "Empty";
        }
    } catch (err) {
        logEvent(`Error checking IndexedDB slots: ${err}`, "warn");
    }
}

await refreshSlotInfo();

// -------------------------------------------------------------
// Main Game / Render Loop
// -------------------------------------------------------------
function gameLoop(now) {
    const dt = Math.min((now - lastTimestamp) / 1000, 0.1);
    lastTimestamp = now;
    totalElapsed += dt;

    // FPS Meter
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
        currentFps = Math.round((frameCount / fpsTimer));
        fpsDisplay.textContent = `FPS: ${currentFps}`;
        deltaDisplay.textContent = `dt: ${(dt * 1000).toFixed(1)}ms`;
        frameCount = 0;
        fpsTimer = 0;
    }

    // 1. Math: Orbit Calculations using BrioMath.wrap & BrioMath.degToRad
    const orbitSpeedPercent = parseFloat(sliderOrbitSpeed.value);
    const speedMultiplier = (orbitSpeedPercent / 50);

    if (chkAutoRotate.checked) {
        orbitAngleDeg = BrioMath.wrap(orbitAngleDeg + 40 * speedMultiplier * dt, 0, 360);
    }
    const orbitAngleRad = BrioMath.degToRad(orbitAngleDeg);

    // 2. Math: Hermite Smoothstep Pulse for Core Box
    const rawSinWave = Math.sin(totalElapsed * 2.5);
    const smoothPulse = BrioMath.smoothstep(rawSinWave, -1, 1);
    const coreScale = chkPulseScale.checked ? BrioMath.lerp(0.85, 1.3, smoothPulse) : 1.0;

    // 3. Math: Remap cosine wave to opacity & color oscillation
    const rawCosWave = Math.cos(totalElapsed * 1.5);
    const remapFactor = BrioMath.remap(rawCosWave, -1, 1, 0.45, 1.0);

    // Update Telemetry Display
    mathSmoothstep.textContent = smoothPulse.toFixed(3);
    mathWrap.textContent = `${orbitAngleDeg.toFixed(1)} deg`;
    mathRemap.textContent = remapFactor.toFixed(3);
    mathRad.textContent = `${orbitAngleRad.toFixed(3)} rad`;

    // 4. Update 3D Entities Transforms
    const core = objects3D.find((o) => o.name === "obj_core");
    if (core) {
        core.transform.scale.set(coreScale, coreScale, coreScale);
        core.transform.rotation.y = BrioMath.wrap(core.transform.rotation.y + 0.8 * dt, 0, Math.PI * 2);
        core.transform.rotation.x = BrioMath.wrap(core.transform.rotation.x + 0.5 * dt, 0, Math.PI * 2);
        core.materialInstance.opacity = remapFactor;
    }

    const satellite = objects3D.find((o) => o.name === "obj_satellite");
    if (satellite) {
        const satRadius = 4.5;
        const satX = Math.cos(orbitAngleRad) * satRadius;
        const satZ = Math.sin(orbitAngleRad) * satRadius;
        satellite.transform.position.set(satX, 1.2 + Math.sin(totalElapsed * 3) * 0.5, satZ);
        satellite.transform.rotation.y = orbitAngleRad * 2;
    }

    const subSatellite = objects3D.find((o) => o.name === "obj_sub_satellite");
    if (subSatellite) {
        subOrbitAngleRad = BrioMath.wrap(subOrbitAngleRad + 3.0 * dt, 0, Math.PI * 2);
        subSatellite.transform.position.set(
            Math.cos(subOrbitAngleRad) * 1.4,
            Math.sin(subOrbitAngleRad) * 0.8,
            0,
        );
        subSatellite.transform.rotation.z = subOrbitAngleRad;
    }

    // Update Floating Cubes
    for (let i = 0; i < floatingObjects.length; i++) {
        const cube = floatingObjects[i];
        cube.transform.rotation.x += cube.rotSpeed.x * dt;
        cube.transform.rotation.y += cube.rotSpeed.y * dt;
        cube.transform.rotation.z += cube.rotSpeed.z * dt;
    }

    // 5. Camera Tracking using BrioMath.lerp & BrioMath.clamp
    const targetDistance = BrioMath.clamp(parseFloat(sliderCamDistance.value), 5, 30);
    targetCamDistance = BrioMath.lerp(targetCamDistance, targetDistance, 0.1);

    const camElevation = 5.0;
    const camTargetX = Math.sin(orbitAngleRad * 0.3) * targetCamDistance;
    const camTargetZ = Math.cos(orbitAngleRad * 0.3) * targetCamDistance;

    camera.position.x = BrioMath.lerp(camera.position.x, camTargetX, 0.08);
    camera.position.y = BrioMath.lerp(camera.position.y, camElevation, 0.08);
    camera.position.z = BrioMath.lerp(camera.position.z, camTargetZ, 0.08);

    // Update Overlay Telemetry
    camInfo.textContent = `X: ${camera.position.x.toFixed(1)}, Y: ${camera.position.y.toFixed(1)}, Z: ${camera.position.z.toFixed(1)}`;
    objCountInfo.textContent = `${objects3D.length}`;
    ecsInfo.textContent = `Active: ${ecsWorld.activeCount} | HighWater: ${ecsWorld.highWaterMark}`;

    // 6. 3D Software Rasterization Pass via Canvas2DBackend
    backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 }, "#030712");

    // Render all active 3D meshes
    for (let i = 0; i < objects3D.length; i++) {
        const obj = objects3D[i];
        if (!obj.meshInstance || !obj.materialInstance || !obj.transform.visibility) continue;

        backend.renderMesh3D(
            obj.meshInstance,
            obj.materialInstance,
            obj.transform.worldMatrix,
            camera.viewProjectionMatrix,
        );
    }

    backend.endFrame();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// -------------------------------------------------------------
// Interactive UI Event Handlers
// -------------------------------------------------------------
sliderOrbitSpeed.addEventListener("input", () => {
    orbitSpeedVal.textContent = `${sliderOrbitSpeed.value}%`;
});

sliderCamDistance.addEventListener("input", () => {
    camDistanceVal.textContent = sliderCamDistance.value;
});

btnSpawnCube.addEventListener("click", () => {
    spawnRandomCube();
});

btnToggleWireframe.addEventListener("click", () => {
    globalWireframe = !globalWireframe;
    for (let i = 0; i < objects3D.length; i++) {
        if (objects3D[i].name !== "obj_ground") {
            objects3D[i].materialInstance.wireframe = globalWireframe;
        }
    }
    logEvent(`Wireframe mode toggled: ${globalWireframe ? "ENABLED" : "DISABLED"}.`, "info");
});

btnResetScene.addEventListener("click", () => {
    buildDefaultScene();
});

// In-Memory Snapshots
btnMemSnapshot.addEventListener("click", () => {
    memorySnapshot = BrioSerializer.captureSnapshot(ecsWorld);
    logEvent(`In-Memory Snapshot captured (${memorySnapshot.byteLength} bytes). Active entities: ${ecsWorld.activeCount}.`, "success");
});

btnMemRestore.addEventListener("click", () => {
    if (!memorySnapshot) {
        logEvent("No In-Memory Snapshot available to restore.", "warn");
        return;
    }
    BrioSerializer.restoreSnapshot(ecsWorld, memorySnapshot);
    logEvent(`In-Memory Snapshot restored! World highWaterMark: ${ecsWorld.highWaterMark}, active: ${ecsWorld.activeCount}.`, "success");
});

// IndexedDB Slot 1 Save & Load
btnIdbSave1.addEventListener("click", async () => {
    try {
        const snapshot = BrioSerializer.captureSnapshot(ecsWorld);
        await BrioStorage.db.saveSnapshot("slot_1_snapshot", snapshot);
        await BrioStorage.db.set("slot_1_meta", {
            timestamp: Date.now(),
            activeEntities: ecsWorld.activeCount,
            highWaterMark: ecsWorld.highWaterMark,
            bytes: snapshot.byteLength,
        });
        await refreshSlotInfo();
        logEvent(`Saved Slot 1 to IndexedDB (${snapshot.byteLength} bytes, ${ecsWorld.activeCount} entities).`, "success");
    } catch (err) {
        logEvent(`Failed to save Slot 1: ${err}`, "error");
    }
});

btnIdbLoad1.addEventListener("click", async () => {
    try {
        const snapshot = await BrioStorage.db.loadSnapshot("slot_1_snapshot");
        if (!snapshot) {
            logEvent("Slot 1 is empty in IndexedDB.", "warn");
            return;
        }
        BrioSerializer.restoreSnapshot(ecsWorld, snapshot);
        logEvent(`Loaded Slot 1 from IndexedDB (${snapshot.byteLength} bytes restored into ECSWorld).`, "success");
    } catch (err) {
        logEvent(`Failed to load Slot 1: ${err}`, "error");
    }
});

// IndexedDB Slot 2 Save & Load
btnIdbSave2.addEventListener("click", async () => {
    try {
        const snapshot = BrioSerializer.captureSnapshot(ecsWorld);
        await BrioStorage.db.saveSnapshot("slot_2_snapshot", snapshot);
        await BrioStorage.db.set("slot_2_meta", {
            timestamp: Date.now(),
            activeEntities: ecsWorld.activeCount,
            highWaterMark: ecsWorld.highWaterMark,
            bytes: snapshot.byteLength,
        });
        await refreshSlotInfo();
        logEvent(`Saved Slot 2 to IndexedDB (${snapshot.byteLength} bytes, ${ecsWorld.activeCount} entities).`, "success");
    } catch (err) {
        logEvent(`Failed to save Slot 2: ${err}`, "error");
    }
});

btnIdbLoad2.addEventListener("click", async () => {
    try {
        const snapshot = await BrioStorage.db.loadSnapshot("slot_2_snapshot");
        if (!snapshot) {
            logEvent("Slot 2 is empty in IndexedDB.", "warn");
            return;
        }
        BrioSerializer.restoreSnapshot(ecsWorld, snapshot);
        logEvent(`Loaded Slot 2 from IndexedDB (${snapshot.byteLength} bytes restored into ECSWorld).`, "success");
    } catch (err) {
        logEvent(`Failed to load Slot 2: ${err}`, "error");
    }
});

// Clear IndexedDB
btnIdbClear.addEventListener("click", async () => {
    try {
        await BrioStorage.db.clear();
        await refreshSlotInfo();
        logEvent("Cleared all IndexedDB records and snapshots.", "warn");
    } catch (err) {
        logEvent(`Failed to clear IndexedDB: ${err}`, "error");
    }
});

// Export & Inspect Snapshot JSON
btnExportJson.addEventListener("click", () => {
    const snapshot = BrioSerializer.captureSnapshot(ecsWorld);
    const json = BrioSerializer.toJSON(snapshot);
    modalJsonContent.textContent = JSON.stringify(json, null, 2);
    modalOverlay.classList.remove("hidden");
    logEvent(`Captured and formatted snapshot JSON (${JSON.stringify(json).length} characters).`, "info");
});

btnCloseModal.addEventListener("click", () => {
    modalOverlay.classList.add("hidden");
});

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.add("hidden");
    }
});

logEvent("BrioJS 3D & Storage test initialized successfully.", "success");
