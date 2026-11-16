# Two-Tier Interface: Canvas Widgets and DOM Roots Over One Contract, With React in Its Own Package

Status: **Accepted** (2026-11-16)

BrioJS offers two ways to build a game interface, and both read and write the game through the same small contract in `@brio-js/core`. **Canvas widgets** are drawn by the engine on `"ui"` layers. **DOM roots** are HTML elements mounted over the canvas. React is the primary way to write a DOM root, and its binding ships as a separate package, `@brio-js/react`. The contract in core is framework-neutral and has three parts: state stores, requests and notices. This replaces decision 16 of [`ENGINE_COMPLETION_PLAN.md`](../plans/ENGINE_COMPLETION_PLAN.md) ("UI is canvas-based, not DOM"), which was recorded during a planning session and not taken by the maintainers. The evidence is in section 10 of [`GAME_LIFECYCLE_STUDY.md`](../architecture/GAME_LIFECYCLE_STUDY.md).

## The contract in core

| Part | Direction | What it is | When it runs |
| --- | --- | --- | --- |
| State store | Game to interface | Named values the game publishes (`game.state.define(...)`), read with `get`, `getSnapshot` and `subscribe`. A snapshot is immutable and keeps its identity until a value changes | Subscribers are called at most once per frame, after `update()` |
| Request | Interface to game | A named, typed message the interface sends (`game.ui.send("startGame", { slot: 1 })`) and the game handles (`game.ui.onRequest("startGame", handler)`). Declared by the game; an undeclared name warns once | Queued, and handled at the start of the next `update()`, never in the middle of a frame |
| Notice | Game to interface | A named, typed, transient message for things that are not state (`game.ui.notify("toast", { text })`) | Queued, and delivered after `update()`, with the store notifications |

Rules that keep the contract small:

- The interface never holds a reference to an engine object, a transform or an ECS buffer. It sees store snapshots and notices, and it speaks through requests.
- There is no general event emitter on engine objects for interfaces to subscribe to. Collision listeners, `onError` and `onLoadProgress` keep their existing roles.
- Requests are recorded and replayed with input (package X-05 of the lifecycle plan), so a run driven through menus stays reproducible.
- Interface controls that are gameplay input (a virtual stick, a jump button) feed `BrioInputMap` actions, not requests.

## Considered Options

- **Canvas widgets only (previous decision 16)**: One renderer, captured by screenshots, post-processing and golden tests, and able to run inside a worker. But complex menus, long text, forms, accessibility and touch layouts must all be rebuilt in the engine, and none of the web's layout, styling and component ecosystems can be used.
- **React support inside core, as plain JavaScript "hooks" and event emitters**: No second package to install. But React itself cannot be a dependency of core (ADR 0001), so core would carry a look-alike reactive system with its own rules, and the word "hook" already names shader hooks in `GLOSSARY.md`. Emitters and listeners in both directions would let interface code reach into the engine at any point of the frame: handlers that change the world during iteration, ordering that depends on registration, listeners that outlive their scene, and state that snapshots and replays cannot see.
- **A framework-neutral contract in core and a React binding in its own package (chosen)**: Core owns what only the engine can own: where state is published, when messages cross the boundary, how a DOM root is mounted, scaled and given input. `@brio-js/react` is a thin adapter over that contract, with `react` as a peer dependency, and other frameworks or plain JavaScript use the same three parts directly.

## Consequences

- Data flows one way in each direction: state and notices go out, requests come in, and each crosses at one fixed point of the frame. This is the one-way data flow that React applications already use, so a React developer finds the model familiar, and the engine keeps determinism.
- `@brio-js/react` exposes the contract as React hooks (`useBrioState`, `useBrioRequest`, `useBrioNotice`, `useBrioGame`) and components (`BrioCanvas`, `createBrioRoot`). `useBrioState` is built on React's `useSyncExternalStore`, whose requirements the store contract was written to meet. In that package "hook" has React's meaning; in core it keeps meaning a shader hook.
- Documentation and examples for menus, heads-up displays and touch layouts lead with React. Plain HTML, CSS and JavaScript stay supported at no extra cost, because a React root is mounted into the same DOM root.
- Canvas widgets remain, for interface that must be part of the rendered image: in-world elements, anything that post-processing, render targets or `captureFrame()` must include, and games that will run in a worker. They bind to the same stores, requests and notices.
- The limits of a DOM root are part of the capability matrix: it is always above the canvas, it is absent from captures and golden frames, its text depends on the host's fonts, and it does not exist in headless runs or in a worker.
- A later option, not planned now: a React renderer that targets canvas widgets, so one component tree can drive either tier. It would live in `@brio-js/react` and needs the widget set of package U-02 first.
- New glossary terms arrive with their packages: State Store, Request, Notice, DOM Root, Canvas Widget.
