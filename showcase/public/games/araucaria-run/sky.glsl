// Sunset sky on a big sphere that follows the camera: a vertical gradient plus a soft sun.
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;

void surface(inout BrioSurface s) {
    vec3 dir = normalize(s.worldPosition - CAMERA_POSITION);
    float h = clamp(dir.y * 1.8 + 0.08, 0.0, 1.0);
    vec3 color = mix(uHorizon, uTop, pow(h, 0.7));
    float sun = max(dot(dir, normalize(uSunDir)), 0.0);
    color += uSunColor * (pow(sun, 600.0) * 3.0 + pow(sun, 10.0) * 0.45);
    // A few stylized cloud bands
    float band = sin(dir.x * 9.0 + TIME * 0.05) * sin(dir.y * 30.0 + dir.x * 4.0);
    color = mix(color, uHorizon * 1.15, smoothstep(0.75, 0.95, band) * (1.0 - h) * 0.6);
    s.baseColor = color;
}
