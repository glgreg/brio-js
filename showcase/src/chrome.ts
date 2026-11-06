// Header and footer shared by the landing, player and credits pages.
import { applyI18n, bindLangSwitch } from "./i18n";
import { capySVG, logoMark } from "./mascot";

export const GITHUB_URL = "https://github.com/glgreg/brio-js";
export const NPM_URL = "https://www.npmjs.com/package/@brio-js/core";

type Page = "home" | "games" | "play" | "playground" | "credits";

export function mountHeader(page: Page): void {
    const host = document.getElementById("site-header");
    if (!host) return;
    host.className = "site-header";
    const current = (p: Page) => (p === page ? ' aria-current="page"' : "");
    host.innerHTML = `
      <div class="wrap">
        <a class="brand" href="/" aria-label="BrioJS">${logoMark()}<span>BrioJS</span></a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-i18n="nav.menu">Menu</button>
        <nav class="nav" id="site-nav">
          <a href="/#games"${current("games")} data-i18n="nav.games">Games</a>
          <a href="/#how" data-i18n="nav.how">How it works</a>
          <a href="/playground"${current("playground")} data-i18n="nav.playground">Playground</a>
          <a href="/credits"${current("credits")} data-i18n="nav.credits">Credits</a>
          <a href="${GITHUB_URL}" target="_blank" rel="noopener" data-i18n="nav.github">GitHub</a>
          <span class="lang-switch" role="group" data-i18n-attr="aria-label:lang.label">
            <button type="button" data-lang-option="en">EN</button>
            <button type="button" data-lang-option="pt">PT</button>
          </span>
        </nav>
      </div>`;
    const toggle = host.querySelector<HTMLButtonElement>(".nav-toggle")!;
    const nav = host.querySelector<HTMLElement>(".nav")!;
    toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach((a) =>
        a.addEventListener("click", () => {
            nav.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        }),
    );
    const onScroll = () => host.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    bindLangSwitch(host);
}

export function mountFooter(): void {
    const host = document.getElementById("site-footer");
    if (!host) return;
    host.className = "site-footer";
    host.innerHTML = `
      <div class="footer-river" aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path d="M0 40 C120 10 240 70 360 40 C480 10 600 70 720 40 C840 10 960 70 1080 40 C1200 10 1320 70 1440 40 L1440 80 L0 80 Z"/></svg>
      </div>
      <div class="footer-body">
        <div class="wrap footer-grid">
          <div class="footer-brand">
            <div class="footer-capy">${capySVG({ pose: "sleep", label: "Capibrio sleeping" })}</div>
            <p class="display footer-tag" data-i18n="footer.tagline">Made in Paraná, with brio.</p>
            <p class="footer-small" data-i18n="footer.license">MIT licensed.</p>
          </div>
          <ul class="footer-links">
            <li><a href="/#games" data-i18n="nav.games">Games</a></li>
            <li><a href="/playground" data-i18n="nav.playground">Playground</a></li>
            <li><a href="/credits" data-i18n="footer.credits">Asset credits</a></li>
            <li><a href="${GITHUB_URL}#readme" target="_blank" rel="noopener" data-i18n="footer.docs">Documentation</a></li>
            <li><a href="${NPM_URL}" target="_blank" rel="noopener" data-i18n="footer.npm">npm package</a></li>
            <li><a href="${GITHUB_URL}" target="_blank" rel="noopener">GitHub</a></li>
          </ul>
        </div>
      </div>`;
}

export function mountChrome(page: Page): void {
    mountHeader(page);
    mountFooter();
    applyI18n();
}
