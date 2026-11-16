// Ready-made pieces of BrioJS code the playground can insert at the cursor. Labels are translated; the code itself
// stays in English, like the engine's API.
export interface Snippet {
    id: string;
    label: { en: string; pt: string };
    code: string;
}

export const SNIPPETS: Snippet[] = [
    {
        id: "object3d",
        label: { en: "3D object (mesh + material)", pt: "Objeto 3D (malha + material)" },
        code: `// In preload(): BrioMesh.createSphere("mesh_ball", 0.5, 24), new BrioMaterial("mat_ball", { shading: "standard", color: "#2c7a7b" })
const ball = new BrioObject3D("ball", "mesh_ball", "mat_ball");
ball.transform.position = { x: 0, y: 1, z: 0 };
// Return it from load(), or add it later with game.instantiate(ball)
`,
    },
    {
        id: "light",
        label: { en: "Point light that flickers", pt: "Luz pontual que tremula" },
        code: `const lamp = new BrioLight("lamp", "point", { color: "#ffb35c", intensity: 6, range: 8, position: { x: 0, y: 2, z: 0 } });
// Return it from load(); then, in update():
// lamp.intensity = 6 + Math.sin(game.time * 12) * 0.6;
`,
    },
    {
        id: "input",
        label: { en: "Keyboard, gamepad and touch input", pt: "Entrada por teclado, gamepad e toque" },
        code: `game.useKeyboard();
game.useGamepad();
game.input
    .bind("left", "ArrowLeft", "a", BrioInputMap.padAxis(0, -1))
    .bind("right", "ArrowRight", "d", BrioInputMap.padAxis(0, 1))
    .bind("jump", " ", BrioInputMap.padButton("south"));
// In update(): const move = game.input.axis("left", "right"); if (game.input.isPressed("jump")) { ... }
`,
    },
    {
        id: "sound",
        label: { en: "Sound effect and music", pt: "Efeito sonoro e música" },
        code: `// In preload(): new BrioAudio("aud_jump", "./assets/jump.wav"), new BrioAudio("aud_music", "./assets/music.mp3", { bus: "bgm", volume: 0.5 })
// Then, anywhere after load():
// updater.getAudio("aud_jump").play();
// updater.getAudio("aud_music").playLoop();
`,
    },
    {
        id: "follow",
        label: { en: "Camera that follows the player", pt: "Câmera que segue o jogador" },
        code: `// In update(): keep the camera a little behind and above the player
const target = game.gameObjects3D.get("player").transform.position;
camera.position = { x: target.x, y: target.y + 4, z: target.z + 7 };
camera.target = { x: target.x, y: target.y + 0.5, z: target.z };
`,
    },
    {
        id: "shader",
        label: { en: "Custom shader (GLSL hook)", pt: "Shader customizado (hook GLSL)" },
        code: `// A glowing, pulsing surface. Add it to preload() and use it from a material:
// new BrioMaterial("mat_glow", { shading: "standard", color: "#7d6bff", shader: "shd_glow", parameters: { uSpeed: 3 } })
new BrioShader("shd_glow", {
    fragment: \`
        uniform float uSpeed;
        void surface(inout BrioSurface s) {
            float pulse = sin(TIME * uSpeed) * 0.5 + 0.5;
            s.emissive += s.baseColor * pulse * 0.8;
        }\`,
});
`,
    },
    {
        id: "model",
        label: { en: "Load a glTF / GLB model", pt: "Carregar um modelo glTF / GLB" },
        code: `// Drop a .glb into assets/ first. In preload():
// new BrioModel("tree", "./assets/tree.glb")
// In load((assets) => ...), turn it into an object (meshes, materials and a collider come with it):
const tree = assets.getModel("tree").instantiate("tree_1");
tree.transform.position = { x: 2, y: 0, z: -1 };
`,
    },
    {
        id: "save",
        label: { en: "Save the best score", pt: "Salvar o recorde" },
        code: `let best = Number(BrioStorage.local.get("my-game.best") ?? 0);
// When the run ends:
// if (score > best) { best = score; BrioStorage.local.set("my-game.best", best); }
`,
    },
    {
        id: "checkpoint",
        label: { en: "Checkpoint and restore the whole game", pt: "Checkpoint e restauração do jogo inteiro" },
        code: `// Saves every object, the active scene and the random seed in memory
game.createCheckPoint();
// ...later (for example when the player falls), go back to that moment:
// game.restoreCheckPoint();
`,
    },
];
