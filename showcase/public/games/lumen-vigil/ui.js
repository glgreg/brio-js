// The HTML overlay of Lumen Vigil: title, HUD, blessing cards and end screens. The game world is drawn by BrioJS
// on the canvas underneath; text and menus are plain DOM so they stay crisp at any size.
import { t } from "./strings.js";
import { EFFECTS } from "./data.js";

const $ = (id) => document.getElementById(id);
const screens = $("screens");

// Static text
document.title = `${t("title")} · BrioJS`;
for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);

let startRequested = false;
const requestStart = (e) => {
    if (e?.target?.closest?.(".card")) return;
    startRequested = true;
};
window.addEventListener("keydown", (e) => {
    if (!e.repeat && !["Shift", "Control", "Alt", "Meta"].includes(e.key)) requestStart(e);
});
screens.addEventListener("pointerdown", requestStart);

export function consumeStart() {
    const value = startRequested;
    startRequested = false;
    return value;
}

export function showTitle(missingEffects) {
    screens.dataset.screen = "title";
    $("missing").hidden = !missingEffects;
    startRequested = false;
}

export function hideScreens() {
    screens.dataset.screen = "";
    $("hud").hidden = false;
    startRequested = false;
}

export function noWebGL() {
    $("nowebgl").hidden = false;
}

// ---- HUD ----
const hpFill = $("hp-fill");
const hpText = $("hp-text");
const xpFill = $("xp-fill");
const levelEl = $("level");
const clockEl = $("clock");
const killsEl = $("kills");
let last = "";
export function updateHud({ hp, maxHp, xp, need, level, left, kills }) {
    const minutes = Math.floor(left / 60);
    const seconds = String(Math.floor(left % 60)).padStart(2, "0");
    const key = `${Math.ceil(hp)}|${maxHp}|${xp}|${need}|${level}|${minutes}:${seconds}|${kills}`;
    if (key === last) return;
    last = key;
    hpFill.style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    hpText.textContent = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    xpFill.style.width = `${Math.min(100, (xp / need) * 100)}%`;
    levelEl.textContent = `${t("level")} ${level}`;
    clockEl.textContent = `${minutes}:${seconds}`;
    killsEl.textContent = kills;
}

export function hurt() {
    const v = $("vignette");
    v.classList.remove("on");
    void v.offsetWidth;
    v.classList.add("on");
}

export function banner(text) {
    const b = $("banner");
    b.textContent = text;
    b.classList.remove("on");
    void b.offsetWidth;
    b.classList.add("on");
}

// ---- Spell icons: the first strong frame of each effect, cut from the sheet with CSS ----
let sheetUrls;
function iconStyle(effect) {
    const fx = EFFECTS[effect];
    if (!sheetUrls || !fx) return "";
    const frame = Math.min(fx.frames - 1, Math.floor(fx.frames * 0.45));
    const url = fx.sheet === "a" ? sheetUrls.a : sheetUrls.b;
    const cols = fx.sheet === "a" ? 19 : 11;
    const rows = fx.sheet === "a" ? 3 : 9;
    return `background-image:url('${url}');background-size:${cols * 100}% ${rows * 100}%;background-position:${(frame / (cols - 1)) * 100}% ${(fx.row / (rows - 1)) * 100}%`;
}

export function setSheets(urls) {
    sheetUrls = urls;
}

export function updateSpells(owned) {
    $("spells").innerHTML = Object.entries(owned)
        .map(([id, level]) => `<li title="${t(id)}"><i style="${iconStyle(effectOf(id))}"></i><b>${level}</b></li>`)
        .join("");
}

const EFFECT_OF = { halo: "halo", smite: "star", sun: "sun", crescent: "crescent", ward: "ward", sigil: "sigil", swift: "arrows", vigor: "bloom", lure: "gold", zeal: "ember" };
const effectOf = (id) => EFFECT_OF[id];

// ---- Blessing cards ----
let choices = [];
let onPick;
export function showChoices(picks, urls, callback) {
    sheetUrls = urls ?? sheetUrls;
    choices = picks;
    onPick = callback;
    $("cards").innerHTML = picks
        .map(
            (p, i) => `<button class="card" type="button" data-i="${i}">
              <span class="card-key">${i + 1}</span>
              <i class="card-icon" style="${iconStyle(p.effect)}"></i>
              <strong>${t(p.id)}</strong>
              <span class="card-level">${p.level === 0 ? t("new") : `${t("level")} ${p.level} → ${p.level + 1}`}</span>
              <span class="card-desc">${t(p.id + "Desc")}</span>
            </button>`,
        )
        .join("");
    screens.dataset.screen = "choose";
}

$("cards").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) pickChoice(Number(card.dataset.i));
});

export function pickChoice(i) {
    if (screens.dataset.screen !== "choose" || !choices[i]) return;
    const pick = choices[i];
    choices = [];
    onPick?.(pick);
}

export function hideChoices() {
    screens.dataset.screen = "";
}

export function showPause(on) {
    screens.dataset.screen = on ? "paused" : "";
}

export function showEnd(won, stats) {
    $("end-title").textContent = t(won ? "dawn" : "fallen");
    $("end-text").textContent = t(won ? "dawnText" : "fallenText");
    $("stat-kills").textContent = stats.kills;
    $("stat-level").textContent = stats.level;
    $("stat-time").textContent = stats.time;
    screens.dataset.screen = "end";
    screens.dataset.won = won ? "1" : "0";
    startRequested = false;
    // Avoid restarting by accident from a key held during the last second of play
    setTimeout(() => (startRequested = false), 600);
}

// ---- Touch: a floating stick wherever the thumb lands ----
const stick = $("stick");
const nub = $("stick-nub");
let touchId = null;
let ox = 0;
let oy = 0;
const vector = { x: 0, y: 0 };
let active = false;
window.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || screens.dataset.screen) return;
    touchId = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    active = true;
    stick.hidden = false;
    stick.style.transform = `translate(${ox - 60}px, ${oy - 60}px)`;
    nub.style.transform = "translate(0px, 0px)";
});
window.addEventListener("pointermove", (e) => {
    if (e.pointerId !== touchId) return;
    let dx = e.clientX - ox;
    let dy = e.clientY - oy;
    const len = Math.hypot(dx, dy);
    const max = 48;
    if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
    }
    vector.x = dx / max;
    vector.y = -dy / max;
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
});
const release = (e) => {
    if (e.pointerId !== touchId) return;
    touchId = null;
    active = false;
    vector.x = 0;
    vector.y = 0;
    stick.hidden = true;
};
window.addEventListener("pointerup", release);
window.addEventListener("pointercancel", release);

export function touchVector() {
    return active ? vector : null;
}
