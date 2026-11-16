// English and Portuguese text. The language comes from ?lang=pt (the showcase passes it).
const TEXT = {
    en: {
        title: "Araucária Run",
        tagline: "Capibrio is late for the hot spring!",
        start: "Press Space or tap to run",
        controls: "A D / ← → lanes · W / Space jump · S roll · swipe on touch screens",
        score: "Score",
        yuzus: "Yuzus",
        best: "Best",
        over: "Bonk!",
        record: "New record!",
        again: "Space or tap to run again",
        combo: "{n} in a row!",
    },
    pt: {
        title: "Araucária Run",
        tagline: "A Capibrio está atrasada para a fonte termal!",
        start: "Aperte Espaço ou toque para correr",
        controls: "A D / ← → faixas · W / Espaço pular · S rolar · deslize em telas de toque",
        score: "Pontos",
        yuzus: "Laranjas",
        best: "Recorde",
        over: "Ploft!",
        record: "Novo recorde!",
        again: "Espaço ou toque para correr de novo",
        combo: "{n} seguidas!",
    },
};

const lang = new URLSearchParams(location.search).get("lang") === "pt" ? "pt" : "en";
document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";

export function t(key, vars = {}) {
    let s = TEXT[lang][key] ?? TEXT.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
}
