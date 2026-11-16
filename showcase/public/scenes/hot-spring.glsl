// Hot spring water for the BrioJS landing page.
// Fragment hook first, then the vertex hook after the "// @vertex" line.
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;

void surface(inout BrioSurface s) {
    vec3 toCamera = normalize(CAMERA_POSITION - s.worldPosition);
    float facing = clamp(dot(toCamera, s.normal), 0.0, 1.0);
    // Distance from the pool center in UV space: shallow and bright near the rim, deep in the middle
    float r = length(s.uv - 0.5) * 2.0;
    vec3 water = mix(uDeep, uShallow, smoothstep(0.15, 0.95, r));
    s.baseColor = mix(water, uDeep, facing * 0.35);
    // Ripples drawn as soft bands that drift outward
    float rings = sin(r * 22.0 - TIME * 2.4) * 0.5 + 0.5;
    s.emissive += uFoam * smoothstep(0.82, 1.0, rings) * (1.0 - r) * 0.18;
    s.emissive += uFoam * smoothstep(0.86, 0.98, r) * 0.25;
    s.roughness = 0.08;
    s.metalness = 0.0;
    s.opacity = mix(0.96, 0.78, facing);
}

// @vertex
uniform float uWave;

void vertex(inout vec3 position, inout vec3 normal) {
    float d = length(position.xz);
    float h = sin(d * 7.0 - TIME * 2.4) * uWave * (1.0 - smoothstep(1.0, 2.2, d));
    float e = 0.04;
    float d2 = length(position.xz + vec2(e, 0.0));
    float d3 = length(position.xz + vec2(0.0, e));
    float hx = sin(d2 * 7.0 - TIME * 2.4) * uWave * (1.0 - smoothstep(1.0, 2.2, d2));
    float hz = sin(d3 * 7.0 - TIME * 2.4) * uWave * (1.0 - smoothstep(1.0, 2.2, d3));
    position.y += h;
    normal = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
}
