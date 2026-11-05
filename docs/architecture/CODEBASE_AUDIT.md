# Technical Audit and Diagnosis of the Codebase (Initial State)

> **Historical snapshot**: this document describes the codebase before the `refactor` branch. It is not kept up to date; file paths, line numbers and class names refer to that earlier code. See `TODO.md`, `docs/ROADMAP.md` and the ADRs in `docs/adr/` for the current state.

This document records the detailed technical diagnosis of the `./src/` directory and the root configuration files before the architectural refactor started on the `refactor` branch.

---

## 1. Overview of the State Found

The initial version of BrioJS (~3,000 hand-written lines of TypeScript) successfully established the proof of concept of the lifecycle (`preload -> load -> update`), encapsulation with ES private fields (`#`), Canvas 2D manipulation, HTML5 audio, keyboard input and basic collisions. However, organic growth produced coupling in the central class, memory allocation bottlenecks in the game loop and unfinished modules.

### Map of the Modules Analyzed in `./src/`

| Module / File                        | Status Found                 | Summary Diagnosis                                                                                                                                                                                             |
| :----------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `./src/index.ts`                     | Functional with deviations   | Exports inconsistent semantic aliases (`BrioAtlas as BrioSpriteAtlas`, `BrioConsole as BrioLogger`) and re-exports empty classes from `./src/not-implemented/`.                                               |
| `./src/game/BrioGame.ts`             | Coupled (God Object)         | Concentrates 827 lines managing the DOM, Canvas, loop, assets, input, collision, instantiation and broken snapshots.                                                                                          |
| `./src/game/BrioSpriteRenderer.ts`   | Functional with bugs         | Ignores `transform.renderSize`, does not apply `pivot` to `skew`, clears objects individually before redrawing and reconfigures `imageSmoothingEnabled` for every sprite.                                     |
| `./src/game/BrioUpdater.ts`          | Domain conflict              | Has `animate*` methods that only call `renderObject`, duplicating the automatic rendering that already happens in `BrioGame.update`.                                                                          |
| `./src/game/BrioAssetManager.ts`     | Incomplete                   | Acts only as a passive aggregator of `Map`s, with inconsistent naming (`#spritesheet` vs the `spritesheets` getter).                                                                                          |
| `./src/game/BrioCanvasBackground.ts` | Functional                   | Manipulates the inline CSS of the `<canvas>` element, but overwrites `style.background` when switching between `color` and `image`.                                                                           |
| `./src/objects/BrioObject.ts`        | Coupled to 2D / OOP          | Stores state directly on the instance (AoS), uses the mutable global static flag `instanceOfObject` and restricts names with a `-[0-9]+` suffix.                                                              |
| `./src/base/BrioTransform.ts`        | Partially broken             | Mutations of sub-properties (`scale.x = 2`, `size.x = 64`) do not trigger the setters, leaving `#renderSize` and `#flip` out of sync. No support for a local hierarchy (`localTransform`).                    |
| `./src/assets/BrioAtlas.ts`          | Unfinished prototype         | Contains a hardcoded external URL in the constructor and a `mount()` method that does not await the `decode()` Promise before calling `createImageBitmap()`.                                                  |
| `./src/assets/BrioSprite.ts`         | Functional / Legacy          | Creates one `HTMLImageElement` per instance; the JSDoc still mentions legacy names (`GameSprite`, `GLS.GameSprite`).                                                                                          |
| `./src/assets/BrioAudio.ts`          | Limited (`HTMLAudioElement`) | Based on `<audio>` and `cloneNode(true)`, subject to latency on repeated effects, listener leaks in `playMany` with a delay and mobile autoplay blocking.                                                     |
| `./src/input/BrioKeyboard.ts`        | Functional with side effects | Registers listeners per instance and calls `event.preventDefault()` on every browser key (blocking `F5`, `F12`, etc.).                                                                                        |
| `./src/math/BrioCollision.ts`        | Asymmetric logic bug         | In the circle-rectangle test (`lines 31-70`), it always assumes that `two` is the circle and `one` is the rectangle; if the argument order is reversed, the calculation fails.                                |
| `./src/math/vec2.ts`                 | Math bugs                    | `normalize(out, v)` computes the magnitude using `out` instead of `v`; `distanceTo(out, target)` computes the absolute difference per axis instead of the Euclidean distance and overwrites `out`.            |
| `./src/debugging/BrioDebugger.ts`    | Allocation on access         | The `console`, `render`, `#grid` and `#fpsOverlay` getters allocate new object literals and closures on every read (including inside the game loop).                                                          |
| `./src/debugging/BrioConsole.ts`     | Bugs in ID methods           | `#storedErrors` and `#storedExceptions` are never initialized (`undefined`), making `error(id)` and `exception(id)` return silently at the initial guard; `if (isFound) true;` on line 121 does not `return`. |
| `./src/tools/BrioUtils.ts`           | Anti-patterns                | `addProperty` uses `Object.defineProperty` at runtime without TS type safety; `timedAnimation` and `wait` use `requestAnimationFrame`/`setTimeout` outside the control of the game's `pause()`.               |
| `./src/not-implemented/*`            | Empty skeletons              | `BrioScene`, `BrioMouse`, `BrioGamepad` are empty; `BrioStorage` returns `{}`; `BrioCamera` recreates closures in the `pos`/`size` getters and requires `BrioMap`; `BrioMap` accepts only a single sprite.    |

---

## 2. Details of the Critical Bugs and Performance Bottlenecks

### 2.1. Game Loop Bottlenecks and Garbage Collector Pressure

