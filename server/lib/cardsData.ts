import { execSync } from "node:child_process";
import { join } from "node:path";
import { readConfig, userHome, type ConfigResult } from "./configs";
import { getManifestEntry, type CardId, type ConfigSource, type FallbackFile } from "../../src/manifest";
import { isWorkerd } from "./runtime";
import { parseDotsScript } from "./dots";
import type { DotsCardPayload } from "../../src/lib/dotsCli";

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
  return ref.startsWith("~/") ? join(userHome(), ref.slice(2)) : ref;
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

/** omarchy lua monitor layout: hl.monitor({ output=…, mode=…, position=…, scale=… }).
 * Tolerant label scan: fields are extracted by name regardless of order, extra
 * unknown keys are ignored, and scale may be quoted — so reordered / augmented
 * blocks are still captured instead of silently dropped. */
export function parseHyprMonitors(content: string): HyprLayout {
  const gdkMatch = content.match(/omarchy_gdk_scale\s*=\s*([\d.]+)/);
  const monitors: HyprMonitor[] = [];
  const blockRe = /hl\.monitor\(\{([\s\S]*?)\}\)/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(content))) {
    const body = block[1];
    const output = body.match(/output\s*=\s*"([^"]*)"/)?.[1];
    if (!output) continue;
    const mode = body.match(/mode\s*=\s*"([^"]*)"/)?.[1] ?? "";
    const position = body.match(/position\s*=\s*"([^"]*)"/)?.[1] ?? "";
    const scaleRaw = body.match(/scale\s*=\s*(?:"([^"]*)"|'([^']*)'|([\d.]+))/);
    const scale = scaleRaw ? Number(scaleRaw[1] ?? scaleRaw[2] ?? scaleRaw[3]) : 1;
    if (Number.isNaN(scale)) continue;
    monitors.push({ output, mode, position, scale });
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
//
// Provenance comes from the manifest (D4): every builder resolves its
// {livePath, fallbackFile} pair via manifestSource() so the registry in
// src/manifest.ts is the single place where card data sources are declared.
// ---------------------------------------------------------------------------

/** Look up a card's manifest source by its bundled fallback file. */
function manifestSource(cardId: CardId, fallbackFile: FallbackFile): ConfigSource {
  const entry = getManifestEntry(cardId);
  const source = entry?.sources?.find((s) => s.fallbackFile === fallbackFile);
  if (!source) {
    throw new Error(`manifest entry "${cardId}" declares no source for ${fallbackFile}`);
  }
  return source;
}

/** Expand a manifest livePath into an absolute host path. */
function resolveLivePath(livePath: string): string {
  return livePath.startsWith("~/") ? join(userHome(), livePath.slice(2)) : livePath;
}

function ghosttyCard() {
  const mainSrc = manifestSource("ghostty", "ghostty-config");
  const themeSrc = manifestSource("ghostty", "ghostty-theme.conf");
  const main = readConfig(resolveLivePath(mainSrc.livePath), mainSrc.fallbackFile);
  const parsedMain = parseGhosttyConfig(main.content);
  const themePath = parsedMain.themeRef ? resolveHomeRef(parsedMain.themeRef) : null;
  // Prefer the theme path referenced by the live config; fall back to the
  // documented generated-state path from the manifest; then the bundled copy.
  const theme: ConfigResult = readConfig(
    [themePath, resolveLivePath(themeSrc.livePath)].filter((p): p is string => !!p),
    themeSrc.fallbackFile,
  );
  return {
    mainSource: main.source,
    themeSource: theme.source,
    ...parsedMain,
    theme: parseGhosttyTheme(theme.content),
  };
}

function miseCard() {
  const src = manifestSource("mise", "mise.toml");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);
  return { source: cfg.source, tools: parseMiseTools(cfg.content) };
}

function packagesCard() {
  const brewSrc = manifestSource("packages", "Brewfile");
  const pacmanSrc = manifestSource("packages", "pacman.txt");
  const brew = readConfig(resolveLivePath(brewSrc.livePath), brewSrc.fallbackFile);
  if (!pacmanSrc.livePath.startsWith("derived:")) {
    throw new Error("pacman source must be declared as derived:<command> in the manifest");
  }
  let pacmanSource: "live" | "fallback" = "fallback";
  let pacman: string[] = [];
  // On workerd there is no child_process/pacman; degrade directly.
  if (!isWorkerd()) {
    try {
      const out = execSync(pacmanSrc.livePath.slice("derived:".length), { encoding: "utf8" });
      pacmanSource = "live";
      pacman = out.split("\n").map((l) => l.split(" ")[0]).filter(Boolean);
    } catch {
      pacman = parseListFile(readConfig([], pacmanSrc.fallbackFile).content);
    }
  } else {
    pacman = parseListFile(readConfig([], pacmanSrc.fallbackFile).content);
  }
  return { brewSource: brew.source, ...parseBrewfile(brew.content), pacmanSource, pacman };
}

function hyprlandCard() {
  const src = manifestSource("hyprland", "hypr-monitors.lua");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);
  return { source: cfg.source, ...parseHyprMonitors(cfg.content) };
}

function dotsCard(): DotsCardPayload {
  const src = manifestSource("dots", "dots");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);
  let source = cfg.source;
  let parsed = parseDotsScript(cfg.content);
  const warnings: string[] = [];

  if (source === "live" && parsed.missing.length > 0) {
    parsed = parseDotsScript(readConfig([], src.fallbackFile).content);
    source = "fallback";
    warnings.push("Live dots source was incomplete; showing the bundled fallback snapshot.");
  }
  if (parsed.missing.length > 0) {
    warnings.push(`Dots source is missing canonical commands: ${parsed.missing.join(", ")}.`);
  }

  return { source, commands: parsed.commands, warnings };
}

function neovimCard() {
  const extrasSrc = manifestSource("neovim", "lazyvim.json");
  const lockSrc = manifestSource("neovim", "lazy-lock.json");
  const extrasCfg = readConfig(resolveLivePath(extrasSrc.livePath), extrasSrc.fallbackFile);
  const lockCfg = readConfig(resolveLivePath(lockSrc.livePath), lockSrc.fallbackFile);
  return {
    extrasSource: extrasCfg.source,
    lockSource: lockCfg.source,
    extras: parseLazyvimExtras(extrasCfg.content),
    plugins: parseLazyLock(lockCfg.content),
  };
}

function ripgrepCard() {
  const src = manifestSource("ripgrep", "ripgrep-rc");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);
  return { source: cfg.source, flags: parseListFile(cfg.content) };
}

function lazygitCard() {
  const src = manifestSource("lazygit", "lazygit.yml");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);
  return { source: cfg.source, content: cfg.content };
}

const CARDS: Record<string, () => unknown> = {
  ghostty: ghosttyCard,
  mise: miseCard,
  packages: packagesCard,
  hyprland: hyprlandCard,
  dots: dotsCard,
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
