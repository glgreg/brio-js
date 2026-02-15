# BrioJS

## Features

- [] Add BrioStorage
- [] Add BrioCamera
- [] Add BrioScene
- [] Add BrioSerializer
- [x] Add grid logic to the render and debugging render
- [] Add "baseSize", "visibility", "opacity" and "layer" logic to BrioTransform
- [] Add skew pivot logic
- [] Add local transform
- [] Add proper object destruction
- [] Add multi layered canvas for less mutable objects such as parallax
- [] Make BrioAudio better

## BugFixes

- [] Check render artifacts at motion in Chromium based
- [x] Fix pivot logic in rendering
- [x] Fix rotation logic when self increasing (+= operator): changed from deg to rad
- [] Check skewing logic
- [x] Change logs for a better use: logs should be shown with no arquives traces, or with only the user traces, or with user and brio classes traces
- [] Fix game scale (broke after thinkering with pivot logic)
- [] Fix object transform not working with individual setter (scale.x, scale.y)

## Refactors

- [] Modularize BrioGame and BrioObject
- [] Use ECS in some places
- [] Add BrioMath to refactor basic math operations (deg to rad, dot products, etc)
- [] Change input logic so it only exists a single event listener for each input type and a global BrioKeyboard.globalIsUp and BrioKeyboard.globalIsDown methods
- [x] Change BrioLogger name to BrioConsole
- [] Check incorrect modularized objects creating closures and copies (BrioDebugger, )
- [] Create atomic classes for instantiating correctly object properties such as position, size, scale (part of the "Fix object transform not working with individual setter")
- [] Create a better multi-layer object rendering system (current one is just array creation and sorting of layer in each loop frame)
- [x] Refactors the Sprite cloning to use a SpriteRegistry approach