1. **Per-Frame Array Allocation and Sorting (`BrioGame.ts:480-485`)**:
    - On every `requestAnimationFrame` tick, `const objects = Array.from(this.#assets.objects.values()); objects.sort(...)` runs.
    - In scenes with hundreds of entities, this allocates throwaway arrays 60 times per second and re-runs an $O(N \log N)$ sort even when no layer has changed.
2. **Closure Allocation in the Render Loop (`BrioDebugger.ts:67-196` and `BrioGame.ts:512-540`)**:
    - `#renderDebuggingGrid()` and `#renderDebuggingHelpers()` access `this.#debugger.render` and `renderConfig.grid` every frame. Each access to these getters instantiates a new object with multiple getters/setters and closures.
    - In `BrioDebugger.ts:119`, `get fpsOverlay()` returns `self.#renderConfig.fpsOverlay` directly, leaving the private getter `get #fpsOverlay()` (lines 155-196) as dead code.
3. **Per-Frame Copy of Keyboard State (`BrioGame.ts:491-494`)**:
    - `this.#keyboardPrevState.clear()` followed by a loop copying `this.#keyboardState` happens inside `BrioGame`, coupling the keyboard's internal state management to the main loop.
4. **Invalid Initial DeltaTime on the First Frame (`BrioGame.ts:469`)**:
    - On the first `requestAnimationFrame` frame, `#deltaTimePreviousTime` is `0`, making `deltaTime = currentTime / 1000` (which can be tens of seconds if the preload takes long), causing an abrupt jump on the first tick.

### 2.2. Rendering, Transform and Scale Bugs

1. **Global Scale (`BrioGame.scale`) and Object Scale (`BrioTransform.scale`)**:
    - `BrioSpriteRenderer` receives `this.#scale` by value (primitive `number`) in its constructor (`BrioGame.ts:185`). When the user changes `game.scale = 2` after instantiating `BrioGame`, `this.#renderer.#gameScale` stays `1`.
    - In `BrioSpriteRenderer.ts:108-109`, `drawImage` uses `object.transform.size.x` and `object.transform.size.y` instead of `object.transform.renderSize` (or applying `object.transform.scale` to the context), ignoring the `transform.scale` property.
2. **Individual Vector Setters (`BrioTransform.ts`)**:
    - Because `position`, `size`, `scale`, `pivot` and `skew` return references to `{ x, y }` object literals, writing `obj.transform.scale.x = 2` or `obj.transform.size.x = 64` mutates the internal property without invoking `set scale` or `set size`, so `#renderSize` and `#flip` are not updated.
3. **Unit and Pivot Inconsistency in `skew` (`BrioSpriteRenderer.ts:84-97` vs `BrioTransform.ts:102`)**:
    - The JSDoc of `BrioTransform.skew` says _"Uses radians for skewing the sprite"_, but `BrioSpriteRenderer.ts:90-91` converts the value by multiplying by `Math.PI / 180` (assuming degrees), omits `Math.tan` (passing the angle directly into the shear matrix) and fixes the translation at `size.x / 2, size.y / 2` instead of respecting `object.transform.pivot`.
4. **Partial Object Clearing (`BrioGame.ts:465-467` and `BrioSpriteRenderer.ts:117-133`)**:
    - `clearObject` runs `clearRect(pos.x, pos.y, size.x, size.y)` without considering rotation, skew or pivot. If an object is rotated or scaled, visual artifacts ("trails") remain on the canvas.

### 2.3. Lifecycle, Instantiation, Destruction and Collision Bugs

1. **Accidental Sprite Destruction (`BrioGame.ts:753-761`)**:
    - In the `destroy(targetObject)` method, line 757 checks `if (this.#assets.sprites.has(targetObject.sprite))` and tries to delete it from the sprite map, mixing the entity lifecycle with the graphics asset lifecycle.
2. **Fragile Clone Instantiation (`BrioGame.ts:710-751` and `BrioObject.ts:93-101`)**:
    - Uses the static variable `BrioObject.instanceOfObject = true` to unlock the `clonesInstantiatedValue` setter.
    - `newObject.instanceId = targetObject.clonesInstantiatedValue` uses `targetObject` instead of `registeredObject`, producing incorrect IDs if the user passes a different reference.
    - `BrioObject.clone()` (`BrioObject.ts:141-178`) creates a new `BrioObject` without copying `collision` before `if (object.collision)` (which is always `undefined` on line 148, making the `switch` block on lines 148-175 unreachable).
3. **Incorrect `outbound` Calculation (`BrioGame.ts:690-698`)**:
    - Line 691 defines `let auxHeight = screenThreshold !== 1 ? this.#width : 0;` (using `#width` instead of `#height`), and lines 695 and 698 multiply `0 * auxWidth * screenThreshold` (which always results in `0`).
4. **Non-Functional Snapshots (`BrioGame.ts:546-581`)**:
    - `JSON.stringify(object)` on `BrioObject` and `BrioSprite` serializes `"{}"` because every attribute is private (`#`).
5. **Duplication and Asymmetry in Collisions (`BrioGame.ts:763-781` and `BrioCollision.ts:25-126`)**:
    - `BrioGame.isColliding` ignores `collision.pos` (the collider offset) and ignores circles.
    - `BrioCollision.isColliding` assumes in the circle-rectangle test that `one` is always the rectangle and `two` is always the circle, and treats the circle's `collision.pos` as the center in one place and as the top-left corner in `BrioSpriteRenderer.renderCollisions` (`lines 153-161`).
