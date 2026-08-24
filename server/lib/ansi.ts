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

/**
 * Convert ANSI to HTML. Pass a terminal palette (16 hex strings) to map SGR
 * 30-37/90-97 to the same colors the user's terminal shows (30-37 -> index
 * 0-7, 90-97 -> index 8-15, per ansi-to-html's mapping).
 */
export function ansiToHtml(ansi: string, opts?: { palette?: readonly string[] }): string {
  if (!opts?.palette) return defaultConverter.toHtml(stripInvisible(ansi));
  const key = opts.palette.join(",");
  let converter = themedConverters.get(key);
  if (!converter) {
    const colors: Record<number, string> = {};
    opts.palette.forEach((hex, i) => {
      if (i < 16) colors[i] = hex;
    });
    converter = new Convert({ newline: true, escapeXML: true, colors });
    themedConverters.set(key, converter);
  }
  return converter.toHtml(stripInvisible(ansi));
}
