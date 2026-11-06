// Capibrio, the BrioJS capybara, drawn as inline SVG so it can be recolored by CSS tokens, animated, and placed
// anywhere (header, empty states, footer) without image requests.

export type CapyPose = "stand" | "sleep" | "peek" | "soak";

export interface CapyOptions {
    pose?: CapyPose;
    /** A yuzu orange balanced on the head (the classic capybara hot-spring look). */
    orange?: boolean;
    /** Extra class names for the root `<svg>`. */
    className?: string;
    /** Accessible label; decorative when omitted. */
    label?: string;
}

const BODY =
    "M40 136 C18 128 14 96 28 74 C44 50 84 42 124 44 C156 46 176 54 184 74 C190 90 188 116 178 130 C172 138 160 140 148 140 L60 140 C52 140 46 139 40 136 Z";
const HEAD =
    "M150 62 C152 40 172 26 200 26 C222 26 238 36 242 54 C246 70 240 86 224 90 C206 94 184 96 168 92 C156 88 149 76 150 62 Z";
const SNOUT = "M216 30 C232 34 242 44 243 57 C244 70 238 82 226 87 C224 70 222 48 216 30 Z";
const EAR = "M174 36 C166 24 172 13 181 14 C189 15 190 27 185 35 Z";
const LEG_FRONT = "M148 126 C147 140 150 151 159 151 C168 151 171 141 169 126 Z";
const LEG_BACK = "M52 124 C47 139 52 151 61 151 C70 151 74 140 72 126 Z";
const FUR = [
    "M70 66 C78 62 86 62 94 64",
    "M104 58 C112 55 120 55 128 57",
    "M60 88 C66 84 72 84 78 86",
    "M120 76 C128 72 136 72 144 74",
    "M84 104 C90 100 96 100 102 102",
];

export function capySVG(options: CapyOptions = {}): string {
    const pose = options.pose ?? "stand";
    const label = options.label
        ? `role="img" aria-label="${options.label}"`
        : `aria-hidden="true" focusable="false"`;
    const sleeping = pose === "sleep";
    const soaking = pose === "soak";
    const eye = sleeping
        ? `<path class="capy-ink-line" d="M198 47 C202 52 209 52 213 47"/>`
        : `<g class="capy-eye"><circle cx="205" cy="46" r="4.6" class="capy-ink"/><circle cx="206.6" cy="44.4" r="1.4" fill="#fff"/></g>`;
    const orange = options.orange
        ? `<g class="capy-orange">
            <circle cx="196" cy="13" r="13" class="capy-yuzu"/>
            <path class="capy-ink-line" d="M190 6 C192 4 195 3 198 4" stroke-width="2" opacity=".45"/>
            <path class="capy-leaf" d="M197 0 C201 -8 211 -9 215 -5 C210 0 203 2 197 0 Z"/>
          </g>`
        : "";
    const legs = soaking
        ? ""
        : `<path class="capy-dark" d="${LEG_BACK}"/><path class="capy-dark" d="${LEG_FRONT}"/>`;
    const shadow = soaking ? "" : `<ellipse cx="108" cy="152" rx="86" ry="7" class="capy-shadow"/>`;
    const water = soaking
        ? `<g class="capy-water">
            <path d="M-10 112 C20 104 40 120 70 112 C100 104 120 120 150 112 C180 104 200 120 230 112 C250 106 262 112 272 110 L272 180 L-10 180 Z"/>
            <path class="capy-water-line" d="M20 128 C34 124 44 132 58 128 M150 134 C162 130 172 138 186 134"/>
          </g>`
        : "";
    const zzz = sleeping
        ? `<g class="capy-zzz"><text x="226" y="20">z</text><text x="238" y="6">z</text></g>`
        : "";
    const viewBox = pose === "peek" ? "130 0 130 100" : soaking ? "0 -20 262 150" : "0 -20 262 176";
    return `<svg class="capy ${options.className ?? ""}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" ${label}>
        ${shadow}
        ${legs}
        <path class="capy-body" d="${BODY}"/>
        <g class="capy-fur">${FUR.map((d) => `<path d="${d}"/>`).join("")}</g>
        <path class="capy-dark" d="${EAR}"/>
        <path class="capy-body" d="${HEAD}"/>
        <path class="capy-snout" d="${SNOUT}"/>
        <ellipse cx="236" cy="52" rx="3" ry="2.3" class="capy-ink"/>
        <path class="capy-ink-line" d="M225 72 C229 77 235 77 239 72"/>
        <ellipse cx="200" cy="66" rx="9" ry="5" class="capy-blush"/>
        ${eye}
        ${orange}
        ${zzz}
        ${water}
    </svg>`;
}

/** Small round logo mark: the capybara head peeking over a "b" baseline. */
export function logoMark(): string {
    return `<svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="23" class="logo-bg"/>
        <g transform="translate(-40.8 7) scale(.33)">
            <path class="capy-dark" d="${EAR}"/>
            <path class="capy-body" d="${HEAD}"/>
            <path class="capy-snout" d="${SNOUT}"/>
            <ellipse cx="236" cy="52" rx="3.4" ry="2.6" class="capy-ink"/>
            <circle cx="205" cy="46" r="5.6" class="capy-ink"/>
        </g>
    </svg>`;
}
