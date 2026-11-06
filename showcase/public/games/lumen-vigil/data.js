// Game data: monsters, spells and upgrades. Tweak the numbers here to change the feel of a run.

/** Monsters, in the order of assets/monsters.png (32x32 cells). */
export const MONSTERS = [
    { id: "slime", hp: 10, speed: 30, damage: 8, xp: 1, scale: 1 },
    { id: "bat", hp: 6, speed: 64, damage: 6, xp: 1, scale: 1, wobble: true },
    { id: "ghost", hp: 16, speed: 40, damage: 10, xp: 2, scale: 1 },
    { id: "skull", hp: 24, speed: 46, damage: 12, xp: 2, scale: 1 },
    { id: "eye", hp: 32, speed: 36, damage: 12, xp: 3, scale: 1.1 },
    { id: "imp", hp: 28, speed: 58, damage: 14, xp: 3, scale: 1 },
    { id: "shroom", hp: 50, speed: 28, damage: 16, xp: 4, scale: 1.1 },
    { id: "spider", hp: 36, speed: 72, damage: 14, xp: 4, scale: 1 },
    { id: "lich", hp: 120, speed: 36, damage: 20, xp: 10, scale: 1.5 },
    { id: "golem", hp: 900, speed: 26, damage: 30, xp: 60, scale: 2.5, boss: true },
    { id: "lantern", hp: 70, speed: 44, damage: 18, xp: 6, scale: 1.2 },
    { id: "vampire", hp: 24, speed: 86, damage: 12, xp: 3, scale: 1.1, wobble: true },
];

/** Which monsters can appear, by minute of the night (index = minute). */
export const WAVES = [
    [0, 1],
    [0, 1, 2, 3],
    [2, 3, 4, 5, 1],
    [4, 5, 6, 7, 11],
    [6, 7, 8, 10, 11],
];

/** Bosses: a stone golem walks out of the dark at these times (seconds). */
export const BOSS_TIMES = [120, 205];

/**
 * Visual effects from the holy spell sheets: sheet, row, frames (64x64 cells).
 * holy-a.png has 3 rows of up to 19 frames, holy-b.png has 9 rows of up to 11 frames.
 */
export const EFFECTS = {
    bloom: { sheet: "a", row: 0, frames: 17 },
    sigil: { sheet: "a", row: 1, frames: 15, loopFrames: 8 },
    star: { sheet: "a", row: 2, frames: 18 },
    arrows: { sheet: "b", row: 0, frames: 7 },
    ward: { sheet: "b", row: 1, frames: 7, loopFrames: 5 },
    frame: { sheet: "b", row: 2, frames: 8 },
    crescent: { sheet: "b", row: 3, frames: 9 },
    claws: { sheet: "b", row: 4, frames: 9 },
    sun: { sheet: "b", row: 5, frames: 9 },
    halo: { sheet: "b", row: 6, frames: 9, loopFrames: 5 },
    gold: { sheet: "b", row: 7, frames: 10 },
    ember: { sheet: "b", row: 8, frames: 11 },
};

/** Spells cast themselves; each upgrade raises the level (1 to 5). */
export const SPELLS = {
    halo: { effect: "halo", max: 5 },
    smite: { effect: "star", max: 5 },
    sun: { effect: "sun", max: 5 },
    crescent: { effect: "crescent", max: 5 },
    ward: { effect: "ward", max: 5 },
    sigil: { effect: "sigil", max: 5 },
};

/** Passive upgrades. */
export const PASSIVES = {
    swift: { effect: "arrows", max: 3 },
    vigor: { effect: "bloom", max: 3 },
    lure: { effect: "gold", max: 3 },
    zeal: { effect: "ember", max: 3 },
};
