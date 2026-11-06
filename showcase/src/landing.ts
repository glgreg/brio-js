import "./styles/base.css";
import "./styles/landing.css";
import { mountChrome } from "./chrome";
import { applyI18n, onLangChange, pick, t } from "./i18n";
import { capySVG } from "./mascot";
import { GAMES } from "./games";
import { highlightJS } from "./highlight";
import { importPublic } from "./runtime-import";

mountChrome("home");

// ---- Version from the engine build ----
fetch("/engine/version.json")
    .then((r) => r.json())
    .then(({ version }: { version: string }) => {
        const el = document.querySelector<HTMLElement>("[data-version]");
        if (!el) return;
        const update = () => (el.textContent = t("hero.eyebrow", { version }));
        update();
        onLangChange(update);
    })
    .catch(() => undefined);

// ---- Install snippet ----
const install = document.getElementById("install");
install?.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText("npm i @brio-js/core");
        const label = install.querySelector<HTMLElement>(".install-copy")!;
        label.textContent = t("hero.copied");
        install.classList.add("copied");
        setTimeout(() => {
            label.textContent = t("hero.copy");
            install.classList.remove("copied");
        }, 1600);
    } catch {
        // clipboard blocked: the command stays visible to copy by hand
    }
});

// ---- Hero: static illustration first, then the live BrioJS scene on top ----
const stage = document.getElementById("hero-stage")!;
const fallback = document.getElementById("hero-fallback")!;
fallback.innerHTML = capySVG({ pose: "soak", orange: true, label: "Capibrio soaking in a hot spring" });
const fpsLabel = document.getElementById("hero-fps")!;
const loading = document.getElementById("hero-loading")!;

async function startHero(): Promise<void> {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
        loading.remove();
        return;
    }
    try {
        const mod = await importPublic("/scenes/hot-spring.js");
        const host = document.createElement("div");
        host.className = "hero-canvas";
        stage.appendChild(host);
        const scene = await mod.startHotSpring(host, {
            onFps: (fps: number) => (fpsLabel.textContent = t("hero.fps", { fps })),
            onReady: () => {
                stage.classList.add("live");
                loading.remove();
            },
            onFail: () => {
                host.remove();
                loading.remove();
                stage.classList.add("no-webgl");
                fpsLabel.textContent = "";
            },
        });
        if (scene) {
            // Pause rendering while the hero is off screen
            new IntersectionObserver(([entry]) => {
                if (entry.isIntersecting) scene.game.resume();
                else scene.game.pause();
            }).observe(stage);
        }
    } catch (error) {
        console.warn("[showcase] hero scene failed", error);
        loading.remove();
        stage.classList.add("no-webgl");
    }
}
// Let the page paint first
requestAnimationFrame(() => setTimeout(startHero, 60));

// ---- Mascots around the page ----
document.getElementById("bridge-capy")!.innerHTML = capySVG({ pose: "stand", orange: true });
document.getElementById("mascot-art")!.innerHTML = `
  <div class="mascot-stack">
    <div class="mascot-bird" aria-hidden="true">${birdSVG()}</div>
    ${capySVG({ pose: "stand", label: "Capibrio" })}
  </div>`;
document.getElementById("teaser-capy")!.innerHTML = capySVG({ pose: "sleep" });
document.getElementById("tcc-pines")!.innerHTML = pinesSVG();

function birdSVG(): string {
    return `<svg viewBox="0 0 60 44"><path d="M6 30 C6 16 18 8 30 10 C38 11 44 16 46 22 L56 20 L48 28 C46 36 36 40 26 39 C14 38 6 36 6 30 Z" fill="#f19a32" stroke="#241c15" stroke-width="3" stroke-linejoin="round"/><path d="M18 26 C24 20 32 22 34 28 C28 30 22 30 18 26 Z" fill="#dc5a2a" stroke="#241c15" stroke-width="2.5" stroke-linejoin="round"/><circle cx="38" cy="18" r="2.6" fill="#241c15"/><path d="M22 39 L20 44 M30 39 L30 44" stroke="#241c15" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function pinesSVG(): string {
    const tree = (x: number, h: number, s: number) => {
        const top = 200 - h;
        return `<g transform="translate(${x} 0)">
          <path d="M-3 200 L-2 ${top} L2 ${top} L3 200 Z" class="pine-trunk"/>
          <path d="M${-46 * s} ${top - 4} C ${-30 * s} ${top + 14} ${30 * s} ${top + 14} ${46 * s} ${top - 4} C ${30 * s} ${top + 2} ${-30 * s} ${top + 2} ${-46 * s} ${top - 4} Z" class="pine-crown"/>
          <path d="M${-34 * s} ${top - 16} C ${-20 * s} ${top - 2} ${20 * s} ${top - 2} ${34 * s} ${top - 16} C ${20 * s} ${top - 10} ${-20 * s} ${top - 10} ${-34 * s} ${top - 16} Z" class="pine-crown"/>
          <path d="M-2 ${top + 30} C ${-14 * s} ${top + 14} ${-26 * s} ${top + 4} ${-36 * s} ${top} M2 ${top + 30} C ${14 * s} ${top + 14} ${26 * s} ${top + 4} ${36 * s} ${top}" class="pine-branch"/>
        </g>`;
    };
    return `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax meet">
      ${tree(60, 120, 0.8)}${tree(150, 170, 1.1)}${tree(250, 110, 0.75)}${tree(330, 150, 0.95)}
      <path d="M0 200 C 80 186 160 196 240 188 C 300 182 360 192 400 186 L400 200 Z" class="pine-ground"/>
    </svg>`;
}

// ---- Code sample: the real hello-brio template, highlighted ----
fetch("/templates/hello-brio/main.js")
    .then((r) => r.text())
    .then((source) => {
        document.getElementById("code-sample")!.innerHTML = highlightJS(source.trim());
    })
    .catch(() => undefined);

// ---- Engine size stat (gzip size measured at build time) ----
fetch("/engine/version.json")
    .then((r) => r.json())
    .then((info: { gzipKB?: number }) => {
        if (info.gzipKB) document.getElementById("stat-size")!.textContent = `${info.gzipKB} KB`;
    })
    .catch(() => undefined);

// ---- Game gallery ----
const grid = document.getElementById("game-grid")!;
function renderGames(): void {
    grid.innerHTML = GAMES.map(
        (game, i) => `
      <article class="game-card" style="--accent:${game.accent}; --tilt:${[-1.2, 0.8, -0.6][i % 3]}deg">
        <a class="game-poster" href="/play?game=${game.id}" aria-label="${t("games.play")}: ${game.title}">
          <img src="/games/${game.id}/poster.webp" alt="" loading="lazy" onerror="this.style.display='none'"/>
          <span class="game-kind">${game.kind} · WebGL2</span>
          <span class="game-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></span>
        </a>
        <div class="game-body">
          <h3 class="display">${game.title}</h3>
          <p>${pick(game.tagline)}</p>
          <ul class="game-features">${game.features.map((f) => `<li class="chip">${f}</li>`).join("")}</ul>
          <div class="game-actions">
            <a class="btn small" href="/play?game=${game.id}">${t("games.play")}</a>
            <a class="link-edit" href="/playground?template=${game.id}">${t("games.edit")} →</a>
          </div>
        </div>
      </article>`,
    ).join("");
}
renderGames();
onLangChange(renderGames);

// ---- Reveal on scroll ----
const reveal = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                reveal.unobserve(entry.target);
            }
        }
    },
    { rootMargin: "0px 0px -10% 0px" },
);
document.querySelectorAll(".section").forEach((el) => reveal.observe(el));

applyI18n();
