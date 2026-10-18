/**
 * Escape-hatch string type that preserves TypeScript union autocomplete while accepting arbitrary custom strings.
 */
export type AnyCSSString = string & {};

/**
 * Standard cardinal and center CSS alignment keywords.
 *
 * @example
 * ```ts
 * const pos: CSSPosition = "center";
 * ```
 */
export type CSSPosition = "center" | "top" | "right" | "bottom" | "left";

/**
 * Template literal type representing valid CSS length values (`px`, `%`, `em`, `rem`, `vw`, `vh`).
 *
 * @example
 * ```ts
 * const width: CSSLength = "64px";
 * const fullWidth: CSSLength = "100%";
 * ```
 */
export type CSSLength =
    | `${number}px`
    | `${number}%`
    | `${number}em`
    | `${number}rem`
    | `${number}vw`
    | `${number}vh`;

/**
 * Template literal type representing a 2D pair of CSS lengths (`"<x> <y>"`).
 *
 * @example
 * ```ts
 * const offset: CSSVec2Length = "16px 32px";
 * ```
 */
export type CSSVec2Length = `${CSSLength} ${CSSLength}`;

/**
 * Valid CSS `background-position` values with template literal autocomplete.
 *
 * @example
 * ```ts
 * game.background.position = "center";
 * game.background.position = "10px 20px";
 * ```
 */
export type CSSBackgroundPosition =
    | CSSPosition
    | `${CSSPosition} ${CSSPosition}`
    | CSSVec2Length
    | `${CSSPosition} ${CSSLength} ${CSSPosition}`
    | `${CSSPosition} ${CSSLength} ${CSSPosition} ${CSSLength}`
    | AnyCSSString;

/**
 * Valid CSS `background-size` values.
 *
 * @example
 * ```ts
 * game.background.size = "cover";
 * game.background.size = "64px 64px";
 * ```
 */
export type CSSBackgroundSize = "contain" | "cover" | CSSLength | CSSVec2Length | AnyCSSString;

/**
 * Valid CSS `background-blend-mode` values.
 *
 * @example
 * ```ts
 * game.background.blendMode = "multiply";
 * ```
 */
export type CSSBackgroundBlendMode =
    | "normal"
    | "multiply"
    | "screen"
    | "overlay"
    | "darken"
    | "lighten"
    | "hard-light"
    | "soft-light"
    | "difference"
    | "exclusion";

/**
 * Valid CSS `background-repeat` values.
 *
 * @example
 * ```ts
 * game.background.repeat = "no-repeat";
 * ```
 */
export type CSSBackgroundRepeat =
    | "repeat"
    | "space"
    | "round"
    | "no-repeat"
    | "repeat-x"
    | "repeat-y";

/**
 * Valid CSS `image-rendering` modes for canvas and background elements.
 *
 * @example
 * ```ts
 * game.background.rendering = "pixelated";
 * ```
 */
export type CSSBackgroundRendering = "auto" | "smooth" | "crisp-edges" | "pixelated";

/**
 * Template literal type for CSS color strings (hex, rgb, rgba, hsl, hsla, named colors, or gradients).
 *
 * @example
 * ```ts
 * const bg: CSSColor = "#1a1a2e";
 * const tint: CSSColor = "rgba(255, 0, 128, 0.5)";
 * ```
 */
export type CSSColor =
    | `#${string}`
    | `rgb(${string})`
    | `rgba(${string})`
    | `hsl(${string})`
    | `hsla(${string})`
    | `linear-gradient(${string})`
    | `radial-gradient(${string})`
    | "transparent"
    | "black"
    | "white"
    | AnyCSSString;

/**
 * Standard `KeyboardEvent.key` values with IDE autocomplete and custom key fallback.
 *
 * @example
 * ```ts
 * if (game.keyboard.isDown("ArrowRight")) {
 *     player.transform.position.x += 200 * dt;
 * }
 * ```
 */
export type KeyboardKey =
    | "ArrowUp"
    | "ArrowDown"
    | "ArrowLeft"
    | "ArrowRight"
    | " "
    | "Enter"
    | "Escape"
    | "Tab"
    | "Backspace"
    | "Delete"
    | "Shift"
    | "Control"
    | "Alt"
    | "Meta"
    | "CapsLock"
    | "Home"
    | "End"
    | "PageUp"
    | "PageDown"
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g"
    | "h"
    | "i"
    | "j"
    | "k"
    | "l"
    | "m"
    | "n"
    | "o"
    | "p"
    | "q"
    | "r"
    | "s"
    | "t"
    | "u"
    | "v"
    | "w"
    | "x"
    | "y"
    | "z"
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F"
    | "G"
    | "H"
    | "I"
    | "J"
    | "K"
    | "L"
    | "M"
    | "N"
    | "O"
    | "P"
    | "Q"
    | "R"
    | "S"
    | "T"
    | "U"
    | "V"
    | "W"
    | "X"
    | "Y"
    | "Z"
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "F1"
    | "F2"
    | "F3"
    | "F4"
    | "F5"
    | "F6"
    | "F7"
    | "F8"
    | "F9"
    | "F10"
    | "F11"
    | "F12"
    | AnyCSSString;

