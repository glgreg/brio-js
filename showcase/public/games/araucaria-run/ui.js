// HTML overlay: title card, score, game over. The forest is BrioJS on the canvas below.
import { t } from "./strings.js";

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
document.title = `${t("title")} · BrioJS`;

let startRequested = false;
$("overlay").addEventListener("pointerdown", () => (startRequested = true));
export function consumeStart() {
    const v = startRequested;
    startRequested = false;
    return v;
}

export function title(best) {
    $("overlay").dataset.screen = "title";
    $("title-best").textContent = best ? `${t("best")}: ${best}` : "";
}

export function play() {
    $("overlay").dataset.screen = "";
    $("hud").hidden = false;
}

let lastHud = "";
export function hud(score, fruit, best) {
    const key = `${score}|${fruit}`;
    if (key === lastHud) return;
    lastHud = key;
    $("score").textContent = score;
    $("fruit").textContent = fruit;
    $("best").textContent = Math.max(best, score);
}

export function over(score, fruit, best, record) {
    $("over-score").textContent = score;
    $("over-fruit").textContent = fruit;
    $("over-best").textContent = best;
    $("over-record").hidden = !record;
    $("overlay").dataset.screen = "over";
    startRequested = false;
}

export function combo(n) {
    const el = $("combo");
    el.textContent = t("combo", { n });
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
}

export function noWebGL() {
    $("nowebgl").hidden = false;
}
