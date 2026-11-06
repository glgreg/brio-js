// Levels in a 960 x 540 design space centered on (0, 0), y up.
// planet: { x, y, r, mass, ink }   rock: { x, y, r }   star: { x, y }   orbit: planets that circle a point
export const LEVELS = [
    {
        start: { x: -360, y: -60 },
        goal: { x: 360, y: 40 },
        planets: [{ x: 0, y: -170, r: 70, mass: 1 }],
        stars: [{ x: -120, y: 0 }, { x: 60, y: 20 }, { x: 220, y: 40 }],
        hint: "hint1",
    },
    {
        start: { x: -380, y: 0 },
        goal: { x: 370, y: 90 },
        planets: [{ x: 0, y: 0, r: 95, mass: 1.2 }],
        stars: [{ x: -150, y: 150 }, { x: 0, y: 170 }, { x: 150, y: 150 }],
        hint: "hint2",
    },
    {
        start: { x: -400, y: 180 },
        goal: { x: 390, y: -170 },
        planets: [
            { x: -130, y: 30, r: 60, mass: 1 },
            { x: 160, y: -40, r: 75, mass: 1.1 },
        ],
        stars: [{ x: -260, y: 120 }, { x: 10, y: -60 }, { x: 280, y: -150 }],
    },
    {
        start: { x: -380, y: -200 },
        goal: { x: 120, y: 0 },
        planets: [{ x: -60, y: 0, r: 80, mass: 1.6 }],
        rocks: [{ x: -230, y: -20, r: 34 }, { x: -200, y: 60, r: 26 }],
        stars: [{ x: -60, y: -150 }, { x: 90, y: -120 }, { x: 60, y: 140 }],
        hint: "hint4",
    },
    {
        start: { x: -400, y: 0 },
        goal: { x: 400, y: 0 },
        planets: [{ x: 0, y: 210, r: 70, mass: 1.3 }, { x: 0, y: -210, r: 70, mass: 1.3 }],
        rocks: [
            { x: -20, y: 70, r: 30 },
            { x: 30, y: 10, r: 26 },
            { x: -10, y: -60, r: 32 },
        ],
        stars: [{ x: -180, y: 60 }, { x: 0, y: 130 }, { x: 200, y: -40 }],
    },
    {
        start: { x: -400, y: -180 },
        goal: { x: 380, y: 170 },
        planets: [],
        orbit: { x: 0, y: 0, radius: 150, speed: 0.6, planets: [{ r: 55, mass: 1.1 }, { r: 55, mass: 1.1 }] },
        stars: [{ x: 0, y: 0 }, { x: -200, y: 90 }, { x: 220, y: -60 }],
        hint: "hint6",
    },
    {
        start: { x: -380, y: 160 },
        goal: { x: -260, y: -160 },
        planets: [{ x: 80, y: 0, r: 40, mass: 2.6, ink: "dark" }],
        rocks: [{ x: -380, y: 10, r: 40 }],
        stars: [{ x: 80, y: 150 }, { x: 260, y: 0 }, { x: 80, y: -150 }],
        hint: "hint7",
    },
    {
        start: { x: -420, y: 0 },
        goal: { x: 420, y: 0 },
        planets: [
            { x: -220, y: 150, r: 55, mass: 0.9 },
            { x: -150, y: -140, r: 50, mass: 0.9 },
            { x: 40, y: 60, r: 60, mass: 1.1 },
            { x: 200, y: -150, r: 50, mass: 0.9 },
            { x: 250, y: 150, r: 45, mass: 0.8 },
        ],
        rocks: [{ x: 330, y: 20, r: 26 }],
        stars: [{ x: -280, y: 0 }, { x: -40, y: -60 }, { x: 140, y: 0 }],
    },
];
