// The live scene of the landing page: a floating island with araucárias and a hot spring where Capibrio soaks with
// a yuzu on its head. Everything is procedural (no model files), lit by a warm sun with shadows, and the water is
// a BrioShader. It runs on WebGL2 only; when WebGL2 is unavailable the page keeps a static illustration.
import {
    BrioGame,
    BrioMesh,
    BrioMaterial,
    BrioShader,
    BrioObject3D,
    BrioCamera3D,
    BrioLight,
} from "@brio-js/core";
import { capybaraAssets, createCapybara } from "../games/araucaria-run/capybara.js";
import { araucariaAssets, createAraucaria } from "../games/araucaria-run/araucaria.js";

const POOL = { x: 0.9, z: 0.8, r: 2.05 };

export async function startHotSpring(container, { onFps, onReady, onFail } = {}) {
    const size = () => ({
        w: Math.max(200, Math.round(container.clientWidth)),
        h: Math.max(200, Math.round(container.clientHeight)),
    });
    const { w, h } = size();
    const game = new BrioGame({
        width: w,
        height: h,
        container,
        dimension: "3d",
        renderBackend: "webgl2",
        maxPixelRatio: 2,
        seed: 7,
    });

    game.preload(() => [
        ...capybaraAssets(),
        ...araucariaAssets(),
        BrioMesh.createCylinder("hs_island_top", 6.4, 6.1, 0.6, 11),
        BrioMesh.createCylinder("hs_island_rock", 6.0, 0.6, 4.2, 11),
        BrioMesh.createCylinder("hs_island_rock2", 3.0, 0.2, 2.6, 8),
        BrioMesh.createPlane("hs_water", POOL.r * 2.15, POOL.r * 2.15, 56),
        BrioMesh.createSphere("hs_stone", 1, 6),
        BrioMesh.createSphere("hs_ball", 1, 12),
        new BrioShader("hs_shd_water", { url: new URL("./hot-spring.glsl", import.meta.url).href }),
        new BrioMaterial("hs_mat_grass", { shading: "flat", color: "#86a95f" }),
        new BrioMaterial("hs_mat_grass_dark", { shading: "flat", color: "#5f8a4a" }),
        new BrioMaterial("hs_mat_dirt", { shading: "flat", color: "#8a5b3b" }),
        new BrioMaterial("hs_mat_rock", { shading: "flat", color: "#9b8f80" }),
        new BrioMaterial("hs_mat_stone", { shading: "flat", color: "#b7aa98" }),
        new BrioMaterial("hs_mat_cloud", { shading: "lambert", color: "#fff8ee", emissive: "#fff4e6", emissiveIntensity: 0.35 }),
        new BrioMaterial("hs_mat_steam", { shading: "unlit", color: "#fffaf2", opacity: 0.22 }),
        new BrioMaterial("hs_mat_firefly", { shading: "unlit", color: "#ffd27a", emissive: "#ffb347", emissiveIntensity: 2 }),
        new BrioMaterial("hs_mat_flower", { shading: "flat", color: "#e8735a" }),
        new BrioMaterial("hs_mat_water", {
            shading: "standard",
            color: "#3a9a98",
            opacity: 0.9,
            alphaCutoff: 0.02,
            shader: "hs_shd_water",
            parameters: { uDeep: "#155e66", uShallow: "#6fc6bd", uFoam: "#e9fff8", uWave: 0.025 },
        }),
    ]);

    const camera = new BrioCamera3D("hs_cam", {
        fov: 0.52,
        near: 0.5,
        far: 120,
        position: { x: 10, y: 7.5, z: 15 },
        target: { x: 0.3, y: -0.4, z: 0 },
        toneMapping: "agx",
        exposure: 1.25,
    });
    const sun = new BrioLight("hs_sun", "directional", {
        color: "#ffe2b8",
        intensity: 2.1,
        direction: { x: -0.55, y: -1, z: -0.4 },
        castShadow: true,
        shadow: { size: 9, distance: 40, resolution: 2048, strength: 0.75, normalBias: 0.04 },
    });
    const sky = new BrioLight("hs_sky", "hemisphere", { color: "#ffe9cf", groundColor: "#6b4a33", intensity: 0.75 });
    const glow = new BrioLight("hs_glow", "point", {
        color: "#ffc07a",
        intensity: 3,
        range: 6,
        position: { x: POOL.x, y: 1.2, z: POOL.z },
    });

    const add = (list, name, mesh, mat, p, s, r) => {
        const o = new BrioObject3D(name, mesh, mat);
        o.transform.position = p;
        if (s) o.transform.scale = s;
        if (r) o.transform.rotation = r;
        list.push(o);
        return o;
    };

    let capy;
    const steam = [];
    const clouds = [];
    const fireflies = [];
    let island;

    game.load(() => {
        const objects = [];
        island = new BrioObject3D("hs_island");
        objects.push(island);
        const parts = [];
        add(parts, "hs_top", "hs_island_top", "hs_mat_grass", { x: 0, y: -0.3, z: 0 });
        add(parts, "hs_rock", "hs_island_rock", "hs_mat_dirt", { x: 0, y: -2.7, z: 0 }).castShadow = false;
        add(parts, "hs_rock2", "hs_island_rock2", "hs_mat_rock", { x: 1.2, y: -5.2, z: 0.6 }, null, { x: 0.15, y: 0, z: 0.1 });
        const water = add(parts, "hs_water", "hs_water", "hs_mat_water", { x: POOL.x, y: 0.06, z: POOL.z });
        water.castShadow = false;
        // Stones around the pool rim
        const stones = 15;
        for (let i = 0; i < stones; i++) {
            const a = (i / stones) * Math.PI * 2;
            const s = 0.28 + game.random.float(0, 0.16);
            add(
                parts,
                `hs_stone_${i}`,
                "hs_stone",
                i % 3 ? "hs_mat_stone" : "hs_mat_rock",
                { x: POOL.x + Math.cos(a) * (POOL.r + 0.12), y: 0.06, z: POOL.z + Math.sin(a) * (POOL.r + 0.12) },
                { x: s * 1.3, y: s * 0.7, z: s },
                { x: 0, y: a, z: 0 },
            );
        }
        // Araucárias and bushes
        const trees = [
            [-3.6, -1.6, 5.6, 0.2],
            [-1.6, -3.9, 4.2, 0.7],
            [3.9, -2.6, 6.4, 0.45],
            [-4.4, 2.2, 3.4, 0.9],
        ];
        for (const [x, z, height, seed] of trees) {
            const tree = createAraucaria(height, seed);
            tree.transform.position = { x, y: 0, z };
            parts.push(tree);
        }
        for (let i = 0; i < 9; i++) {
            const a = game.random.float(0, Math.PI * 2);
            const d = game.random.float(3.4, 5.6);
            const s = game.random.float(0.35, 0.7);
            add(parts, `hs_bush_${i}`, "hs_stone", i % 2 ? "hs_mat_grass_dark" : "hs_mat_grass", { x: Math.cos(a) * d, y: s * 0.35, z: Math.sin(a) * d }, { x: s * 1.2, y: s * 0.8, z: s });
        }
        for (let i = 0; i < 7; i++) {
            const a = game.random.float(0, Math.PI * 2);
            const d = game.random.float(2.6, 5.4);
            add(parts, `hs_flower_${i}`, "hs_ball", "hs_mat_flower", { x: Math.cos(a) * d, y: 0.08, z: Math.sin(a) * d }, { x: 0.09, y: 0.09, z: 0.09 });
        }
        for (const p of parts) island.addChild(p);

        capy = createCapybara({ name: "hs_capy", orange: true });
        capy.root.transform.position = { x: POOL.x - 0.1, y: -0.5, z: POOL.z };
        capy.root.transform.scale = { x: 0.78, y: 0.78, z: 0.78 };
        capy.root.transform.rotation.y = 0.55;
        island.addChild(capy.root);

        for (let i = 0; i < 9; i++) {
            const puff = add(steam, `hs_steam_${i}`, "hs_ball", "hs_mat_steam", { x: POOL.x, y: 0.3, z: POOL.z }, { x: 0.2, y: 0.2, z: 0.2 });
            puff.castShadow = false;
            puff.receiveShadow = false;
            island.addChild(puff);
        }
        for (let i = 0; i < 6; i++) {
            const f = add(fireflies, `hs_fly_${i}`, "hs_ball", "hs_mat_firefly", { x: 0, y: 2, z: 0 }, { x: 0.05, y: 0.05, z: 0.05 });
            f.castShadow = false;
            island.addChild(f);
        }
        for (let i = 0; i < 4; i++) {
            const cloud = new BrioObject3D(`hs_cloud_${i}`);
            for (let j = 0; j < 3; j++) {
                const puff = new BrioObject3D(`hs_cloud_${i}_${j}`, "hs_ball", "hs_mat_cloud");
                puff.transform.position = { x: (j - 1) * 0.9, y: j === 1 ? 0.25 : 0, z: 0 };
                const s = j === 1 ? 0.85 : 0.6;
                puff.transform.scale = { x: s * 1.2, y: s * 0.75, z: s };
                puff.castShadow = false;
                cloud.addChild(puff);
            }
            cloud.transform.position = { x: -12 + i * 7, y: 5.5 + (i % 2) * 1.5, z: -7 - (i % 3) * 2 };
            clouds.push(cloud);
            objects.push(cloud);
        }
        return [camera, sun, sky, glow, ...objects];
    });

    // Mouse parallax: the camera orbits a little around the island
    let targetYaw = 0;
    let targetPitch = 0;
    let yaw = 0;
    let pitch = 0;
    const onPointer = (event) => {
        const rect = container.getBoundingClientRect();
        targetYaw = ((event.clientX - rect.left) / rect.width - 0.5) * 0.7;
        targetPitch = ((event.clientY - rect.top) / rect.height - 0.5) * 0.25;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let frames = 0;
    let fpsTime = 0;
    let ready = false;
    game.update((_updater, dt) => {
        if (!ready) {
            ready = true;
            onReady?.();
        }
        const t = game.time;
        frames++;
        fpsTime += dt;
        if (fpsTime >= 0.5) {
            onFps?.(Math.round(frames / fpsTime));
            frames = 0;
            fpsTime = 0;
        }
        yaw += (targetYaw + Math.sin(t * 0.15) * 0.12 - yaw) * Math.min(1, dt * 2.5);
        pitch += (targetPitch - pitch) * Math.min(1, dt * 2.5);
        const radius = 27;
        const base = 0.6;
        camera.position = {
            x: Math.sin(base + yaw) * radius,
            y: 9.5 + pitch * 12,
            z: Math.cos(base + yaw) * radius,
        };
        // Floating island bob
        island.transform.position.y = Math.sin(t * 0.8) * 0.12;
        // Capibrio breathes, looks around and lets the yuzu wobble
        capy.root.transform.position.y = -0.5 + Math.sin(t * 1.3) * 0.03;
        capy.head.transform.rotation.y = Math.sin(t * 0.45) * 0.35;
        capy.head.transform.rotation.z = Math.sin(t * 0.7) * 0.06 - 0.05;
        if (capy.orange) capy.orange.transform.rotation.z = Math.sin(t * 1.7) * 0.12;
        // Steam rises and fades by shrinking
        for (let i = 0; i < steam.length; i++) {
            const k = (t * 0.22 + i / steam.length) % 1;
            const p = steam[i].transform.position;
            const a = i * 2.4;
            p.x = POOL.x + Math.cos(a) * (0.6 + k * 0.5) + Math.sin(t + i) * 0.1;
            p.z = POOL.z + Math.sin(a) * (0.6 + k * 0.5);
            p.y = 0.25 + k * 2.6;
            const s = 0.12 + Math.sin(k * Math.PI) * 0.3;
            steam[i].transform.scale = { x: s, y: s, z: s };
        }
        for (let i = 0; i < fireflies.length; i++) {
            const a = t * (0.3 + i * 0.05) + i * 1.1;
            const p = fireflies[i].transform.position;
            p.x = Math.cos(a) * (2.6 + i * 0.35);
            p.z = Math.sin(a * 1.3) * (2.4 + i * 0.3);
            p.y = 1.1 + Math.sin(t * 1.7 + i) * 0.5 + i * 0.12;
        }
        for (let i = 0; i < clouds.length; i++) {
            const p = clouds[i].transform.position;
            p.x += dt * (0.25 + i * 0.06);
            if (p.x > 16) p.x = -16;
        }
    });

    const resizeObserver = new ResizeObserver(() => {
        const s = size();
        game.resize(s.w, s.h);
    });
    resizeObserver.observe(container);

    await game.ready();
    if (game.renderBackend?.backendType !== "webgl2") {
        // This scene is a WebGL2 showcase; without it the page keeps its static illustration
        resizeObserver.disconnect();
        window.removeEventListener("pointermove", onPointer);
        game.end();
        onFail?.(new Error("WebGL2 unavailable"));
        return undefined;
    }
    return {
        game,
        destroy() {
            resizeObserver.disconnect();
            window.removeEventListener("pointermove", onPointer);
            game.end();
        },
    };
}
