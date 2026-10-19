import {
    BrioMesh,
    BrioMaterial,
    BrioObject3D,
    BrioCamera3D,
    Canvas2DBackend,
    BrioModel,
    BrioSerializer,
    BrioStorage,
    BrioMath,
    Vector3,
    Quaternion,
    Matrix4,
    ECSWorld,
    ComponentMask,
} from "../../dist/index.js";

// DOM References
const canvas = document.getElementById("brio_3d_canvas");
const loadingScreen = document.getElementById("loading_screen");
const loadingStatus = document.getElementById("loading_status");

const fpsDisplay = document.getElementById("fps_display");
const deltaDisplay = document.getElementById("delta_display");
const totalTrisDisplay = document.getElementById("total_tris_display");

const camModeInfo = document.getElementById("cam_mode_info");
const camPosInfo = document.getElementById("cam_pos_info");
const culledTrisInfo = document.getElementById("culled_tris_info");
const ecsInfo = document.getElementById("ecs_info");
const logOutput = document.getElementById("log_output");
const idbStatusLabel = document.getElementById("idb_status_label");

// Camera Buttons
const btnCamAll = document.getElementById("btn_cam_all");
const btnCamGwen = document.getElementById("btn_cam_gwen");
const btnCamMalfoy = document.getElementById("btn_cam_malfoy");
const btnCamSpider = document.getElementById("btn_cam_spider");

// Controls
const sliderCamDistance = document.getElementById("slider_cam_distance");
const camDistanceVal = document.getElementById("cam_distance_val");
const sliderOrbitSpeed = document.getElementById("slider_orbit_speed");
const orbitSpeedVal = document.getElementById("orbit_speed_val");
const chkAutoRotate = document.getElementById("chk_auto_rotate");
const chkModelSpin = document.getElementById("chk_model_spin");

// Render Mode Buttons
const btnModeDiffuse = document.getElementById("btn_mode_diffuse");
const btnModeWireframe = document.getElementById("btn_mode_wireframe");
const btnModePalette = document.getElementById("btn_mode_palette");
const btnModeClay = document.getElementById("btn_mode_clay");

// Persistence Buttons
const btnCheckpointSave = document.getElementById("btn_checkpoint_save");
const btnCheckpointRestore = document.getElementById("btn_checkpoint_restore");
const btnIdbSave = document.getElementById("btn_idb_save");
const btnIdbLoad = document.getElementById("btn_idb_load");

// Logger Helper
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
// Engine & Camera Setup
// -------------------------------------------------------------
const backend = new Canvas2DBackend();
await backend.init(canvas);

const ecsWorld = new ECSWorld(256);

const camera = new BrioCamera3D("scene_cam_3d", {
    fov: BrioMath.degToRad(55),
    aspect: canvas.width / canvas.height,
    near: 0.1,
    far: 1000,
    position: { x: 0, y: 3.5, z: 11 },
    target: { x: 0, y: 1.2, z: 0 },
});

// Camera Focus Targets
const CAMERA_PRESETS = {
    all: { target: { x: 0, y: 1.2, z: 0 }, distance: 11, name: "Orbit (All Models)" },
    gwen: { target: { x: -3.5, y: 1.3, z: 0 }, distance: 4.5, name: "Gwen Tennyson" },
    malfoy: { target: { x: 0, y: 1.0, z: 0 }, distance: 3.8, name: "Malfoy Draconia" },
    spider: { target: { x: 3.5, y: 1.2, z: 0 }, distance: 4.2, name: "Spider-Gwen" },
};

let activeCamKey = "all";
let currentCamTarget = { x: 0, y: 1.2, z: 0 };
let currentCamDistance = 11;
let orbitAngleDeg = 0;

// Shading Mode: "diffuse" | "wireframe" | "palette" | "clay"
let currentShadingMode = "diffuse";

// -------------------------------------------------------------
// Stage & Environment Entities
// -------------------------------------------------------------
const meshGround = BrioMesh.createPlane("mesh_ground", 32, 32);
const matGround = new BrioMaterial("mat_ground", {
    color: "#1e293b",
    wireframe: true,
});

const groundObj = new BrioObject3D("obj_ground", "mesh_ground", "mat_ground");
groundObj.transform.position.set(0, -0.5, 0);
groundObj.transform.rotation.set(-BrioMath.degToRad(90), 0, 0);
groundObj.meshInstance = meshGround;
groundObj.materialInstance = matGround;

// Pedestals
const meshPedestal = BrioMesh.createBox("mesh_pedestal", 2.4, 0.35, 2.4);
const matPedestal = new BrioMaterial("mat_pedestal", {
    color: "#0f172a",
    shading: "phong",
    opacity: 0.95,
});

