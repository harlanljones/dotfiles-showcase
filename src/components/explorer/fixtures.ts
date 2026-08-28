/**
 * Shared card payloads for render-parity (render.test.tsx) and axe a11y
 * (tests/axe.test.tsx) suites. Payloads mirror the API shapes built by
 * server/lib/cardsData.ts for live and fallback provenance.
 */

export type Payload = Record<string, unknown>;

export interface FetcherCase {
  name: string;
  live: Payload;
  fallback: Payload;
}

export const FETCHERS: FetcherCase[] = [
  {
    name: "dots",
    live: {
      source: "live",
      commands: [{
        name: "status",
        aliases: ["st"],
        description: "Show state of managed files",
        effect: "read",
        handler: "cmd_status",
        handlerSource: "cmd_status() {\n  chezmoi status\n}",
      }],
      warnings: [],
    },
    fallback: {
      source: "fallback",
      commands: [{
        name: "status",
        aliases: ["st"],
        description: "Show state of managed files",
        effect: "read",
        handler: "cmd_status",
        handlerSource: "cmd_status() {\n  chezmoi status\n}",
      }],
      warnings: ["Live dots source was unavailable."],
    },
  },
  {
    name: "lazygit",
    live: { source: "live", content: "customCommands:\n  - key: '<c-g>'\n" },
    fallback: { source: "fallback", content: "customCommands:\n" },
  },
  {
    name: "ghostty",
    live: {
      mainSource: "live",
      themeSource: "live",
      fontFamily: "JetBrainsMono Nerd Font",
      fontSize: 9,
      keybinds: ["shift+insert=paste_from_clipboard"],
      theme: { background: "#060912", foreground: "#959aa4", palette: { "0": "#0d0f16" } },
    },
    fallback: {
      mainSource: "fallback",
      themeSource: "fallback",
      fontFamily: "JetBrainsMono Nerd Font",
      fontSize: 9,
      keybinds: [],
      theme: { background: "#060912", foreground: "#959aa4", palette: {} },
    },
  },
  {
    name: "mise",
    live: { source: "live", tools: [["bun", "latest"]] },
    fallback: { source: "fallback", tools: [["node", "22"]] },
  },
  {
    name: "packages",
    live: { brewSource: "live", formulae: ["age"], casks: [], pacmanSource: "live", pacman: ["age"] },
    fallback: {
      brewSource: "fallback",
      formulae: ["age"],
      casks: [],
      pacmanSource: "fallback",
      pacman: ["age"],
    },
  },
  {
    name: "hyprland",
    live: {
      source: "live",
      gdkScale: 1,
      monitors: [{ output: "DP-1", mode: "3440x1440", position: "0x0", scale: 1 }],
    },
    fallback: { source: "fallback", gdkScale: null, monitors: [] },
  },
  {
    name: "neovim",
    live: {
      extrasSource: "live",
      lockSource: "live",
      extras: ["lang.typescript"],
      plugins: [["blink.cmp", "abc1234"]],
    },
    fallback: {
      extrasSource: "fallback",
      lockSource: "fallback",
      extras: [],
      plugins: [],
    },
  },
  {
    name: "ripgrep",
    live: { source: "live", flags: ["--smart-case"] },
    fallback: { source: "fallback", flags: ["--smart-case"] },
  },
];
