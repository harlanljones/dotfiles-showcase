import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ConfigResult {
  /** "live" = read from the host filesystem; "fallback" = bundled copy. */
  source: "live" | "fallback";
  content: string;
}

const FALLBACK_DIR = join(import.meta.dir, "..", "..", "fallback");

/** Join path segments under the user's home directory. */
export function homePath(...segments: string[]): string {
  return join(homedir(), ...segments);
}

/**
 * Read the first existing live path; otherwise return a bundled fallback copy.
 * Never throws in the steady state — a missing host config degrades to the
 * fallback (hard gate in AGENTS.md §6).
 */
export function readConfig(
  livePaths: string | string[],
  fallbackName: string,
): ConfigResult {
  const candidates = Array.isArray(livePaths) ? livePaths : [livePaths];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return { source: "live", content: readFileSync(p, "utf8") };
    } catch {
      // unreadable candidate — try the next one / the fallback
    }
  }
  return { source: "fallback", content: readFileSync(join(FALLBACK_DIR, fallbackName), "utf8") };
}
