// Recolor logic that mirrors the two starship failure wrappers in the dotfiles.
//
// zsh (dot_zshrc:18-24): replace the cyan escape `36m` with red `31m` for the
//   exact 8 documented style-prefix variants only. Cyan-only.
// bash (dot_bashrc:29-34): recolor ALL foreground colors (30|32|33|34|35|36|
//   37|90|92|93|94|95|96|97) to red `31m`, preserving any leading `[0-9;]*`
//   prefix. Not cyan-only.
//
// The real wrappers only match 8-color escapes. Truecolor (`38;2;r;g;b`) is NOT
// recolored by either shell in the shipped dotfiles — see AGENTS.md §5a (the
// playground forces `true_color = false` so the 8-color code path is what runs).
//
// TC-01 (HJ-431) adds an OPT-IN truecolor path below, gated behind `trueColor`.
// It is a *proposed-fix preview* of the dotfiles amendment, not current behavior:
// it matches the palette's cyan `38;2;r;g;b` and remaps it to the palette's red,
// preserving each shell's semantics (zsh: cyan-only; bash: all-foreground→red).

export type ShellMode = "zsh" | "bash";

// The exact palette cyan/red a truecolor recolor targets. Supplied by the caller
// (derived from the served starship palette) so the matcher stays faithful to the
// theme's cyan rather than guessing a hard-coded RGB.
export interface TrueColor {
  cyan: [number, number, number];
  red: [number, number, number];
}

// The 8 style-prefix variants from dot_zshrc starship_status_prompt.
const ZSH_PREFIXES = ["", "1;", "2;", "3;", "1;2;", "1;3;", "2;3;", "1;2;3;"];

const ANSI = "\x1b[";

// Truecolor foreground SGR: an optional `[0-9;]*` prefix (style attrs like 1;),
// then `38;2;` followed by exactly r;g;b. Background (`48;2;`) is excluded so we
// never recolor unrelated truecolor sequences.
const TRUECOLOR_FG = /^([0-9;]*)38;2;(\d{1,3});(\d{1,3});(\d{1,3})$/;

