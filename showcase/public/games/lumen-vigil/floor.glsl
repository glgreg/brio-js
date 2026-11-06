// The meadow around the shrine, drawn procedurally: no tileset, just math snapped to a pixel grid so it matches
// the pixel art. Lighting (the knight's lantern, the spells) is applied by the engine after this hook.
uniform float uPixel;   // world units per art pixel
uniform float uDawn;    // 0 = midnight, 1 = sunrise

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void surface(inout BrioSurface s) {
    // Snap to the art-pixel grid
    vec2 p = floor(s.worldPosition.xy / uPixel);
    float n = noise(p * 0.045) * 0.6 + noise(p * 0.16) * 0.4;
    vec3 deep = mix(vec3(0.06, 0.11, 0.10), vec3(0.22, 0.30, 0.16), uDawn);
    vec3 mid = mix(vec3(0.09, 0.17, 0.13), vec3(0.33, 0.42, 0.20), uDawn);
    vec3 high = mix(vec3(0.13, 0.23, 0.16), vec3(0.45, 0.52, 0.25), uDawn);
    vec3 color = n < 0.42 ? deep : n < 0.62 ? mid : high;
    // Grass blades: sparse brighter pixels
    float r = hash(p);
    if (r > 0.985) color = high * 1.35;
    // Flowers
    if (r > 0.9975) color = mix(vec3(0.85, 0.55, 0.7), vec3(0.95, 0.82, 0.45), hash(p + 3.1));
    // Stone ring of the shrine at the center
    float d = length(p);
    if (d > 46.0 && d < 52.0) {
        float stone = step(0.3, hash(floor(p / 3.0)));
        color = mix(color, vec3(0.32, 0.31, 0.36) * (0.8 + 0.3 * hash(p)), stone);
    }
    if (d < 6.0) color = vec3(0.45, 0.42, 0.5);
    // Fade into darkness toward the edge of the clearing
    float edge = smoothstep(560.0, 760.0, max(abs(p.x), abs(p.y)));
    color *= 1.0 - edge * 0.85;
    s.baseColor = color;
    s.normal = vec3(0.0, 0.0, 1.0);
}