function createPedestal(name, posX) {
    const ped = new BrioObject3D(name, "mesh_pedestal", "mat_pedestal");
    ped.transform.position.set(posX, -0.32, 0);
    ped.meshInstance = meshPedestal;
    ped.materialInstance = matPedestal;
    return ped;
}

const pedGwen = createPedestal("ped_gwen", -3.5);
const pedMalfoy = createPedestal("ped_malfoy", 0);
const pedSpider = createPedestal("ped_spider", 3.5);

const staticObjects = [groundObj, pedGwen, pedMalfoy, pedSpider];

// -------------------------------------------------------------
// Asynchronous GLB Models Preloading
// -------------------------------------------------------------
let characterContainers = [];

async function loadModels() {
    try {
        loadingStatus.textContent = "Fetching and parsing gwen_tennyson.glb...";
        logEvent("Loading GLB 1/3: gwen_tennyson.glb...", "info");
        const gwenModel = new BrioModel("mod_gwen", "../../assets/3d/glb/gwen_tennyson.glb");
        await gwenModel.load();

        loadingStatus.textContent = "Fetching and parsing harry_potter_-_malfoy_draconia_3d_model__dl.glb...";
        logEvent("Loading GLB 2/3: harry_potter_-_malfoy_draconia_3d_model__dl.glb...", "info");
        const malfoyModel = new BrioModel("mod_malfoy", "../../assets/3d/glb/harry_potter_-_malfoy_draconia_3d_model__dl.glb");
        await malfoyModel.load();

        loadingStatus.textContent = "Fetching and parsing spider_gwen.glb...";
        logEvent("Loading GLB 3/3: spider_gwen.glb...", "info");
        const spiderModel = new BrioModel("mod_spider_gwen", "../../assets/3d/glb/spider_gwen.glb");
        await spiderModel.load();

        loadingStatus.textContent = "Configuring scene entities and ECS bindings...";

        // Model 1: Gwen Tennyson (Left: X = -3.5)
        const gwenRoot = gwenModel.instantiate("obj_gwen");
        gwenRoot.transform.position.set(-3.5, -0.15, 0);
        registerToECS(gwenRoot);

        // Model 2: Malfoy Draconia (Center: X = 0)
        const malfoyRoot = malfoyModel.instantiate("obj_malfoy");
        malfoyRoot.transform.position.set(0, -0.15, 0);
        registerToECS(malfoyRoot);

        // Model 3: Spider-Gwen (Right: X = +3.5)
        const spiderRoot = spiderModel.instantiate("obj_spider");
        spiderRoot.transform.position.set(3.5, -0.15, 0);
        registerToECS(spiderRoot);

        characterContainers = [
            {
                key: "gwen",
                name: "Gwen Tennyson",
                model: gwenModel,
                root: gwenRoot,
                spinAngle: 0,
                baseY: -0.15,
                palette: ["#38bdf8", "#0284c7", "#f59e0b", "#ec4899", "#10b981", "#6366f1", "#14b8a6", "#f43f5e", "#8b5cf6", "#f97316"],
            },
            {
                key: "malfoy",
                name: "Malfoy Draconia",
                model: malfoyModel,
                root: malfoyRoot,
                spinAngle: 0,
                baseY: -0.15,
                palette: ["#10b981", "#fed7aa", "#fde047"],
            },
            {
                key: "spider",
                name: "Spider-Gwen",
                model: spiderModel,
                root: spiderRoot,
                spinAngle: 0,
                baseY: -0.15,
                palette: ["#f8fafc", "#0f172a", "#f43f5e", "#06b6d4", "#ec4899", "#94a3b8", "#cbd5e1"],
            },
        ];

        // Apply initial shading mode
        applyShadingMode(currentShadingMode);

        // Hide Loading Screen
        loadingScreen.classList.add("hidden");
        logEvent("All 3 GLB models loaded and instantiated successfully!", "success");

        // Compute total triangles in scene
        let totalTris = 0;
        for (const c of characterContainers) {
            for (const m of c.model.meshes.values()) {
                totalTris += m.triangleCount;
            }
        }
        totalTrisDisplay.textContent = `Triangles: ${totalTris.toLocaleString()}`;
    } catch (err) {
        loadingStatus.textContent = `Error loading models: ${err.message}`;
        logEvent(`Fatal error preloading models: ${err.message}`, "error");
        console.error(err);
    }
}

function registerToECS(obj) {
    const id = ecsWorld.createEntity(ComponentMask.TRANSFORM_3D);
    obj.entityId = id;
    obj.transform.bindECS(ecsWorld.storage, id);
    for (const child of obj.transform.children) {
        const cId = ecsWorld.createEntity(ComponentMask.TRANSFORM_3D);
        child.bindECS(ecsWorld.storage, cId);
    }
}

