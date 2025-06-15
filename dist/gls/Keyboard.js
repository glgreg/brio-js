export class Keyboard {
    static keydown(valueKey) {
        let pressed = false;
        window.addEventListener("keydown", (e) => {
            if (e.key === valueKey) {
                pressed = true;
            }
        });
        return pressed;
    }
}
