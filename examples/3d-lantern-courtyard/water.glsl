// Water surface for the BrioJS "Lantern Courtyard" example.
// A BrioShader file holds GLSL hooks: the fragment hook first, then the vertex hook after the "// @vertex" line.
// Lighting, shadows, fog and tone mapping still run after these hooks.

uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform float uLevel;

// Changes the surface before lighting: darker where the water faces the camera (looking down into it), lighter and
// more transparent at grazing angles, with soft glowing foam on the wave crests.
void surface(inout BrioSurface s) {
    vec3 toCamera = normalize(CAMERA_POSITION - s.worldPosition);
    float facing = clamp(dot(toCamera, s.normal), 0.0, 1.0);
    s.baseColor = mix(s.baseColor, uDeepColor, facing * 0.75);
    float crest = smoothstep(0.05, 0.12, s.worldPosition.y - uLevel);
    s.emissive += uFoamColor * crest * 0.35;
    s.roughness = 0.06;
    s.opacity = mix(0.95, 0.7, facing);
}

// @vertex
uniform float uWaveHeight;
uniform float uWaveScale;

float waveAt(vec2 p) {
    return sin(p.x * uWaveScale + TIME * 1.7) * 0.6
        + sin((p.x * 0.6 + p.y) * uWaveScale * 1.3 + TIME * 1.1) * 0.4;
}

// Moves the vertices of the subdivided plane (object space) into waves and recomputes the normal from the slope.
void vertex(inout vec3 position, inout vec3 normal) {
    const float e = 0.05;
    float h = waveAt(position.xz) * uWaveHeight;
    float hx = waveAt(position.xz + vec2(e, 0.0)) * uWaveHeight;
    float hz = waveAt(position.xz + vec2(0.0, e)) * uWaveHeight;
    position.y += h;
    normal = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
}
