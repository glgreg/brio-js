// Capibrio, built from BrioJS primitives: scaled spheres and boxes with flat shading give it a low-poly,
// hand-carved look without any model file. The landing page hot spring reuses this module.
import { BrioMesh, BrioMaterial, BrioObject3D } from "@brio-js/core";

/** Meshes and materials used by createCapybara(); add them to game.preload(). */
export function capybaraAssets() {
    return [
        BrioMesh.createSphere("capy_mesh_sphere", 1, 10),
        BrioMesh.createBox("capy_mesh_box", 1, 1, 1),
        BrioMesh.createCylinder("capy_mesh_leg", 1, 0.85, 1, 7),
        new BrioMaterial("capy_mat_fur", { shading: "flat", color: "#a8683a" }),
        new BrioMaterial("capy_mat_fur_dark", { shading: "flat", color: "#7d4a29" }),
        new BrioMaterial("capy_mat_snout", { shading: "flat", color: "#5e3720" }),
        new BrioMaterial("capy_mat_eye", { shading: "unlit", color: "#1a120c" }),
        new BrioMaterial("capy_mat_yuzu", {
            shading: "standard",
            color: "#f19a32",
            roughness: 0.55,
            emissive: "#f19a32",
            emissiveIntensity: 0.12,
        }),
        new BrioMaterial("capy_mat_leaf", { shading: "flat", color: "#6f9c55" }),
    ];
}

let count = 0;

/**
 * Builds a capybara facing +X with its feet on y = 0. Returns the root object (no mesh, a pivot) and the parts
 * that are fun to animate.
 */
export function createCapybara(options = {}) {
    const id = options.name ?? `capy_${count++}`;
    const root = new BrioObject3D(id);
    const part = (name, mesh, material, p, s, r) => {
        const o = new BrioObject3D(`${id}_${name}`, mesh, material);
        o.transform.position = p;
        o.transform.scale = s;
        if (r) o.transform.rotation = r;
        return o;
    };
    const body = new BrioObject3D(`${id}_body_pivot`);
    root.addChild(body);
    body.addChild(part("body", "capy_mesh_sphere", "capy_mat_fur", { x: 0.1, y: 0.86, z: 0 }, { x: 1.12, y: 0.74, z: 0.72 }));
    body.addChild(part("rump", "capy_mesh_sphere", "capy_mat_fur", { x: -0.55, y: 0.8, z: 0 }, { x: 0.78, y: 0.72, z: 0.68 }));

    const head = new BrioObject3D(`${id}_head_pivot`);
    head.transform.position = { x: 0.95, y: 1.18, z: 0 };
    body.addChild(head);
    head.addChild(part("head", "capy_mesh_box", "capy_mat_fur", { x: 0.25, y: 0.05, z: 0 }, { x: 0.95, y: 0.6, z: 0.62 }, { x: 0, y: 0, z: -0.12 }));
    head.addChild(part("snout", "capy_mesh_box", "capy_mat_snout", { x: 0.74, y: -0.03, z: 0 }, { x: 0.26, y: 0.48, z: 0.54 }, { x: 0, y: 0, z: -0.12 }));
    for (const side of [-1, 1]) {
        head.addChild(part(`ear${side}`, "capy_mesh_sphere", "capy_mat_fur_dark", { x: -0.12, y: 0.42, z: 0.22 * side }, { x: 0.1, y: 0.13, z: 0.07 }));
        head.addChild(part(`eye${side}`, "capy_mesh_sphere", "capy_mat_eye", { x: 0.36, y: 0.2, z: 0.31 * side }, { x: 0.065, y: 0.065, z: 0.04 }));
        head.addChild(part(`nose${side}`, "capy_mesh_sphere", "capy_mat_eye", { x: 0.88, y: 0.1, z: 0.1 * side }, { x: 0.03, y: 0.04, z: 0.04 }));
    }
    let orange;
    if (options.orange) {
        orange = part("yuzu", "capy_mesh_sphere", "capy_mat_yuzu", { x: 0.18, y: 0.6, z: 0 }, { x: 0.25, y: 0.23, z: 0.25 });
        orange.addChild(part("leaf", "capy_mesh_box", "capy_mat_leaf", { x: 0.35, y: 1.05, z: 0 }, { x: 0.9, y: 0.12, z: 0.45 }, { x: 0, y: 0.4, z: 0.35 }));
        head.addChild(orange);
    }

    const legs = [];
    for (const [x, z] of [
        [0.62, 0.34],
        [0.62, -0.34],
        [-0.62, 0.34],
        [-0.62, -0.34],
    ]) {
        const pivot = new BrioObject3D(`${id}_leg_${legs.length}`);
        pivot.transform.position = { x, y: 0.55, z };
        pivot.addChild(part(`leg_${legs.length}_mesh`, "capy_mesh_leg", "capy_mat_fur_dark", { x: 0, y: -0.3, z: 0 }, { x: 0.15, y: 0.55, z: 0.15 }));
        root.addChild(pivot);
        legs.push(pivot);
    }
    return { root, body, head, legs, orange };
}

/** Walk cycle: swings the legs and bobs the body. `phase` grows with distance travelled. */
export function animateRun(capy, phase, amount = 1) {
    const swing = Math.sin(phase) * 0.9 * amount;
    capy.legs[0].transform.rotation.z = swing;
    capy.legs[3].transform.rotation.z = swing;
    capy.legs[1].transform.rotation.z = -swing;
    capy.legs[2].transform.rotation.z = -swing;
    capy.body.transform.position.y = Math.abs(Math.sin(phase)) * 0.12 * amount;
    capy.head.transform.rotation.z = Math.sin(phase * 2) * 0.05 * amount;
}
