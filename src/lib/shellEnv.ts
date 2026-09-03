/**
 * Shell Profiles & Environment shared model (HJ-698).
 *
 * Pure domain logic for the "shell-env" card: startup-sequence constants,
 * rc/export parsers, environment.d parsing, and the cross-shell parity
 * matrix. Imported by both the server card builder
 * (`server/lib/cardsData.ts`) and the client card component — no
 * filesystem or network access here, so it stays unit-testable and
 * Workers-safe.
 */

export interface ShellExport {
  key: string;
  value: string;
}

export interface ShellProfile {
  /** `export KEY=value` lines in file order. */
  exports: ShellExport[];
  /** Effective PATH precedence: first entry wins, `$PATH` token preserved. */
  path: string[];
}

export interface EnvDFile {
  file: string;
  vars: ShellExport[];
}

export interface StartupStage {
  file: string;
  when: string;
  /** True when the file is chezmoi-managed in this dotfiles repo. */
  managed: boolean;
  note: string;
}

export type ParityStatus = "shared" | "diverged" | "unique";

export interface ParityRow {
  key: string;
  zsh: string | null;
  bash: string | null;
  env: string | null;
  status: ParityStatus;
}

export type Provenance = "live" | "fallback";

export interface ShellEnvPayload {
  zshSource: Provenance;
  bashSource: Provenance;
  envSource: Provenance;
  zsh: ShellProfile;
  bash: ShellProfile;
  env: EnvDFile[];
  startup: { zsh: StartupStage[]; bash: StartupStage[] };
  warnings: string[];
}

export const EMPTY_PROFILE: ShellProfile = { exports: [], path: [] };

// ---------------------------------------------------------------------------
// Static startup sequences (shell-domain knowledge, not host reads)
// ---------------------------------------------------------------------------

export const STARTUP_ZSH: StartupStage[] = [
  { file: "/etc/zshenv", when: "always", managed: false, note: "System-wide environment; sourced for every zsh invocation." },
  { file: "~/.zshenv", when: "always", managed: false, note: "Per-user environment. Not managed by these dotfiles." },
  { file: "/etc/zprofile", when: "login shells", managed: false, note: "System login profile." },
  { file: "~/.zprofile", when: "login shells", managed: false, note: "Per-user login profile. Not managed by these dotfiles." },
  { file: "/etc/zshrc", when: "interactive shells", managed: false, note: "System interactive defaults." },
  {
    file: "~/.zshrc",
    when: "interactive shells",
    managed: true,
    note: "chezmoi dot_zshrc: starship init + failure recolor, mise activate, guarded zoxide/fzf/atuin/direnv hooks, zj/zp jumps, tool exports (RIPGREP_CONFIG_PATH, FZF_*).",
  },
  { file: "/etc/zlogin", when: "login shells", managed: false, note: "System login epilogue." },
  { file: "~/.zlogin", when: "login shells", managed: false, note: "Per-user login epilogue. Not managed by these dotfiles." },
];

export const STARTUP_BASH: StartupStage[] = [
  { file: "/etc/profile", when: "login shells", managed: false, note: "System-wide login profile." },
  {
    file: "~/.bash_profile",
    when: "login shells",
    managed: true,
    note: "chezmoi dot_bash_profile: sources ~/.bashrc, then prepends ~/.local/bin and loads cargo env.",
  },
  {
    file: "~/.bashrc",
    when: "interactive shells",
    managed: true,
    note: "chezmoi dot_bashrc: omarchy defaults, starship_precmd recolor, PATH, freetoken launcher, gcloud, guarded zoxide/fzf/atuin/direnv hooks.",
  },
  { file: "~/.config/environment.d/*.conf", when: "user session", managed: true, note: "systemd --user session environment (EDITOR, PAGER, MACHINE_NAME). Read before any shell starts." },
];

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/** Strip one layer of matching single/double quotes and unescape `\"` / `\\`. */
function unquote(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    const inner = t.slice(1, -1);
    return t.startsWith('"') ? inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\") : inner;
  }
  // Unquoted trailing ` # comment` is a shell comment; quoted values keep theirs.
  const hash = t.indexOf(" #");
  return hash === -1 ? t : t.slice(0, hash).trim();
}

/**
 * `export KEY=value` lines of an rc file, in file order. Bare assignments
 * (e.g. `local x=…` inside shell functions) are intentionally ignored — only
 * exported session environment is modeled.
 */
export function parseRcExports(content: string): ShellExport[] {
  const out: ShellExport[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out.push({ key: m[1], value: unquote(m[2] ?? "") });
  }
  return out;
}

/** Split a PATH-style value on `:`; empty segments are dropped. */
export function parsePathEntries(value: string): string[] {
  return value.split(":").map((s) => s.trim()).filter(Boolean);
}

