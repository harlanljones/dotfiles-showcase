// Ambient types for ansi-to-html (ships without TypeScript definitions).
declare module "ansi-to-html" {
  interface ConvertOptions {
    newline?: boolean;
    escapeXML?: boolean;
    fg?: string;
    bg?: string;
    colors?: Record<number, string>;
    [key: string]: unknown;
  }
  export default class Convert {
    constructor(options?: ConvertOptions);
    toHtml(input: string): string;
  }
}
