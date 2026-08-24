import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { homePath, readConfig, type ConfigResult } from "./configs";

// ---------------------------------------------------------------------------
// Pure parsers (unit-tested without filesystem access)
// ---------------------------------------------------------------------------

/** [tools] table of a mise config.toml → ordered [name, version] pairs. */
export function parseMiseTools(content: string): Array<[string, string]> {
  const tools: Array<[string, string]> = [];
  let inTools = false;
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t.startsWith("[") && t.endsWith("]")) {
      inTools = t === "[tools]";
      continue;
    }
    if (!inTools || !t || t.startsWith("#")) continue;
    const m = t.match(/^(?:"([^"]+)"|'([^']+)'|([^\s=]+))\s*=\s*(.+)$/);
    if (!m) continue;
    const name = m[1] ?? m[2] ?? m[3];
    const version = m[4].trim().replace(/^["']|["']$/g, "");
    tools.push([name, version]);
  }
  return tools;
}

export interface GhosttyTheme {
  background: string | null;
  foreground: string | null;
  /** ANSI palette "0".."15" → hex color. */
  palette: Record<string, string>;
}

/** omarchy-style ghostty theme file (background/foreground/palette lines). */
export function parseGhosttyTheme(content: string): GhosttyTheme {
  const theme: GhosttyTheme = { background: null, foreground: null, palette: {} };
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let m = t.match(/^background\s*=\s*(\S+)/);
    if (m) theme.background = m[1];
    m = t.match(/^foreground\s*=\s*(\S+)/);
    if (m) theme.foreground = m[1];
    m = t.match(/^palette\s*=\s*(\d+)\s*=\s*(\S+)/);
    if (m) theme.palette[m[1]] = m[2];
  }
  return theme;
}

export interface GhosttyMain {
  fontFamily: string | null;
  fontSize: number | null;
  keybinds: string[];
  /** Raw config-file reference (e.g. the omarchy dynamic theme path). */
  themeRef: string | null;
}

/** ghostty main config — font info, keybinds, and the dynamic theme reference. */
export function parseGhosttyConfig(content: string): GhosttyMain {
  const main: GhosttyMain = { fontFamily: null, fontSize: null, keybinds: [], themeRef: null };
  for (const line of content.split("\n")) {
    const t = line.trim();
    let m = t.match(/^font-family\s*=\s*"?([^"\n]+)"?/);
    if (m) main.fontFamily = m[1].trim();
    m = t.match(/^font-size\s*=\s*([\d.]+)/);
    if (m) main.fontSize = Number(m[1]);
    m = t.match(/^keybind\s*=\s*(.+)$/);
    if (m) main.keybinds.push(m[1].trim());
    m = t.match(/^config-file\s*=\s*\?"([^"]+)"/);
    if (m) main.themeRef = m[1];
  }
  return main;
}

/** Expand a leading "~/" reference to an absolute path. */
export function resolveHomeRef(ref: string): string {
  return ref.startsWith("~/") ? join(homedir(), ref.slice(2)) : ref;
}

export interface HyprMonitor {
  output: string;
  mode: string;
  position: string;
  scale: number;
}

export interface HyprLayout {
  gdkScale: number | null;
  monitors: HyprMonitor[];
}

/** omarchy lua monitor layout: hl.monitor({ output=…, mode=…, position=…, scale=… }). */
export function parseHyprMonitors(content: string): HyprLayout {
  const gdkMatch = content.match(/omarchy_gdk_scale\s*=\s*([\d.]+)/);
  const monitors: HyprMonitor[] = [];
  const re =
    /hl\.monitor\(\{\s*output\s*=\s*"([^"]+)"\s*,\s*mode\s*=\s*"([^"]+)"\s*,\s*position\s*=\s*"([^"]+)"\s*,\s*scale\s*=\s*([\d.]+)\s*,?\s*\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    monitors.push({ output: m[1], mode: m[2], position: m[3], scale: Number(m[4]) });
  }
  return { gdkScale: gdkMatch ? Number(gdkMatch[1]) : null, monitors };
}

export interface BrewList {
  formulae: string[];
  casks: string[];
}

