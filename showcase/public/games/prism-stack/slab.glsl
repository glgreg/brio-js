// Glowing glass slab: neon edges with a constant width in world units, whatever the size of the box.
// uCenter / uHalf describe the box (world space), so the hook knows how far each pixel is from an edge.
uniform vec3 uCenter;
uniform vec3 uHalf;
uniform vec3 uEdge;
uniform float uPulse;

void surface(inout BrioSurface s) {
    vec3 d = uHalf - abs(s.worldPosition - uCenter);
    vec3 n = abs(s.normal);
    // Distance to the closest edge of the face this pixel lies on (ignore the axis of the face normal)
    float edge = n.x > 0.5 ? min(d.y, d.z) : n.y > 0.5 ? min(d.x, d.z) : min(d.x, d.y);
    float line = smoothstep(0.05, 0.0, edge);
    float glow = smoothstep(0.22, 0.0, edge) * 0.35;
    // Fresnel rim: brighter at grazing angles, like glass
    vec3 toCamera = normalize(CAMERA_POSITION - s.worldPosition);
    float rim = pow(1.0 - clamp(dot(toCamera, s.normal), 0.0, 1.0), 3.0);
    s.emissive += uEdge * (line * 1.6 + glow + rim * 0.35) * (1.0 + uPulse * 2.0);
    s.baseColor = mix(s.baseColor, s.baseColor * 0.55, n.y > 0.5 ? 0.0 : 0.35);
}
