/**
 * Config search index generator (SEARCH-01).
 *
 * The palette (HJ-725) searches the visitor's real configuration content.
 * That index has to exist somewhere both the local Bun host and the public
 * Workers mirror can read — the mirror has no filesystem, so (like the
 * FALLBACKS bundle in `server/lib/fallbacks.ts`) it is embedded as a
 * committed TS module rather than read off disk at request time.
 *
 * This script walks the bundled fallback snapshots (`fallback/*`, already
 * the mirror's source of truth per CFG-01) via the manifest's declared
 * per-demo `sources` (`src/manifest.ts`), extracts setting keys/values with
 * a format-aware parser, and emits `server/lib/searchIndex.ts`.
 *
 * Usage:
 *   bun run scripts/generate-search-index.ts           # generate (write) mode
 *   bun run scripts/generate-search-index.ts --check   # verify freshness only, exit 1 if stale
 *
 * Modes are injectable via `generate()` for tests; `main()` wires real paths.
 * Reuses the secret-scan / host-literal guard from `refresh-fallbacks.ts` as
 * a defense-in-depth check — the fallback snapshots it reads are already
 * sanitized, but the generated artifact is re-verified anyway before it is
 * ever written (D2 acceptance: no host-identifying literals or secrets).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname as osHostname, userInfo } from "node:os";
import { join } from "node:path";
import { findHostLeaks, findSecretMatches, type ScrubIdentity } from "./refresh-fallbacks";
import { MANIFEST, type CardId, type ManifestEntry } from "../src/manifest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchIndexEntry {
  /** Showcase demo (Explorer card) this entry renders in. */
  demoId: CardId;
  /** Live host path the setting is read from (generic — never host-identifying; see fallback/README.md). */
  configPath: string;
  /** Bundled fallback file the entry was extracted from. */
  fallbackFile: string;
  /** Setting key (section-qualified where the format has structure). */
  key: string;
  /** Setting value as it appears in the fallback snapshot. */
  value: string;
}

interface Setting {
  key: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Format-specific extractors
//
// Each bundled fallback file (src/manifest.ts `FALLBACK_FILES`) is one of a
// small number of real shapes (see fallback/README.md). Rather than a single
// lossy generic parser, each shape gets its own small extractor.
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSON snapshots (agent-skills.json, herdr-plugins.json, lazy-lock.json, lazyvim.json, shell-env.json). */
export function extractJson(content: string): Setting[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }
  const out: Setting[] = [];
  const walk = (node: unknown, path: string): void => {
    if (isPlainObject(node)) {
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
    } else if (Array.isArray(node)) {
      node.forEach((value, i) => walk(value, `${path}[${i}]`));
    } else if (node !== null && node !== undefined) {
      out.push({ key: path, value: String(node) });
    }
  };
  walk(data, "");
  return out;
}

