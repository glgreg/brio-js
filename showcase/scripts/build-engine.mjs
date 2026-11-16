// Builds the BrioJS engine from ../src into public/engine/ so the demo games, the playground sandbox and the
// landing page all run the engine of this repository (not a published version):
//   public/engine/brio.js      ES module bundle (the WebGL2 / Canvas2D backends stay as lazy chunks)
//   public/engine/types.json   { "<path>.d.ts": source } for the editor's IntelliSense
import { build } from "vite";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const showcase = resolve(here, "..");
const repo = resolve(showcase, "..");
const out = join(showcase, "public", "engine");
const typesTmp = join(showcase, "node_modules", ".brio-types");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
    configFile: false,
    logLevel: "warn",
    root: repo,
    build: {
        outDir: out,
        emptyOutDir: false,
        sourcemap: true,
        minify: true,
        target: "es2022",
        lib: { entry: join(repo, "src", "index.ts"), formats: ["es"], fileName: () => "brio.js" },
        rollupOptions: { output: { chunkFileNames: "chunks/[name]-[hash].js" } },
    },
});

rmSync(typesTmp, { recursive: true, force: true });
const tsc = join(showcase, "node_modules", "typescript", "bin", "tsc");
execFileSync(
    process.execPath,
    [
        tsc,
        "-p",
        join(repo, "tsconfig.json"),
        "--emitDeclarationOnly",
        "--declaration",
        // The engine is type-checked by its own CI; here only the declarations are needed
        "--noCheck",
        "--declarationMap",
        "false",
        "--outDir",
        typesTmp,
        "--declarationDir",
        typesTmp,
    ],
    { stdio: "inherit" },
);

const types = {};
const walk = (dir) => {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith(".d.ts")) types[relative(typesTmp, path).split("\\").join("/")] = readFileSync(path, "utf8");
    }
};
walk(typesTmp);
writeFileSync(join(out, "types.json"), JSON.stringify(types));
const version = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
let bytes = readFileSync(join(out, "brio.js")).length;
let gzip = gzipSync(readFileSync(join(out, "brio.js"))).length;
for (const name of readdirSync(join(out, "chunks"))) {
    if (!name.endsWith(".js")) continue;
    const code = readFileSync(join(out, "chunks", name));
    bytes += code.length;
    gzip += gzipSync(code).length;
}
writeFileSync(
    join(out, "version.json"),
    JSON.stringify({ version, built: new Date().toISOString(), kB: Math.round(bytes / 1024), gzipKB: Math.round(gzip / 1024) }),
);
console.log(`engine ${version}: ${Object.keys(types).length} declaration files -> public/engine/`);
