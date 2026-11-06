import "./styles/base.css";
import "./styles/landing.css";
import { mountChrome } from "./chrome";
import { applyI18n, onLangChange, pick, t } from "./i18n";
import { GAMES } from "./games";
import { capySVG } from "./mascot";

mountChrome("credits");
document.getElementById("credits-capy")!.innerHTML = capySVG({ pose: "stand", orange: true });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function render(): void {
    document.getElementById("credits-list")!.innerHTML = GAMES.map(
        (g) => `<section class="credits-game" style="--accent:${g.accent}">
          <h2 class="display"><a href="/play?game=${g.id}">${esc(g.title)}</a> <span class="chip">${g.kind}</span></h2>
          <table>
            <thead><tr><th>${esc(t("credits.asset"))}</th><th>${esc(t("credits.author"))}</th><th>${esc(t("credits.license"))}</th></tr></thead>
            <tbody>${g.credits
                .map(
                    (c) => `<tr><td><a href="${c.url}" target="_blank" rel="noopener">${esc(pick(c.what))}</a></td><td>${esc(c.author)}</td><td>${esc(c.license)}</td></tr>`,
                )
                .join("")}</tbody>
          </table>
        </section>`,
    ).join("");
}
render();
applyI18n();
onLangChange(render);
