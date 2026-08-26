import { Hono } from "hono";
import { spawnSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homePath, readConfig } from "../lib/configs";
import { applyFailureColor, explainRecolor, type SgrSpan, type ShellMode, type TrueColor } from "../lib/recolor";
import { ansiToHtml } from "../lib/ansi";
import { loadGhosttyTheme } from "../lib/theme";
import { buildTempRepo, type PromptState } from "../lib/tempRepo";
import { isWorkerd } from "../lib/runtime";

// TC-01 proposed-fix preview palette. When the user opts into truecolor, the
// served config forces `true_color = true` and defines a palette whose `cyan`
// resolves to this exact RGB, so starship emits `38;2;46;222;250` for cyan
// styles — which the recolor then remaps to the palette `red`. The matcher uses
// these same RGBs, keeping generation and detection consistent by construction.
const TC_CYAN: [number, number, number] = [46, 222, 250];
const TC_RED: [number, number, number] = [255, 102, 92];
const TC_TRUECOLOR: TrueColor = { cyan: TC_CYAN, red: TC_RED };

// The real `starship` binary only emits 8-color `36m` when spawned without a
// truecolor TTY (e.g. via spawnSync). To preview the proposed truecolor
// recolor we elevate the binary's 8-color FOREGROUND escapes to their `38;2`
// RGB equivalents — cyan maps to the exact TC cyan so the real recolor logic
// (recolor.ts) demonstrably transforms it. The prompt CONTENT still comes from
// the real binary (no faking); only the color encoding is translated.
const ANSI8_FG_RGB: Record<string, string> = {
  "30": "0;0;0", "31": "170;0;0", "32": "0;170;0", "33": "170;85;0",
  "34": "0;0;170", "35": "170;0;170", "36": TC_CYAN.join(";"), "37": "170;170;170",
  "90": "85;85;85", "91": "255;85;85", "92": "85;255;85", "93": "255;255;85",
  "94": "85;85;255", "95": "255;85;255", "96": TC_CYAN.join(";"), "97": "255;255;255",
};
function elevateToTrueColor(ansi: string): string {
  return ansi.replace(
    /\x1b\[((?:\d+;)*)(30|31|32|33|34|35|36|37|90|91|92|93|94|95|96|97)m/g,
    (_m, prefix: string, code: string) => `\x1b[${prefix}38;2;${ANSI8_FG_RGB[code]}m`,
  );
}

// Serve a copy of the live starship.toml. By default true_color is forced OFF so
// the dotfiles' 8-color recolor code (36m -> 31m) demonstrably applies. See
// AGENTS.md §5a. When `trueColor` is requested (TC-01 preview), force it ON and
// define a palette so cyan renders as truecolor `38;2;...` for the proposed fix.
function servedConfigPath(trueColor = false): string {
  const { content: live } = readConfig(homePath(".config", "starship.toml"), "starship.toml");
  const stripped = live
    .replace(/^\s*true_color\s*=.*$/m, "")
    .replace(/^\s*palette\s*=.*$/m, "");
  const forced = trueColor
    ? stripped +
      '\ntrue_color = true\npalette = "tc_preview"\n[palettes.tc_preview]\ncyan = "#2EDEFA"\nred = "#FF665C"\n'
    : stripped + "\ntrue_color = false\n";
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
  /** True when this result is the Workers degraded snapshot (no real binary). */
  degraded?: boolean;
  /** TC-01: true when the render used the truecolor proposed-fix preview. */
  trueColor?: boolean;
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
  const bun = (globalThis as unknown as { Bun?: { which: (bin: string) => string | null } }).Bun;
  const which = (bin: string) => {
    try {
      return bun?.which(bin) ?? null;
    } catch {
      return null;
    }
  };
  if (which(requested)) return { exec: requested };
  const fallback: ShellMode = requested === "zsh" ? "bash" : "zsh";
  const warning =
    `This host has no '${requested}' binary, so starship cannot execute its ` +
    `custom modules (${requested === "zsh" ? "hadrian" : "augustus"}'s native shell). ` +
    `Falling back to invisible '${fallback}' execution; the rendered prompt still ` +
    `matches what the ${requested} machine shows. Install '${requested}' for full fidelity.`;
  return which(fallback)
    ? { exec: fallback, warning }
    : { exec: requested, warning: warning + ` ('${fallback}' is also missing.)` };
}

/**
 * Workers degraded snapshot: no starship binary, no temp repo, no fs-host.
 * Builds a plausible ANSI prompt from the requested state so the recolor
 * playground still demonstrates zsh vs bash transformations. Uses the
 * committed fallback starship.toml string for provenance (ADR-001).
 */
export function renderDegradedStarship(input: PromptState): RenderResult {
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
    trueColor: input.trueColor,
  };
  const shell: ShellMode = input.shell === "bash" ? "bash" : "zsh";
  const trueColor = state.trueColor ? TC_TRUECOLOR : undefined;

  // Build a representative ANSI prompt that mirrors the fallback starship.toml
  // layout: directory + git_branch + git_status + custom.git_dirty + git_commit + character.
  // Use 8-color 36m (cyan) escapes so recolor demonstrably applies, per AGENTS.md §5a.
  // In truecolor preview mode, emit the palette cyan as `38;2;46;222;250` instead.
  const cyan = trueColor ? `\x1b[38;2;${TC_CYAN.join(";")}m` : "\x1b[36m";
  const dimCyan = trueColor ? `\x1b[2;38;2;${TC_CYAN.join(";")}m` : "\x1b[2;36m";
  const boldCyan = trueColor ? `\x1b[1;38;2;${TC_CYAN.join(";")}m` : "\x1b[1;36m";
  const reset = "\x1b[0m";
  const dir = state.ssh ? `at hadrian ${cyan}~/dotfiles${reset}` : `${cyan}~/dotfiles${reset}`;
  const branchPart = state.detached
    ? `${dimCyan}(detached abc1234)${reset}`
    : `${boldCyan} ${state.branch}${reset}`;
  const dirtyPart = state.dirty ? `${cyan}✗${reset}` : "";
  const aheadPart = state.ahead ? `${cyan}⇡${state.ahead}${reset}` : "";
  const behindPart = state.behind ? `${cyan}⇣${state.behind}${reset}` : "";
  const statePart = state.state === "rebase" ? `${cyan}(rebase 1/1)${reset}` : state.state === "merge" ? `${cyan}(merge)${reset}` : "";
  const char = state.status !== 0 ? `${cyan}❯${reset}` : `${boldCyan}❯${reset}`;

  const rawAnsi = `${dir} ${branchPart}${dirtyPart}${aheadPart}${behindPart}${statePart} ${char} `;
  const recolored = applyFailureColor(rawAnsi, { status: state.status ?? 0, shell, trueColor });
  const theme = loadGhosttyTheme();
  const rawHtml = ansiToHtml(rawAnsi, { palette: theme.palette });
  const html = ansiToHtml(recolored, { palette: theme.palette });
  const spans = state.status !== 0 ? explainRecolor(rawAnsi, shell, trueColor).spans : [];

  return {
    ansi: recolored,
    html,
    rawAnsi,
    rawHtml,
    spans,
    state,
    theme: {
      background: theme.background,
      foreground: theme.foreground,
      source: theme.source,
    },
    degraded: true,
    trueColor: !!trueColor,
    warnings: [
      "Starship binary unavailable on this edge runtime — showing a degraded snapshot from fallback/starship.toml with recolor applied. Run `bun run dev` locally for the live binary.",
    ],
  };
}

