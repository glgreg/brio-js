export class BrioAtlas {
    #element;
    constructor(name, sx, sy) {
        const img = new Image();
        img.src = "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/7a23bab1-ebef-4321-baea-df64bfdd3aa4/da0pcrd-a07b6870-35dd-4841-9eb5-8e36cea3699b.png/v1/fit/w_714,h_399,q_70,strp/basic_sprite_background_by_321kye_da0pcrd-375w-2x.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9Mzk5IiwicGF0aCI6Ii9mLzdhMjNiYWIxLWViZWYtNDMyMS1iYWVhLWRmNjRiZmRkM2FhNC9kYTBwY3JkLWEwN2I2ODcwLTM1ZGQtNDg0MS05ZWI1LThlMzZjZWEzNjk5Yi5wbmciLCJ3aWR0aCI6Ijw9NzE0In1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmltYWdlLm9wZXJhdGlvbnMiXX0.yuldnBJvYpUpGEgmj8nuW3-KA2Kw5KdfDerA371fu-A";
        this.#element = img;
    }
    mount() {
        return new Promise((resolve, _) => {
            this.#element.decode();
            resolve(createImageBitmap(this.#element));
        });
    }
}
