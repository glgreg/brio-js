import { BrioSprite } from "./BrioSprite.js";
interface BrioRegistry<T> {
    get: (key: string) => T;
    set: (target: T) => void;
    delete: (key: string) => boolean;
    has: (key: string) => boolean;
}
export declare class BrioSpriteRegistry implements BrioRegistry<BrioSprite> {
    #private;
    set(sprite: BrioSprite): void;
    get(key: string): BrioSprite;
    has(key: string): boolean;
    delete(key: string): boolean;
}
export {};
//# sourceMappingURL=BrioSpriteRegistry.d.ts.map
