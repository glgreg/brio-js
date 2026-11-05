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
 * CSS color functions accepted by `CSSColor` (`rgb()`, `hsl()`, `oklch()`, `color()`, ...).
 */
export type CSSColorFunction =
    | `rgb(${string})`
    | `rgba(${string})`
    | `hsl(${string})`
    | `hsla(${string})`
    | `hwb(${string})`
    | `lab(${string})`
    | `lch(${string})`
    | `oklab(${string})`
    | `oklch(${string})`
    | `color(${string})`
    | `color-mix(${string})`;

/**
 * The 148 CSS named colors (lowercase, as in the CSS Color Module).
 */
export type CSSNamedColor =
    | "aliceblue"
    | "antiquewhite"
    | "aqua"
    | "aquamarine"
    | "azure"
    | "beige"
    | "bisque"
    | "black"
    | "blanchedalmond"
    | "blue"
    | "blueviolet"
    | "brown"
    | "burlywood"
    | "cadetblue"
    | "chartreuse"
    | "chocolate"
    | "coral"
    | "cornflowerblue"
    | "cornsilk"
    | "crimson"
    | "cyan"
    | "darkblue"
    | "darkcyan"
    | "darkgoldenrod"
    | "darkgray"
    | "darkgreen"
    | "darkgrey"
    | "darkkhaki"
    | "darkmagenta"
    | "darkolivegreen"
    | "darkorange"
    | "darkorchid"
    | "darkred"
    | "darksalmon"
    | "darkseagreen"
    | "darkslateblue"
    | "darkslategray"
    | "darkslategrey"
    | "darkturquoise"
    | "darkviolet"
    | "deeppink"
    | "deepskyblue"
    | "dimgray"
    | "dimgrey"
    | "dodgerblue"
    | "firebrick"
    | "floralwhite"
    | "forestgreen"
    | "fuchsia"
    | "gainsboro"
    | "ghostwhite"
    | "gold"
    | "goldenrod"
    | "gray"
    | "green"
    | "greenyellow"
    | "grey"
    | "honeydew"
    | "hotpink"
    | "indianred"
    | "indigo"
    | "ivory"
    | "khaki"
    | "lavender"
    | "lavenderblush"
    | "lawngreen"
    | "lemonchiffon"
    | "lightblue"
    | "lightcoral"
    | "lightcyan"
    | "lightgoldenrodyellow"
    | "lightgray"
    | "lightgreen"
    | "lightgrey"
    | "lightpink"
    | "lightsalmon"
    | "lightseagreen"
    | "lightskyblue"
    | "lightslategray"
    | "lightslategrey"
    | "lightsteelblue"
    | "lightyellow"
    | "lime"
    | "limegreen"
    | "linen"
    | "magenta"
    | "maroon"
    | "mediumaquamarine"
    | "mediumblue"
    | "mediumorchid"
    | "mediumpurple"
    | "mediumseagreen"
    | "mediumslateblue"
    | "mediumspringgreen"
    | "mediumturquoise"
    | "mediumvioletred"
    | "midnightblue"
    | "mintcream"
    | "mistyrose"
    | "moccasin"
    | "navajowhite"
    | "navy"
    | "oldlace"
    | "olive"
    | "olivedrab"
    | "orange"
    | "orangered"
    | "orchid"
    | "palegoldenrod"
    | "palegreen"
    | "paleturquoise"
    | "palevioletred"
    | "papayawhip"
    | "peachpuff"
    | "peru"
    | "pink"
    | "plum"
    | "powderblue"
    | "purple"
    | "rebeccapurple"
    | "red"
    | "rosybrown"
    | "royalblue"
    | "saddlebrown"
    | "salmon"
    | "sandybrown"
    | "seagreen"
    | "seashell"
    | "sienna"
    | "silver"
    | "skyblue"
    | "slateblue"
    | "slategray"
    | "slategrey"
    | "snow"
    | "springgreen"
    | "steelblue"
    | "tan"
    | "teal"
    | "thistle"
    | "tomato"
    | "turquoise"
    | "violet"
    | "wheat"
    | "white"
    | "whitesmoke"
    | "yellow"
    | "yellowgreen";

/**
 * CSS color string: hex (`"#1a1a2e"`), a color function (`"rgba(255, 0, 128, 0.5)"`, `"oklch(70% 0.1 200)"`),
 * a named color (`"tomato"`), `"transparent"` or `"currentcolor"`. Arbitrary strings are rejected at compile time;
 * gradients are a separate type (`CSSGradient`).
 *
 * @example
 * ```ts
 * const bg: CSSColor = "#1a1a2e";
 * const tint: CSSColor = "rgba(255, 0, 128, 0.5)";
 * const named: CSSColor = "tomato";
 * ```
 */
