import { describe, it, expect, vi } from "vitest";
import { BrioModel } from "../../src/assets/BrioModel";
import { BrioMesh } from "../../src/assets/BrioMesh";
import { BrioMaterial } from "../../src/assets/BrioMaterial";
import { OBJLoader } from "../../src/assets/loaders/OBJLoader";
import { GLBLoader } from "../../src/assets/loaders/GLBLoader";
import { GLTFLoader } from "../../src/assets/loaders/GLTFLoader";
import { BrioGame } from "../../src/game/BrioGame";
import { BrioObject3D } from "../../src/objects/BrioObject3D";

describe("3D Model Asset Pipeline (OBJLoader, GLBLoader, GLTFLoader, BrioModel)", () => {
    describe("OBJLoader", () => {
        it("parses Wavefront OBJ and MTL text into meshes and materials", () => {
            const mtlText = `
                # Material Library
                newmtl mat_gold
                Kd 1.0 0.8 0.0
                d 0.9

                newmtl mat_blue
                Kd 0.0 0.2 1.0
                Tr 0.1
            `;

            const objText = `
                # Cube with 2 groups and quad face
                v 0 0 0
                v 1 0 0
                v 1 1 0
                v 0 1 0
                v 0 0 1
                v 1 0 1
                v 1 1 1
                v 0 1 1
                vt 0 0
                vt 1 0
                vt 1 1
                vt 0 1
                vn 0 0 1
                vn 0 1 0

                o FrontFace
                usemtl mat_gold
                f 1/1/1 2/2/1 3/3/1 4/4/1

                o TopFace
                usemtl mat_blue
                f 4/1/2 3/2/2 7/3/2 8/4/2
            `;

            const parsed = OBJLoader.parse(objText, mtlText, "mod_cube");

            // Materials check
            expect(parsed.materials.length).toBe(2);
            expect(parsed.materials[0].name).toBe("mat_gold");
            expect(parsed.materials[0].color).toBe("#ffcc00");
            expect(parsed.materials[0].opacity).toBeCloseTo(0.9);
            expect(parsed.materials[1].name).toBe("mat_blue");
            expect(parsed.materials[1].color).toBe("#0033ff");
            expect(parsed.materials[1].opacity).toBeCloseTo(0.9);

            // Meshes check (quad should be triangulated into 2 triangles / 6 indices)
            expect(parsed.meshes.length).toBe(2);
            const frontMesh = parsed.meshes[0];
            expect(frontMesh.name).toBe("mod_cube_FrontFace");
            expect(frontMesh.indices.length).toBe(6);
            expect(frontMesh.triangleCount).toBe(2);
            expect(frontMesh.vertexCount).toBe(4);

            const bbox = frontMesh.computeBoundingBox();
            expect(bbox.min.x).toBe(0);
            expect(bbox.max.x).toBe(1);
            expect(bbox.min.y).toBe(0);
            expect(bbox.max.y).toBe(1);
            expect(bbox.size.x).toBe(1);
            expect(bbox.size.y).toBe(1);
            expect(bbox.center.x).toBe(0.5);
        });

        it("computes flat normals when normals are omitted in OBJ", () => {
            const objText = `
                v 0 0 0
                v 2 0 0
                v 0 2 0
                f 1 2 3
            `;
            const parsed = OBJLoader.parse(objText, undefined, "mod_triangle");
            expect(parsed.meshes.length).toBe(1);
            const mesh = parsed.meshes[0];
            expect(mesh.normals.length).toBe(9);
            expect(mesh.normals[2]).toBe(1); // Normal pointing towards +Z
        });
    });

    describe("GLBLoader & GLTFLoader", () => {
        // Helper to construct a synthetic valid GLB container for a single triangle
        function createSyntheticGLB(): ArrayBuffer {
            const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
            const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
            const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
            const indices = new Uint16Array([0, 1, 2]);

            const posBytes = new Uint8Array(positions.buffer);
            const normBytes = new Uint8Array(normals.buffer);
            const uvBytes = new Uint8Array(uvs.buffer);
            const idxBytes = new Uint8Array(indices.buffer);

            const binLength = posBytes.byteLength + normBytes.byteLength + uvBytes.byteLength + idxBytes.byteLength;
            const binBuffer = new Uint8Array(binLength);
            let offset = 0;

            binBuffer.set(posBytes, offset);
            const posOffset = offset;
            offset += posBytes.byteLength;

            binBuffer.set(normBytes, offset);
            const normOffset = offset;
            offset += normBytes.byteLength;

            binBuffer.set(uvBytes, offset);
            const uvOffset = offset;
            offset += uvBytes.byteLength;

            binBuffer.set(idxBytes, offset);
            const idxOffset = offset;
            offset += idxBytes.byteLength;

            const gltfJson = {
                asset: { version: "2.0" },
                buffers: [{ byteLength: binLength }],
                bufferViews: [
                    { buffer: 0, byteOffset: posOffset, byteLength: posBytes.byteLength },
                    { buffer: 0, byteOffset: normOffset, byteLength: normBytes.byteLength },
                    { buffer: 0, byteOffset: uvOffset, byteLength: uvBytes.byteLength },
                    { buffer: 0, byteOffset: idxOffset, byteLength: idxBytes.byteLength },
                ],
                accessors: [
                    { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: "VEC3" }, // 0: pos
                    { bufferView: 1, byteOffset: 0, componentType: 5126, count: 3, type: "VEC3" }, // 1: norm
                    { bufferView: 2, byteOffset: 0, componentType: 5126, count: 3, type: "VEC2" }, // 2: uv
                    { bufferView: 3, byteOffset: 0, componentType: 5123, count: 3, type: "SCALAR" }, // 3: indices
                ],
                materials: [
                    {
                        name: "mat_ruby",
                        pbrMetallicRoughness: {
                            baseColorFactor: [0.9, 0.1, 0.2, 1.0],
                        },
                    },
                ],
                meshes: [
                    {
                        name: "mesh_tri",
                        primitives: [
                            {
                                attributes: {
                                    POSITION: 0,
                                    NORMAL: 1,
                                    TEXCOORD_0: 2,
                                },
                                indices: 3,
                                material: 0,
                            },
                        ],
                    },
                ],
            };

            const jsonStr = JSON.stringify(gltfJson);
            const jsonBytes = new TextEncoder().encode(jsonStr);
            const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
            const jsonChunkLength = jsonBytes.byteLength + jsonPadding;

            const totalLength = 12 + (8 + jsonChunkLength) + (8 + binLength);
            const glbBuffer = new ArrayBuffer(totalLength);
            const view = new DataView(glbBuffer);

            // Header
            view.setUint32(0, 0x46546c67, true); // "glTF"
            view.setUint32(4, 2, true); // Version 2
            view.setUint32(8, totalLength, true);

            // Chunk 0 (JSON)
            view.setUint32(12, jsonChunkLength, true);
            view.setUint32(16, 0x4e4f534a, true); // "JSON"
            const glbBytes = new Uint8Array(glbBuffer);
            glbBytes.set(jsonBytes, 20);
            for (let p = 0; p < jsonPadding; p++) {
                glbBytes[20 + jsonBytes.byteLength + p] = 0x20; // Space padding
            }

            // Chunk 1 (BIN)
            const binChunkHeaderOffset = 20 + jsonChunkLength;
            view.setUint32(binChunkHeaderOffset, binLength, true);
            view.setUint32(binChunkHeaderOffset + 4, 0x004e4942, true); // "BIN\0"
            glbBytes.set(binBuffer, binChunkHeaderOffset + 8);

            return glbBuffer;
        }

        it("parses binary GLB container and decodes geometry, accessors and materials", () => {
            const glb = createSyntheticGLB();
            const parsed = GLBLoader.parse(glb, "mod_synth");

            expect(parsed.meshes.length).toBe(1);
            const mesh = parsed.meshes[0];
            expect(mesh.name).toBe("mesh_tri");
            expect(mesh.vertexCount).toBe(3);
            expect(mesh.triangleCount).toBe(1);
            expect(mesh.positions[3]).toBe(1); // second vertex X = 1
            expect(mesh.normals[2]).toBe(1); // Z normal = 1
            expect(mesh.uvs[2]).toBe(1); // UV u1 = 1
            expect(mesh.indices).toEqual(new Uint16Array([0, 1, 2]));

            expect(parsed.materials.length).toBe(1);
            expect(parsed.materials[0].name).toBe("mat_ruby");
            // baseColorFactor is linear light (glTF spec); CSS colors are sRGB-encoded
            expect(parsed.materials[0].color).toBe("#f3597c");
        });

        it("throws descriptive errors on invalid GLB magic or version", () => {
            const corruptBuffer = new ArrayBuffer(24);
            const view = new DataView(corruptBuffer);
            view.setUint32(0, 0x12345678, true); // Invalid magic
            view.setUint32(4, 2, true);
            view.setUint32(8, 24, true);

            expect(() => GLBLoader.parse(corruptBuffer)).toThrow("Invalid GLB binary magic");
        });

        it("parses ASCII glTF JSON with base64 embedded binary buffer via GLTFLoader", () => {
            const positions = new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]);
            const indices = new Uint16Array([0, 1, 2]);

            const posBytes = new Uint8Array(positions.buffer);
            const idxBytes = new Uint8Array(indices.buffer);
            const combined = new Uint8Array(posBytes.byteLength + idxBytes.byteLength);
            combined.set(posBytes, 0);
            combined.set(idxBytes, posBytes.byteLength);

            let binaryString = "";
            for (let i = 0; i < combined.length; i++) {
                binaryString += String.fromCharCode(combined[i]);
            }
            const base64Data = btoa(binaryString);

            const gltfText = JSON.stringify({
                asset: { version: "2.0" },
                buffers: [
                    {
                        uri: `data:application/octet-stream;base64,${base64Data}`,
                        byteLength: combined.byteLength,
                    },
                ],
                bufferViews: [
                    { buffer: 0, byteOffset: 0, byteLength: posBytes.byteLength },
                    { buffer: 0, byteOffset: posBytes.byteLength, byteLength: idxBytes.byteLength },
                ],
                accessors: [
                    { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: "VEC3" },
                    { bufferView: 1, byteOffset: 0, componentType: 5123, count: 3, type: "SCALAR" },
                ],
                meshes: [
                    {
                        name: "mesh_embedded",
                        primitives: [
                            {
                                attributes: { POSITION: 0 },
                                indices: 1,
                            },
                        ],
                    },
                ],
            });

            const parsed = GLTFLoader.parse(gltfText, [], "mod_embedded");
            expect(parsed.meshes.length).toBe(1);
            expect(parsed.meshes[0].name).toBe("mesh_embedded");
            expect(parsed.meshes[0].positions[3]).toBe(2);
            expect(parsed.meshes[0].indices.length).toBe(3);
        });
    });

    describe("BrioModel", () => {
        it("constructs BrioModel fromData, calculates bounding box, and provides fallback empty instance", () => {
            const boxMesh = BrioMesh.createBox("mesh_box", 2, 4, 6);
            const material = new BrioMaterial("mat_crate", { color: "#885522" });
            const model = BrioModel.fromData("mod_crate", [boxMesh], [material]);

            expect(model.name).toBe("mod_crate");
            expect(model.isLoaded).toBe(true);
            expect(model.meshes.size).toBe(1);
            expect(model.materials.size).toBe(1);
            expect(model.primaryMesh?.name).toBe("mesh_box");
            expect(model.primaryMaterial?.name).toBe("mat_crate");

            const bbox = model.boundingBox;
            expect(bbox.size.x).toBe(2);
            expect(bbox.size.y).toBe(4);
            expect(bbox.size.z).toBe(6);
            expect(bbox.center.x).toBe(0);
            expect(bbox.center.y).toBe(0);
            expect(bbox.center.z).toBe(0);

            const empty = BrioModel.getEmptyInstance();
            expect(empty.name).toBe("empty_model");
            expect(empty.isLoaded).toBe(true);
            expect(empty.meshes.size).toBe(0);
        });
    });

    describe("BrioGame Lifecycle with 3D Models and Entities", () => {
        it("preloads BrioModel, retrieves it via getModel in load, registers BrioObject3D, and binds to ECS", async () => {
            const container = document.createElement("div");
            const game = new BrioGame(640, 480, container, "3d");

            const boxMesh = BrioMesh.createBox("mesh_fighter", 4, 2, 8);
            const material = new BrioMaterial("mat_hull", { color: "#336699" });
            const shipModel = BrioModel.fromData("mod_fighter", [boxMesh], [material]);

            // Spy on shipModel.load so preload executes cleanly
            vi.spyOn(shipModel, "load").mockImplementation(async () => shipModel);

            game.preload(() => [shipModel]);

            let loadedModelRetrieved = false;
            let loadedShipObj: BrioObject3D | undefined;

            game.load((assets) => {
                const retrievedModel = assets.getModel("mod_fighter");
                expect(retrievedModel.name).toBe("mod_fighter");
                expect(retrievedModel.primaryMesh?.name).toBe("mesh_fighter");
                loadedModelRetrieved = true;

                const ship = new BrioObject3D(
                    "obj_player_ship",
                    retrievedModel.primaryMesh?.name,
                    retrievedModel.primaryMaterial?.name,
                );
                ship.transform.position.set(0, 5, -20);
                ship.addCollider3D("box", "solid", { x: 0, y: 0, z: 0 }, retrievedModel.boundingBox.size);
                loadedShipObj = ship;
                return [ship];
            });

            // Wait for lifecycle promise
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(loadedModelRetrieved).toBe(true);
            expect(game.loadedModels.has("mod_fighter")).toBe(true);
            expect(game.gameObjects3D.has("obj_player_ship")).toBe(true);

            // Verify ECS binding
            expect(loadedShipObj?.entityId).toBeGreaterThanOrEqual(0);
            expect(game.ecsWorld.isAlive(loadedShipObj!.entityId)).toBe(true);

            // Test checkpoint persistence with 3D models and objects
            game.createCheckPoint();

            // Mutate and restore checkpoint: the handle re-adopts the restored slot values
            loadedShipObj!.transform.position.y = 999;
            const restored = game.restoreCheckPoint();
            expect(restored).toBe(true);
            expect(game.gameObjects3D.has("obj_player_ship")).toBe(true);
            expect(loadedShipObj!.transform.position.y).toBe(5);
            expect(game.ecsWorld.isAlive(loadedShipObj!.entityId, loadedShipObj!.entityGeneration)).toBe(true);

            // Meshes and materials of preloaded models are registered for the 3D passes
            expect(game.loadedMeshes.has("mesh_fighter")).toBe(true);
            expect(game.loadedMaterials.has("mat_hull")).toBe(true);

            // Test model.instantiate
            const multiMeshModel = BrioModel.fromData(
                "mod_robot",
                [BrioMesh.createBox("head", 1, 1, 1), BrioMesh.createBox("body", 2, 2, 2)],
                [new BrioMaterial("mat_metal", { color: "#888888" })],
            );
            const instantiatedRoot = multiMeshModel.instantiate("obj_robot");
            expect(instantiatedRoot.name).toBe("obj_robot");
            expect(instantiatedRoot.transform.children.length).toBe(2);
            expect(instantiatedRoot.children.length).toBe(2);
            expect(instantiatedRoot.children[0].mesh).toBe("head");
            expect(instantiatedRoot.collision).toBeDefined();
            expect(instantiatedRoot.collision?.shape).toBe("box");
        });
    });
});
