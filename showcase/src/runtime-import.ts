// Imports a module served from public/ (the engine, scenes, games) at runtime. Vite would rewrite a literal
// import() of those URLs in dev; a Function-built import keeps the browser's native loader in both modes.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const nativeImport = new Function("url", "return import(url)") as (url: string) => Promise<any>;

export function importPublic<T = any>(url: string): Promise<T> {
    return nativeImport(url);
}
