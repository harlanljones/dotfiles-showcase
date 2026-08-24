import { Hono } from "hono";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../lib/configs";
import { applyFailureColor, type ShellMode } from "../lib/recolor";
import { ansiToHtml } from "../lib/ansi";
import { buildTempRepo, type PromptState } from "../lib/tempRepo";

const LIVE_CONFIG = join(homedir(), ".config", "starship.toml");

// Serve a copy of the live starship.toml with true_color forced OFF so the
// dotfiles' 8-color recolor code (36m -> 31m) demonstrably applies. See
// AGENTS.md §5a. Truecolor TTYs are a known limitation, surfaced in the UI.
function servedConfigPath(): string {
  const { content: live } = readConfig(LIVE_CONFIG, "starship.toml");
  const forced =
    live.replace(/^\s*true_color\s*=.*$/m, "") + "\ntrue_color = false\n";
  const tmp = join(tmpdir(), "starship-showcase-served.toml");
  writeFileSync(tmp, forced);
  return tmp;
}

export interface RenderResult {
  ansi: string;
  html: string;
  state: PromptState;
}

// Build a temp repo for the requested state, run the REAL starship binary, and
// apply the exact failure recolor. No faking, no precomputed output.
export function renderStarship(input: PromptState): RenderResult {
  const state: PromptState = {
    branch: input.branch ?? "main",
    dirty: !!input.dirty,
    ahead: Math.max(0, Math.min(999, input.ahead ?? 0)),
    behind: Math.max(0, Math.min(999, input.behind ?? 0)),
    detached: !!input.detached,
    state: input.state ?? "none",
    width: input.width ?? 200,
    ssh: !!input.ssh,
    status: input.status ?? 0,
    durationMs: Math.max(0, input.durationMs ?? 0),
  };

  const repo = buildTempRepo(state);
  const shell: ShellMode = input.shell === "bash" ? "bash" : "zsh";
  try {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      STARSHIP_CONFIG: servedConfigPath(),
      COLUMNS: String(state.width),
    };
    if (state.ssh) {
      env.SSH_CONNECTION = "10.0.0.2 22 10.0.0.9 22";
    }

    const res = spawnSync(
      "starship",
      [
        "prompt",
        "--status",
        String(state.status),
        "--cmd-duration",
        String(state.durationMs),
        "--jobs",
        "0",
        "--keymap=",
        "--terminal-width",
        String(state.width),
      ],
      { cwd: repo.path, env, encoding: "utf8" },
    );

    if (!res.stdout && res.error) {
      throw new Error(`starship execution failed: ${res.error.message}`);
    }

    const ansi = res.stdout ?? "";
    const recolored = applyFailureColor(ansi, {
      status: state.status ?? 0,
      shell,
    });
    return { ansi: recolored, html: ansiToHtml(recolored), state };
  } finally {
    repo.cleanup();
  }
}

export const starshipApp = new Hono();

starshipApp.post("/starship", async (c) => {
  try {
    const body = await c.req.json<PromptState>();
    const result = renderStarship(body);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});
