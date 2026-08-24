import { homePath, readConfig } from "./configs";

export interface GhosttyTheme {
  /** Terminal background hex, e.g. "#060912". */
  background: string;
  /** Terminal foreground hex. */
  foreground: string;
  /** The 16 ANSI palette colors (indexes 0-15) as hex strings. */
  palette: string[];
  /** Where the theme came from: live host config or bundled snapshot. */
  source: "live" | "fallback";
}

const LIVE_THEME_PATHS = [
  // omarchy's dynamic theme target (referenced by ~/.config/ghostty/config)
  homePath(".local", "state", "omarchy", "current", "theme", "ghostty.conf"),
];

/**
 * Parse a ghostty theme file's color directives into a palette.
 * Tolerates comments, blank lines, and `key = value` spacing.
 */
export function parseGhosttyTheme(content: string): Omit<GhosttyTheme, "source"> {
  const background = matchHex(content, /^background\s*=\s*(\S+)/m);
  const foreground = matchHex(content, /^foreground\s*=\s*(\S+)/m);
  const palette = new Array<string>(16).fill("#000000");
  for (const m of content.matchAll(/^\s*palette\s*=\s*(\d{1,2})\s*=\s*(\S+)/gm)) {
    const idx = Number(m[1]);
    if (idx >= 0 && idx < 16 && /^#?[0-9a-fA-F]{6}$/.test(m[2])) {
      palette[idx] = normalizeHex(m[2]);
    }
  }
  return {
    background: background ?? "#000000",
    foreground: foreground ?? "#e6e6e6",
    palette,
  };
}

/**
 * Load the user's real ghostty theme (live omarchy state file), falling back
 * to the bundled sanitized snapshot. Never throws in the steady state.
 */
export function loadGhosttyTheme(): GhosttyTheme {
  const { source, content } = readConfig(LIVE_THEME_PATHS, "ghostty-theme.conf");
  return { ...parseGhosttyTheme(content), source };
}

function matchHex(content: string, re: RegExp): string | null {
  const m = content.match(re);
  if (!m || !/^#?[0-9a-fA-F]{3,8}$/.test(m[1])) return null;
  return normalizeHex(m[1]);
}

function normalizeHex(hex: string): string {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return `#${h.toLowerCase()}`;
}
