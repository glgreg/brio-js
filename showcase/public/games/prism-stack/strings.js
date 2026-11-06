const TEXT = {
    en: {
        title: "Prism Stack",
        tagline: "Drop the slab. Keep what overlaps. Climb.",
        start: "Space, click or tap",
        perfect: "Perfect",
        best: "Best",
        over: "The tower stands at",
        record: "New record!",
        again: "Tap or press Space to build again",
        milestone: "{n} floors!",
        floors: "floors",
    },
    pt: {
        title: "Prism Stack",
        tagline: "Solte a placa. Fique com o que sobrepõe. Suba.",
        start: "Espaço, clique ou toque",
        perfect: "Perfeito",
        best: "Recorde",
        over: "A torre ficou com",
        record: "Novo recorde!",
        again: "Toque ou aperte Espaço para construir de novo",
        milestone: "{n} andares!",
        floors: "andares",
    },
};
const lang = new URLSearchParams(location.search).get("lang") === "pt" ? "pt" : "en";
document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
export function t(key, vars = {}) {
    let s = TEXT[lang][key] ?? TEXT.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
}