// Build a temp repo for the requested state, run the REAL starship binary, and
// apply the exact failure recolor. No faking, no precomputed output.
// On workerd (Workers) the binary/filesystem are unavailable — degrade early
// to the embedded snapshot (never call buildTempRepo/spawnSync). See ADR-001 §5b.
export function renderStarship(input: PromptState): RenderResult {
  if (isWorkerd()) {
    return renderDegradedStarship(input);
  }

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
    trueColor: input.trueColor,
  };

  const repo = buildTempRepo(state);
  const shell: ShellMode = input.shell === "bash" ? "bash" : "zsh";
  const { exec, warning } = resolveExecShell(shell);
  let configPath: string | undefined;
  try {
    configPath = servedConfigPath(state.trueColor);
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
    // Preview: elevate the real binary's 8-color output to `38;2` so the
    // truecolor recolor has something to transform (the binary can't emit
    // truecolor without a truecolor TTY; see elevateToTrueColor).
    const previewAnsi = state.trueColor ? elevateToTrueColor(ansi) : ansi;
    const trueColor = state.trueColor ? TC_TRUECOLOR : undefined;
    const recolored = applyFailureColor(previewAnsi, {
      status: state.status ?? 0,
      shell,
      trueColor,
    });
    const theme = loadGhosttyTheme();
    const rawHtml = ansiToHtml(previewAnsi, { palette: theme.palette });
    const html = ansiToHtml(recolored, { palette: theme.palette });
    const spans = state.status !== 0 ? explainRecolor(previewAnsi, shell, trueColor).spans : [];
    return {
      ansi: recolored,
      html,
      rawAnsi: previewAnsi,
      rawHtml,
      spans,
      state,
      trueColor: !!trueColor,
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
