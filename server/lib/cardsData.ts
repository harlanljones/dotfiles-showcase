import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

export interface HerdrPluginAction {
  id: string;
  title: string;
  description?: string;
}

export interface HerdrPlugin {
  id: string;
  name: string;
  version: string;
  minHerdrVersion?: string;
  description: string;
  enabled: boolean;
  platforms: string[];
  actions: HerdrPluginAction[];
  sourceKind: string;
  sourceRepo?: string;
}

export interface HerdrKeyCommand {
  key: string;
  type: string;
  command: string;
  description: string;
}

export interface HerdrConfigSummary {
  prefix: string;
  theme: string;
  accent: string;
  agentPanelSort: string;
  resumeAgents: boolean;
  worktreesDir: string;
  supportedAgents: string[];
  keyCommands: HerdrKeyCommand[];
  agentKeybinds: Array<{ action: string; key: string }>;
}

export function parseHerdrPlugins(json: string): HerdrPlugin[] {
  try {
    const raw = JSON.parse(json) as Array<Record<string, unknown>>;
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => {
      const src = p.source && typeof p.source === "object" ? (p.source as Record<string, unknown>) : {};
      const actionsRaw = Array.isArray(p.actions) ? p.actions : [];
      const actions: HerdrPluginAction[] = actionsRaw.map((a: Record<string, unknown>) => ({
        id: String(a.id ?? ""),
        title: String(a.title ?? a.id ?? ""),
        description: a.description ? String(a.description) : undefined,
      }));
      return {
        id: String(p.plugin_id ?? ""),
        name: String(p.name ?? p.plugin_id ?? "Unnamed Plugin"),
        version: String(p.version ?? ""),
        minHerdrVersion: p.min_herdr_version ? String(p.min_herdr_version) : undefined,
        description: String(p.description ?? ""),
        enabled: Boolean(p.enabled),
        platforms: Array.isArray(p.platforms) ? (p.platforms as string[]) : [],
        actions,
        sourceKind: String(src.kind ?? "unknown"),
        sourceRepo: src.owner && src.repo ? `${src.owner}/${src.repo}` : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function parseHerdrConfig(content: string): HerdrConfigSummary {
  let section = "";
  let prefix = "";
  let theme = "";
  let accent = "";
  let agentPanelSort = "";
  let resumeAgents = false;
  let worktreesDir = "";
  const supportedAgents: string[] = [];
  const keyCommands: HerdrKeyCommand[] = [];
  const agentKeybinds: Array<{ action: string; key: string }> = [];

  let currentCmd: Record<string, string> | null = null;

  const pushCmd = () => {
    if (currentCmd && currentCmd.key) {
      keyCommands.push({
        key: currentCmd.key,
        type: currentCmd.type ?? "",
        command: currentCmd.command ?? "",
        description: currentCmd.description ?? "",
      });
    }
    currentCmd = null;
  };

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed === "[[keys.command]]") {
      pushCmd();
      currentCmd = {};
      section = "keys.command";
      continue;
    }

    const secMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (secMatch) {
      pushCmd();
      section = secMatch[1].trim();
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kvMatch) continue;
    const key = kvMatch[1];
    const val = kvMatch[2].split("#")[0].trim().replace(/^["']|["']$/g, "");

    if (section === "keys.command" && currentCmd) {
      currentCmd[key] = val;
    } else if (section === "keys" || section === "") {
      if (key === "prefix") prefix = val;
      if (key === "previous_agent" || key === "next_agent" || key === "focus_agent") {
        agentKeybinds.push({ action: key, key: val });
      }
    } else if (section === "theme" && key === "name") {
      theme = val;
    } else if (section === "ui") {
      if (key === "accent") accent = val;
      if (key === "agent_panel_sort") agentPanelSort = val;
    } else if (section === "session" && key === "resume_agents_on_restore") {
      resumeAgents = val === "true";
    } else if (section === "worktrees" && key === "directory") {
      worktreesDir = val;
    } else if (section === "ui.sidebar.agents.rows_by_agent") {
      supportedAgents.push(key);
    }
  }

  pushCmd();

  return {
    prefix,
    theme,
    accent,
    agentPanelSort,
    resumeAgents,
    worktreesDir,
    supportedAgents,
    keyCommands,
    agentKeybinds,
  };
}

function herdrCard() {
  const cfgSrc = manifestSource("herdr", "herdr-config.toml");
  const pluginsSrc = manifestSource("herdr", "herdr-plugins.json");
  const cfg = readConfig(resolveLivePath(cfgSrc.livePath), cfgSrc.fallbackFile);
  const plugins = readConfig(resolveLivePath(pluginsSrc.livePath), pluginsSrc.fallbackFile);

  return {
    configSource: cfg.source,
    pluginsSource: plugins.source,
    config: parseHerdrConfig(cfg.content),
    plugins: parseHerdrPlugins(plugins.content),
    rawConfig: cfg.content,
    rawPlugins: plugins.content,
  };
}

// ---------------------------------------------------------------------------
// Agent Skills Hub + Git Core & Security (HJ-699)
//
// Live roots: ~/.agents/skills (canonical catalogue; Codex/OpenCode discover
// it directly) reconciled by chezmoi into per-harness discovery roots
// (~/.claude/skills, ~/.cline/skills, ~/.gemini/skills,
// ~/.gemini/config/skills, ~/.pi/agent/skills). Categories come from
// ~/.local/share/chezmoi/.chezmoidata/agent_skills.yaml (pack membership);
// anything installed but undeclared there is "additional".
// ---------------------------------------------------------------------------

export interface AgentHarness {
  id: string;
  label: string;
  /** Display path of the harness discovery root ("~/" = user home). */
  path: string;
}

export const AGENT_HARNESSES: AgentHarness[] = [
  { id: "claude", label: "Claude Code", path: "~/.claude/skills" },
  { id: "codex", label: "Codex", path: "~/.agents/skills" },
  { id: "gemini", label: "Gemini CLI", path: "~/.gemini/skills" },
  { id: "cline", label: "Cline", path: "~/.cline/skills" },
  { id: "pi", label: "Pi", path: "~/.pi/agent/skills" },
];

export interface AgentSkillEntry {
  name: string;
  description: string;
  /** Pack key from agent_skills.yaml ("local"/"shared" for the linked sets). */
  category: string;
  /** Harness ids (see AGENT_HARNESSES) whose discovery root carries the skill. */
  harnesses: string[];
}

/** SKILL.md frontmatter (`name:` / `description:`) → identity + one-line use. */
export function parseSkillFrontmatter(content: string): { name: string; description: string } {
  const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields: Record<string, string> = {};
  let current = "";
  for (const line of (block ? block[1] : "").split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      current = kv[1];
      fields[current] = kv[2].trim();
    } else if (current && /^\s+\S/.test(line)) {
      fields[current] += ` ${line.trim()}`;
    }
  }
  // YAML block-scalar indicators (`>`, `>-`, `|+`, …) are formatting, not prose.
  const description = (fields.description ?? "").replace(/^[>|][+-]?\s*/, "").trim();
  return { name: fields.name ?? "", description };
}

/**
 * Targeted reader for the `.chezmoidata/agent_skills.yaml` shape:
 * `portableLocal` (→ "local"), each `packs.<pack>.skills` list — block or
 * inline flow style — (→ pack key), and `sharedExtras` names (→ "shared").
 * First claim wins; unknown skills default to "additional" at the call site.
 */
export function parseAgentSkillsCategories(yaml: string): Map<string, string> {
  const map = new Map<string, string>();
  let mode: "none" | "portable" | "packs" | "extras" = "none";
  let pack = "";
  let inSkills = false;
  for (const line of yaml.split("\n")) {
    const top = line.match(/^  (\w+):\s*$/);
    if (top) {
      mode =
        top[1] === "portableLocal" ? "portable"
        : top[1] === "packs" ? "packs"
        : top[1] === "sharedExtras" ? "extras"
        : "none";
      pack = "";
      inSkills = false;
      continue;
    }
    if (mode === "portable") {
      const item = line.match(/^    - (\S+)\s*$/);
      if (item && !map.has(item[1])) map.set(item[1], "local");
    } else if (mode === "packs") {
      const header = line.match(/^    ([\w-]+):\s*$/);
      if (header) {
        pack = header[1];
        inSkills = false;
        continue;
      }
      if (/^      skills:\s*$/.test(line)) {
        inSkills = true;
        continue;
      }
      const inline = line.match(/^      skills:\s*\[(.*)\]\s*$/);
      if (inline && pack) {
        for (const part of inline[1].split(",")) {
          const name = part.trim();
          if (name && !map.has(name)) map.set(name, pack);
        }
        inSkills = false;
        continue;
      }
      if (/^      [A-Za-z]/.test(line)) {
        inSkills = false;
        continue;
      }
      const item = line.match(/^        - (\S+)\s*$/);
      if (item && pack && inSkills && !map.has(item[1])) map.set(item[1], pack);
    } else if (mode === "extras") {
      const item = line.match(/^    - name:\s*(\S+)\s*$/);
      if (item && !map.has(item[1])) map.set(item[1], "shared");
    }
  }
  return map;
}

export interface AgentSkillsPayload {
  source: "live" | "fallback";
  skills: AgentSkillEntry[];
  harnesses: AgentHarness[];
}

function harnessRoots(home: string): Record<string, string[]> {
  return {
    claude: [join(home, ".claude", "skills")],
    codex: [join(home, ".agents", "skills")],
    gemini: [join(home, ".gemini", "skills"), join(home, ".gemini", "config", "skills")],
    cline: [join(home, ".cline", "skills")],
    pi: [join(home, ".pi", "agent", "skills")],
  };
}

function skillPresent(roots: string[], name: string): boolean {
  for (const root of roots) {
    try {
      if (existsSync(join(root, name))) return true;
    } catch {
      // unreadable candidate — treat as absent
    }
  }
  return false;
}

/** Live scan of the canonical skills root. Null when the root is unreadable. */
export function scanAgentSkills(skillsDir: string, home: string): AgentSkillEntry[] | null {
  let dirents;
  try {
    dirents = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return null;
  }
  let categories = new Map<string, string>();
  try {
    const yamlPath = join(home, ".local", "share", "chezmoi", ".chezmoidata", "agent_skills.yaml");
    if (existsSync(yamlPath)) categories = parseAgentSkillsCategories(readFileSync(yamlPath, "utf8"));
  } catch {
    // yaml unavailable — every skill falls back to "additional"
  }
  const roots = harnessRoots(home);
  const skills: AgentSkillEntry[] = [];
  for (const entry of dirents) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const name = entry.name;
    let description = "";
    try {
      const front = parseSkillFrontmatter(readFileSync(join(skillsDir, name, "SKILL.md"), "utf8"));
      if (front.name && front.name !== name) continue; // stray dir, not this skill
      description = front.description;
    } catch {
      continue; // no readable SKILL.md — not a skill
    }
    const harnesses = AGENT_HARNESSES.filter((h) =>
      h.id === "codex" ? true : skillPresent(roots[h.id] ?? [], name),
    ).map((h) => h.id);
    skills.push({ name, description, category: categories.get(name) ?? "additional", harnesses });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

/** Bundled snapshot (fallback/agent-skills.json) → skill list. Never throws. */
export function parseAgentSkillsSnapshot(json: string): AgentSkillEntry[] {
  try {
    const parsed = JSON.parse(json) as { skills?: unknown };
    if (!Array.isArray(parsed.skills)) return [];
    return parsed.skills.flatMap((s) => {
      if (!s || typeof s !== "object") return [];
      const rec = s as Record<string, unknown>;
      if (typeof rec.name !== "string" || !rec.name) return [];
      const harnesses = Array.isArray(rec.harnesses)
        ? rec.harnesses.filter((h): h is string => typeof h === "string")
        : [];
      return [{
        name: rec.name,
        description: typeof rec.description === "string" ? rec.description : "",
        category: typeof rec.category === "string" && rec.category ? rec.category : "additional",
        harnesses,
      }];
    });
  } catch {
    return [];
  }
}

function agentSkillsCard(): AgentSkillsPayload {
  const src = manifestSource("agent-skills", "agent-skills.json");
  // On workerd there is no host skills tree; degrade directly to the snapshot.
  if (!isWorkerd()) {
    try {
      const skills = scanAgentSkills(resolveLivePath(src.livePath), userHome());
      if (skills && skills.length > 0) {
        return { source: "live", skills, harnesses: AGENT_HARNESSES };
      }
    } catch {
      // fall through to the bundled snapshot
    }
  }
  const fb = readConfig([], src.fallbackFile);
  return { source: fb.source, skills: parseAgentSkillsSnapshot(fb.content), harnesses: AGENT_HARNESSES };
}

// ---------------------------------------------------------------------------
// Git Core & Security: ~/.config/git/config + ~/.config/git/ignore.
//
// The parser is a tolerant ini-style reader (sections, subsections, repeated
// keys). Signing-key VALUES are never served — only whether one is set — and
// the bundled fallback carries synthetic identity placeholders.
// ---------------------------------------------------------------------------

export interface GitConfigSection {
  section: string;
  /** Ordered [key, values] pairs; repeated keys accumulate values. */
  entries: Array<[string, string[]]>;
}

export function parseGitConfig(content: string): GitConfigSection[] {
  const sections: GitConfigSection[] = [];
  let current: GitConfigSection | null = null;
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const sec = line.match(/^\[([^\]"\s]+)(?:\s+"([^"]+)")?\]$/);
    if (sec) {
      current = { section: sec[2] ? `${sec[1]} "${sec[2]}"` : sec[1], entries: [] };
      sections.push(current);
      continue;
    }
    const kv = line.match(/^([A-Za-z0-9-]+)\s*=\s*(.*)$/) ?? line.match(/^([A-Za-z0-9-]+)$/);
    if (kv && current) {
      const value = (kv[2] ?? "true").trim();
      const existing = current.entries.find(([k]) => k === kv[1]);
      if (existing) existing[1].push(value);
      else current.entries.push([kv[1], [value]]);
    }
  }
  return sections;
}

/** Look up a section's entries by bare section name (ignores subsections). */
export function gitSectionEntries(sections: GitConfigSection[], name: string): Array<[string, string[]]> {
  return sections.find((s) => s.section === name)?.entries ?? [];
}

/** First value of `key` in `section`, with trailing inline comments stripped. */
export function gitValue(
  sections: GitConfigSection[],
  section: string,
  key: string,
): string | null {
  for (const [k, values] of gitSectionEntries(sections, section)) {
    if (k === key && values.length > 0) return values[0].split("#")[0].trim() || null;
  }
  return null;
}

export interface GitSigningSummary {
  commitGpgsign: string | null;
  tagGpgsign: string | null;
  gpgFormat: string | null;
  gpgProgram: string | null;
  signingKeySet: boolean;
}

export function summarizeGitSigning(sections: GitConfigSection[]): GitSigningSummary {
  return {
    commitGpgsign: gitValue(sections, "commit", "gpgsign"),
    tagGpgsign: gitValue(sections, "tag", "gpgsign") ?? gitValue(sections, "tag", "gpgSign"),
    gpgFormat: gitValue(sections, "gpg", "format"),
    gpgProgram: gitValue(sections, "gpg", "program"),
    signingKeySet: gitValue(sections, "user", "signingkey") !== null,
  };
}

/** Marker dividing the fallback gitconfig snapshot from its ignore snapshot. */
export const GITCONFIG_IGNORE_MARKER =
  "# --- global ignores snapshot (live source: ~/.config/git/ignore) ---";

/** Fallback file layout: gitconfig text, then `#i <pattern>` lines past the marker. */
export function splitGitconfigFallback(content: string): { configText: string; ignorePatterns: string[] } {
  const idx = content.indexOf(GITCONFIG_IGNORE_MARKER);
  if (idx === -1) return { configText: content, ignorePatterns: [] };
  const ignorePatterns = content
    .slice(idx + GITCONFIG_IGNORE_MARKER.length)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("#i "))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
  return { configText: content.slice(0, idx), ignorePatterns };
}

/** ~/.config/git/ignore → patterns (comments/blank skipped). Null when unreadable. */
export function readGitIgnore(livePath: string): string[] | null {
  try {
    if (!existsSync(livePath)) return null;
    return readFileSync(livePath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return null;
  }
}

export interface GitCorePayload {
  source: "live" | "fallback";
  ignoresSource: "live" | "fallback";
  user: { name: string | null; email: string | null };
  signing: GitSigningSummary;
  aliases: Array<[string, string]>;
  /** Safety-relevant sections rendered verbatim (pull/push/diff/commit/…). */
  policies: Array<{ section: string; entries: Array<[string, string]> }>;
  credentialHelpers: string[];
  safeDirs: string[];
  ignores: string[];
  rawConfig: string;
}

/** Sections surfaced as safety policy (identity/alias/credential/safe shown separately). */
const GIT_POLICY_SECTIONS = new Set([
  "init",
  "pull",
  "push",
  "diff",
  "commit",
  "column",
  "branch",
  "tag",
  "rerere",
  "core",
  "status",
  "advice",
  "interactive",
  "delta",
  "merge",
]);

function gitCoreCard(): GitCorePayload {
  const src = manifestSource("git-core", "gitconfig");
  const cfg = readConfig(resolveLivePath(src.livePath), src.fallbackFile);

  let configText: string;
  let ignores: string[];
  let ignoresSource: "live" | "fallback";
  if (cfg.source === "live") {
    configText = cfg.content;
    const liveIgnores = isWorkerd() ? null : readGitIgnore(join(userHome(), ".config", "git", "ignore"));
    if (liveIgnores) {
      ignores = liveIgnores;
      ignoresSource = "live";
    } else {
      ignores = splitGitconfigFallback(readConfig([], src.fallbackFile).content).ignorePatterns;
      ignoresSource = "fallback";
    }
  } else {
    const split = splitGitconfigFallback(cfg.content);
    configText = split.configText;
    ignores = split.ignorePatterns;
    ignoresSource = "fallback";
  }

  const sections = parseGitConfig(configText);
  const aliases: Array<[string, string]> = gitSectionEntries(sections, "alias").map(
    ([k, v]) => [k, v.join(", ")],
  );
  const credentialHelpers = sections
    .filter((s) => s.section === "credential" || s.section.startsWith('credential "'))
    .flatMap((s) => s.entries)
    .filter(([k]) => k === "helper")
    .flatMap(([, v]) => v)
    .filter((v) => v.length > 0);
  const safeDirs = sections
    .filter((s) => s.section === "safe")
    .flatMap((s) => s.entries)
    .filter(([k]) => k === "directory")
    .flatMap(([, v]) => v);
  const policies = sections
    .filter((s) => GIT_POLICY_SECTIONS.has(s.section))
    .map((s) => ({ section: s.section, entries: s.entries.map(([k, v]): [string, string] => [k, v.join(", ")]) }));

  return {
    source: cfg.source,
    ignoresSource,
    user: {
      name: gitValue(sections, "user", "name"),
      email: gitValue(sections, "user", "email"),
    },
    signing: summarizeGitSigning(sections),
    aliases,
    policies,
    credentialHelpers,
    safeDirs,
    ignores,
    rawConfig: configText,
  };
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
  herdr: herdrCard,
  "agent-skills": agentSkillsCard,
  "git-core": gitCoreCard,
};

export type CardKey = keyof typeof CARDS;

export function cardKeys(): string[] {
  return Object.keys(CARDS);
}

export function buildCard(key: string): unknown | undefined {
  const fn = CARDS[key];
  return fn ? fn() : undefined;
}