/**
 * One `environment.d` conf file: `KEY=value` lines (no `export` keyword in
 * that format), comments and blanks skipped.
 */
export function parseEnvDFile(content: string): ShellExport[] {
  const out: ShellExport[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    out.push({ key: m[1], value: unquote(m[2] ?? "") });
  }
  return out;
}

/** Rewrite a leading home-directory literal (or `$HOME`) as `~` for display. */
export function normalizeHome(value: string, home: string): string {
  if (home && value.startsWith(home)) return `~${value.slice(home.length)}`;
  if (value.startsWith("$HOME")) return `~${value.slice("$HOME".length)}`;
  return value;
}

const SENSITIVE_KEY_RE = /token|secret|password|passwd|api[_-]?key|private|auth|credential/i;

/** Keys whose values must never be rendered (defense in depth for the UI). */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_RE.test(key);
}

/** Replace sensitive values with `<redacted>`; everything else passes through. */
export function redactSensitive(exports: ShellExport[]): ShellExport[] {
  return exports.map((e) => (isSensitiveKey(e.key) ? { key: e.key, value: "<redacted>" } : e));
}

/**
 * Build a ShellProfile from raw rc text: exports (sanitized for display)
 * plus the effective PATH precedence across every `export PATH=…` line in
 * file order, deduplicated keeping the first occurrence.
 */
export function rcProfile(content: string, home: string): ShellProfile {
  const exports = redactSensitive(
    parseRcExports(content).map((e) => ({ key: e.key, value: normalizeHome(e.value, home) })),
  );
  const seen = new Set<string>();
  const path: string[] = [];
  for (const e of exports) {
    if (e.key !== "PATH") continue;
    for (const entry of parsePathEntries(e.value)) {
      if (!seen.has(entry)) {
        seen.add(entry);
        path.push(entry);
      }
    }
  }
  return { exports, path };
}

/**
 * Cross-shell parity matrix over zsh exports, bash exports, and the merged
 * environment.d vars (first file wins per key). Sorted by key.
 */
export function buildParity(zsh: ShellProfile, bash: ShellProfile, env: EnvDFile[]): ParityRow[] {
  const find = (list: ShellExport[], key: string): string | null =>
    list.find((e) => e.key === key)?.value ?? null;

  const envMerged = new Map<string, string>();
  for (const f of env) {
    for (const v of f.vars) {
      if (!envMerged.has(v.key)) envMerged.set(v.key, v.value);
    }
  }

  const keys = new Set<string>([
    ...zsh.exports.map((e) => e.key),
    ...bash.exports.map((e) => e.key),
    ...envMerged.keys(),
  ]);

  const rows: ParityRow[] = [...keys].map((key) => {
    const z = find(zsh.exports, key);
    const b = find(bash.exports, key);
    const e = envMerged.get(key) ?? null;
    const present = [z, b, e].filter((v) => v !== null);
    const distinct = new Set(present);
    const status: ParityStatus =
      present.length >= 2 && distinct.size === 1
        ? "shared"
        : present.length >= 2
          ? "diverged"
          : "unique";
    return { key, zsh: z, bash: b, env: e, status };
  });
  rows.sort((a, b) => a.key.localeCompare(b.key));
  return rows;
}

/**
 * Parse the bundled `fallback/shell-env.json` snapshot. Returns null when the
 * content is not a well-formed snapshot so the caller can degrade to empty
 * sections instead of throwing (CFG-01: never throw on missing host config).
 */
export function parseShellEnvSnapshot(
  json: string,
): { zsh: ShellProfile; bash: ShellProfile; env: EnvDFile[] } | null {
  try {
    const parsed = JSON.parse(json) as {
      zsh?: { exports?: ShellExport[]; path?: string[] };
      bash?: { exports?: ShellExport[]; path?: string[] };
      env?: Array<{ file?: string; vars?: ShellExport[] }>;
    };
    if (!parsed || typeof parsed !== "object") return null;
    const profile = (p?: { exports?: ShellExport[]; path?: string[] }): ShellProfile => ({
      exports: Array.isArray(p?.exports)
        ? p.exports.filter((e) => typeof e?.key === "string" && typeof e?.value === "string")
        : [],
      path: Array.isArray(p?.path) ? p.path.filter((s): s is string => typeof s === "string") : [],
    });
    const env = Array.isArray(parsed.env)
      ? parsed.env
          .filter((f) => typeof f?.file === "string")
          .map((f) => ({
            file: f.file as string,
            vars: Array.isArray(f.vars)
              ? f.vars.filter((v) => typeof v?.key === "string" && typeof v?.value === "string")
              : [],
          }))
      : [];
    return { zsh: profile(parsed.zsh), bash: profile(parsed.bash), env };
  } catch {
    return null;
  }
}
