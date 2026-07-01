import { BrioAudio } from "../assets/BrioAudio.js";
import { BrioSprite } from "../assets/BrioSprite.js";
import { BrioAtlas } from "../assets/BrioAtlas.js";
import { BrioCamera } from "../not-implemented/BrioCamera.js";
import { BrioMap } from "../not-implemented/BrioMap.js";
import { BrioScene } from "../not-implemented/BrioScene.js";
import { BrioObject } from "../objects/BrioObject.js";
interface BrioAssets {
    objects: Map<string, BrioObject>;
    sprites: Map<string, BrioSprite>;
    audios: Map<string, BrioAudio>;
    maps: Map<string, BrioMap>;
    cameras: Map<string, BrioCamera>;
    scenes: Map<string, BrioScene>;
    spritesheets: Map<string, BrioAtlas>;
}
export declare class BrioAssetManager implements BrioAssets {
    #private;
    get objects(): Map<string, BrioObject>;
    get sprites(): Map<string, BrioSprite>;
    get audios(): Map<string, BrioAudio>;
    get maps(): Map<string, BrioMap>;
    get cameras(): Map<string, BrioCamera>;
    get scenes(): Map<string, BrioScene>;
    get spritesheets(): Map<string, BrioAtlas>;
}
export {};
//# sourceMappingURL=BrioAssetManager.d.ts.map
