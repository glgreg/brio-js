import "./styles/base.css";
import "./styles/landing.css";
import "./styles/play.css";
import { mountChrome } from "./chrome";
import { applyI18n, getLang, onLangChange, pick, t } from "./i18n";
import { findGame, GAMES } from "./games";
import { capySVG } from "./mascot";

mountChrome("play");

const id = new URLSearchParams(location.search).get("game");
const game = findGame(id);
const stage = document.getElementById("play-stage")!;
let frame: HTMLIFrameElement | undefined;

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(): void {
    if (!game) {
        document.getElementById("play-main")!.innerHTML = `<div class="play-missing">${capySVG({ pose: "sleep" })}<p>${esc(t("play.notfound"))}</p>
          <div class="play-missing-list">${GAMES.map((g) => `<a class="btn small" href="/play?game=${g.id}">${esc(g.title)}</a>`).join("")}</div></div>`;
        return;
    }
    document.title = `${game.title} · BrioJS`;
    document.documentElement.style.setProperty("--accent", game.accent);
    document.getElementById("play-title")!.textContent = game.title;
    document.getElementById("play-desc")!.textContent = pick(game.description);
    document.getElementById("play-controls")!.innerHTML = pick(game.controls)
        .map((line) => {
            const [keys, action] = line.split(":");
            return `<li><kbd>${esc(keys.trim())}</kbd><span>${esc((action ?? "").trim())}</span></li>`;
        })
        .join("");
    document.getElementById("play-features")!.innerHTML = game.features.map((f) => `<li class="chip">${esc(f)}</li>`).join("");
    document.getElementById("play-credits")!.innerHTML = game.credits
        .map(
            (c) => `<li><strong>${esc(pick(c.what))}</strong><span>${esc(c.author)} · ${esc(c.license)}</span><a href="${c.url}" target="_blank" rel="noopener">${esc(new URL(c.url).hostname)}</a></li>`,
        )
        .join("");
    (document.getElementById("edit") as HTMLAnchorElement).href = `/playground?template=${game.id}`;
    const poster = document.getElementById("play-cover")!;
    poster.style.backgroundImage = `url(/games/${game.id}/poster.webp)`;
}

function start(): void {
    if (!game) return;
    frame?.remove();
    frame = document.createElement("iframe");
    frame.className = "play-frame";
    frame.title = game.title;
    frame.allow = "fullscreen; gamepad; autoplay";
    frame.src = `/games/${game.id}/index.html?lang=${getLang()}`;
    stage.appendChild(frame);
    document.getElementById("play-cover")!.hidden = true;
    frame.addEventListener("load", () => frame?.contentWindow?.focus());
}

document.getElementById("play-start")?.addEventListener("click", start);
document.getElementById("restart")?.addEventListener("click", start);
document.getElementById("fullscreen")?.addEventListener("click", () => {
    if (!frame) start();
    void stage.requestFullscreen?.();
    setTimeout(() => frame?.contentWindow?.focus(), 200);
});
stage.addEventListener("pointerdown", () => frame?.contentWindow?.focus());

render();
applyI18n();
onLangChange(() => {
    render();
    // Restart so the game picks up the new language
    if (frame) start();
});
