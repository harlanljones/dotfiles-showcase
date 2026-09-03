/**
 * Fallback snapshot refresh automation (FB-01).
 *
 * Regenerates `fallback/*` from the live sources declared in
 * `fallback/README.md` (the authoritative per-file strategy registry, D2),
 * sanitizes host-identifying literals, hard-fails on credential-like
 * patterns, and keeps the embedded Workers bundle
 * (`server/lib/fallbacks.ts`) in sync.
 *
 * Usage:
 *   bun run scripts/refresh-fallbacks.ts           # refresh (write) mode
 *   bun run scripts/refresh-fallbacks.ts --check   # verify freshness only, exit 1 if stale
 *
 * Modes are injectable via `refresh()` for tests; `main()` wires real paths.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname as osHostname, homedir, userInfo } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Strategy =
  | "FULL-COPY"
  | "TRIMMED-SAMPLE"
  | "SYNTHETIC"
  | "DERIVED-SNAPSHOT"
  | "SANITIZED SAMPLE";

export interface ManifestEntry {
  file: string;
  strategy: Strategy;
  /** Live source path (`~/...`) or special source text (e.g. "pacman -Qe"). */
  liveSource: string;
  notes: string;
}

export type EntryStatus = "SAME" | "STALE" | "SKIP-SYNTHETIC" | "SKIP-NO-LIVE" | "SKIP-DERIVED-UNAVAILABLE";

export interface EntryReport {
  file: string;
  status: EntryStatus;
  detail: string;
}

export interface RefreshReport {
  entries: EntryReport[];
  bundle: "SAME" | "STALE";
  wrote: boolean;
  staleCount: number;
}

export interface ScrubIdentity {
  user: string;
  host: string;
}

// ---------------------------------------------------------------------------
// Sanitization policy (AGENTS.md §6 / fallback/README.md rules)
// ---------------------------------------------------------------------------

/** Exact host-identifying literals to substitute, with their placeholders. */
const SCRUB_EXACT: Array<[string, string]> = [
  ["Augustus", "<host>"],
  ["augustus", "<host>"],
];

/**
 * Hostname values that are generic project/distro names rather than unique
 * machine identifiers — allowed through unscrubbed. Anything else that shows
 * up matching os.hostname() fails the run instead of being written.
 */
const BENIGN_HOST_TOKENS = new Set(["omarchy"]);

/** Credential-like patterns: never auto-scrubbed — always a hard failure. */
const SECRET_PATTERNS: RegExp[] = [
  /ghp_[A-Za-z0-9]/,
  /github_pat_[A-Za-z0-9]/,
  /\bAGE-SECRET/i,
  /BEGIN (OPENSSH|RSA|PGP) PRIVATE KEY/,
  /api[_-]?key\s*[=:]/i,
  /\btoken\s*[=:]\s*\S+/i,
  /\bpassword\s*[=:]\s*\S+/i,
  /\bsecret\b/i,
];

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const MAC_RE = /\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi;

export function findSecretMatches(content: string): string[] {
  const hits: string[] = [];
  for (const re of SECRET_PATTERNS) {
    const m = content.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"));
    if (m) hits.push(...m.map((s) => s.trim()));
  }
  return hits;
}

/** Substitute known host-identifying literals plus any IPv4/MAC addresses. */
export function scrubLiterals(content: string, identity: ScrubIdentity): { content: string; hits: number } {
  let hits = 0;
  let out = content;

  for (const [literal, placeholder] of SCRUB_EXACT) {
    if (out.includes(literal)) {
      out = out.split(literal).join(placeholder);
      hits++;
    }
  }
  if (identity.user && identity.user.length >= 3) {
    const before = out;
    out = out.split(identity.user).join("<user>");
    if (out !== before) hits++;
  }

  out = out.replace(IPV4_RE, () => {
    hits++;
    return "<ip>";
  });
  out = out.replace(MAC_RE, () => {
    hits++;
    return "<mac>";
  });

  return { content: out, hits };
}

/**
 * Final guard: the live machine's hostname must not survive into output
 * unless it is a known-generic token. Returns offending occurrences.
 */
export function findHostLeaks(content: string, host: string): string[] {
  if (!host || BENIGN_HOST_TOKENS.has(host)) return [];
  return content.includes(host) ? [host] : [];
}

// ---------------------------------------------------------------------------
// Manifest parsing (fallback/README.md is authoritative)
// ---------------------------------------------------------------------------