/** Homebrew Bundle file → formulae and casks (comments ignored). */
export function parseBrewfile(content: string): BrewList {
  const formulae: string[] = [];
  const casks: string[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    let m = t.match(/^brew\s+"([^"]+)"/);
    if (m) formulae.push(m[1]);
    m = t.match(/^cask\s+"([^"]+)"/);
    if (m) casks.push(m[1]);
  }
  return { formulae, casks };
}

/** Generic list file (pacman -Qe dump, ripgrep rc): skip blanks/comments. */
export function parseListFile(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

export function parseLazyvimExtras(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as { extras?: string[] };
    return parsed.extras ?? [];
  } catch {
    return [];
  }
}

/** lazy-lock.json → [plugin, short-commit] pairs. */
export function parseLazyLock(json: string): Array<[string, string]> {
  try {
    const parsed = JSON.parse(json) as Record<string, { commit?: string }>;
    return Object.entries(parsed).map(([name, v]) => [
      name,
      (v.commit ?? "").slice(0, 7),
    ]);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Card builders (live reads with bundled fallbacks)
// ---------------------------------------------------------------------------

function ghosttyCard() {
  const main = readConfig(homePath(".config", "ghostty", "config"), "ghostty-config");
  const parsedMain = parseGhosttyConfig(main.content);
  const themePath = parsedMain.themeRef ? resolveHomeRef(parsedMain.themeRef) : null;
  const theme: ConfigResult = themePath
    ? readConfig(themePath, "ghostty-theme.conf")
    : readConfig([], "ghostty-theme.conf");
  return {
    mainSource: main.source,
    themeSource: theme.source,
    ...parsedMain,
    theme: parseGhosttyTheme(theme.content),
  };
}

function miseCard() {
  const cfg = readConfig(homePath(".config", "mise", "config.toml"), "mise.toml");
  return { source: cfg.source, tools: parseMiseTools(cfg.content) };
}

function packagesCard() {
  const brew = readConfig(homePath(".Brewfile"), "Brewfile");
  let pacmanSource: "live" | "fallback" = "fallback";
  let pacman: string[] = [];
  try {
    const out = execSync("pacman -Qe", { encoding: "utf8" });
    pacmanSource = "live";
    pacman = out.split("\n").map((l) => l.split(" ")[0]).filter(Boolean);
  } catch {
    pacman = parseListFile(readConfig([], "pacman.txt").content);
  }
  return { brewSource: brew.source, ...parseBrewfile(brew.content), pacmanSource, pacman };
}

function hyprlandCard() {
  const cfg = readConfig(homePath(".config", "hypr", "monitors.lua"), "hypr-monitors.lua");
  return { source: cfg.source, ...parseHyprMonitors(cfg.content) };
}

function neovimCard() {
  const extrasCfg = readConfig(
    homePath(".config", "nvim", "lazyvim.json"),
    "lazyvim.json",
  );
  const lockCfg = readConfig(homePath(".config", "nvim", "lazy-lock.json"), "lazy-lock.json");
  return {
    extrasSource: extrasCfg.source,
    lockSource: lockCfg.source,
    extras: parseLazyvimExtras(extrasCfg.content),
    plugins: parseLazyLock(lockCfg.content),
  };
}

function ripgrepCard() {
  const cfg = readConfig(homePath(".config", "ripgrep", "rc"), "ripgrep-rc");
  return { source: cfg.source, flags: parseListFile(cfg.content) };
}

function lazygitCard() {
  const cfg = readConfig(homePath(".config", "lazygit", "config.yml"), "lazygit.yml");
  return { source: cfg.source, content: cfg.content };
}

const CARDS: Record<string, () => unknown> = {
  ghostty: ghosttyCard,
  mise: miseCard,
  packages: packagesCard,
  hyprland: hyprlandCard,
  neovim: neovimCard,
  ripgrep: ripgrepCard,
  lazygit: lazygitCard,
};

export type CardKey = keyof typeof CARDS;

export function cardKeys(): string[] {
  return Object.keys(CARDS);
}

export function buildCard(key: string): unknown | undefined {
  const fn = CARDS[key];
  return fn ? fn() : undefined;
}
