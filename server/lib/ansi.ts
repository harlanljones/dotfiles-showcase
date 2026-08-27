import Convert from "ansi-to-html";

// ANSI -> HTML for the live terminal preview. We wrap the vetted `ansi-to-html`
// library and escape XML so untrusted-looking output can never inject markup.

const defaultConverter = new Convert({ newline: true, escapeXML: true });
const themedConverters = new Map<string, Convert>();

// In a real terminal these sequences are invisible: readline prompt-width
// markers (\[ \]) emitted for bash targets, %{ %} emitted for zsh, and any
// OSC escapes. Strip them so the preview shows exactly what the eye sees.
function stripInvisible(ansi: string): string {
  return ansi
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/%\{/g, "")
    .replace(/%\}/g, "");
}

const SGR_RUN = /\x1b\[([0-9;]*)m/g;
// Well-formed 24-bit foreground/background SGR codes.
const TRUECOLOR_FG = /^38;2;(\d{1,3});(\d{1,3});(\d{1,3})$/;
const TRUECOLOR_BG = /^48;2;(\d{1,3});(\d{1,3});(\d{1,3})$/;

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.min(255, v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * ansi-to-html cannot parse 24-bit SGRs (`38;2;r;g;b` misparses the tail as a
 * bright-color code). Rewrite every truecolor code into the library's 256-color
 * form (`38;5;n` / `48;5;n`) with a synthetic palette entry, splitting it into
 * a standalone escape because the library only honors extended colors there.
 * Well-formed codes only; anything else passes through unchanged.
 */
function rewriteTruecolor(ansi: string, colors: Record<number, string>): string {
  let nextIndex = 16;
  const indexFor = new Map<string, number>();
  return ansi.replace(SGR_RUN, (raw, params: string) => {
    if (!/;?(38;2|48;2);/.test(`;${params};`)) return raw;
    const parts: string[] = [];
    const attrs: string[] = [];
    let changed = false;
    for (let i = 0; i < params.length; ) {
      const m = params.slice(i).match(/^(38|48);(?:2;(\d{1,3});(\d{1,3});(\d{1,3})|5;(\d{1,3}))(?=[;$]|$)/);
      if (m) {
        if (attrs.length) {
          parts.push(`\x1b[${attrs.join(";")}m`);
          attrs.length = 0;
        }
        let key: string;
        let code: string;
        if (m[2] !== undefined) {
          code = m[1];
          const [r, g, b] = [Number(m[2]), Number(m[3]), Number(m[4])];
          key = `${code};${r};${g};${b}`;
          if (!indexFor.has(key)) {
            indexFor.set(key, nextIndex);
            colors[nextIndex++] = toHex(r, g, b);
          }
        } else {
          // 256-color code: indices 0-15 already resolve via the palette;
          // higher indices have no defined color either way. Split only.
          code = m[1];
          key = `${code};5;${m[5]}`;
          indexFor.set(key, Number(m[5]));
        }
        parts.push(`\x1b[${code};5;${indexFor.get(key)}m`);
        changed = true;
        i += m[0].length;
        if (params[i] === ";") i++;
        continue;
      }
      const nextSemi = params.indexOf(";", i);
      attrs.push(params.slice(i, nextSemi === -1 ? params.length : nextSemi));
      i = nextSemi === -1 ? params.length : nextSemi + 1;
    }
    if (!changed) return raw;
    if (attrs.length) parts.push(`\x1b[${attrs.join(";")}m`);
    return parts.join("");
  });
}

/**
 * Convert ANSI to HTML. Pass a terminal palette (16 hex strings) to map SGR
 * 30-37/90-97 to the same colors the user's terminal shows (30-37 -> index
 * 0-7, 90-97 -> index 8-15, per ansi-to-html's mapping). 24-bit truecolor
 * sequences are rendered as their exact RGB.
 */
export function ansiToHtml(ansi: string, opts?: { palette?: readonly string[] }): string {
  const stripped = stripInvisible(ansi);
  const hasTruecolor = /(?:38|48);2;\d{1,3};\d{1,3};\d{1,3}/.test(stripped);
  if (!opts?.palette && !hasTruecolor) return defaultConverter.toHtml(stripped);
  const base: Record<number, string> = {};
  opts?.palette?.forEach((hex, i) => {
    if (i < 16) base[i] = hex;
  });
  if (!hasTruecolor) {
    const key = JSON.stringify(base);
    let converter = themedConverters.get(key);
    if (!converter) {
      converter = new Convert({ newline: true, escapeXML: true, colors: base });
      themedConverters.set(key, converter);
    }
    return converter.toHtml(stripped);
  }
  const colors = { ...base };
  const rewritten = rewriteTruecolor(stripped, colors);
  const converter = new Convert({ newline: true, escapeXML: true, colors });
  return converter.toHtml(rewritten);
}
