// Catalog of the demo games. Each game lives in public/games/<id>/ as a normal BrioJS project (index.html,
// main.js, modules and assets), so the same folder runs in the player and opens in the playground.

export interface Credit {
    what: { en: string; pt: string };
    author: string;
    url: string;
    license: string;
}

export interface GameInfo {
    id: string;
    title: string;
    kind: "2D" | "3D";
    accent: string;
    tagline: { en: string; pt: string };
    description: { en: string; pt: string };
    controls: { en: string[]; pt: string[] };
    /** Engine features the game leans on (shown as chips). */
    features: string[];
    credits: Credit[];
    /** Whether the game supports touch controls. */
    touch: boolean;
}

export const GAMES: GameInfo[] = [
    {
        id: "lumen-vigil",
        title: "Lumen Vigil",
        kind: "2D",
        accent: "#7b6cf0",
        tagline: {
            en: "Survive the night against the horde. Your spells cast themselves; you just keep moving.",
            pt: "Sobreviva à noite contra a horda. Os feitiços se lançam sozinhos; você só precisa continuar se mexendo.",
        },
        description: {
            en: "A pixel-art arena survivor drawn entirely on the GPU: hundreds of monsters, sprite-sheet animation in a custom shader, holy spell effects and a level-up draft every minute.",
            pt: "Um survivor de arena em pixel art desenhado inteiro na GPU: centenas de monstros, animação de sprite sheet num shader customizado, efeitos de feitiço e uma escolha de upgrade a cada nível.",
        },
        controls: {
            en: ["WASD / arrows: move", "1 2 3: pick an upgrade", "P: pause"],
            pt: ["WASD / setas: mover", "1 2 3: escolher upgrade", "P: pausar"],
        },
        features: ["WebGL2", "BrioShader", "Sprite sheets", "Spatial hash", "Web Audio"],
        touch: true,
        credits: [
            {
                what: { en: "Knight sprite, sounds and music", pt: "Sprite do cavaleiro, sons e música" },
                author: "Brackeys, analogStudios_",
                url: "https://brackeysgames.itch.io/brackeys-platformer-bundle",
                license: "CC0",
            },
            {
                what: { en: "64 tiny monsters", pt: "64 monstrinhos" },
                author: "JedimeisterX (Pixel-Deck.com)",
                url: "https://jedimeisterx.itch.io/64-tiny-monsters-free-32x32-pixel-art",
                license: "Free, commercial use allowed",
            },
            {
                what: { en: "Holy spell effects", pt: "Efeitos de feitiço" },
                author: "BDragon1727",
                url: "https://bdragon1727.itch.io/pixel-holy-spell-effect-32x32-pack-3",
                license: "Free for non-commercial use, no redistribution",
            },
        ],
    },
    {
        id: "araucaria-run",
        title: "Araucária Run",
        kind: "3D",
        accent: "#3f8a55",
        tagline: {
            en: "Capibrio is late for the hot spring. Dodge the forest, grab the yuzus.",
            pt: "A Capibrio está atrasada para a fonte termal. Desvie da floresta e pegue as laranjas.",
        },
        description: {
            en: "A low-poly endless runner through a Paraná forest: glTF models, directional shadows that follow the camera, fog, tone mapping and a procedural capybara built from primitives.",
            pt: "Um endless runner low-poly por uma floresta do Paraná: modelos glTF, sombras direcionais que seguem a câmera, neblina, tone mapping e uma capivara procedural feita de primitivas.",
        },
        controls: {
            en: ["A D / arrows: change lane", "W / Space: jump", "S: roll"],
            pt: ["A D / setas: trocar de faixa", "W / Espaço: pular", "S: rolar"],
        },
        features: ["WebGL2", "glTF", "Shadows", "Fog", "Tone mapping"],
        touch: true,
        credits: [
            {
                what: { en: "Forest Nature Pack (trees, rocks, bushes)", pt: "Forest Nature Pack (árvores, pedras, arbustos)" },
                author: "Kay Lousberg (KayKit)",
                url: "https://kaylousberg.itch.io/kaykit-forest",
                license: "CC0",
            },
            {
                what: { en: "Sounds and music", pt: "Sons e música" },
                author: "Brackeys",
                url: "https://brackeysgames.itch.io/brackeys-platformer-bundle",
                license: "CC0",
            },
        ],
    },
    {
        id: "prism-stack",
        title: "Prism Stack",
        kind: "3D",
        accent: "#e0457b",
        tagline: {
            en: "One button. Drop the slab, keep what overlaps, build as high as you dare.",
            pt: "Um botão. Solte a placa, fique com o que sobrepõe e construa o mais alto que conseguir.",
        },
        description: {
            en: "A one-button stacking game in glowing glass: a gradient sky written as a BrioShader, emissive materials, metallic-roughness shading, AgX tone mapping and a camera that rises with your tower.",
            pt: "Um jogo de empilhar de um botão só, em vidro brilhante: céu em degradê escrito como BrioShader, materiais emissivos, shading metallic-roughness, tone mapping AgX e uma câmera que sobe com a torre.",
        },
        controls: {
            en: ["Space / click / tap: drop", "R: restart"],
            pt: ["Espaço / clique / toque: soltar", "R: reiniciar"],
        },
        features: ["WebGL2", "BrioShader", "PBR", "Emissive", "Point lights"],
        touch: true,
        credits: [
            {
                what: { en: "Shaders, sounds (synthesized) and code", pt: "Shaders, sons (sintetizados) e código" },
                author: "BrioJS",
                url: "https://github.com/glgreg/brio-js",
                license: "MIT",
            },
        ],
    },
    {
        id: "comet-garden",
        title: "Comet Garden",
        kind: "2D",
        accent: "#ff48b0",
        tagline: {
            en: "Pull back, let go, and let the planets bend your comet into the flower.",
            pt: "Puxe, solte e deixe os planetas curvarem o seu cometa até a flor.",
        },
        description: {
            en: "A gravity golf puzzle printed like a risograph poster: two fluorescent inks, halftone dots and misregistered outlines, all drawn by one BrioShader with no textures. Eight levels, moving planets and a trajectory preview that runs the same physics ahead of time.",
            pt: "Um quebra-cabeça de golfe gravitacional impresso como um pôster de risografia: duas tintas fluorescentes, retícula de meio-tom e contornos desalinhados, tudo desenhado por um único BrioShader sem texturas. Oito níveis, planetas em movimento e uma prévia da trajetória que roda a mesma física antes do lançamento.",
        },
        controls: {
            en: ["Drag and release: launch", "R: reset the comet", "P / N: previous / next level"],
            pt: ["Arrastar e soltar: lançar", "R: recomeçar o cometa", "P / N: nível anterior / próximo"],
        },
        features: ["WebGL2", "BrioShader", "Orthographic camera", "Pointer input", "BrioStorage"],
        touch: true,
        credits: [
            {
                what: { en: "Shaders, levels, sounds (synthesized) and code", pt: "Shaders, níveis, sons (sintetizados) e código" },
                author: "BrioJS",
                url: "https://github.com/glgreg/brio-js",
                license: "MIT",
            },
        ],
    },
];

export function findGame(id: string | null): GameInfo | undefined {
    return GAMES.find((g) => g.id === id);
}
