import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { FALLBACKS } from "./fallbacks";
import { isWorkerd } from "./runtime";

export interface ConfigResult {
  /** "live" = read from the host filesystem; "fallback" = bundled copy. */
  source: "live" | "fallback";
  content: string;
}

/**
 * `os.homedir()` throws/returns undefined under workerd's nodejs_compat.
 * Never call it at module top level; guard every use.
 */
function safeHomedir(): string {
  try {
    return homedir() ?? "";
  } catch {
    return "";
  }
}

/** Bun-only `import.meta.dir`; absent on workerd. Computed lazily, cached. */
let cachedFallbackDir: string | null | undefined;
function fallbackDir(): string | null {
  if (cachedFallbackDir === undefined) {
    try {
      const dir = (import.meta as unknown as { dir?: string }).dir;
      cachedFallbackDir = dir ? join(dir, "..", "..", "fallback") : null;
    } catch {
      cachedFallbackDir = null;
    }
  }
  return cachedFallbackDir;
}

/**
 * The user's home directory. Honors DOTFILES_SHOWCASE_HOME so tests can point
 * live-config resolution at an empty sandbox; defaults to the OS home.
 */
export function userHome(): string {
  return process.env.DOTFILES_SHOWCASE_HOME || safeHomedir();
}

/** Join path segments under the user's home directory. */
export function homePath(...segments: string[]): string {
  return join(userHome(), ...segments);
}

/**
 * Read the first existing live path; otherwise return a bundled fallback copy.
 * Never throws in the steady state — a missing host config degrades to the
 * fallback (hard gate in AGENTS.md §6).
 *
 * On workerd (Cloudflare Workers) there is no host filesystem, so live reads
 * are skipped entirely and the embedded FALLBACKS bundle is used (ADR-001).
 */
export function readConfig(
  livePaths: string | string[],
  fallbackName: string,
): ConfigResult {
  const candidates = Array.isArray(livePaths) ? livePaths : [livePaths];

  // On Bun, try live host paths first (local-first fidelity).
  if (!isWorkerd()) {
    for (const p of candidates) {
      try {
        if (existsSync(p)) return { source: "live", content: readFileSync(p, "utf8") };
      } catch {
        // unreadable candidate — try the next one / the fallback
      }
    }
  }

  // Fallback: prefer the embedded bundle (works on both Bun and workerd),
  // then try fs for the fallback/ directory (Bun local), never throw.
  const embedded = FALLBACKS[fallbackName];
  if (embedded !== undefined) {
    return { source: "fallback", content: embedded };
  }
  const dir = !isWorkerd() ? fallbackDir() : null;
  if (dir) {
    try {
      return { source: "fallback", content: readFileSync(join(dir, fallbackName), "utf8") };
    } catch {
      // fall through
    }
  }
  return { source: "fallback", content: "" };
}
