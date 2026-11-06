// Draws one frame of a sprite sheet on a quad (BrioJS draws 2D art on the GPU this way).
// uFrame = (u, v, width, height) of the frame inside the texture, in 0..1 texture coordinates.
uniform vec4 uFrame;
// rgb tint and opacity
uniform vec4 uTint;
// 0..1: blends the sprite to white (hit flash)
uniform float uFlash;
// emissive strength: glowing things ignore the darkness of the night
uniform float uGlow;

void surface(inout BrioSurface s) {
    vec4 texel = texture(uMap, uFrame.xy + s.uv * uFrame.zw);
    vec3 color = texel.rgb * uTint.rgb;
    s.baseColor = mix(color, vec3(1.0), uFlash);
    s.opacity = texel.a * uTint.a;
    s.emissive = color * uGlow + vec3(uFlash * 0.8);
    // Quads face the camera; a flat normal keeps the lighting even across the sprite
    s.normal = vec3(0.0, 0.0, 1.0);
}
