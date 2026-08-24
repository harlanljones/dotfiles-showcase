export type CardId =
  | "starship"
  | "recolor"
  | "git-safety"
  | "lazygit"
  | "fuzzy"
  | "ghostty"
  | "mise"
  | "packages"
  | "hyprland"
  | "neovim"
  | "ripgrep";

export type CardKind = "live" | "static" | "interactive" | "simulated";

export interface ManifestEntry {
  id: CardId;
  title: string;
  blurb: string;
  kind: CardKind;
}

/**
 * Explorer manifest (D4 schema): every entry declares its data strategy.
 * "live" cards fetch /api/cards/<id> (server reads ~/.config with bundled
 * fallback); "interactive" cards call the live API; "simulated" cards run
 * client-side mock demos for TUI-only tools; "static" cards are pure content.
 */
export const MANIFEST: ManifestEntry[] = [
  {
    id: "starship",
    title: "Starship Prompt",
    blurb: "Module layout of the real prompt; drive it in the Playground.",
    kind: "interactive",
  },
  {
    id: "recolor",
    title: "Failure Recolor",
    blurb: "zsh recolors cyan only; bash recolors every foreground color to red.",
    kind: "interactive",
  },
  {
    id: "git-safety",
    title: "Git Safety Guardrails",
    blurb: "How each coding agent is blocked from committing or pushing.",
    kind: "static",
  },
  {
    id: "lazygit",
    title: "lazygit + Ollama Commits",
    blurb: "Ctrl+G generates the commit message with a local LLM.",
    kind: "live",
  },
  {
    id: "fuzzy",
    title: "fzf · zoxide · atuin",
    blurb: "Fuzzy finding, smart cd, and shell history — simulated mini-demos.",
    kind: "simulated",
  },
  {
    id: "ghostty",
    title: "Ghostty Theme",
    blurb: "Font, keybinds, and the omarchy dynamic palette.",
    kind: "live",
  },
  {
    id: "mise",
    title: "mise Toolchains",
    blurb: "Declarative runtime versions managed by mise.",
    kind: "live",
  },
  {
    id: "packages",
    title: "Packages",
    blurb: "Homebrew Bundle manifest and explicit pacman packages.",
    kind: "live",
  },
  {
    id: "hyprland",
    title: "Hyprland Monitors",
    blurb: "The dual-monitor layout from monitors.lua, drawn to scale.",
    kind: "live",
  },
  {
    id: "neovim",
    title: "Neovim / LazyVim",
    blurb: "Enabled LazyVim extras and pinned plugin revisions.",
    kind: "live",
  },
  {
    id: "ripgrep",
    title: "ripgrep Defaults",
    blurb: "Flags loaded via RIPGREP_CONFIG_PATH on every search.",
    kind: "live",
  },
];