export type CSSColor =
    | `#${string}`
    | CSSColorFunction
    | CSSNamedColor
    | "transparent"
    | "currentcolor";

/**
 * CSS gradient string, accepted where the engine paints through CSS backgrounds (`game.background.color`).
 *
 * @example
 * ```ts
 * game.background.color = "linear-gradient(#0b1220, #1e293b)";
 * ```
 */
export type CSSGradient =
    | `linear-gradient(${string})`
    | `radial-gradient(${string})`
    | `conic-gradient(${string})`
    | `repeating-linear-gradient(${string})`
    | `repeating-radial-gradient(${string})`;

/**
 * Named (non-printable) `KeyboardEvent.key` values from the UI Events specification, plus `" "` (Space).
 */
export type KeyboardNamedKey =
    | "Alt"
    | "AltGraph"
    | "CapsLock"
    | "Control"
    | "Fn"
    | "FnLock"
    | "Meta"
    | "NumLock"
    | "ScrollLock"
    | "Shift"
    | "Symbol"
    | "SymbolLock"
    | "Enter"
    | "Tab"
    | " "
    | "ArrowDown"
    | "ArrowLeft"
    | "ArrowRight"
    | "ArrowUp"
    | "End"
    | "Home"
    | "PageDown"
    | "PageUp"
    | "Backspace"
    | "Clear"
    | "Copy"
    | "CrSel"
    | "Cut"
    | "Delete"
    | "EraseEof"
    | "ExSel"
    | "Insert"
    | "Paste"
    | "Redo"
    | "Undo"
    | "Accept"
    | "Again"
    | "Attn"
    | "Cancel"
    | "ContextMenu"
    | "Escape"
    | "Execute"
    | "Find"
    | "Help"
    | "Pause"
    | "Play"
    | "Props"
    | "Select"
    | "ZoomIn"
    | "ZoomOut"
    | "BrightnessDown"
    | "BrightnessUp"
    | "Eject"
    | "LogOff"
    | "Power"
    | "PowerOff"
    | "PrintScreen"
    | "Hibernate"
    | "Standby"
    | "WakeUp"
    | "AudioVolumeDown"
    | "AudioVolumeMute"
    | "AudioVolumeUp"
    | "MediaPlayPause"
    | "MediaStop"
    | "MediaTrackNext"
    | "MediaTrackPrevious"
    | "Dead"
    | "Process"
    | "Unidentified"
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
    | "F13"
    | "F14"
    | "F15"
    | "F16"
    | "F17"
    | "F18"
    | "F19"
    | "F20"
    | "F21"
    | "F22"
    | "F23"
    | "F24";

/** ASCII letters, as reported by `KeyboardEvent.key` (`"a"` without Shift, `"A"` with Shift or Caps Lock). */
export type KeyboardLetterKey =
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
    | "Z";

/** Digits and ASCII punctuation, as reported by `KeyboardEvent.key` on a US layout. */
export type KeyboardSymbolKey =
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
    | "`"
    | "~"
    | "!"
    | "@"
    | "#"
    | "$"
    | "%"
    | "^"
    | "&"
    | "*"
    | "("
    | ")"
    | "-"
    | "_"
    | "="
    | "+"
    | "["
    | "]"
    | "{"
    | "}"
    | "\\"
    | "|"
    | ";"
    | ":"
    | "'"
    | '"'
    | ","
    | "."
    | "<"
    | ">"
    | "/"
    | "?";

/**
 * Strict `KeyboardEvent.key` value accepted by `BrioKeyboard` and `BrioInputMap`: a named key (`"ArrowUp"`, `"Enter"`,
 * `" "` for Space, `"F1"` to `"F24"`), an ASCII letter (case-sensitive) or an ASCII digit/symbol. Letters match in
 * both cases at runtime (`isDown("a")` is also true while Shift is held). Characters of other layouts (such as
 * `"ç"`) are valid at runtime but not part of the type; cast them with `as KeyboardKey`.
 *
 * @example
 * ```ts
 * if (game.keyboard.isDown("ArrowRight")) {
 *     player.transform.position.x += 200 * dt;
 * }
 * if (game.keyboard.isPressed(" ")) jump();
 * ```
 */
export type KeyboardKey = KeyboardNamedKey | KeyboardLetterKey | KeyboardSymbolKey;
