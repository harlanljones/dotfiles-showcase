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
    name: "ghostty-terminal",
    live: {
      source: "live",
      fontFamily: "JetBrainsMono Nerd Font",
      fontStyle: "Regular",
      fontSize: 9,
      paddingX: 14,
      paddingY: 14,
      windowTheme: "ghostty",
      asyncBackend: "epoll",
      cursorStyle: "block",
      cursorBlink: false,
      shellIntegration: ["no-cursor", "ssh-env"],
      scrollMultiplier: 0.95,
      confirmClose: "false",
      resizeOverlay: "never",
      keybinds: ["shift+insert=paste_from_clipboard"],
      csiExamples: ["shift+enter=csi:13;2u"],
      themeRef: "~/.local/state/omarchy/current/theme/ghostty.conf",
    },
    fallback: {
      source: "fallback",
      fontFamily: "JetBrainsMono Nerd Font",
      fontStyle: "Regular",
      fontSize: 9,
      paddingX: 14,
      paddingY: 14,
      windowTheme: "ghostty",
      asyncBackend: "epoll",
      cursorStyle: "block",
      cursorBlink: false,
      shellIntegration: ["no-cursor", "ssh-env"],
      scrollMultiplier: 0.95,
      confirmClose: "false",
      resizeOverlay: "never",
      keybinds: [],
      csiExamples: [],
      themeRef: "~/.local/state/omarchy/current/theme/ghostty.conf",
    },
  },
  {
    name: "btop",
    live: {
      source: "live",
      settings: {
        color_theme: '"current"',
        theme_background: "true",
        truecolor: "true",
        presets: '"cpu:1:default,proc:0:default cpu:0:default,mem:0:default,net:0:default"',
        vim_keys: "true",
        graph_symbol: '"braille"',
        shown_boxes: '"cpu mem net proc"',
        update_ms: "2000",
        proc_sorting: '"cpu lazy"',
      },
      order: ["color_theme", "theme_background", "truecolor", "presets", "vim_keys", "graph_symbol", "shown_boxes", "update_ms", "proc_sorting"],
    },
    fallback: {
      source: "fallback",
      settings: {
        color_theme: '"current"',
        truecolor: "true",
        shown_boxes: '"cpu mem net proc"',
        update_ms: "2000",
      },
      order: ["color_theme", "truecolor", "shown_boxes", "update_ms"],
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
  {
    name: "herdr",
    live: {
      configSource: "live",
      pluginsSource: "live",
      config: {
        prefix: "ctrl+space",
        theme: "terminal",
        accent: "blue",
        agentPanelSort: "priority",
        resumeAgents: true,
        worktreesDir: "~/.herdr/worktrees",
        supportedAgents: ["claude", "cursor"],
        keyCommands: [
          {
            key: "prefix+l",
            type: "plugin_action",
            command: "harlan.corral.toggle",
            description: "Toggle Linear panel",
          },
        ],
        agentKeybinds: [
          { action: "next_agent", key: "alt+shift+down" },
          { action: "previous_agent", key: "alt+shift+up" },
        ],
      },
      plugins: [
        {
          id: "harlan.corral",
          name: "Corral",
          version: "0.1.0",
          minHerdrVersion: "0.8.0",
          description: "Dispatch Linear issues to agent panes",
          enabled: true,
          platforms: ["linux", "macos"],
          actions: [{ id: "toggle", title: "Toggle Linear panel" }],
          sourceKind: "local",
        },
      ],
      rawConfig: "onboarding = false\n",
      rawPlugins: "[]\n",
    },
    fallback: {
      configSource: "fallback",
      pluginsSource: "fallback",
      config: {
        prefix: "ctrl+space",
        theme: "terminal",
        accent: "blue",
        agentPanelSort: "priority",
        resumeAgents: true,
        worktreesDir: "~/.herdr/worktrees",
        supportedAgents: ["claude"],
        keyCommands: [],
        agentKeybinds: [],
      },
      plugins: [],
      rawConfig: "# Fallback snapshot: herdr-config.toml.\n",
      rawPlugins: "[]\n",
    },
  },
];
