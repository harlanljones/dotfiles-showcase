import { Hono } from "hono";
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { readConfig } from "../lib/configs";
import { applyFailureColor, explainRecolor, type SgrSpan, type ShellMode } from "../lib/recolor";
import { ansiToHtml } from "../lib/ansi";
import { loadGhosttyTheme } from "../lib/theme";
import { buildTempRepo, type PromptState } from "../lib/tempRepo";

const LIVE_CONFIG = join(homedir(), ".config", "starship.toml");

// Serve a copy of the live starship.toml with true_color forced OFF so the
// dotfiles' 8-color recolor code (36m -> 31m) demonstrably applies. See
// AGENTS.md §5a. Truecolor TTYs are a known limitation, surfaced in the UI.
function servedConfigPath(): string {
  const { content: live } = readConfig(LIVE_CONFIG, "starship.toml");
  const forced =
    live.replace(/^\s*true_color\s*=.*$/m, "") + "\ntrue_color = false\n";
  const tmp = join(tmpdir(), `starship-showcase-served-${process.pid}-${randomUUID()}.toml`);
  writeFileSync(tmp, forced);
  return tmp;
}

export interface RenderResult {
  ansi: string;
  html: string;
  rawAnsi?: string;
  rawHtml?: string;
  spans?: SgrSpan[];
  state: PromptState;
  theme: { background: string; foreground: string; source: "live" | "fallback" };
  /** Non-fatal degradations the UI should surface (e.g. missing shell binary). */
  warnings?: string[];
}

// starship executes custom-module commands through the binary named by
// STARSHIP_SHELL (verified v1.26.0: it spawns `$STARSHIP_SHELL -c` twice per
// custom module — once for `when`, once for `command`). If that binary is
// missing on this host, custom modules silently vanish (e.g. the git_dirty
// glyph). Wrapping style itself is invisible in our HTML (we strip \[ \] and
// %{ %}), so when the requested shell is not installed we fall back to an
// installed shell for EXECUTION only — keeping the visible render faithful to
// the target machine while surfacing the degradation.
function resolveExecShell(requested: ShellMode): { exec: ShellMode; warning?: string } {
  if (Bun.which(requested)) return { exec: requested };
  const fallback: ShellMode = requested === "zsh" ? "bash" : "zsh";
  const warning =
    `This host has no '${requested}' binary, so starship cannot execute its ` +
    `custom modules (${requested === "zsh" ? "hadrian" : "augustus"}'s native shell). ` +
    `Falling back to invisible '${fallback}' execution; the rendered prompt still ` +
    `matches what the ${requested} machine shows. Install '${requested}' for full fidelity.`;
  return Bun.which(fallback)
    ? { exec: fallback, warning }
    : { exec: requested, warning: warning + ` ('${fallback}' is also missing.)` };
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
  const { exec, warning } = resolveExecShell(shell);
  let configPath: string | undefined;
  try {
    configPath = servedConfigPath();
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      STARSHIP_CONFIG: configPath,
      // Match the TARGET machine's shell so starship renders and executes
      // exactly as that machine does (augustus=bash, hadrian=zsh). If that
      // binary is missing on this host we fall back for execution only
      // (see resolveExecShell); the recolor below still follows the
      // requested machine's dotfile algorithm.
      STARSHIP_SHELL: exec,
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
    const theme = loadGhosttyTheme();
    const rawHtml = ansiToHtml(ansi, { palette: theme.palette });
    const html = ansiToHtml(recolored, { palette: theme.palette });
    const spans = state.status !== 0 ? explainRecolor(ansi, shell).spans : [];
    return {
      ansi: recolored,
      html,
      rawAnsi: ansi,
      rawHtml,
      spans,
      state,
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        source: theme.source,
      },
      ...(warning ? { warnings: [warning] } : {}),
    };
  } finally {
    repo.cleanup();
    if (configPath) {
      try {
        unlinkSync(configPath);
      } catch {
        // The render result is already complete; a missing temp file is safe.
      }
    }
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
