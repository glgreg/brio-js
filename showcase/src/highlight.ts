// Minimal JavaScript highlighter for static snippets on the landing page (the playground uses Monaco).
const KEYWORDS = new Set([
    "import",
    "from",
    "export",
    "const",
    "let",
    "var",
    "function",
    "return",
    "new",
    "if",
    "else",
    "for",
    "of",
    "while",
    "true",
    "false",
    "null",
    "undefined",
    "await",
    "async",
    "class",
    "extends",
]);

const TOKEN =
    /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([^\w\s])/g;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function highlightJS(source: string): string {
    let out = "";
    let last = 0;
    for (const match of source.matchAll(TOKEN)) {
        const index = match.index ?? 0;
        out += escape(source.slice(last, index));
        last = index + match[0].length;
        const [text, comment, str, num, ident, punct] = match;
        if (comment) out += `<span class="tk-c">${escape(text)}</span>`;
        else if (str) out += `<span class="tk-s">${escape(text)}</span>`;
        else if (num) out += `<span class="tk-n">${text}</span>`;
        else if (ident) {
            if (KEYWORDS.has(ident)) out += `<span class="tk-k">${ident}</span>`;
            else if (/^Brio/.test(ident)) out += `<span class="tk-t">${ident}</span>`;
            else if (source[last] === "(") out += `<span class="tk-f">${ident}</span>`;
            else out += ident;
        } else if (punct) out += `<span class="tk-p">${escape(text)}</span>`;
    }
    return out + escape(source.slice(last));
}
