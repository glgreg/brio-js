# Concrete 2D/3D Separation and Strict Ubiquitous Language

BrioJS separates 2D and 3D entities into concrete classes (`BrioObject2D` and `BrioObject3D`, `BrioTransform2D` and `BrioTransform3D`, `BrioCamera2D` and `BrioCamera3D`) orchestrated by a single `BrioGame` entrypoint supporting `"2d"` and `"3d"` configuration presets, and enforces a strict Ubiquitous Language policy forbidding semantic aliases.

## Considered Options

- **Unified 3D classes for both 2D and 3D games**: Forces 2D beginners to deal with `z` coordinates and 3D rotations while doubling the ECS memory footprint for 2D scenes.
- **Separate `BrioGame2D` and `BrioGame3D` entrypoints**: Splits the engine's root identity and complicates multi-mode configuration.
- **Single `BrioGame` entrypoint with `"2d"` / `"3d"` presets and concrete `2D` / `3D` entity classes**: Keeps `BrioGame` as the universal entrypoint (accepting `"2d"`, `"3d"`, or a full `BrioGameConfig` object) while providing specialized, tree-shakeable 2D and 3D classes.

## Consequences

- **Strict Ubiquitous Language Rule**: Aliases may only be introduced when abstracting technical complexity (such as preset configurations), never as semantic synonyms for the same concept. Every domain concept has exactly one canonical name (for example, `trigger` instead of `intangible`, `BrioAtlas` instead of `BrioSpriteAtlas`, `BrioObject2D` and `BrioObject3D` instead of an ambiguous `BrioObject` alias), and JSDoc/TSDoc is responsible for explaining its behavior.