export function parseManifest(readme: string): ManifestEntry[] {
  const rows: ManifestEntry[] = [];
  for (const line of readme.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6) continue;
    const file = cells[1];
    const fileName = file.replace(/`/g, "");
    if (!fileName || fileName === "File" || /^[-:\s]*$/.test(fileName)) continue;
    if (!/^[A-Za-z0-9._-]+$/.test(fileName)) continue;

    const strategyRaw = cells[2].replace(/`/g, "").toUpperCase();
    const strategy = (
      strategyRaw.startsWith("FULL-COPY") ? "FULL-COPY"
      : strategyRaw.startsWith("TRIMMED-SAMPLE") ? "TRIMMED-SAMPLE"
      : strategyRaw.startsWith("SYNTHETIC") ? "SYNTHETIC"
      : strategyRaw.startsWith("DERIVED-SNAPSHOT") ? "DERIVED-SNAPSHOT"
      : "SANITIZED SAMPLE"
    ) as Strategy;

    const liveCell = cells[3].replace(/`/g, "");
    const pathMatch = liveCell.match(/(~\/\S+)/);
    const liveSource = pathMatch ? pathMatch[1] : liveCell === "none on Linux host" ? "" : liveCell;

    rows.push({ file: fileName, strategy, liveSource, notes: cells.slice(4).join(" | ").replace(/\s+\|\s*$/, "") });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Per-strategy body transformers
// ---------------------------------------------------------------------------

function commentPrefixFor(file: string): string {
  return file.endsWith(".lua") ? "--" : "#";
}

function expandHome(p: string, home: string): string {
  return p.startsWith("~/") ? join(home, p.slice(2)) : p;
}

/** Strip a leading block of blank/comment lines from live content. */
export function stripLeadingComments(content: string, prefix: string): string {
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].trim() === "" || lines[i].trimStart().startsWith(prefix))) i++;
  return lines.slice(i).join("\n");
}

/** TRIMMED-SAMPLE for ghostty-config: drop full-line comments, keep settings verbatim. */
export function trimComments(content: string): string {
  return content
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join("\n");
}

const COLOR_KEYS_RE = /^(background|foreground|cursor-color|cursor-text|selection-background|selection-foreground|palette)\s*=/;

/** TRIMMED-SAMPLE for generated theme state: color-bearing lines (plus blank separators) only. */
export function extractColors(content: string): string {
  const out = content
    .split("\n")
    .filter((l) => COLOR_KEYS_RE.test(l) || l.trim() === "")
    .join("\n");
  return out;
}

/**
 * SANITIZED SAMPLE for starship.toml: genericize the username block (drop the
 * trailing "@") and replace a literal hostname in the [hostname] format with
 * the $hostname variable so no machine name survives.
 */
export function sanitizeStarship(content: string): string {
  const lines = content.split("\n");
  let section = "";
  const out = lines.map((line) => {
    const secMatch = line.match(/^\[([^\]]+)\]\s*$/);
    if (secMatch) {
      section = secMatch[1].trim().toLowerCase();
      return line;
    }
    if (section === "username") {
      // format = "[$user]($style)@" → drop the pairing "@" (implies a host).
      return line.replace(/(\$\{?user\}?\]\([^)]*\))@(")/, "$1$2");
    }
    if (section === "hostname") {
      // [LiteralMachineName](style) → at [$hostname](style)
      return line.replace(/\[([^$\]]+)\]/, "at [$hostname]");
    }
    return line;
  });
  return out.join("\n");
}

/** Build the final content for one entry given its live input. */
export function regenerateBody(entry: ManifestEntry, liveContent: string): string {
  switch (entry.strategy) {
    case "FULL-COPY":
      // JSON snapshots are byte-identical copies (no provenance header possible).
      if (entry.file.endsWith(".json")) return liveContent;
      return stripLeadingComments(liveContent, commentPrefixFor(entry.file));
    case "TRIMMED-SAMPLE":
      return entry.file.includes("theme") ? extractColors(liveContent) : trimComments(liveContent);
    case "SANITIZED SAMPLE":
      return sanitizeStarship(liveContent);
    default:
      return liveContent;
  }
}

/**
 * Provenance header preserved byte-for-byte from the existing snapshot
 * (leading comment lines, terminated by a blank line). Empty for JSON files.
 */
export function splitProvenanceHeader(existing: string, entry: ManifestEntry): string {
  if (entry.file.endsWith(".json")) return "";
  const prefix = commentPrefixFor(entry.file);
  const lines = existing.split("\n");
  const header: string[] = [];
  for (const line of lines) {
    if (line.trimStart().startsWith(prefix)) header.push(line);
    else break;
  }
  return header.length > 0 ? header.join("\n") + "\n\n" : "";
}

function synthesizeHeader(entry: ManifestEntry, derivedSourceText?: string): string {
  const prefix = commentPrefixFor(entry.file);
  const source = derivedSourceText ?? entry.liveSource;
  return `${prefix} Fallback snapshot: ${entry.file}.\n${prefix} Live source: ${source}\n\n`;
}

// ---------------------------------------------------------------------------
// Embedded Workers bundle regeneration
// ---------------------------------------------------------------------------

export function buildBundle(files: Map<string, string>): string {
  const lines = [
    "// Auto-generated fallback bundle for Workers (and Bun fallback).",
    "// Do not edit manually — regenerated from fallback/* via `bun run fallbacks:refresh`.",
    "// Each value is the exact fallback file content (see fallback/README.md for strategy).",
    "",
    "export const FALLBACKS: Record<string, string> = {",
  ];
  const keys = [...files.keys()].sort();
  keys.forEach((key, idx) => {
    const comma = idx === keys.length - 1 ? "" : ",";
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(files.get(key))}${comma}`);
  });
  lines.push("};", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Core driver (injectable for tests)
// ---------------------------------------------------------------------------

export interface RefreshOptions {
  repoRoot: string;
  home: string;
  identity: ScrubIdentity;
  checkOnly?: boolean;
  /** Runs the DERIVED-SNAPSHOT command (pacman). Defaults to auto-detect. */
  runDerived?: (cmd: string, args: string[]) => string | null;
}

function readFileOrNull(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function defaultRunDerived(cmd: string, args: string[]): string | null {
  try {
    const proc = Bun.spawnSync([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== 0) return null;
    return new TextDecoder().decode(proc.stdout);
  } catch {
    return null;
  }
}

export function refresh(options: RefreshOptions): RefreshReport {
  const { repoRoot, home, identity, checkOnly = false } = options;
  const runDerived = options.runDerived ?? defaultRunDerived;
  const fallbackDir = join(repoRoot, "fallback");

  const readme = readFileOrNull(join(fallbackDir, "README.md"));
  if (!readme) throw new Error("fallback/README.md not found — cannot resolve per-file strategies (D2)");
  const manifest = parseManifest(readme);

  const reports: EntryReport[] = [];
  const writtenFiles = new Map<string, string>();
  let stale = 0;

  for (const entry of manifest) {
    const fallbackPath = join(fallbackDir, entry.file);
    const existing = readFileOrNull(fallbackPath);

    if (entry.strategy === "SYNTHETIC") {
      reports.push({ file: entry.file, status: "SKIP-SYNTHETIC", detail: "hand-authored; not derived from live source" });
      if (existing !== null) writtenFiles.set(entry.file, existing);
      continue;
    }

    if (entry.strategy === "DERIVED-SNAPSHOT") {
      const out = runDerived("pacman", ["-Qe"]);
      if (out === null) {
        reports.push({ file: entry.file, status: "SKIP-DERIVED-UNAVAILABLE", detail: "pacman unavailable or failed" });
        if (existing !== null) writtenFiles.set(entry.file, existing);
        continue;
      }
      const names = out.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean).sort();
      const header = existing !== null
        ? splitProvenanceHeader(existing, entry)
        : synthesizeHeader(entry, "`pacman -Qe` on the host.");
      const content = scrubAndVerify(`${header}\n${names.join("\n")}\n`, identity, entry.file);
      evaluate(entry, content, existing, checkOnly, reports, writtenFiles, fallbackPath, () => stale++);
      continue;
    }

    if (!entry.liveSource) {
      reports.push({ file: entry.file, status: "SKIP-NO-LIVE", detail: "no live source declared" });
      if (existing !== null) writtenFiles.set(entry.file, existing);
      continue;
    }

    const livePath = expandHome(entry.liveSource, home);
    const live = readFileOrNull(livePath);
    if (live === null) {
      reports.push({ file: entry.file, status: "SKIP-NO-LIVE", detail: `live source missing: ${entry.liveSource}` });
      if (existing !== null) writtenFiles.set(entry.file, existing);
      continue;
    }

    const header = existing !== null
      ? splitProvenanceHeader(existing, entry)
      : entry.file.endsWith(".json")
        ? ""
        : synthesizeHeader(entry);
    const body = regenerateBody(entry, live);
    const content = scrubAndVerify(header + body, identity, entry.file);
    evaluate(entry, content, existing, checkOnly, reports, writtenFiles, fallbackPath, () => stale++);
  }

  // Keep the embedded Workers bundle in sync with all fallback files.
  const bundlePath = join(repoRoot, "server", "lib", "fallbacks.ts");
  const bundle = buildBundle(writtenFiles);
  const existingBundle = readFileOrNull(bundlePath);
  const bundleMissing = existingBundle === null && writtenFiles.size > 0;
  const bundleStale = bundleMissing || existingBundle !== bundle;
  let bundleStatus: "SAME" | "STALE" = "SAME";
  if (bundleStale) {
    bundleStatus = "STALE";
    if (!checkOnly) {
      mkdirSync(join(repoRoot, "server", "lib"), { recursive: true });
      writeFileSync(bundlePath, bundle);
    }
  }

  return { entries: reports, bundle: bundleStatus, wrote: !checkOnly, staleCount: stale };
}

function scrubAndVerify(content: string, identity: ScrubIdentity, file: string): string {
  const secrets = findSecretMatches(content);
  if (secrets.length > 0) {
    throw new Error(
      `secret-scan FAILED for ${file}: credential-like pattern(s) detected (${secrets.map((s) => JSON.stringify(s.slice(0, 12))).join(", ")}…). Nothing was written.`,
    );
  }
  const { content: scrubbed } = scrubLiterals(content, identity);
  const leaks = findHostLeaks(scrubbed, identity.host);
  if (leaks.length > 0) {
    throw new Error(
      `host-literal guard FAILED for ${file}: machine hostname "${identity.host}" survived sanitization. Add it to SCRUB_EXACT or BENIGN_HOST_TOKENS. Nothing was written.`,
    );
  }
  return scrubbed;
}

function evaluate(
  entry: ManifestEntry,
  content: string,
  existing: string | null,
  checkOnly: boolean,
  reports: EntryReport[],
  writtenFiles: Map<string, string>,
  fallbackPath: string,
  bumpStale: () => void,
): void {
  if (existing === null) {
    reports.push({ file: entry.file, status: "STALE", detail: "no committed snapshot yet" });
    bumpStale();
    if (!checkOnly) {
      writeFileSync(fallbackPath, content);
      writtenFiles.set(entry.file, content);
    }
    return;
  }
  if (existing === content) {
    reports.push({ file: entry.file, status: "SAME", detail: "matches regeneration from live source" });
    writtenFiles.set(entry.file, existing);
    return;
  }
  reports.push({ file: entry.file, status: "STALE", detail: "differs from regeneration from live source" });
  bumpStale();
  if (!checkOnly) {
    writeFileSync(fallbackPath, content);
    writtenFiles.set(entry.file, content);
  } else {
    writtenFiles.set(entry.file, existing); // --check leaves disk untouched
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

function currentIdentity(): ScrubIdentity {
  try {
    return { user: userInfo().username, host: osHostname() };
  } catch {
    return { user: process.env.USER ?? "", host: "" };
  }
}

function main(): void {
  const checkOnly = process.argv.includes("--check");
  const repoRoot = join(import.meta.dir, "..");
  const report = refresh({ repoRoot, home: homedir(), identity: currentIdentity(), checkOnly });

  console.log(`fallback refresh ${checkOnly ? "(check)" : "(write)"} — ${repoRoot}`);
  for (const r of report.entries) {
    console.log(`  ${r.status.padEnd(26)} ${r.file}  —  ${r.detail}`);
  }
  console.log(`  ${`BUNDLE-${report.bundle}`.padEnd(26)} server/lib/fallbacks.ts`);
  const staleTotal = report.staleCount + (report.bundle === "STALE" ? 1 : 0);
  if (staleTotal > 0 && checkOnly) {
    console.error(`\n${staleTotal} artifact(s) stale — run \`bun run fallbacks:refresh\` to update.`);
    process.exit(1);
  }
  console.log(`\ndone: ${report.entries.filter((r) => r.status === "SAME").length} same, ${report.staleCount} refreshed, ${report.entries.filter((r) => r.status.startsWith("SKIP")).length} skipped`);
}

if (import.meta.main) {
  main();
}
