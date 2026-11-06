// Tiny i18n layer shared by every page. English is the default language; Portuguese is complete.
// Markup uses data attributes, so pages stay plain HTML:
//   data-i18n="key"            -> textContent
//   data-i18n-html="key"       -> innerHTML (only for strings we wrote ourselves)
//   data-i18n-attr="title:key;aria-label:key2"
import { strings } from "./strings";

export type Lang = "en" | "pt";
export type StringKey = keyof typeof strings.en;

const STORAGE_KEY = "brio.lang";
const listeners = new Set<(lang: Lang) => void>();

function initialLang(): Lang {
    const fromQuery = new URLSearchParams(location.search).get("lang");
    if (fromQuery === "en" || fromQuery === "pt") return fromQuery;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "en" || stored === "pt") return stored;
    } catch {
        // storage can be blocked (private mode); fall through to the default
    }
    return "en";
}

let current: Lang = initialLang();

export function getLang(): Lang {
    return current;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
    let value: string = (strings[current] as Record<string, string>)[key] ?? strings.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) value = value.split(`{${k}}`).join(String(v));
    return value;
}

/** Picks the right side of a `{ en, pt }` pair (used by the game catalog and templates). */
export function pick<T>(pair: { en: T; pt: T }): T {
    return pair[current];
}

export function applyI18n(root: ParentNode = document): void {
    document.documentElement.lang = current === "pt" ? "pt-BR" : "en";
    root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n as StringKey);
    });
    root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
        el.innerHTML = t(el.dataset.i18nHtml as StringKey);
    });
    root.querySelectorAll<HTMLElement>("[data-i18n-attr]").forEach((el) => {
        for (const pair of el.dataset.i18nAttr!.split(";")) {
            const [attr, key] = pair.split(":");
            if (attr && key) el.setAttribute(attr.trim(), t(key.trim() as StringKey));
        }
    });
    document.querySelectorAll<HTMLElement>("[data-lang-option]").forEach((el) => {
        el.setAttribute("aria-pressed", String(el.dataset.langOption === current));
    });
}

export function setLang(lang: Lang): void {
    if (lang === current) return;
    current = lang;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // ignore: the choice still applies to this page view
    }
    applyI18n();
    listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Wires every `[data-lang-option]` button on the page. */
export function bindLangSwitch(root: ParentNode = document): void {
    root.querySelectorAll<HTMLElement>("[data-lang-option]").forEach((el) => {
        el.addEventListener("click", () => setLang(el.dataset.langOption as Lang));
    });
}
