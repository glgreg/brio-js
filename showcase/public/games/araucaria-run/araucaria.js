// Araucária (Paraná pine), the tree on Paraná's flag: a tall bare trunk carrying a flat, upturned crown like an
// open umbrella. Built from cylinders with flat shading.
import { BrioMesh, BrioMaterial, BrioObject3D } from "@brio-js/core";

export function araucariaAssets() {
    return [
        BrioMesh.createCylinder("arau_mesh_trunk", 0.6, 1, 1, 7),
        // Crown tiers: wide at the top, narrow at the bottom (an upturned bowl)
        BrioMesh.createCylinder("arau_mesh_tier", 1, 0.35, 1, 9),
        BrioMesh.createCylinder("arau_mesh_branch", 0.5, 1, 1, 5),
        new BrioMaterial("arau_mat_bark", { shading: "flat", color: "#6b4630" }),
        new BrioMaterial("arau_mat_needles", { shading: "flat", color: "#2f5c40" }),
        new BrioMaterial("arau_mat_needles_light", { shading: "flat", color: "#477a4c" }),
    ];
}

let count = 0;

/** Builds an araucária with its base at y = 0. `height` is the trunk height in world units. */
export function createAraucaria(height = 5, seed = Math.random()) {
    const id = `arau_${count++}`;
    const root = new BrioObject3D(id);
    const trunk = new BrioObject3D(`${id}_trunk`, "arau_mesh_trunk", "arau_mat_bark");
    trunk.transform.position = { x: 0, y: height / 2, z: 0 };
    trunk.transform.scale = { x: 0.16, y: height, z: 0.16 };
    root.addChild(trunk);
    const tiers = 2 + Math.floor(seed * 2);
    for (let i = 0; i < tiers; i++) {
        const t = i / Math.max(1, tiers - 1);
        const radius = 1.9 - t * 0.9 + seed * 0.3;
        const tier = new BrioObject3D(
            `${id}_tier_${i}`,
            "arau_mesh_tier",
            i % 2 ? "arau_mat_needles_light" : "arau_mat_needles",
        );
        tier.transform.position = { x: 0, y: height - 0.2 + i * 0.42, z: 0 };
        tier.transform.scale = { x: radius, y: 0.45, z: radius };
        tier.transform.rotation.y = seed * 6 + i;
        root.addChild(tier);
    }
    // A few branches reaching up toward the crown
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + seed * 3;
        const branch = new BrioObject3D(`${id}_branch_${i}`, "arau_mesh_branch", "arau_mat_bark");
        branch.transform.position = { x: Math.cos(angle) * 0.45, y: height - 0.55, z: Math.sin(angle) * 0.45 };
        branch.transform.scale = { x: 0.06, y: 0.9, z: 0.06 };
        branch.transform.rotation = { x: Math.sin(angle) * 0.9, y: 0, z: -Math.cos(angle) * 0.9 };
        root.addChild(branch);
    }
    return root;
}
