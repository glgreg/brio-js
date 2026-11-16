import { t } from "./strings.js";

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
document.title = `${t("title")} · BrioJS`;

let next = false;
let levelStep = 0;
$("card-next").addEventListener("click", () => (next = true));
$("prev").addEventListener("click", () => (levelStep = -1));
$("next").addEventListener("click", () => (levelStep = 1));

export function consumeNext() {
    const v = next;
    next = false;
    return v;
}
export function consumeLevelStep() {
    const v = levelStep;
    levelStep = 0;
    return v;
}
export function level(index, total, hint) {
    $("level").textContent = t("level", { n: index + 1, total });
    $("hint").textContent = hint;
    $("hint").hidden = !hint;
}
export function counts(shots, stars) {
    $("shots").textContent = shots;
    $("stars").innerHTML = [0, 1, 2].map((i) => `<i class="${i < stars ? "on" : ""}"></i>`).join("");
}
export function won(done, shots, stars, totalStars, total) {
    $("card-title").textContent = t(done ? "done" : "bloom");
    $("card-text").textContent = done ? t("doneText", { stars: totalStars, total }) : t("result", { shots, stars });
    $("card-next").textContent = t(done ? "again" : "next");
    $("card").hidden = false;
}
export function hideCard() {
    $("card").hidden = true;
}
export function noWebGL() {
    $("nowebgl").hidden = false;
}