// -------------------------------------------------------------
// Material & Shading Switcher
// -------------------------------------------------------------
function applyShadingMode(mode) {
    currentShadingMode = mode;

    for (const container of characterContainers) {
        const materials = Array.from(container.model.materials.values());

        for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];

            if (mode === "wireframe") {
                mat.wireframe = true;
                mat.color = "#38bdf8";
                mat.opacity = 0.8;
                mat.shading = "unlit";
            } else if (mode === "clay") {
                mat.wireframe = false;
                mat.color = "#e2e8f0";
                mat.opacity = 1.0;
                mat.shading = "phong";
            } else if (mode === "palette") {
                mat.wireframe = false;
                mat.color = container.palette[i % container.palette.length];
                mat.opacity = 1.0;
                mat.shading = "phong";
            } else {
                // "diffuse": standard neutral diffuse
                mat.wireframe = false;
                mat.color = "#ffffff";
                mat.opacity = 1.0;
                mat.shading = "lambert";
            }
        }
    }

    logEvent(`Shading mode set to: ${mode.toUpperCase()}`, "info");
}

// -------------------------------------------------------------
// Simulation & Animation Loop
// -------------------------------------------------------------
let lastTime = performance.now();
let frameCount = 0;
let fpsTimer = 0;
let totalElapsed = 0;

function renderScene(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    totalElapsed += dt;

    // FPS Meter
    frameCount++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
        const currentFps = Math.round(frameCount / fpsTimer);
        fpsDisplay.textContent = `FPS: ${currentFps}`;
        deltaDisplay.textContent = `dt: ${(dt * 1000).toFixed(1)}ms`;
        frameCount = 0;
        fpsTimer = 0;
    }

    // 1. Math: Orbit Angle wrapping
    const speedPercent = parseFloat(sliderOrbitSpeed.value);
    const speedMult = speedPercent / 40;

    if (chkAutoRotate.checked) {
        orbitAngleDeg = BrioMath.wrap(orbitAngleDeg + 25 * speedMult * dt, 0, 360);
    }
    const orbitAngleRad = BrioMath.degToRad(orbitAngleDeg);

    // 2. Camera target & position interpolation via BrioMath.lerp
    const preset = CAMERA_PRESETS[activeCamKey];
    currentCamTarget.x = BrioMath.lerp(currentCamTarget.x, preset.target.x, 0.08);
    currentCamTarget.y = BrioMath.lerp(currentCamTarget.y, preset.target.y, 0.08);
    currentCamTarget.z = BrioMath.lerp(currentCamTarget.z, preset.target.z, 0.08);

    const targetDist = BrioMath.clamp(parseFloat(sliderCamDistance.value), 3, 25);
    currentCamDistance = BrioMath.lerp(currentCamDistance, targetDist, 0.08);

    const eyeX = currentCamTarget.x + Math.sin(orbitAngleRad) * currentCamDistance;
    const eyeZ = currentCamTarget.z + Math.cos(orbitAngleRad) * currentCamDistance;
    const eyeY = currentCamTarget.y + currentCamDistance * 0.35;

    camera.position.x = BrioMath.lerp(camera.position.x, eyeX, 0.12);
    camera.position.y = BrioMath.lerp(camera.position.y, eyeY, 0.12);
    camera.position.z = BrioMath.lerp(camera.position.z, eyeZ, 0.12);
    camera.lookAt(currentCamTarget);

    camPosInfo.textContent = `X: ${camera.position.x.toFixed(1)}, Y: ${camera.position.y.toFixed(1)}, Z: ${camera.position.z.toFixed(1)}`;
    ecsInfo.textContent = `Active: ${ecsWorld.activeCount}`;

    // 3. Characters Turntable & Floating Motion via BrioMath
    for (let i = 0; i < characterContainers.length; i++) {
        const char = characterContainers[i];

        if (chkModelSpin.checked) {
            char.spinAngle = BrioMath.wrap(char.spinAngle + (0.5 + i * 0.2) * dt, 0, Math.PI * 2);
            char.root.transform.rotation.y = char.spinAngle;
        }

        // Smooth subtle breathing wave with BrioMath.smoothstep
        const wave = Math.sin(totalElapsed * 2 + i * 1.5);
        const floatFactor = BrioMath.smoothstep(wave, -1, 1);
        char.root.transform.position.y = char.baseY + floatFactor * 0.06;
    }

    // 4. Software 3D Rasterization
    backend.beginFrame({ x: 0, y: 0, width: 1, height: 1 }, "#030712");

    // Render Stage and Pedestals
    for (const staticObj of staticObjects) {
        backend.renderMesh3D(
            staticObj.meshInstance,
            staticObj.materialInstance,
            staticObj.transform.worldMatrix,
            camera.viewProjectionMatrix,
        );
    }

    // Render all Sub-Meshes for each Loaded GLB Character
    for (const char of characterContainers) {
        const meshesArr = Array.from(char.model.meshes.values());
        const materialsArr = Array.from(char.model.materials.values());
        const worldMat = char.root.transform.worldMatrix;

        for (let m = 0; m < meshesArr.length; m++) {
            const mesh = meshesArr[m];
            const mat = materialsArr[m] ?? materialsArr[0] ?? matPedestal;

            backend.renderMesh3D(
                mesh,
                mat,
                worldMat,
                camera.viewProjectionMatrix,
            );
        }
    }

    backend.endFrame();

    requestAnimationFrame(renderScene);
}

