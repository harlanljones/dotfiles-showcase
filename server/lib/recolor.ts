// Recolor logic that mirrors the two starship failure wrappers in the dotfiles.
//
// zsh (dot_zshrc:18-24): replace the cyan escape `36m` with red `31m` for the
//   exact 8 documented style-prefix variants only. Cyan-only.
// bash (dot_bashrc:29-34): recolor ALL foreground colors (30|32|33|34|35|36|
//   37|90|92|93|94|95|96|97) to red `31m`, preserving any leading `[0-9;]*`
//   prefix. Not cyan-only.
//
// The real wrappers only match 8-color escapes. Truecolor (`38;2;r;g;b`) is NOT
// recolored by either shell — see AGENTS.md §5a (the playground forces
// `true_color = false` so this code path is what actually runs).

export type ShellMode = "zsh" | "bash";

// The 8 style-prefix variants from dot_zshrc starship_status_prompt.
const ZSH_PREFIXES = ["", "1;", "2;", "3;", "1;2;", "1;3;", "2;3;", "1;2;3;"];

const ANSI = "\x1b[";

export function recolor(text: string, shell: ShellMode = "zsh"): string {
  if (shell === "bash") {
    return text.replace(
      /\x1b\[([0-9;]*)(30|32|33|34|35|36|37|90|92|93|94|95|96|97)m/g,
      (_match, prefix: string) => `${ANSI}${prefix}31m`,
    );
  }

  // zsh: cyan-only, exactly the 8 documented variants.
  let out = text;
  for (const prefix of ZSH_PREFIXES) {
    const re = new RegExp(`\\x1b\\[${prefix}36m`, "g");
    out = out.replace(re, `${ANSI}${prefix}31m`);
  }
  return out;
}

export interface FailureColorOptions {
  status: number;
  shell?: ShellMode;
}

// No-op when the previous command succeeded; otherwise apply the recolor.
export function applyFailureColor(
  text: string,
  { status, shell = "zsh" }: FailureColorOptions,
): string {
  if (status === 0) return text;
  return recolor(text, shell);
}
