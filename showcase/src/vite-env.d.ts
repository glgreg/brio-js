/// <reference types="vite/client" />
declare module "monaco-editor/editor/editor.worker?worker" {
    const W: new () => Worker;
    export default W;
}
declare module "monaco-editor/language/*?worker" {
    const W: new () => Worker;
    export default W;
}
