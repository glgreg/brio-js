interface Atlas {
    bitmap: ImageBitmap;
    regions: number[];
}

export class BrioAtlas {
    #name: string;
    #element: HTMLImageElement;

    public constructor(
        name: string,
        sx: number,
        sy: number,
        src: string = "./assets/sprites/background.png",
    ) {
        this.#name = name;
        const img = new Image();
        img.src = src;
        this.#element = img;
    }

    public get name(): string {
        return this.#name;
    }

    public async mount(): Promise<ImageBitmap> {
        await this.#element.decode();
        return createImageBitmap(this.#element);
    }
}