/** INI/TOML-shaped snapshots: `[section]` headers plus `key = value` lines (starship.toml, mise.toml, herdr-config.toml, ghostty-config, ghostty-theme.conf, btop.conf, gitconfig). */
export function extractIniLike(content: string): Setting[] {
  const out: Setting[] = [];
  let section = "";
  for (const raw of content.split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith(";") || line.startsWith("--")) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    line = line.replace(/\s+#.*$/, ""); // strip trailing inline comment
    const kv = line.match(/^([A-Za-z0-9_."\-]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = section ? `${section}.${kv[1]}` : kv[1];
    out.push({ key, value: kv[2].trim().replace(/^["']|["']$/g, "") });
  }
  return out;
}

/** YAML-ish snapshots (lazygit.yml): flat `key: value` lines, list markers stripped. */
export function extractYamlish(content: string): Setting[] {
  const out: Setting[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim().replace(/^-\s*/, "");
    if (!line || line.startsWith("#")) continue;
    const kv = line.match(/^([A-Za-z0-9_.\-]+):\s*(.+)$/);
    if (kv) out.push({ key: kv[1], value: kv[2].trim().replace(/^["']|["']$/g, "") });
  }
  return out;
}

/** Lua config calls (hypr-monitors.lua): `key = "value"` / `key = number` pairs anywhere in the file, including inside table literals. */
export function extractLua(content: string): Setting[] {
  const out: Setting[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const rawValue = m[2];
    out.push({ key: m[1], value: rawValue.startsWith('"') ? rawValue.slice(1, -1) : rawValue });
  }
  return out;
}

/** Brewfile: `brew "name"` / `cask "name"` / `tap "name"` DSL lines. */
export function extractBrewfile(content: string): Setting[] {
  const out: Setting[] = [];
  for (const raw of content.split("\n")) {
    const m = raw.trim().match(/^(brew|cask|tap)\s+"([^"]+)"/);
    if (m) out.push({ key: m[1], value: m[2] });
  }
  return out;
}

/** Flat non-comment lines, one setting per line, under a shared key (pacman.txt package names). */
export function extractLineList(content: string, key: string): Setting[] {
  const out: Setting[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    out.push({ key, value: line });
  }
  return out;
}

/** ripgrep-rc: one CLI flag per line, `--flag` or `--flag=value`. */
export function extractFlags(content: string): Setting[] {
  const out: Setting[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    out.push(eq === -1 ? { key: line, value: "" } : { key: line.slice(0, eq), value: line.slice(eq + 1) });
  }
  return out;
}

/** `dots` (bash script): top-level function definitions, the closest analog to "settings" in a script. */
export function extractShellFunctions(content: string): Setting[] {
  const out: Setting[] = [];
  const re = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) out.push({ key: "function", value: m[1] });
  return out;
}

/** Dispatch by fallback filename/extension to the matching extractor. */
export function extractSettings(fallbackFile: string, content: string): Setting[] {
  if (fallbackFile.endsWith(".json")) return extractJson(content);
  if (fallbackFile.endsWith(".lua")) return extractLua(content);
  if (fallbackFile.endsWith(".yml") || fallbackFile.endsWith(".yaml")) return extractYamlish(content);
  if (fallbackFile === "Brewfile") return extractBrewfile(content);
  if (fallbackFile === "pacman.txt") return extractLineList(content, "package");
  if (fallbackFile === "ripgrep-rc") return extractFlags(content);
  if (fallbackFile === "dots") return extractShellFunctions(content);
  return extractIniLike(content);
}

// ---------------------------------------------------------------------------
// Index assembly
// ---------------------------------------------------------------------------

/** Walks every manifest demo's declared config sources and extracts index entries. Order is deterministic (manifest declaration order). */
export function buildIndex(manifest: ManifestEntry[], readFallback: (file: string) => string | null): SearchIndexEntry[] {
  const entries: SearchIndexEntry[] = [];
  for (const demo of manifest) {
    if (!demo.sources) continue;
    for (const source of demo.sources) {
      const content = readFallback(source.fallbackFile);
      if (content === null) continue;
      for (const setting of extractSettings(source.fallbackFile, content)) {
        entries.push({
          demoId: demo.id,
          configPath: source.livePath,
          fallbackFile: source.fallbackFile,
          key: setting.key,
          value: setting.value,
        });
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Serialization (committed module)
// ---------------------------------------------------------------------------

export function buildIndexModule(entries: SearchIndexEntry[]): string {
  const lines = [
    "// Auto-generated config search index for the palette (SEARCH-01).",
    "// Do not edit manually — regenerated from fallback/* via `bun run search-index:build`.",
    "// See scripts/generate-search-index.ts and fallback/README.md for provenance.",
    "",
    "export interface SearchIndexEntry {",
    "  demoId: string;",
    "  configPath: string;",
    "  fallbackFile: string;",
    "  key: string;",
    "  value: string;",
    "}",
    "",
    "export const SEARCH_INDEX: SearchIndexEntry[] = [",
  ];
  for (const entry of entries) {
    lines.push(`  ${JSON.stringify(entry)},`);
  }
  lines.push("];", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Core driver (injectable for tests)
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  repoRoot: string;
  checkOnly?: boolean;
  /** Defaults to the real MANIFEST; overridable so tests can use fixture demos. */
  manifest?: ManifestEntry[];
  /** Defaults to the live machine identity; overridable for tests. */
  identity?: ScrubIdentity;
}

export interface GenerateReport {
  entryCount: number;
  status: "SAME" | "STALE" | "CREATED";
  wrote: boolean;
}

function readFileOrNull(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function currentIdentity(): ScrubIdentity {
  try {
    return { user: userInfo().username, host: osHostname() };
  } catch {
    return { user: process.env.USER ?? "", host: "" };
  }
}

export function generate(options: GenerateOptions): GenerateReport {
  const { repoRoot, checkOnly = false } = options;
  const manifest = options.manifest ?? MANIFEST;
  const identity = options.identity ?? currentIdentity();
  const fallbackDir = join(repoRoot, "fallback");
  const outPath = join(repoRoot, "server", "lib", "searchIndex.ts");

  // Defense-in-depth: the fallback snapshots this reads are already
  // sanitized by refresh-fallbacks.ts, but re-verify each one's raw content
  // before it is extracted into the index — same guard, same failure
  // semantics, applied per source file (a JSON-serialized index entry can
  // split a `key = secret` line across separate fields, so the scan has to
  // run on the raw fallback content, not the generated artifact).
  const readFallback = (file: string): string | null => {
    const content = readFileOrNull(join(fallbackDir, file));
    if (content === null) return null;
    const secrets = findSecretMatches(content);
    if (secrets.length > 0) {
      throw new Error(
        `secret-scan FAILED for fallback/${file}: credential-like pattern(s) detected (${secrets.map((s) => JSON.stringify(s.slice(0, 12))).join(", ")}…). Search index not generated.`,
      );
    }
    const leaks = findHostLeaks(content, identity.host);
    if (leaks.length > 0) {
      throw new Error(
        `host-literal guard FAILED for fallback/${file}: machine hostname "${identity.host}" survived sanitization. Search index not generated.`,
      );
    }
    return content;
  };

  const entries = buildIndex(manifest, readFallback);
  const content = buildIndexModule(entries);

  const existing = readFileOrNull(outPath);
  if (existing === content) {
    return { entryCount: entries.length, status: "SAME", wrote: false };
  }
  const status: GenerateReport["status"] = existing === null ? "CREATED" : "STALE";
  if (checkOnly) {
    return { entryCount: entries.length, status, wrote: false };
  }
  mkdirSync(join(repoRoot, "server", "lib"), { recursive: true });
  writeFileSync(outPath, content);
  return { entryCount: entries.length, status, wrote: true };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const repoRoot = join(import.meta.dir, "..");

  let report: GenerateReport;
  try {
    report = generate({ repoRoot, checkOnly });
  } catch (err) {
    console.error(`\n${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`search index ${checkOnly ? "(check)" : "(write)"} — ${repoRoot}`);
  console.log(`  ${report.status.padEnd(8)} server/lib/searchIndex.ts  —  ${report.entryCount} entries`);

  if (checkOnly && report.status !== "SAME") {
    console.error(`\nsearch index stale — run \`bun run search-index:build\` to update.`);
    process.exit(1);
  }
  console.log(`\ndone: ${report.entryCount} entries, ${report.status.toLowerCase()}`);
}

if (import.meta.main) {
  main();
}
