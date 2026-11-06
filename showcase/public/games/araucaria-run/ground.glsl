// Forest floor: a dirt trail along the three lanes and grass with patches on both sides.
uniform vec3 uGrass;
uniform vec3 uGrassDark;
uniform vec3 uDirt;
uniform vec3 uDirtDark;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void surface(inout BrioSurface s) {
    vec2 p = s.worldPosition.xz;
    float n = noise(p * 0.35) * 0.6 + noise(p * 1.7) * 0.4;
    vec3 grass = mix(uGrassDark, uGrass, smoothstep(0.3, 0.7, n));
    // Wobbly trail edge
    float edge = 3.6 + (noise(vec2(p.y * 0.4, 1.0)) - 0.5) * 0.9;
    float trail = 1.0 - smoothstep(edge - 0.25, edge + 0.25, abs(p.x));
    vec3 dirt = mix(uDirtDark, uDirt, smoothstep(0.25, 0.75, noise(p * 2.3)));
    // Wheel ruts between the lanes
    float rut = smoothstep(0.12, 0.0, abs(abs(p.x) - 1.1)) * 0.18;
    dirt *= 1.0 - rut;
    s.baseColor = mix(grass, dirt, trail);
    s.roughness = 0.95;
}
