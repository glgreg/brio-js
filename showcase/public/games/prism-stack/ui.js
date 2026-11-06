import { t } from "./strings.js";

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll("[data-t]")) el.textContent = t(el.dataset.t);
document.title = `${t("title")} · BrioJS`;

let tapped = false;
window.addEventListener("pointerdown", (e) => {
    if (e.button === 0 || e.pointerType !== "mouse") tapped = true;
});
export function consumeTap() {
    const v = tapped;
    tapped = false;
    return v;
}

export function title(best) {
    $("screen").dataset.screen = "title";
    $("title-best").textContent = best ? `${t("best")} · ${best}` : "";
}
export function play(best) {
    $("screen").dataset.screen = "";
    $("hud").hidden = false;
    $("best").textContent = best ? `${t("best")} ${best}` : "";
}
export function score(n) {
    const el = $("score");
    el.textContent = n;
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
}
export function perfect(combo) {
    const el = $("perfect");
    el.textContent = combo > 1 ? `${t("perfect")} ×${combo}` : t("perfect");
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
}
export function milestone(n) {
    const el = $("milestone");
    el.textContent = t("milestone", { n });
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
}
export function over(score, best, record) {
    $("over-score").textContent = score;
    $("over-best").textContent = `${t("best")} · ${best}`;
    $("over-record").hidden = !record;
    $("screen").dataset.screen = "over";
    tapped = false;
}
export function noWebGL() {
    $("nowebgl").hidden = false;
}
