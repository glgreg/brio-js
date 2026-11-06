// Background: a deep gradient whose hue drifts as the tower grows, with soft stars and an aurora band.
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uAurora;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void surface(inout BrioSurface s) {
    vec3 dir = normalize(s.worldPosition - CAMERA_POSITION);
    float h = dir.y * 0.5 + 0.5;
    vec3 color = mix(uLow, uHigh, smoothstep(0.2, 0.95, h));
    // Stars: a sparse grid of tiny bright cells
    vec3 cell = floor(dir * 160.0);
    float star = step(0.9965, hash(cell)) * smoothstep(0.35, 0.7, h);
    color += vec3(star) * (0.6 + 0.4 * sin(TIME * 3.0 + hash(cell) * 40.0));
    // Aurora: a slow wavy ribbon across the sky
    float wave = sin(dir.x * 5.0 + TIME * 0.15) * 0.06 + sin(dir.z * 7.0 - TIME * 0.1) * 0.04;
    float band = exp(-pow((dir.y - 0.32 - wave) * 9.0, 2.0));
    color += uAurora * band * 0.55;
    s.baseColor = color;
}
