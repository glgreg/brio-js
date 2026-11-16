// Writes public/<games|templates>/<id>/project.json listing every file of that project, so the playground can
// copy a game or template into the browser's storage. Posters and the manifest itself are not project files.
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const SKIP = new Set(["project.json", "poster.webp", "poster.png", ".DS_Store"]);

function list(dir, root = dir, out = []) {
    for (const name of readdirSync(dir).sort()) {
        if (SKIP.has(name) || name.startsWith(".")) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) list(path, root, out);
        else out.push({ path: relative(root, path).split("\\").join("/"), size: statSync(path).size });
    }
    return out;
}

for (const group of ["games", "templates"]) {
    const base = join(publicDir, group);
    if (!existsSync(base)) continue;
    const index = [];
    for (const id of readdirSync(base).sort()) {
        const dir = join(base, id);
        if (!statSync(dir).isDirectory()) continue;
        const files = list(dir);
        writeFileSync(join(dir, "project.json"), JSON.stringify({ id, group, files }, null, 1));
        index.push({ id, files: files.length, bytes: files.reduce((n, f) => n + f.size, 0) });
        console.log(`${group}/${id}: ${files.length} files`);
    }
    writeFileSync(join(base, "index.json"), JSON.stringify(index, null, 1));
}