export function recolor(
  text: string,
  shell: ShellMode = "zsh",
  trueColor?: TrueColor,
): string {
  if (shell === "bash") {
    // 8-color recolor always applies (preserves the shipped behavior).
    let out = text.replace(
      /\x1b\[([0-9;]*)(30|32|33|34|35|36|37|90|92|93|94|95|96|97)m/g,
      (_match, prefix: string) => `${ANSI}${prefix}31m`,
    );
    // TC-01 opt-in: also recolor truecolor foreground (all-foreground→red).
    if (trueColor) {
      out = out.replace(
        /\x1b\[([0-9;]*)38;2;(\d{1,3});(\d{1,3});(\d{1,3})m/g,
        (_m, prefix: string) => `${ANSI}${prefix}38;2;${trueColor.red.join(";")}m`,
      );
    }
    return out;
  }

  // zsh: cyan-only, exactly the 8 documented variants (8-color path).
  let out = text;
  for (const prefix of ZSH_PREFIXES) {
    const re = new RegExp(`\\x1b\\[${prefix}36m`, "g");
    out = out.replace(re, `${ANSI}${prefix}31m`);
  }
  // TC-01 opt-in: also recolor the palette cyan truecolor `38;2;...`,
  // preserving every documented style prefix. Cyan-only.
  if (trueColor) {
    const [cr, cg, cb] = trueColor.cyan;
    for (const prefix of ZSH_PREFIXES) {
      const re = new RegExp(`\\x1b\\[${prefix}38;2;${cr};${cg};${cb}m`, "g");
      out = out.replace(re, `${ANSI}${prefix}38;2;${trueColor.red.join(";")}m`);
    }
  }
  return out;
}

export interface FailureColorOptions {
  status: number;
  shell?: ShellMode;
  /** TC-01 opt-in: recolor truecolor (`38;2;r;g;b`) cyan→red. Proposed-fix preview. */
  trueColor?: TrueColor;
}

export interface SgrSpan {
  /** Byte offset of the escape in the original string. */
  offset: number;
  /** The exact escape matched, e.g. `"\x1b[1;36m"`. */
  raw: string;
  /** The SGR param string before the trailing `m`, e.g. `"1;36"`. */
  params: string;
  /** Whether this escape was recolored. */
  recolored: boolean;
  /** What it became after recolor (identical to raw when not recolored). */
  after: string;
  /** Machine-readable reason for the verdict. */
  reason:
    | "zsh:cyan-variant"
    | "bash:fg-to-red"
    | "bash:tail-256"
    | "bash:tail-truecolor"
    | "untouched:not-cyan"
    | "untouched:prefix-not-in-zsh-list"
    | "untouched:truecolor-tail"
    | "untouched:truecolor-not-cyan"
    | "untouched:truecolor-bg"
    | "untouched:256color-tail"
    | "untouched:no-fg-code"
    | "untouched:non-sgr"
    | "zsh:truecolor-cyan"
    | "bash:truecolor-fg-to-red";
}

const ZSH_SET = new Set(ZSH_PREFIXES);
const BASH_FG = new Set(["30", "32", "33", "34", "35", "36", "37", "90", "92", "93", "94", "95", "96", "97"]);

// True ordering matters: we must recognise extended color tails so the bash
// regex's tail-match does not get misattributed. Real wrappers only intend
// 8-color escapes; the bash one happens to claw the tail of 38;5;* / 38;2;*.

function classifySgr(
  params: string,
  shell: ShellMode,
  trueColor?: TrueColor,
): { recolored: boolean; after: string; reason: SgrSpan["reason"] } {
  // TC-01 truecolor path: remap the palette cyan `38;2;r;g;b` to the palette
  // red. Only active when the caller opts in (the proposed-fix preview). When
  // absent, the original 8-color-only logic below runs untouched.
  if (trueColor) {
    const m = params.match(TRUECOLOR_FG);
    if (m) {
      const prefix = m[1];
      const r = Number(m[2]);
      const g = Number(m[3]);
      const b = Number(m[4]);
      const isCyan = r === trueColor.cyan[0] && g === trueColor.cyan[1] && b === trueColor.cyan[2];
      const red = trueColor.red.join(";");
      if (shell === "bash") {
        return { recolored: true, after: `${prefix}38;2;${red}`, reason: "bash:truecolor-fg-to-red" };
      }
      if (isCyan) {
        return { recolored: true, after: `${prefix}38;2;${red}`, reason: "zsh:truecolor-cyan" };
      }
      return { recolored: false, after: params, reason: "untouched:truecolor-not-cyan" };
    }
    // A background truecolor (`48;2;...`) is not a foreground recolor target;
    // leave it untouched so the ledger matches recolor() (which ignores it).
    if (/^48;2;/.test(params)) {
      return { recolored: false, after: params, reason: "untouched:truecolor-bg" };
    }
  }

  if (/^38;5;/.test(params)) {
    const tail = params.split(";").pop() ?? "";
    if (BASH_FG.has(tail) && shell === "bash") {
      const prefix = params.slice(0, params.length - tail.length);
      return { recolored: true, after: `${prefix}31`, reason: "bash:tail-256" };
    }
    return { recolored: false, after: params, reason: "untouched:256color-tail" };
  }
  if (/^38;2;/.test(params) || /^48;2;/.test(params) || /^48;5;/.test(params)) {
    const tail = params.split(";").pop() ?? "";
    if (BASH_FG.has(tail) && shell === "bash") {
      const prefix = params.slice(0, params.length - tail.length);
      return { recolored: true, after: `${prefix}31`, reason: "bash:tail-truecolor" };
    }
    return { recolored: false, after: params, reason: "untouched:truecolor-tail" };
  }

  // Regular SGR: split on ; and look for a foreground code.
  const parts = params.split(";");
  // Find the last fg code — the wrappers' regex anchors on the final code before m.
  let fgIndex = -1;
  let fgCode = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    if (BASH_FG.has(parts[i])) {
      fgIndex = i;
      fgCode = parts[i];
      break;
    }
  }
  if (fgIndex === -1) return { recolored: false, after: params, reason: "untouched:no-fg-code" };

  if (shell === "bash") {
    const after = [...parts.slice(0, fgIndex), "31", ...parts.slice(fgIndex + 1)].join(";");
    // Preserve empty-prefix case correctly (join handles it).
    return { recolored: true, after, reason: "bash:fg-to-red" };
  }

  // zsh: only cyan (36) and only the 8 documented prefixes.
  if (fgCode !== "36") return { recolored: false, after: params, reason: "untouched:not-cyan" };
  const prefix = fgIndex === 0 ? "" : parts.slice(0, fgIndex).join(";") + ";";
  if (!ZSH_SET.has(prefix)) return { recolored: false, after: params, reason: "untouched:prefix-not-in-zsh-list" };
  const after = prefix + "31";
  return { recolored: true, after, reason: "zsh:cyan-variant" };
}

/**
 * Single-pass ledger for a string: what recolor() would do, per escape.
 * Faithful to both wrappers — `recolor(text, shell)` must equal
 * `applyLedger(text, explainRecolor(text, shell).spans)`.
 */
export function explainRecolor(
  text: string,
  shell: ShellMode = "zsh",
  trueColor?: TrueColor,
): { output: string; spans: SgrSpan[] } {
  const spans: SgrSpan[] = [];
  let output = "";
  let last = 0;
  const re = /\x1b\[([0-9;]*)m/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const params = m[1];
    output += text.slice(last, m.index);
    const cls = classifySgr(params, shell, trueColor);
    const after = `${ANSI}${cls.after}m`;
    spans.push({ offset: m.index, raw, params, recolored: cls.recolored, after, reason: cls.reason });
    output += cls.recolored ? after : raw;
    last = m.index + raw.length;
  }
  output += text.slice(last);
  return { output, spans };
}

// No-op when the previous command succeeded; otherwise apply the recolor.
export function applyFailureColor(
  text: string,
  { status, shell = "zsh", trueColor }: FailureColorOptions,
): string {
  if (status === 0) return text;
  return recolor(text, shell, trueColor);
}
