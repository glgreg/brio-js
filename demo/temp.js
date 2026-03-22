const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d");

const image = new Image();
// prettier-ignore
// image.src = "./assets/sprites/soldier_attack.png";
image.src = "./assets/sprites/soldier.png";

let px = 0;
let py = 0;

setInterval(() => {
    if (px === 500) px = 0;
    px += 100;
}, 100);

(function main() {
    canvas.style.background = "#555";
    document.body.append(canvas);

    if (!ctx) return;
    image.onload = () => {
        setInterval(() => {
            render();
        }, 16);
    };
})();

function render() {
    if (!ctx) return;
    ctx.reset();
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(
        image, // element
        px, // sx  - posição de movimento em base da imagem -> gridX
        200, // sy - posição de movimento em base da imagem -> gridY
        100, // sw - tamanho base (px original em escala)   -> tileX
        100, // sh - tamanho base (px original em escala)   -> tileY
        -90, // dx   - posição final                        -> -
        0, // dy   - posicão final                          -> -
        512, // dw - renderização final                     -> tileW
        512, // dh - renderização final                     -> tileH
    );
}
