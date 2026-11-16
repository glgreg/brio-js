// Risograph print look: two fluorescent inks overprinted (multiplied) on cream paper, with halftone dots for shading
// and the second ink slightly misregistered. Every element of the game is a quad drawn by this one hook; uKind picks
// the shape. Nothing here uses a texture.
uniform float uKind;   // 0 paper, 1 planet, 2 comet, 3 flower, 4 star, 5 dot, 6 rock, 7 gravity ring, 8 trail
uniform vec3 uInk;     // main ink
uniform vec3 uInk2;    // second ink
uniform float uSeed;
uniform float uOpen;   // flower bloom / star pulse (0..1)

const vec3 PAPER = vec3(0.89, 0.82, 0.69);

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

// Halftone coverage: 1 inside a dot of the screen, 0 outside. `value` is the ink coverage (0..1).
float halftone(vec2 p, float value, float cell) {
    vec2 q = mat2(0.866, -0.5, 0.5, 0.866) * p / cell;
    vec2 f = fract(q) - 0.5;
    return step(length(f), sqrt(clamp(value, 0.0, 1.0)) * 0.66);
}

// Overprint: inks multiply like real riso layers
vec3 overprint(vec3 color, vec3 ink, float amount) {
    return color * mix(vec3(1.0), ink, clamp(amount, 0.0, 1.0));
}

void surface(inout BrioSurface s) {
    vec2 c = s.uv - 0.5;
    c.y = -c.y;
    float r = length(c) * 2.0;
    vec2 p = s.worldPosition.xy;
    vec3 color = PAPER;
    float alpha = 1.0;
    int kind = int(uKind + 0.5);

    if (kind == 0) {
        // Paper: grain and a soft halftone vignette in the second ink
        float vignette = smoothstep(0.75, 1.45, length(c * vec2(1.25, 1.0)) * 1.5);
        color = overprint(color, uInk2, halftone(p, vignette * 0.3, 8.0) * 0.45);
        color = overprint(color, uInk, halftone(p + 3.0, vignette * 0.12, 8.0) * 0.4);
    } else if (kind == 1) {
        // Planet: halftone shading from a light at the top left, bands, misregistered outline in the second ink
        if (r > 1.0) alpha = 0.0;
        vec3 n = vec3(c * 2.0, sqrt(max(0.0, 1.0 - r * r)));
        float light = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
        float bands = sin((c.y + sin(c.x * 4.0 + uSeed) * 0.05) * (10.0 + uSeed * 6.0)) * 0.5 + 0.5;
        float coverage = (1.0 - light) * 0.95 + 0.12 + bands * 0.18;
        color = overprint(color, uInk, halftone(p, coverage, 5.0));
        vec2 off = c + vec2(0.035, -0.03);
        float r2 = length(off) * 2.0;
        float rim = smoothstep(0.86, 0.9, r2) * (1.0 - smoothstep(0.97, 1.0, r2));
        color = overprint(color, uInk2, rim);
        if (r2 < 1.0 && r > 0.96) color = overprint(color, uInk2, 1.0);
    } else if (kind == 2) {
        // Comet head: a solid core and a halftone halo
        if (r > 1.0) alpha = 0.0;
        color = overprint(color, uInk, step(r, 0.55));
        color = overprint(color, uInk2, halftone(p, (1.0 - r) * 1.2, 3.0) * step(0.45, r));
    } else if (kind == 3) {
        // Flower (the goal): petals open with uOpen and turn slowly
        float a = atan(c.y, c.x);
        float petals = 0.38 + (0.42 + 0.12 * uOpen) * pow(abs(cos(a * 2.5 + TIME * 0.4)), 0.7);
        float inside = step(r, petals * (0.7 + 0.3 * uOpen));
        if (inside < 0.5 && r > 0.3) alpha = 0.0;
        color = overprint(color, uInk, inside * halftone(p, 0.35 + r * 0.6, 4.0));
        color = overprint(color, uInk, inside * smoothstep(0.62, 0.7, r / max(petals, 0.01)));
        float core = step(r, 0.3);
        color = overprint(color, uInk2, core);
        color = overprint(color, uInk, core * halftone(p + 2.0, 0.4, 3.0));
    } else if (kind == 4) {
        // Star: five points, solid ink with an offset outline
        float a = atan(c.y, c.x) + 1.5708;
        float star = 0.55 + 0.45 * pow(abs(cos(a * 2.5)), 2.0);
        float inside = step(r, star * (0.85 + 0.15 * uOpen));
        if (inside < 0.5) alpha = 0.0;
        color = overprint(color, uInk, inside);
        vec2 off = c + vec2(0.06, -0.05);
        float r2 = length(off) * 2.0;
        float a2 = atan(off.y, off.x) + 1.5708;
        float star2 = 0.55 + 0.45 * pow(abs(cos(a2 * 2.5)), 2.0);
        color = overprint(color, uInk2, step(r2, star2 * 0.85) * (1.0 - step(r2, star2 * 0.6)));
    } else if (kind == 5 || kind == 8) {
        // Dot (aim preview, trail, debris)
        if (r > 1.0) alpha = 0.0;
        color = overprint(color, uInk, 1.0);
    } else if (kind == 6) {
        // Rock: an irregular outline, cross-hatched in the second ink
        float a = atan(c.y, c.x);
        float edge = 0.78 + 0.16 * sin(a * 3.0 + uSeed * 5.0) + 0.08 * sin(a * 7.0 + uSeed * 11.0);
        if (r > edge) alpha = 0.0;
        float hatch = step(0.5, fract((p.x + p.y) / 5.0));
        color = overprint(color, uInk2, 0.85);
        color = overprint(color, uInk, hatch * smoothstep(0.2, 0.9, r / edge));
    } else if (kind == 7) {
        // Gravity ring: a dashed circle showing how far the planet pulls
        float a = atan(c.y, c.x);
        float dash = step(0.5, fract(a * 9.549 + TIME * 0.15));
        float ring = step(0.965, r) * step(r, 1.0) * dash;
        if (ring < 0.5) alpha = 0.0;
        color = overprint(color, uInk, 0.55);
    }
    // Paper grain over everything so all layers feel printed
    color *= 0.95 + 0.07 * hash(floor(p * 1.5));
    s.baseColor = color;
    s.opacity = alpha;
}
