/**
 * Explorer manifest (D4 schema): every card declares its content strategy and,
 * where a config file backs the card, its CFG-01 data provenance — the live
 * host path consulted first plus the bundled fallback file served when the
 * live read fails. See `fallback/README.md` for per-file content strategy.
 */

export type CardId =
  | "starship"
  | "recolor"
  | "git-safety"
  | "lazygit"
  | "fuzzy"
  | "ghostty"
  | "ghostty-terminal"
  | "btop"
  | "mise"
  | "packages"
  | "hyprland"
  | "dots"
  | "neovim"
  | "ripgrep"
  | "herdr";

export type CardKind = "live" | "static" | "interactive" | "simulated";

/** Every bundled fallback file that exists under `/fallback`. */
export const FALLBACK_FILES = [
  "Brewfile",
  "btop.conf",
  "dots",
  "ghostty-config",
  "ghostty-theme.conf",
  "herdr-config.toml",
  "herdr-plugins.json",
  "hypr-monitors.lua",
  "lazygit.yml",
  "lazy-lock.json",
  "lazyvim.json",
  "mise.toml",
  "pacman.txt",
  "ripgrep-rc",
  "starship.toml",
] as const;

export type FallbackFile = (typeof FALLBACK_FILES)[number];

export interface ConfigSource {
  /**
   * Host path consulted first ("~/" resolves to the user's home). Derived
   * sources use a "derived:<command>" prefix instead of a filesystem path.
   */
  livePath: string;
  /** Bundled stand-in served when the live read fails (CFG-01 fallback). */
  fallbackFile: FallbackFile;
}

export interface ManifestEntry {
  id: CardId;
  title: string;
  blurb: string;
  kind: CardKind;
  /**
   * Data provenance for cards backed by config files. Required for
   * kind "live"; optional for interactive/static/simulated cards that also
   * render config content.
   */
  sources?: readonly ConfigSource[];
}

export const MANIFEST: ManifestEntry[] = [
  {
    id: "starship",
    title: "Starship Prompt",
    blurb: "The real prompt, rendered inline — drive the shell state and see it respond.",
    kind: "interactive",
    sources: [{ livePath: "~/.config/starship.toml", fallbackFile: "starship.toml" }],
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
    sources: [{ livePath: "~/.config/lazygit/config.yml", fallbackFile: "lazygit.yml" }],
  },
  {
    id: "fuzzy",
    title: "fzf · zoxide · atuin",
    blurb: "Fuzzy finding, smart cd, and shell history — simulated mini-demos.",
    kind: "simulated",
  },
  {
    id: "ghostty",
    title: "Omarchy Palette",
    blurb: "The dynamic 16-color ANSI palette plus truecolor background/foreground, generated per omarchy theme.",
    kind: "live",
    sources: [
      { livePath: "~/.config/ghostty/config", fallbackFile: "ghostty-config" },
      {
        livePath: "~/.local/state/omarchy/current/theme/ghostty.conf",
        fallbackFile: "ghostty-theme.conf",
      },
    ],
  },
  {
    id: "ghostty-terminal",
    title: "Ghostty Terminal",
    blurb: "Wayland epoll backend, CSI-u key protocol, padding, font, and keybinds from the ghostty config.",
    kind: "live",
    sources: [
      { livePath: "~/.config/ghostty/config", fallbackFile: "ghostty-config" },
    ],
  },
  {
    id: "btop",
    title: "System Monitor",
    blurb: "btop layout boxes, presets, theme, and process-monitoring settings.",
    kind: "live",
    sources: [
      { livePath: "~/.config/btop/btop.conf", fallbackFile: "btop.conf" },
    ],
  },
  {
    id: "mise",
    title: "mise Toolchains",
    blurb: "Declarative runtime versions managed by mise.",
    kind: "live",
    sources: [{ livePath: "~/.config/mise/config.toml", fallbackFile: "mise.toml" }],
  },
  {
    id: "packages",
    title: "Packages",
    blurb: "Homebrew Bundle manifest and explicit pacman packages.",
    kind: "live",
    sources: [
      { livePath: "~/Brewfile", fallbackFile: "Brewfile" },
      { livePath: "derived:pacman -Qe", fallbackFile: "pacman.txt" },
    ],
  },
  {
    id: "hyprland",
    title: "Hyprland Monitors",
    blurb: "The dual-monitor layout from monitors.lua, drawn to scale.",
    kind: "live",
    sources: [{ livePath: "~/.config/hypr/monitors.lua", fallbackFile: "hypr-monitors.lua" }],
  },
  {
    id: "dots",
    title: "Dots CLI",
    blurb: "A read-only trace of the ergonomic chezmoi wrapper: choose a command, inspect its handler, and preview a sanitized workflow.",
    kind: "live",
    sources: [{ livePath: "~/.local/bin/dots", fallbackFile: "dots" }],
  },
  {
    id: "neovim",
    title: "Neovim / LazyVim",
    blurb: "Enabled LazyVim extras and pinned plugin revisions.",
    kind: "live",
    sources: [
      { livePath: "~/.config/nvim/lazyvim.json", fallbackFile: "lazyvim.json" },
      { livePath: "~/.config/nvim/lazy-lock.json", fallbackFile: "lazy-lock.json" },
    ],
  },
  {
    id: "ripgrep",
    title: "ripgrep Defaults",
    blurb: "Flags loaded via RIPGREP_CONFIG_PATH on every search.",
    kind: "live",
    sources: [{ livePath: "~/.config/ripgrep/rc", fallbackFile: "ripgrep-rc" }],
  },
  {
    id: "herdr",
    title: "Herdr Agent Orchestration",
    blurb: "Multi-agent terminal workspace manager — keys, attention queue, and installed plugins.",
    kind: "live",
    sources: [
      { livePath: "~/.config/herdr/config.toml", fallbackFile: "herdr-config.toml" },
      { livePath: "~/.config/herdr/plugins.json", fallbackFile: "herdr-plugins.json" },
    ],
  },
];

export function getManifestEntry(id: CardId): ManifestEntry | undefined {
  return MANIFEST.find((entry) => entry.id === id);
}