// -------------------------------------------------------------
// Interactive UI Handlers
// -------------------------------------------------------------
sliderCamDistance.addEventListener("input", () => {
    camDistanceVal.textContent = sliderCamDistance.value;
});

sliderOrbitSpeed.addEventListener("input", () => {
    orbitSpeedVal.textContent = `${sliderOrbitSpeed.value}%`;
});

function setCameraFocus(key, btn) {
    activeCamKey = key;
    sliderCamDistance.value = CAMERA_PRESETS[key].distance;
    camDistanceVal.textContent = CAMERA_PRESETS[key].distance;
    camModeInfo.textContent = CAMERA_PRESETS[key].name;

    [btnCamAll, btnCamGwen, btnCamMalfoy, btnCamSpider].forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    logEvent(`Camera focused on: ${CAMERA_PRESETS[key].name}`, "info");
}

btnCamAll.addEventListener("click", () => setCameraFocus("all", btnCamAll));
btnCamGwen.addEventListener("click", () => setCameraFocus("gwen", btnCamGwen));
btnCamMalfoy.addEventListener("click", () => setCameraFocus("malfoy", btnCamMalfoy));
btnCamSpider.addEventListener("click", () => setCameraFocus("spider", btnCamSpider));

// Shading Mode Buttons
function setShadingModeBtn(mode, btn) {
    [btnModeDiffuse, btnModeWireframe, btnModePalette, btnModeClay].forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyShadingMode(mode);
}

btnModeDiffuse.addEventListener("click", () => setShadingModeBtn("diffuse", btnModeDiffuse));
btnModeWireframe.addEventListener("click", () => setShadingModeBtn("wireframe", btnModeWireframe));
btnModePalette.addEventListener("click", () => setShadingModeBtn("palette", btnModePalette));
btnModeClay.addEventListener("click", () => setShadingModeBtn("clay", btnModeClay));

// Persistence: In-Memory Checkpoints
let checkpointSnapshot = null;

btnCheckpointSave.addEventListener("click", () => {
    checkpointSnapshot = BrioSerializer.captureSnapshot(ecsWorld);
    logEvent(`Checkpoint captured (${checkpointSnapshot.byteLength} bytes, ${ecsWorld.activeCount} active entities).`, "success");
});

btnCheckpointRestore.addEventListener("click", () => {
    if (!checkpointSnapshot) {
        logEvent("No checkpoint found in memory.", "warn");
        return;
    }
    BrioSerializer.restoreSnapshot(ecsWorld, checkpointSnapshot);
    logEvent("Checkpoint restored into ECS world state.", "success");
});

// Persistence: IndexedDB
btnIdbSave.addEventListener("click", async () => {
    try {
        const snap = BrioSerializer.captureSnapshot(ecsWorld);
        await BrioStorage.db.saveSnapshot("glb_scene_slot", snap);
        await BrioStorage.db.set("glb_scene_meta", {
            timestamp: Date.now(),
            activeEntities: ecsWorld.activeCount,
            models: ["gwen_tennyson", "malfoy_draconia", "spider_gwen"],
            bytes: snap.byteLength,
        });
        idbStatusLabel.textContent = `IndexedDB: Saved at ${new Date().toLocaleTimeString()} (${snap.byteLength} bytes)`;
        logEvent(`Saved 3D scene state to IndexedDB (${snap.byteLength} bytes).`, "success");
    } catch (err) {
        logEvent(`IndexedDB save failed: ${err.message}`, "error");
    }
});

btnIdbLoad.addEventListener("click", async () => {
    try {
        const snap = await BrioStorage.db.loadSnapshot("glb_scene_slot");
        if (!snap) {
            logEvent("No saved snapshot found in IndexedDB.", "warn");
            return;
        }
        BrioSerializer.restoreSnapshot(ecsWorld, snap);
        idbStatusLabel.textContent = `IndexedDB: Loaded ${snap.byteLength} bytes successfully`;
        logEvent(`Restored 3D scene state from IndexedDB (${snap.byteLength} bytes).`, "success");
    } catch (err) {
        logEvent(`IndexedDB load failed: ${err.message}`, "error");
    }
});

// Start Loading & Loop
await loadModels();
requestAnimationFrame(renderScene);
