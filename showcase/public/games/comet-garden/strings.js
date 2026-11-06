const TEXT = {
    en: {
        title: "Comet Garden",
        level: "Level {n} of {total}",
        shots: "Shots",
        stars: "Stars",
        hint1: "Drag back from the comet and let go. Reach the flower.",
        hint2: "Planets pull. Curve around this one.",
        hint4: "Swing around the planet to reach the flower behind it.",
        hint6: "These two never stop moving. Time your shot.",
        hint7: "A tiny, heavy planet. Use it to turn all the way around.",
        bloom: "It bloomed!",
        done: "The whole garden is in bloom!",
        doneText: "{stars} of {total} stars collected.",
        result: "Shots: {shots} · Stars: {stars}/3",
        next: "Next garden",
        again: "Play again",
        reset: "R reset · P / N previous / next level",
    },
    pt: {
        title: "Comet Garden",
        level: "Nível {n} de {total}",
        shots: "Lançamentos",
        stars: "Estrelas",
        hint1: "Puxe o cometa para trás e solte. Chegue até a flor.",
        hint2: "Planetas puxam. Faça a curva em volta deste.",
        hint4: "Contorne o planeta para chegar à flor atrás dele.",
        hint6: "Esses dois nunca param. Escolha a hora certa.",
        hint7: "Um planeta pequeno e pesado. Use-o para dar a volta completa.",
        bloom: "Floresceu!",
        done: "O jardim inteiro floresceu!",
        doneText: "{stars} de {total} estrelas coletadas.",
        result: "Lançamentos: {shots} · Estrelas: {stars}/3",
        next: "Próximo jardim",
        again: "Jogar de novo",
        reset: "R recomeçar · P / N nível anterior / próximo",
    },
};
const lang = new URLSearchParams(location.search).get("lang") === "pt" ? "pt" : "en";
document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
export function t(key, vars = {}) {
    let s = TEXT[lang][key] ?? TEXT.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
}
