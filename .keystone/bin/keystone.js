#!/usr/bin/env node

// .keystone/operations/cli.ts
import { parseArgs } from "node:util";

// .keystone/operations/commands/create.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, statSync as statSync2, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join2, relative as relative3, resolve as resolve2 } from "node:path";

// .keystone/operations/core/context.ts
function csv(value) {
  if (!value)
    return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}
function plural(count, word, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

// .keystone/operations/core/key.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";

// .keystone/operations/core/workspace.ts
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname as dirname2, join, relative as relative2, resolve } from "node:path";

// .keystone/operations/core/frontmatter.ts
class FrontmatterError extends Error {
  line;
  constructor(message, line) {
    super(line > 0 ? `line ${line}: ${message}` : message);
    this.name = "FrontmatterError";
    this.line = line;
  }
}
var KEY_PATTERN = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/;
function splitDocument(source) {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, `
`);
  if (!text.startsWith(`---
`)) {
    throw new FrontmatterError("missing opening '---' frontmatter delimiter", 1);
  }
  const lines = text.split(`
`);
  for (let i = 1;i < lines.length; i++) {
    if (lines[i] === "---") {
      return {
        frontmatter: lines.slice(1, i).join(`
`),
        body: lines.slice(i + 1).join(`
`),
        offset: 2
      };
    }
  }
  throw new FrontmatterError("missing closing '---' frontmatter delimiter", lines.length);
}
function indentOf(line) {
  const match = /^( *)/.exec(line);
  return match ? match[1].length : 0;
}
function isSkippable(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}
function stripInlineComment(value) {
  const index = value.search(/\s#/);
  return index === -1 ? value : value.slice(0, index);
}
function parseScalar(raw, line) {
  const value = raw.trim();
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    if (end <= 0)
      throw new FrontmatterError("unterminated double-quoted string", line);
    try {
      return JSON.parse(value.slice(0, end + 1));
    } catch {
      throw new FrontmatterError("invalid double-quoted string", line);
    }
  }
  if (value.startsWith("'")) {
    const end = value.lastIndexOf("'");
    if (end <= 0)
      throw new FrontmatterError("unterminated single-quoted string", line);
    return value.slice(1, end).replace(/''/g, "'");
  }
  return stripInlineComment(value).trim();
}
function splitInlineList(inner, line) {
  const items = [];
  let current = "";
  let quote = null;
  for (const char of inner) {
    if (quote) {
      current += char;
      if (char === quote)
        quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      items.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (quote)
    throw new FrontmatterError("unterminated quoted item in inline list", line);
  items.push(current);
  return items.map((item) => parseScalar(item, line)).filter((item) => item !== "");
}
function parseInlineList(raw, line) {
  const value = stripInlineComment(raw).trim();
  if (!value.startsWith("["))
    return null;
  if (!value.endsWith("]"))
    throw new FrontmatterError("unterminated inline list", line);
  return splitInlineList(value.slice(1, -1), line);
}
function lineNumber(cursor, index = cursor.index) {
  return cursor.offset + index;
}
function nextContentIndex(cursor, from) {
  let i = from;
  while (i < cursor.lines.length && isSkippable(cursor.lines[i]))
    i++;
  return i;
}
function parseBlockList(cursor, indent) {
  const items = [];
  while (true) {
    const i = nextContentIndex(cursor, cursor.index);
    if (i >= cursor.lines.length) {
      cursor.index = i;
      break;
    }
    const line = cursor.lines[i];
    const lineIndent = indentOf(line);
    if (lineIndent < indent)
      break;
    if (lineIndent > indent) {
      throw new FrontmatterError("unexpected indentation inside list", lineNumber(cursor, i));
    }
    const trimmed = line.trim();
    if (!trimmed.startsWith("-"))
      break;
    const item = trimmed.slice(1);
    if (item !== "" && !item.startsWith(" ")) {
      throw new FrontmatterError("list items must use '- value'", lineNumber(cursor, i));
    }
    const value = parseScalar(item, lineNumber(cursor, i));
    if (value !== "")
      items.push(value);
    cursor.index = i + 1;
  }
  return items;
}
function parseBlockScalar(cursor, style, parentIndent) {
  const collected = [];
  let blockIndent = -1;
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.trim() === "") {
      collected.push("");
      cursor.index++;
      continue;
    }
    const lineIndent = indentOf(line);
    if (lineIndent <= parentIndent)
      break;
    if (blockIndent === -1)
      blockIndent = lineIndent;
    collected.push(line.slice(Math.min(blockIndent, lineIndent)));
    cursor.index++;
  }
  while (collected.length > 0 && collected[collected.length - 1] === "")
    collected.pop();
  if (style.startsWith("|"))
    return collected.join(`
`);
  const paragraphs = [];
  let current = [];
  for (const entry of collected) {
    if (entry === "") {
      if (current.length > 0)
        paragraphs.push(current.join(" "));
      current = [];
    } else {
      current.push(entry.trim());
    }
  }
  if (current.length > 0)
    paragraphs.push(current.join(" "));
  return paragraphs.join(`
`);
}
function parseNestedMap(cursor, indent) {
  const map = {};
  while (true) {
    const i = nextContentIndex(cursor, cursor.index);
    if (i >= cursor.lines.length) {
      cursor.index = i;
      break;
    }
    const line = cursor.lines[i];
    const lineIndent = indentOf(line);
    if (lineIndent < indent)
      break;
    if (lineIndent > indent) {
      throw new FrontmatterError("unexpected indentation inside map", lineNumber(cursor, i));
    }
    const match = KEY_PATTERN.exec(line.trim());
    if (!match)
      throw new FrontmatterError("expected 'key:' inside map", lineNumber(cursor, i));
    const [, key, rawValue = ""] = match;
    if (key in map)
      throw new FrontmatterError(`duplicate key '${key}'`, lineNumber(cursor, i));
    cursor.index = i + 1;
    const value = stripInlineComment(rawValue).trim();
    if (value === "") {
      const next = nextContentIndex(cursor, cursor.index);
      if (next < cursor.lines.length && indentOf(cursor.lines[next]) > indent) {
        map[key] = parseBlockList(cursor, indentOf(cursor.lines[next]));
      } else {
        map[key] = [];
      }
      continue;
    }
    const list = parseInlineList(value, lineNumber(cursor, i));
    if (list === null) {
      throw new FrontmatterError(`nested key '${key}' must hold a list`, lineNumber(cursor, i));
    }
    map[key] = list;
  }
  return map;
}
function parseFrontmatter(source, offset = 1) {
  const cursor = { lines: source.split(`
`), index: 0, offset };
  const data = {};
  while (true) {
    const i = nextContentIndex(cursor, cursor.index);
    if (i >= cursor.lines.length)
      break;
    const line = cursor.lines[i];
    if (indentOf(line) !== 0) {
      throw new FrontmatterError("top-level keys must not be indented", lineNumber(cursor, i));
    }
    const match = KEY_PATTERN.exec(line);
    if (!match)
      throw new FrontmatterError("expected 'key: value'", lineNumber(cursor, i));
    const [, key, rawValue = ""] = match;
    if (key in data)
      throw new FrontmatterError(`duplicate key '${key}'`, lineNumber(cursor, i));
    cursor.index = i + 1;
    const value = rawValue.trim();
    if (value === "|" || value === ">" || /^[|>][+-]$/.test(value)) {
      data[key] = parseBlockScalar(cursor, value, 0);
      continue;
    }
    if (value === "") {
      const next = nextContentIndex(cursor, cursor.index);
      if (next >= cursor.lines.length || indentOf(cursor.lines[next]) === 0) {
        data[key] = "";
        continue;
      }
      const childIndent = indentOf(cursor.lines[next]);
      data[key] = cursor.lines[next].trim().startsWith("-") ? parseBlockList(cursor, childIndent) : parseNestedMap(cursor, childIndent);
      continue;
    }
    const list = parseInlineList(value, lineNumber(cursor, i));
    data[key] = list ?? parseScalar(value, lineNumber(cursor, i));
  }
  return data;
}
var PLAIN_SAFE = /^[A-Za-z0-9_./@()][^\n]*$/;
var RESERVED = /^(true|false|yes|no|on|off|null|~|-?\d[\d_.]*)$/i;
function formatScalar(value) {
  const needsQuotes = value === "" || value !== value.trim() || !PLAIN_SAFE.test(value) || RESERVED.test(value) || value.includes(": ") || value.endsWith(":") || /\s#/.test(value) || value.includes(`
`);
  return needsQuotes ? JSON.stringify(value) : value;
}
var INLINE_ITEM = /^[A-Za-z0-9_./@-][A-Za-z0-9_./@ -]*$/;
var INLINE_MAX_WIDTH = 80;
function formatList(key, items, indent) {
  if (items.length === 0)
    return [`${indent}${key}: []`];
  const inline = `${indent}${key}: [${items.join(", ")}]`;
  const simple = items.every((item) => INLINE_ITEM.test(item) && item === item.trim() && !RESERVED.test(item));
  if (simple && inline.length <= INLINE_MAX_WIDTH)
    return [inline];
  return [`${indent}${key}:`, ...items.map((item) => `${indent}  - ${formatScalar(item)}`)];
}
function stringifyFrontmatter(data, order = []) {
  const keys = [...order.filter((key) => (key in data)), ...Object.keys(data).filter((key) => !order.includes(key))];
  const out = [];
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string") {
      out.push(`${key}: ${formatScalar(value)}`);
    } else if (Array.isArray(value)) {
      out.push(...formatList(key, value, ""));
    } else {
      out.push(`${key}:`);
      for (const [sub, items] of Object.entries(value))
        out.push(...formatList(sub, items, "  "));
    }
  }
  return out.join(`
`);
}

// .keystone/operations/core/stone.ts
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, sep } from "node:path";

// .keystone/operations/types.ts
var STONE_TYPES = ["module", "service", "entity", "policy", "integration"];
var RELATION_KINDS = ["depends_on", "depended_by", "children"];
var INVERSE_RELATION = {
  depends_on: "depended_by",
  depended_by: "depends_on"
};

class KeystoneError extends Error {
  exitCode;
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "KeystoneError";
    this.exitCode = exitCode;
  }
}

// .keystone/operations/core/stone.ts
var STONE_FILE_PATTERN = /^\.stone\.([a-z0-9][a-z0-9-]*)\.md$/;
var STONE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
var KNOWN_KEYS = ["id", "type", "tags", "relations", "owner", "summary"];
function stoneFileName(id) {
  return `.stone.${id}.md`;
}
function emptyRelations() {
  return { depends_on: [], depended_by: [], children: [] };
}
function asString(value) {
  return typeof value === "string" ? value : "";
}
function asList(value) {
  if (Array.isArray(value))
    return value.map(String);
  if (typeof value === "string" && value !== "")
    return [value];
  return [];
}
function toMeta(data) {
  const relations = emptyRelations();
  const rawRelations = data.relations;
  const extra = {};
  if (rawRelations && typeof rawRelations === "object" && !Array.isArray(rawRelations)) {
    for (const [kind, targets] of Object.entries(rawRelations)) {
      if (RELATION_KINDS.includes(kind)) {
        relations[kind] = [...targets];
      }
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (!KNOWN_KEYS.includes(key))
      extra[key] = value;
  }
  const owner = asString(data.owner);
  return {
    id: asString(data.id),
    type: asString(data.type),
    tags: asList(data.tags),
    relations,
    owner: owner === "" ? undefined : owner,
    summary: asString(data.summary),
    extra
  };
}
function unknownRelationKinds(data) {
  const raw = data.relations;
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return [];
  return Object.keys(raw).filter((kind) => !RELATION_KINDS.includes(kind));
}
function fromMeta(meta) {
  const data = {
    id: meta.id,
    type: meta.type,
    tags: meta.tags,
    relations: {
      depends_on: meta.relations.depends_on,
      depended_by: meta.relations.depended_by,
      children: meta.relations.children
    }
  };
  if (meta.owner)
    data.owner = meta.owner;
  data.summary = meta.summary;
  return { ...data, ...meta.extra };
}
function renderStone(meta, body) {
  const frontmatter = stringifyFrontmatter(fromMeta(meta), KNOWN_KEYS);
  const content = `---
${frontmatter}
---
${body}`;
  return content.endsWith(`
`) ? content : `${content}
`;
}
function toPosix(path) {
  return path.split(sep).join("/");
}
function readStone(path, root) {
  const source = readFileSync(path, "utf8");
  const { frontmatter, body, offset } = splitDocument(source);
  const data = parseFrontmatter(frontmatter, offset);
  const relPath = toPosix(relative(root, path));
  const relDir = toPosix(relative(root, dirname(path))) || ".";
  const match = STONE_FILE_PATTERN.exec(basename(path));
  const notes = unknownRelationKinds(data).map((kind) => `unknown relation kind '${kind}'`);
  if (data.relations !== undefined && (typeof data.relations !== "object" || Array.isArray(data.relations))) {
    notes.push("'relations' must be a map of lists");
  }
  for (const key of ["id", "type", "summary", "owner"]) {
    if (data[key] !== undefined && typeof data[key] !== "string")
      notes.push(`'${key}' must be a scalar`);
  }
  return {
    data,
    stone: {
      meta: toMeta(data),
      body,
      path,
      relPath,
      relDir,
      fileId: match ? match[1] : "",
      notes
    }
  };
}
function writeStone(stone) {
  if (stone.notes.length > 0) {
    throw new KeystoneError(`refusing to rewrite ${stone.relPath}: ${stone.notes.join("; ")}. Fix the frontmatter by hand first (see 'keystone stone doctor').`);
  }
  writeFileSync(stone.path, renderStone(stone.meta, stone.body), "utf8");
}
function titleFromId(id) {
  return id.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
function headings(body) {
  return body.split(`
`).filter((line) => /^#{1,6}\s/.test(line)).map((line) => line.replace(/^#{1,6}\s+/, "").trim());
}

// .keystone/operations/core/workspace.ts
var KEY_DIR = ".keystone";
var KEY_FILES = {
  protocol: "protocol.md",
  architecture: "architecture.md",
  identity: "identity.md",
  standards: "standards.md",
  state: "state.md",
  stoneTemplate: "templates/stone.md"
};
var IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  "coverage",
  "__pycache__"
]);
function findProjectRoot(start) {
  let current = resolve(start);
  while (true) {
    const candidate = join(current, KEY_DIR);
    if (existsSync(candidate) && statSync(candidate).isDirectory())
      return current;
    const parent = dirname2(current);
    if (parent === current)
      return null;
    current = parent;
  }
}
function resolveRoot(explicit, cwd) {
  if (explicit)
    return resolve(cwd, explicit);
  return findProjectRoot(cwd) ?? resolve(cwd);
}
function keyPath(root, file) {
  return join(root, KEY_DIR, KEY_FILES[file]);
}
function hasKey(root) {
  return existsSync(join(root, KEY_DIR));
}
function collectStonePaths(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name))
        continue;
      if (existsSync(join(dir, entry.name, KEY_DIR)))
        continue;
      collectStonePaths(join(dir, entry.name), out);
    } else if (entry.isFile() && STONE_FILE_PATTERN.test(entry.name)) {
      out.push(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.startsWith(".stone.") && entry.name.endsWith(".md")) {
      out.push(join(dir, entry.name));
    }
  }
}
function scan(root) {
  const paths = [];
  collectStonePaths(root, paths);
  const stones = [];
  const parseIssues = [];
  for (const path of paths) {
    try {
      stones.push(readStone(path, root).stone);
    } catch (error) {
      const message = error instanceof FrontmatterError ? error.message : String(error);
      const relPath = toPosix(relative2(root, path));
      parseIssues.push({ path, relPath, message });
    }
  }
  return { root, stones, parseIssues };
}
function indexById(stones) {
  const map = new Map;
  for (const stone of stones) {
    const id = stone.meta.id || stone.fileId;
    if (id && !map.has(id))
      map.set(id, stone);
  }
  return map;
}

// .keystone/operations/core/key.ts
var INDEX_START = "<!-- keystone:index:start -->";
var INDEX_END = "<!-- keystone:index:end -->";
var TEMPLATE_MARKER = "<!-- keystone:template -->";
function escapeCell(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function renderIndex(stones) {
  if (stones.length === 0)
    return "_No stones yet. Create one with `keystone stone create <id> --path <dir>`._";
  const rows = [...stones].sort((a, b) => a.relPath.localeCompare(b.relPath)).map((stone) => `| \`${stone.meta.id}\` | ${escapeCell(stone.meta.type)} | [${stone.relDir}](../${stone.relPath}) | ${escapeCell(stone.meta.summary)} |`);
  return ["| Stone | Type | Location | Summary |", "| --- | --- | --- | --- |", ...rows].join(`
`);
}
function updateIndex(root, stones) {
  const path = keyPath(root, "architecture");
  if (!existsSync2(path))
    return "missing-file";
  const source = readFileSync2(path, "utf8");
  const start = source.indexOf(INDEX_START);
  const end = source.indexOf(INDEX_END);
  if (start === -1 || end === -1 || end < start)
    return "missing-markers";
  const next = `${source.slice(0, start + INDEX_START.length)}
${renderIndex(stones)}
${source.slice(end)}`;
  if (next === source)
    return "unchanged";
  writeFileSync2(path, next, "utf8");
  return "updated";
}
function hasTemplateMarker(path) {
  return existsSync2(path) && readFileSync2(path, "utf8").includes(TEMPLATE_MARKER);
}
function readState(root) {
  const path = keyPath(root, "state");
  if (!existsSync2(path))
    return [];
  const items = [];
  for (const line of readFileSync2(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*-\s*\[([ xX-])\]\s*\*{0,2}([^*(\u2014:]+?)\*{0,2}\s*(?:[(\u2014:].*)?$/.exec(line);
    if (!match)
      continue;
    const mark = match[1].toLowerCase();
    items.push({
      name: match[2].trim(),
      status: mark === "x" ? "done" : mark === "-" ? "skipped" : "pending",
      line: line.trim()
    });
  }
  return items;
}

// .keystone/operations/commands/create.ts
var DEFAULT_STONE_BODY = `
# {{title}}

## Purpose and Design Decisions

Why this part of the system exists and which technical choices shape it.

## Invariants

Rules that must hold for every change in this scope. Describe them as facts
of the system, with the reason that makes them necessary.

## Integration Contracts

Interfaces, payloads, events and side effects other parts rely on.

## Anti-Patterns

Approaches that look reasonable here but conflict with the design above.
`;
function loadTemplate(root) {
  const path = keyPath(root, "stoneTemplate");
  return existsSync3(path) ? readFileSync3(path, "utf8") : DEFAULT_STONE_BODY;
}
function fill(template, values) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => values[key] ?? match);
}
function create(ctx, id, options) {
  if (!id)
    throw new KeystoneError("usage: keystone stone create <id> --path <dir> [--type <type>] [--tags a,b] [--summary <text>]");
  if (!STONE_ID_PATTERN.test(id)) {
    throw new KeystoneError(`invalid stone id '${id}': use lowercase letters, digits and dashes (e.g. 'user-service')`);
  }
  const type = options.type ?? "module";
  if (!STONE_TYPES.includes(type)) {
    throw new KeystoneError(`invalid type '${type}': expected one of ${STONE_TYPES.join(", ")}`);
  }
  if (!options.path)
    throw new KeystoneError("missing --path <dir>: stones live next to the code they describe");
  const dir = resolve2(ctx.cwd, options.path);
  const relDir = relative3(ctx.root, dir);
  if (relDir.startsWith("..") || resolve2(ctx.root, relDir) !== dir) {
    throw new KeystoneError(`path '${options.path}' is outside the project root ${ctx.root}`);
  }
  if (!existsSync3(dir) || !statSync2(dir).isDirectory()) {
    throw new KeystoneError(`directory '${options.path}' does not exist`);
  }
  const parts = toPosix(relDir).split("/");
  if (parts.some((part) => part.startsWith("."))) {
    throw new KeystoneError(`stones inside hidden directories are not scanned: '${options.path}'`);
  }
  const ignored = parts.find((part) => IGNORED_DIRS.has(part));
  if (ignored) {
    throw new KeystoneError(`stones inside '${ignored}/' are not scanned (generated or vendored code): '${options.path}'. Place the stone next to the source that produces it.`);
  }
  const { stones } = scan(ctx.root);
  const byId = indexById(stones);
  if (byId.has(id))
    throw new KeystoneError(`stone '${id}' already exists at ${byId.get(id)?.relPath}`);
  const dependsOn = csv(options["depends-on"]);
  for (const target of dependsOn) {
    if (target === id)
      throw new KeystoneError("a stone cannot depend on itself");
    if (!byId.has(target))
      throw new KeystoneError(`unknown stone '${target}' in --depends-on`);
    const notes = byId.get(target)?.notes ?? [];
    if (notes.length > 0)
      throw new KeystoneError(`cannot link '${target}': ${notes.join("; ")}`);
  }
  const meta = {
    id,
    type,
    tags: csv(options.tags),
    relations: { ...emptyRelations(), depends_on: dependsOn },
    owner: options.owner,
    summary: options.summary ?? "",
    extra: {}
  };
  const filePath = join2(dir, stoneFileName(id));
  const body = fill(loadTemplate(ctx.root), { id, title: titleFromId(id), type, summary: meta.summary });
  writeFileSync3(filePath, renderStone(meta, body.startsWith(`
`) ? body : `
${body}`), "utf8");
  for (const target of dependsOn) {
    const stone = byId.get(target);
    if (stone && !stone.meta.relations.depended_by.includes(id)) {
      stone.meta.relations.depended_by.push(id);
      writeStone(stone);
    }
  }
  const index = updateIndex(ctx.root, scan(ctx.root).stones);
  const relFile = toPosix(relative3(ctx.root, filePath));
  ctx.io.stdout(`Created ${relFile}`);
  if (dependsOn.length > 0)
    ctx.io.stdout(`Linked ${plural(dependsOn.length, "dependency", "dependencies")}: ${dependsOn.join(", ")}`);
  if (index === "updated")
    ctx.io.stdout("Updated stone index in .keystone/architecture.md");
  if (index === "missing-markers")
    ctx.io.stderr("warning: .keystone/architecture.md has no index markers; index not updated");
  if (!meta.summary)
    ctx.io.stdout("Next: fill in 'summary' and the body sections, then run 'keystone stone doctor'.");
  return 0;
}

// .keystone/operations/commands/doctor.ts
import { existsSync as existsSync4, readFileSync as readFileSync4, readdirSync as readdirSync2 } from "node:fs";
import { dirname as dirname3 } from "node:path";
var REQUIRED_KEY_FILES = ["protocol", "architecture", "state"];
var RECOMMENDED_KEY_FILES = ["identity", "standards"];
function checkKey(root, push) {
  if (!hasKey(root)) {
    push({ severity: "error", code: "key-missing", message: `no .keystone/ directory found at ${root}` });
    return;
  }
  for (const file of REQUIRED_KEY_FILES) {
    if (!existsSync4(keyPath(root, file))) {
      push({ severity: "error", code: "key-file-missing", message: `.keystone/${KEY_FILES[file]} is missing` });
    }
  }
  for (const file of RECOMMENDED_KEY_FILES) {
    if (!existsSync4(keyPath(root, file))) {
      push({ severity: "warning", code: "key-file-missing", message: `.keystone/${KEY_FILES[file]} is missing` });
    }
  }
  for (const file of ["identity", "architecture", "standards"]) {
    if (hasTemplateMarker(keyPath(root, file))) {
      push({
        severity: "warning",
        code: "core-context-template",
        message: `.keystone/${KEY_FILES[file]} still contains template content (remove ${TEMPLATE_MARKER} once filled)`
      });
    }
  }
  const assumed = readState(root).filter((item) => /\(assumed\b/i.test(item.line));
  if (assumed.length > 0) {
    push({
      severity: "info",
      code: "state-assumed",
      message: `set up without the user's confirmation, review when possible: ${assumed.map((item) => item.name).join(", ")}`
    });
  }
  const pending = readState(root).filter((item) => item.status === "pending");
  if (pending.length > 0) {
    push({
      severity: "info",
      code: "state-pending",
      message: `activation pending in .keystone/state.md: ${pending.map((item) => item.name).join(", ")}`
    });
  }
}
var normalize = (text) => text.replace(/\s+/g, " ").trim();
function templateGuidance(root) {
  return loadTemplate(root).split(/\n\s*\n/).map(normalize).filter((paragraph) => paragraph && !paragraph.startsWith("#") && !paragraph.includes("{{"));
}
function hasCoLocatedSource(stone) {
  try {
    return readdirSync2(dirname3(stone.path)).some((name) => !name.startsWith("."));
  } catch {
    return false;
  }
}
function diagnose(root) {
  const diagnostics = [];
  const push = (d) => diagnostics.push(d);
  checkKey(root, push);
  const { stones, parseIssues } = scan(root);
  for (const issue of parseIssues) {
    push({ severity: "error", code: "parse-error", message: issue.message, path: issue.relPath });
  }
  const byId = new Map;
  for (const stone of stones) {
    const id = stone.meta.id || stone.fileId;
    byId.set(id, [...byId.get(id) ?? [], stone]);
  }
  const guidance = templateGuidance(root);
  for (const stone of stones) {
    const at = { stone: stone.meta.id || stone.fileId, path: stone.relPath };
    const { meta } = stone;
    if (!STONE_FILE_PATTERN.test(stone.relPath.split("/").pop() ?? "")) {
      push({ severity: "error", code: "invalid-filename", message: "filename must match .stone.<id>.md with a lowercase kebab-case id", ...at });
    }
    for (const note of stone.notes)
      push({ severity: "error", code: "invalid-frontmatter", message: note, ...at });
    if (!meta.id)
      push({ severity: "error", code: "missing-id", message: "frontmatter has no 'id'", ...at });
    else if (stone.fileId && meta.id !== stone.fileId) {
      push({ severity: "error", code: "id-mismatch", message: `frontmatter id '${meta.id}' does not match filename id '${stone.fileId}'`, ...at });
    }
    if (!meta.type)
      push({ severity: "error", code: "missing-type", message: "frontmatter has no 'type'", ...at });
    else if (!STONE_TYPES.includes(meta.type)) {
      push({ severity: "warning", code: "unknown-type", message: `type '${meta.type}' is not one of ${STONE_TYPES.join(", ")}`, ...at });
    }
    if (!meta.summary.trim())
      push({ severity: "error", code: "missing-summary", message: "frontmatter has no 'summary'", ...at });
    if (meta.tags.length === 0)
      push({ severity: "warning", code: "missing-tags", message: "no tags declared; search quality degrades", ...at });
    const leftover = guidance.filter((paragraph) => normalize(stone.body).includes(paragraph)).length;
    if (guidance.length > 0 && leftover === guidance.length) {
      push({ severity: "error", code: "unfilled-stone", message: "body is still the template; describe this module from its code", ...at });
    } else if (leftover > 0) {
      push({ severity: "warning", code: "template-text", message: `${plural(leftover, "section still holds", "sections still hold")} template guidance text`, ...at });
    }
    if (!stone.body.trim())
      push({ severity: "warning", code: "empty-body", message: "body is empty; document purpose and invariants", ...at });
    else if (!headings(stone.body).some((heading) => /invariant/i.test(heading))) {
      push({ severity: "info", code: "missing-invariants", message: "no 'Invariants' section found", ...at });
    }
    if (!hasCoLocatedSource(stone)) {
      push({ severity: "warning", code: "no-co-located-source", message: `directory '${stone.relDir}' has no visible files; was the module moved or removed?`, ...at });
    }
    for (const kind of RELATION_KINDS) {
      const targets = meta.relations[kind];
      const seen = new Set;
      for (const target of targets) {
        if (seen.has(target)) {
          push({ severity: "warning", code: "duplicate-relation", message: `${kind} lists '${target}' more than once`, fixable: true, ...at });
          continue;
        }
        seen.add(target);
        if (target === meta.id) {
          push({ severity: "error", code: "self-relation", message: `${kind} references the stone itself`, ...at });
          continue;
        }
        const other = byId.get(target)?.[0];
        if (!other) {
          push({ severity: "error", code: "broken-relation", message: `${kind} references unknown stone '${target}'`, ...at });
          continue;
        }
        const inverse = INVERSE_RELATION[kind];
        if (inverse && !other.meta.relations[inverse].includes(meta.id)) {
          push({
            severity: "warning",
            code: "asymmetric-relation",
            message: `${kind} '${target}' but '${target}' does not declare ${inverse} '${meta.id}'`,
            fixable: true,
            ...at
          });
        }
      }
    }
    const relationCount = RELATION_KINDS.reduce((sum, kind) => sum + meta.relations[kind].length, 0);
    const referenced = stones.some((other) => other !== stone && RELATION_KINDS.some((kind) => other.meta.relations[kind].includes(meta.id)));
    if (stones.length > 1 && relationCount === 0 && !referenced) {
      push({ severity: "info", code: "isolated", message: "stone has no relations to the rest of the graph", ...at });
    }
  }
  for (const [id, group] of byId) {
    if (id && group.length > 1) {
      push({ severity: "error", code: "duplicate-id", message: `id '${id}' is declared by ${group.map((s) => s.relPath).join(", ")}` });
    }
  }
  const architecture = keyPath(root, "architecture");
  if (existsSync4(architecture)) {
    const source = readFileSync4(architecture, "utf8");
    const start = source.indexOf(INDEX_START);
    const end = source.indexOf(INDEX_END);
    if (start === -1 || end === -1 || end < start) {
      push({ severity: "warning", code: "index-markers-missing", message: `.keystone/architecture.md has no ${INDEX_START} / ${INDEX_END} block` });
    } else {
      const current = source.slice(start + INDEX_START.length, end).trim();
      if (current !== renderIndex(stones).trim()) {
        push({ severity: "warning", code: "stale-index", message: "stone index in .keystone/architecture.md is out of date", fixable: true });
      }
    }
  }
  if (stones.length === 0 && parseIssues.length === 0) {
    push({ severity: "info", code: "no-stones", message: "no stones found yet; map the main modules with 'keystone stone create'" });
  }
  return { root, stoneCount: stones.length + parseIssues.length, diagnostics };
}
function applyFixes(root) {
  const changes = [];
  const { stones } = scan(root);
  const byId = new Map;
  for (const stone of stones)
    if (stone.meta.id && !byId.has(stone.meta.id))
      byId.set(stone.meta.id, stone);
  const dirty = new Set;
  for (const stone of stones) {
    if (stone.notes.length > 0)
      continue;
    for (const kind of RELATION_KINDS) {
      const unique = [...new Set(stone.meta.relations[kind])];
      if (unique.length !== stone.meta.relations[kind].length) {
        stone.meta.relations[kind] = unique;
        dirty.add(stone);
        changes.push(`${stone.meta.id}: removed duplicate ${kind} entries`);
      }
    }
  }
  for (const stone of stones) {
    if (stone.notes.length > 0)
      continue;
    for (const kind of RELATION_KINDS) {
      const inverse = INVERSE_RELATION[kind];
      if (!inverse)
        continue;
      for (const target of stone.meta.relations[kind]) {
        const other = byId.get(target);
        if (!other || other === stone || other.notes.length > 0)
          continue;
        if (!other.meta.relations[inverse].includes(stone.meta.id)) {
          other.meta.relations[inverse].push(stone.meta.id);
          dirty.add(other);
          changes.push(`${other.meta.id}: added ${inverse} '${stone.meta.id}'`);
        }
      }
    }
  }
  for (const stone of dirty)
    writeStone(stone);
  if (updateIndex(root, scan(root).stones) === "updated")
    changes.push("regenerated stone index in .keystone/architecture.md");
  return changes;
}
var ORDER = { error: 0, warning: 1, info: 2 };
function doctor(ctx, options) {
  const fixes = options.fix ? applyFixes(ctx.root) : [];
  const ignored = new Set(csv(options.ignore));
  const report = diagnose(ctx.root);
  const diagnostics = report.diagnostics.filter((d) => !ignored.has(d.code)).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.path ?? "").localeCompare(b.path ?? ""));
  const count = (severity) => diagnostics.filter((d) => d.severity === severity).length;
  const errors = count("error");
  const warnings = count("warning");
  const failed = errors > 0 || options.strict === true && warnings > 0;
  if (options.json) {
    ctx.io.stdout(JSON.stringify({ root: report.root, stones: report.stoneCount, fixes, diagnostics, healthy: !failed }, null, 2));
    return failed ? 1 : 0;
  }
  ctx.io.stdout(`Keystone doctor: ${report.root}`);
  ctx.io.stdout(`${plural(report.stoneCount, "stone")} scanned`);
  for (const change of fixes)
    ctx.io.stdout(`fixed    ${change}`);
  for (const d of diagnostics) {
    const location = d.path ? ` (${d.path})` : "";
    const subject = d.stone ? `${d.stone}: ` : "";
    ctx.io.stdout(`${d.severity.padEnd(8)} ${d.code.padEnd(24)} ${subject}${d.message}${location}${d.fixable ? " [fixable]" : ""}`);
  }
  const fixable = diagnostics.filter((d) => d.fixable).length;
  ctx.io.stdout(`Summary: ${plural(errors, "error")}, ${plural(warnings, "warning")}, ${plural(count("info"), "info")}` + (fixable > 0 ? `; ${fixable} fixable with --fix` : ""));
  ctx.io.stdout(failed ? "Status: unhealthy" : "Status: healthy");
  return failed ? 1 : 0;
}

