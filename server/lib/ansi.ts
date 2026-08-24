import Convert from "ansi-to-html";

// ANSI -> HTML for the live terminal preview. We wrap the vetted `ansi-to-html`
// library and escape XML so untrusted-looking output can never inject markup.
const converter = new Convert({ newline: true, escapeXML: true });

export function ansiToHtml(ansi: string): string {
  return converter.toHtml(ansi);
}