// .keystone/operations/commands/graph.ts
import { basename as basename2 } from "node:path";

// .keystone/operations/core/graph.ts
function buildGraph(stones) {
  const nodes = indexById(stones);
  const edges = [];
  for (const [id, stone] of nodes) {
    for (const kind of RELATION_KINDS) {
      for (const target of stone.meta.relations[kind])
        edges.push({ from: id, to: target, kind });
    }
  }
  return { nodes, edges };
}
var LABELS = {
  depends_on: "depends on",
  depended_by: "depended by",
  children: "children"
};
function describe(graph, id) {
  const stone = graph.nodes.get(id);
  if (!stone)
    return `${id} (missing)`;
  return `${id} [${stone.meta.type || "untyped"}] ${stone.relDir}`;
}
function navigationRoots(graph) {
  const childIds = new Set(graph.edges.filter((edge) => edge.kind === "children").map((edge) => edge.to));
  return [...graph.nodes.keys()].filter((id) => !childIds.has(id)).sort();
}
function reachable(graph, start, kind, depth) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let level = 0;level < depth && frontier.length > 0; level++) {
    const next = [];
    for (const id of frontier) {
      for (const target of graph.nodes.get(id)?.meta.relations[kind] ?? []) {
        if (!seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      }
    }
    frontier = next;
  }
  seen.delete(start);
  return [...seen];
}
function impactOf(graph, start, depth) {
  const dependents = new Map;
  const add = (target, source) => {
    if (!dependents.has(target))
      dependents.set(target, new Set);
    dependents.get(target)?.add(source);
  };
  for (const edge of graph.edges) {
    if (edge.kind === "depends_on")
      add(edge.to, edge.from);
    if (edge.kind === "depended_by")
      add(edge.from, edge.to);
  }
  const seen = new Set([start]);
  let frontier = [start];
  for (let level = 0;level < depth && frontier.length > 0; level++) {
    const next = [];
    for (const id of frontier) {
      for (const source of dependents.get(id) ?? []) {
        if (!seen.has(source)) {
          seen.add(source);
          next.push(source);
        }
      }
    }
    frontier = next;
  }
  seen.delete(start);
  return [...seen].sort();
}
function renderBranch(graph, id, kind, depth, prefix, path, out) {
  const targets = graph.nodes.get(id)?.meta.relations[kind] ?? [];
  targets.forEach((target, index) => {
    const last = index === targets.length - 1;
    const cycle = path.has(target);
    out.push(`${prefix}${last ? "└── " : "├── "}${describe(graph, target)}${cycle ? " (cycle)" : ""}`);
    if (!cycle && depth > 1 && graph.nodes.has(target)) {
      const nextPath = new Set(path);
      nextPath.add(target);
      renderBranch(graph, target, kind, depth - 1, `${prefix}${last ? "    " : "│   "}`, nextPath, out);
    }
  });
}
function renderFocusedAscii(graph, id, depth) {
  const stone = graph.nodes.get(id);
  const out = [describe(graph, id)];
  if (stone?.meta.summary)
    out.push(`    ${stone.meta.summary}`);
  const kinds = RELATION_KINDS.filter((kind) => (stone?.meta.relations[kind].length ?? 0) > 0);
  kinds.forEach((kind, index) => {
    const last = index === kinds.length - 1;
    out.push(`${last ? "└── " : "├── "}${LABELS[kind]}`);
    renderBranch(graph, id, kind, depth, last ? "    " : "│   ", new Set([id]), out);
  });
  if (kinds.length === 0)
    out.push("└── (no relations)");
  return out.join(`
`);
}
function renderFullAscii(graph, title) {
  const out = [`${title} (${graph.nodes.size} stone${graph.nodes.size === 1 ? "" : "s"})`];
  const visited = new Set;
  const walk = (id, prefix, last) => {
    const stone = graph.nodes.get(id);
    const repeated = visited.has(id);
    out.push(`${prefix}${last ? "└── " : "├── "}${describe(graph, id)}${repeated ? " (see above)" : ""}`);
    if (repeated || !stone)
      return;
    visited.add(id);
    const childPrefix = `${prefix}${last ? "    " : "│   "}`;
    const deps = stone.meta.relations.depends_on;
    const children = stone.meta.relations.children;
    if (deps.length > 0) {
      out.push(`${childPrefix}${children.length > 0 ? "│   " : "    "}depends on: ${deps.join(", ")}`);
    }
    children.forEach((child, index) => walk(child, childPrefix, index === children.length - 1));
  };
  const roots = navigationRoots(graph);
  const reach = new Set;
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (reach.has(id))
      continue;
    reach.add(id);
    stack.push(...graph.nodes.get(id)?.meta.relations.children ?? []);
  }
  const tops = [...roots, ...[...graph.nodes.keys()].filter((id) => !reach.has(id)).sort()];
  tops.forEach((id, index) => walk(id, "", index === tops.length - 1));
  if (graph.nodes.size === 0)
    out.push("└── (no stones found)");
  return out.join(`
`);
}
function mermaidId(id) {
  return `s_${id.replace(/-/g, "_")}`;
}
function renderMermaid(graph, ids) {
  const include = (id) => !ids || ids.has(id);
  const out = ["flowchart TD"];
  const declared = new Set;
  const addNode = (id) => {
    if (declared.has(id))
      return;
    declared.add(id);
    const stone = graph.nodes.get(id);
    const label = stone ? `${id} (${stone.meta.type || "untyped"})` : `${id} (missing)`;
    out.push(`  ${mermaidId(id)}["${label}"]`);
  };
  for (const id of [...graph.nodes.keys()].sort())
    if (include(id))
      addNode(id);
  const seen = new Set;
  for (const edge of graph.edges) {
    if (!include(edge.from) && !include(edge.to))
      continue;
    let from = edge.from;
    let to = edge.to;
    let kind = edge.kind;
    if (kind === "depended_by") {
      from = edge.to;
      to = edge.from;
      kind = "depends_on";
    }
    const key = `${from}|${to}|${kind}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    addNode(from);
    addNode(to);
    out.push(kind === "children" ? `  ${mermaidId(from)} -.->|child| ${mermaidId(to)}` : `  ${mermaidId(from)} -->|depends on| ${mermaidId(to)}`);
  }
  return out.join(`
`);
}
function graphToJson(graph, ids) {
  const include = (id) => !ids || ids.has(id);
  return {
    nodes: [...graph.nodes.values()].filter((stone) => include(stone.meta.id || stone.fileId)).map((stone) => ({
      id: stone.meta.id || stone.fileId,
      type: stone.meta.type,
      tags: stone.meta.tags,
      summary: stone.meta.summary,
      path: stone.relPath
    })),
    edges: graph.edges.filter((edge) => include(edge.from) || include(edge.to))
  };
}

// .keystone/operations/commands/graph.ts
var FORMATS = ["ascii", "mermaid", "json"];
function graph(ctx, id, options) {
  const format = options.format ?? "ascii";
  if (!FORMATS.includes(format))
    throw new KeystoneError(`invalid --format '${format}': expected ${FORMATS.join(", ")}`);
  const depth = options.depth === undefined ? 1 : Number(options.depth);
  if (!Number.isInteger(depth) || depth < 1)
    throw new KeystoneError(`invalid --depth '${options.depth}'`);
  const topology = buildGraph(scan(ctx.root).stones);
  if (id && !topology.nodes.has(id))
    throw new KeystoneError(`unknown stone '${id}'. Try 'keystone stone search ${id}'.`);
  let subset;
  if (id) {
    subset = new Set([id]);
    for (const kind of RELATION_KINDS)
      for (const other of reachable(topology, id, kind, depth))
        subset.add(other);
  }
  if (format === "json") {
    ctx.io.stdout(JSON.stringify(graphToJson(topology, subset), null, 2));
    return 0;
  }
  if (format === "mermaid") {
    ctx.io.stdout(renderMermaid(topology, subset));
    return 0;
  }
  if (id) {
    ctx.io.stdout(renderFocusedAscii(topology, id, depth));
    const impact = impactOf(topology, id, Number.POSITIVE_INFINITY);
    ctx.io.stdout(`
Transitive impact: ${impact.length > 0 ? impact.join(", ") : "(none)"}`);
    return 0;
  }
  ctx.io.stdout(renderFullAscii(topology, `Key: ${basename2(ctx.root)}`));
  return 0;
}

// .keystone/operations/commands/init.ts
import { chmodSync, copyFileSync, cpSync, existsSync as existsSync5, mkdirSync, readFileSync as readFileSync5, statSync as statSync3, writeFileSync as writeFileSync4 } from "node:fs";
import { basename as basename3, dirname as dirname4, join as join3, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
var PROJECT_FILES = [KEY_FILES.identity, KEY_FILES.architecture, KEY_FILES.standards, KEY_FILES.state, KEY_FILES.stoneTemplate];
var MANAGED_FILES = [KEY_FILES.protocol, "bin/keystone"];
var INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"];
var CLAUDE_IMPORT = `@AGENTS.md
`;
var POINTER = `## Keystone

This project uses Keystone for architectural context. Before planning or changing code, read \`.keystone/protocol.md\` and follow it.
`;
function locateSource() {
  const self = fileURLToPath(import.meta.url);
  if (basename3(dirname4(self)) === "dist") {
    return { keyDir: join3(dirname4(dirname4(self)), KEY_DIR), tooling: { kind: "bundle", file: self } };
  }
  const operations = dirname4(dirname4(self));
  return { keyDir: dirname4(operations), tooling: { kind: "sources", dir: operations } };
}
function findTargetRoot(cwd) {
  let current = resolve3(cwd);
  while (true) {
    if (existsSync5(join3(current, ".git")))
      return current;
    const parent = dirname4(current);
    if (parent === current)
      return resolve3(cwd);
    current = parent;
  }
}
function hasPointer(root, file, seen = new Set) {
  const path = join3(root, file);
  if (seen.has(file) || !existsSync5(path))
    return false;
  seen.add(file);
  const content = readFileSync5(path, "utf8");
  if (content.includes(".keystone/protocol.md"))
    return true;
  return INSTRUCTION_FILES.some((other) => other !== file && new RegExp(`(^|\\s)@(\\./)?${other.replace(/[.]/g, "\\.")}\\b`, "m").test(content) && hasPointer(root, other, seen));
}
function ensurePointer(root, file) {
  if (hasPointer(root, file))
    return false;
  const path = join3(root, file);
  const current = existsSync5(path) ? readFileSync5(path, "utf8") : "";
  const separator = current === "" ? "" : current.endsWith(`

`) ? "" : current.endsWith(`
`) ? `
` : `

`;
  mkdirSync(dirname4(path), { recursive: true });
  writeFileSync4(path, `${current}${separator}${POINTER}`);
  return true;
}
function init(cwd, io, options) {
  const root = options.root ? resolve3(cwd, options.root) : findTargetRoot(cwd);
  if (!existsSync5(root) || !statSync3(root).isDirectory())
    throw new KeystoneError(`not a directory: ${root}`);
  const source = locateSource();
  if (!existsSync5(join3(source.keyDir, KEY_FILES.protocol))) {
    throw new KeystoneError("the Key templates were not found next to this CLI. Run init from the npm package (npx @glgreg/keystone init) or from a Keystone checkout.");
  }
  const target = join3(root, KEY_DIR);
  if (resolve3(target) === resolve3(source.keyDir))
    throw new KeystoneError("this is the Keystone source repository; init targets other projects.");
  const fresh = !existsSync5(target);
  const created = [];
  const updated = [];
  for (const file of PROJECT_FILES) {
    const to = join3(target, file);
    if (existsSync5(to))
      continue;
    mkdirSync(dirname4(to), { recursive: true });
    copyFileSync(join3(source.keyDir, file), to);
    created.push(`${KEY_DIR}/${file}`);
  }
  for (const file of MANAGED_FILES) {
    const to = join3(target, file);
    (existsSync5(to) ? updated : created).push(`${KEY_DIR}/${file}`);
    mkdirSync(dirname4(to), { recursive: true });
    copyFileSync(join3(source.keyDir, file), to);
  }
  chmodSync(join3(target, "bin/keystone"), 493);
  if (source.tooling.kind === "bundle") {
    const to = join3(target, "bin/keystone.js");
    (existsSync5(to) ? updated : created).push(`${KEY_DIR}/bin/keystone.js`);
    copyFileSync(source.tooling.file, to);
  } else {
    const to = join3(target, "operations");
    (existsSync5(to) ? updated : created).push(`${KEY_DIR}/operations/`);
    cpSync(source.tooling.dir, to, { recursive: true });
  }
  const pointers = [];
  const present = INSTRUCTION_FILES.filter((file) => existsSync5(join3(root, file)));
  if (present.length === 0) {
    ensurePointer(root, "AGENTS.md");
    writeFileSync4(join3(root, "CLAUDE.md"), CLAUDE_IMPORT);
    pointers.push("AGENTS.md", "CLAUDE.md (imports AGENTS.md)");
  } else {
    pointers.push(...present.filter((file) => ensurePointer(root, file)));
  }
  io.stdout(`${fresh ? "Installed" : "Updated"} Keystone in ${root}`);
  for (const path of created)
    io.stdout(`  created  ${path}`);
  for (const path of updated)
    io.stdout(`  updated  ${path}`);
  for (const file of pointers)
    io.stdout(`  pointer  ${file}`);
  io.stdout("");
  io.stdout(fresh ? 'Next: activate it. Agents: follow section 6 (Activation) of .keystone/protocol.md now. People: ask your agent to "Activate the Keystone protocol".' : "Your project files (identity, architecture, standards, state, stones) were left untouched.");
  return 0;
}

// .keystone/operations/commands/relate.ts
function toggle(stone, kind, target, remove) {
  const list = stone.meta.relations[kind];
  const present = list.includes(target);
  if (remove && present) {
    stone.meta.relations[kind] = list.filter((item) => item !== target);
    return true;
  }
  if (!remove && !present) {
    list.push(target);
    return true;
  }
  return false;
}
function relate(ctx, source, target, options) {
  if (!source || !target) {
    throw new KeystoneError("usage: keystone stone relate <source> <target> [--type depends_on|depended_by|children] [--remove]");
  }
  const kind = options.type ?? "depends_on";
  if (!RELATION_KINDS.includes(kind)) {
    throw new KeystoneError(`invalid relation type '${options.type}': expected one of ${RELATION_KINDS.join(", ")}`);
  }
  if (source === target)
    throw new KeystoneError("a stone cannot relate to itself");
  const byId = indexById(scan(ctx.root).stones);
  const from = byId.get(source);
  const to = byId.get(target);
  if (!from)
    throw new KeystoneError(`unknown stone '${source}'`);
  if (!to)
    throw new KeystoneError(`unknown stone '${target}'`);
  for (const stone of [from, to]) {
    if (stone.notes.length > 0)
      throw new KeystoneError(`cannot rewrite ${stone.relPath}: ${stone.notes.join("; ")}`);
  }
  const remove = options.remove === true;
  const inverse = INVERSE_RELATION[kind];
  const changedFrom = toggle(from, kind, target, remove);
  const changedTo = inverse ? toggle(to, inverse, source, remove) : false;
  if (changedFrom)
    writeStone(from);
  if (changedTo)
    writeStone(to);
  const verb = remove ? "Removed" : "Linked";
  const label = kind.replace("_", " ");
  if (!changedFrom && !changedTo) {
    ctx.io.stdout(`No change: '${source}' ${remove ? "does not have" : "already has"} ${label} '${target}'.`);
    return 0;
  }
  ctx.io.stdout(`${verb}: ${source} ${label} ${target}`);
  if (inverse && changedTo)
    ctx.io.stdout(`${verb} inverse: ${target} ${inverse.replace("_", " ")} ${source}`);
  return 0;
}

// .keystone/operations/commands/search.ts
function tokenize(query) {
  return query.toLowerCase().split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
}
function scoreStone(stone, tokens) {
  const id = (stone.meta.id || stone.fileId).toLowerCase();
  const tags = stone.meta.tags.map((tag) => tag.toLowerCase());
  const summary = stone.meta.summary.toLowerCase();
  const heads = headings(stone.body).map((heading) => heading.toLowerCase());
  const path = stone.relPath.toLowerCase();
  const body = stone.body.toLowerCase();
  let total = 0;
  for (const token of tokens) {
    let score = 0;
    if (id === token)
      score += 10;
    else if (id.includes(token))
      score += 6;
    if (tags.includes(token))
      score += 5;
    else if (tags.some((tag) => tag.includes(token)))
      score += 3;
    if (summary.includes(token))
      score += 2;
    if (path.includes(token))
      score += 1.5;
    if (heads.some((heading) => heading.includes(token)))
      score += 1;
    if (body.includes(token))
      score += 0.5;
    if (score === 0)
      return 0;
    total += score;
  }
  return total;
}
function searchStones(stones, query, options) {
  const tokens = tokenize(query);
  const tag = options.tag?.toLowerCase();
  const filtered = stones.filter((stone) => (!tag || stone.meta.tags.some((item) => item.toLowerCase() === tag)) && (!options.type || stone.meta.type === options.type));
  const hits = tokens.length === 0 ? filtered.map((stone) => ({ stone, score: 0 })) : filtered.map((stone) => ({ stone, score: scoreStone(stone, tokens) })).filter((hit) => hit.score > 0);
  return hits.sort((a, b) => b.score - a.score || a.stone.relPath.localeCompare(b.stone.relPath));
}
function search(ctx, query, options) {
  const limit = options.limit === undefined ? Number.POSITIVE_INFINITY : Number(options.limit);
  if (Number.isNaN(limit) || limit < 1)
    throw new KeystoneError(`invalid --limit '${options.limit}'`);
  const { stones, parseIssues } = scan(ctx.root);
  const hits = searchStones(stones, query, options).slice(0, limit);
  if (options.json) {
    ctx.io.stdout(JSON.stringify(hits.map(({ stone, score }) => ({
      id: stone.meta.id || stone.fileId,
      type: stone.meta.type,
      path: stone.relPath,
      tags: stone.meta.tags,
      summary: stone.meta.summary,
      score
    })), null, 2));
    return hits.length > 0 ? 0 : 1;
  }
  if (hits.length === 0) {
    ctx.io.stdout(query ? `No stones match '${query}'.` : "No stones found. Create one with 'keystone stone create <id> --path <dir>'.");
  }
  for (const { stone } of hits) {
    ctx.io.stdout(`${stone.meta.id || stone.fileId} [${stone.meta.type || "untyped"}] ${stone.relPath}`);
    if (stone.meta.summary)
      ctx.io.stdout(`    ${stone.meta.summary}`);
    if (stone.meta.tags.length > 0)
      ctx.io.stdout(`    tags: ${stone.meta.tags.join(", ")}`);
  }
  if (parseIssues.length > 0) {
    ctx.io.stderr(`warning: ${parseIssues.length} stone file(s) could not be parsed; run 'keystone stone doctor'`);
  }
  return hits.length > 0 ? 0 : 1;
}

// .keystone/operations/commands/show.ts
import { readFileSync as readFileSync6 } from "node:fs";
function show(ctx, id, options) {
  if (!id)
    throw new KeystoneError("usage: keystone stone show <id>");
  const graph2 = buildGraph(scan(ctx.root).stones);
  const stone = graph2.nodes.get(id);
  if (!stone)
    throw new KeystoneError(`unknown stone '${id}'. Try 'keystone stone search ${id}'.`);
  const related = RELATION_KINDS.flatMap((kind) => stone.meta.relations[kind].map((target) => {
    const other = graph2.nodes.get(target);
    return { kind, id: target, path: other?.relPath ?? null, summary: other?.meta.summary ?? null };
  }));
  const impact = impactOf(graph2, id, Number.POSITIVE_INFINITY);
  if (options.json) {
    ctx.io.stdout(JSON.stringify({ id, path: stone.relPath, meta: stone.meta, body: stone.body, related, impact }, null, 2));
    return 0;
  }
  ctx.io.stdout(`# ${stone.relPath}`);
  ctx.io.stdout(readFileSync6(stone.path, "utf8").trimEnd());
  ctx.io.stdout("");
  ctx.io.stdout("# Related stones");
  if (related.length === 0)
    ctx.io.stdout("(none)");
  for (const item of related) {
    const location = item.path ?? "missing";
    ctx.io.stdout(`- ${item.kind.replace("_", " ")}: ${item.id} (${location})${item.summary ? ` - ${item.summary}` : ""}`);
  }
  ctx.io.stdout("");
  ctx.io.stdout(`# Transitive impact (stones that depend on '${id}')`);
  ctx.io.stdout(impact.length > 0 ? impact.join(", ") : "(none)");
  return 0;
}

// .keystone/operations/cli.ts
var VERSION = "1.0.1";
var GLOBAL_OPTIONS = {
  root: { type: "string" },
  help: { type: "boolean", short: "h" }
};
var COMMAND_OPTIONS = {
  init: {},
  create: {
    path: { type: "string", short: "p" },
    type: { type: "string", short: "t" },
    tags: { type: "string" },
    summary: { type: "string", short: "s" },
    owner: { type: "string" },
    "depends-on": { type: "string" }
  },
  search: {
    tag: { type: "string" },
    type: { type: "string", short: "t" },
    limit: { type: "string", short: "n" },
    json: { type: "boolean" }
  },
  show: { json: { type: "boolean" } },
  relate: {
    type: { type: "string", short: "t" },
    remove: { type: "boolean" }
  },
  graph: {
    format: { type: "string", short: "f" },
    depth: { type: "string", short: "d" }
  },
  doctor: {
    fix: { type: "boolean" },
    strict: { type: "boolean" },
    json: { type: "boolean" },
    ignore: { type: "string" }
  }
};
var HELP = `Keystone ${VERSION} - context architecture for AI software engineering

Usage:
  keystone init
  keystone stone <command> [options]

Commands:
  init                       Install or update the Key in this project (.keystone/)
  create <id> --path <dir>   Scaffold a co-located stone (.stone.<id>.md)
      [--type module|service|entity|policy|integration] [--tags a,b]
      [--summary <text>] [--owner <team>] [--depends-on a,b]
  search [query]             Find stones by id, tags, summary, headings and body
      [--tag <tag>] [--type <type>] [--limit <n>] [--json]
  show <id>                  Print a stone plus related stones and impact set [--json]
  relate <source> <target>   Link stones and keep the inverse relation in sync
      [--type depends_on|depended_by|children] [--remove]
  graph [id]                 Render the topology [--format ascii|mermaid|json] [--depth <n>]
  doctor                     Audit the Key and the stone graph [--fix] [--strict] [--json]
      [--ignore code1,code2]

Global options:
  --root <dir>               Project root (default: nearest directory holding .keystone/)
  -h, --help                 Show help
  --version                  Show version

Run 'keystone stone <command> --help' for details and examples.
Exit codes: 0 success, 1 failure (no search results, doctor errors, invalid input).`;
var COMMAND_HELP = {
  init: `Usage: keystone init [--root <dir>]

Installs the Key in the project (the enclosing Git repository, or --root):
.keystone/ with the protocol, Key templates and the CLI, plus a pointer to
.keystone/protocol.md in the agent instruction files the project already has
(AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md), or in a
new AGENTS.md when there are none.

Safe to run again: project files (identity, architecture, standards, state,
stone template) are never overwritten, while the protocol and the CLI are
refreshed, so re-running init from a newer version upgrades them.

After a fresh install, follow section 6 (Activation) of .keystone/protocol.md.

Example:
  npx @glgreg/keystone init`,
  create: `Usage: keystone stone create <id> --path <dir> [options]

Writes <dir>/.stone.<id>.md: a generated frontmatter plus the body template
(.keystone/templates/stone.md) with Purpose, Invariants, Integration Contracts
and Anti-Patterns sections. Then regenerates the stone index in
.keystone/architecture.md. Afterwards, edit the body (and 'summary' if empty)
directly in the file; frontmatter edits by hand are fine too.

Options:
  -p, --path <dir>        Directory of the code this stone describes (required, must exist)
  -t, --type <type>       module (default) | service | entity | policy | integration
      --tags a,b          Search keywords
  -s, --summary <text>    One sentence shown in the index, search results and neighbor lists
      --owner <team>      Optional owner
      --depends-on a,b    Existing stones this one depends on (inverse 'depended_by' is written too)

Rules: <id> is lowercase kebab-case and unique; stones cannot live in hidden directories.

Example:
  keystone stone create password-reset --path src/auth/password-reset \\
    --tags auth,password,token --summary "Single-use reset tokens valid for 30 minutes." \\
    --depends-on users`,
  search: `Usage: keystone stone search [terms...] [options]

Ranked lexical search. Every term must match somewhere; matches weigh
id > tags > summary > path > headings > body. With no terms, lists all stones.

Options:
  --tag <tag>         Only stones with this exact tag
  -t, --type <type>   Only stones of this type
  -n, --limit <n>     Maximum results
  --json              Machine-readable output

Exit code 1 when nothing matches.

Example:
  keystone stone search refresh token`,
  show: `Usage: keystone stone show <id> [--json]

Prints the full stone file, then one line per related stone (relation, path,
summary), then the transitive impact set: every stone that directly or
indirectly depends on <id> and may be affected by changing it.

Example:
  keystone stone show auth`,
  relate: `Usage: keystone stone relate <source> <target> [--type <relation>] [--remove]

Adds (or with --remove, deletes) <target> in <source>'s relation list and keeps
the inverse in sync. Idempotent. Only the frontmatter is rewritten; bodies are
never touched.

Relations:
  depends_on (default)  <source> uses <target>; writes <target>.depended_by += <source>
  depended_by           <target> uses <source>; writes <target>.depends_on += <source>
  children              <target> is a sub-part of <source> in the navigation tree (no inverse stored)

Examples:
  keystone stone relate billing users                   # billing depends on users
  keystone stone relate auth password-reset --type children`,
  graph: `Usage: keystone stone graph [id] [--format ascii|mermaid|json] [--depth <n>]

Without <id>: the full navigation tree (children nested under parents, with
each stone's dependencies). With <id>: that stone's relations followed <n>
levels deep (default 1), plus its transitive impact set.

Example:
  keystone stone graph users --depth 2`,
  doctor: `Usage: keystone stone doctor [--fix] [--strict] [--json] [--ignore code1,code2]

Audits the Key (required files, unfilled templates, pending activation) and
every stone (parse errors, schema, id/filename match, broken, duplicate or
asymmetric relations, duplicate ids, co-located code, stale index).

Options:
  --fix          Repair mechanical issues only: duplicate relation entries, missing
                 inverse relations, stale index. Never edits stone bodies.
  --strict       Exit 1 on warnings as well as errors
  --json         Machine-readable report
  --ignore a,b   Hide diagnostics with these codes

Exit code 1 when errors are found. Run before reporting a task as done.`
};
function parse(command, argv) {
  try {
    return parseArgs({
      args: argv,
      options: { ...GLOBAL_OPTIONS, ...COMMAND_OPTIONS[command] ?? {} },
      allowPositionals: true,
      strict: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new KeystoneError(`${message}
Run 'keystone stone ${command} --help' for usage.`);
  }
}
function run(argv, env) {
  const args = argv[0] === "stone" ? argv.slice(1) : argv;
  const command = args[0];
  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      const topic = command === "help" ? args[1] : undefined;
      env.io.stdout(topic && COMMAND_HELP[topic] ? COMMAND_HELP[topic] : HELP);
      return 0;
    }
    if (command === "--version" || command === "version") {
      env.io.stdout(VERSION);
      return 0;
    }
    if (!(command in COMMAND_OPTIONS)) {
      throw new KeystoneError(`unknown command '${command}'. Run 'keystone stone --help' for usage.`);
    }
    if (args.includes("--help") || args.includes("-h")) {
      env.io.stdout(COMMAND_HELP[command]);
      return 0;
    }
    const { values, positionals } = parse(command, args.slice(1));
    if (command === "init")
      return init(env.cwd, env.io, { root: values.root });
    const ctx = {
      cwd: env.cwd,
      root: resolveRoot(values.root, env.cwd),
      io: env.io
    };
    const v = values;
    switch (command) {
      case "create":
        return create(ctx, positionals[0], v);
      case "search":
        return search(ctx, positionals.join(" "), v);
      case "show":
        return show(ctx, positionals[0], v);
      case "relate":
        return relate(ctx, positionals[0], positionals[1], v);
      case "graph":
        return graph(ctx, positionals[0], v);
      case "doctor":
        return doctor(ctx, v);
    }
    return 1;
  } catch (error) {
    if (error instanceof KeystoneError) {
      env.io.stderr(`keystone: ${error.message}`);
      return error.exitCode;
    }
    throw error;
  }
}

// .keystone/operations/stone.ts
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE")
    process.exit(0);
  throw error;
});
process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  io: {
    stdout: (text) => process.stdout.write(`${text}
`),
    stderr: (text) => process.stderr.write(`${text}
`)
  }
});
