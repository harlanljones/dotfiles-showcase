import { describe, expect, it } from "bun:test";
import {
  parseBrewfile,
  parseGhosttyConfig,
  parseGhosttyTheme,
  parseHyprMonitors,
  parseLazyLock,
  parseLazyvimExtras,
  parseListFile,
  parseMiseTools,
  parseHerdrConfig,
  parseHerdrPlugins,
  parseSkillFrontmatter,
  parseAgentSkillsCategories,
  parseAgentSkillsSnapshot,
  parseGitConfig,
  summarizeGitSigning,
  splitGitconfigFallback,
  gitValue,
} from "./cardsData";

describe("parseMiseTools", () => {
  it("parses the [tools] table with quoted and bare keys", () => {
    const tools = parseMiseTools(`# comment
[tools]
bun = "latest"
"npm:playwright" = "latest"
python = '3.12.13'
[other]
ignore = "me"
`);
    expect(tools).toEqual([
      ["bun", "latest"],
      ["npm:playwright", "latest"],
      ["python", "3.12.13"],
    ]);
  });
});

describe("parseGhosttyTheme", () => {
  it("extracts background, foreground and the 16-color palette", () => {
    const theme = parseGhosttyTheme(`background = #060912
foreground = #959aa4
palette = 0=#0d0f16
palette = 1=#b16371
`);
    expect(theme.background).toBe("#060912");
    expect(theme.foreground).toBe("#959aa4");
    expect(theme.palette["0"]).toBe("#0d0f16");
    expect(theme.palette["1"]).toBe("#b16371");
  });

  it("tolerates a theme with no palette", () => {
    const theme = parseGhosttyTheme("background = #000000\n");
    expect(theme.background).toBe("#000000");
    expect(Object.keys(theme.palette)).toHaveLength(0);
  });
});

describe("parseGhosttyConfig", () => {
  it("extracts font, keybinds and the dynamic theme reference", () => {
    const main = parseGhosttyConfig(`config-file = ?"~/.local/state/omarchy/current/theme/ghostty.conf"
font-family = "JetBrainsMono Nerd Font"
font-size = 9
keybind = shift+insert=paste_from_clipboard
keybind = control+insert=copy_to_clipboard
`);
    expect(main.themeRef).toBe("~/.local/state/omarchy/current/theme/ghostty.conf");
    expect(main.fontFamily).toBe("JetBrainsMono Nerd Font");
    expect(main.fontSize).toBe(9);
    expect(main.keybinds).toHaveLength(2);
  });
});

describe("parseHyprMonitors", () => {
  it("parses omarchy lua monitor entries and the GDK scale", () => {
    const layout = parseHyprMonitors(`local omarchy_gdk_scale = 1
hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))
hl.monitor({ output = "DP-1", mode = "3840x2160@60", position = "0x0", scale = 1.6 })
hl.monitor({ output = "DP-2", mode = "2560x1440@240", position = "3840x360", scale = 1.25 })
`);
    expect(layout.gdkScale).toBe(1);
    expect(layout.monitors).toEqual([
      { output: "DP-1", mode: "3840x2160@60", position: "0x0", scale: 1.6 },
      { output: "DP-2", mode: "2560x1440@240", position: "3840x360", scale: 1.25 },
    ]);
  });

  it("parses monitors regardless of field order", () => {
    const layout = parseHyprMonitors(`hl.monitor({ scale = 1.25, position = "3840x360", mode = "2560x1440@240", output = "DP-2" })`);
    expect(layout.monitors).toEqual([
      { output: "DP-2", mode: "2560x1440@240", position: "3840x360", scale: 1.25 },
    ]);
  });

  it("ignores extra unknown fields and quoted scale instead of dropping the monitor", () => {
    const layout = parseHyprMonitors(`hl.monitor({ vrr = 1, output = "DP-1", bitdepth = 10, mode = "3840x2160@60", scale = "1.6" })`);
    expect(layout.monitors).toEqual([
      { output: "DP-1", mode: "3840x2160@60", position: "", scale: 1.6 },
    ]);
  });

  it("parses the documented DP-1/DP-2 fallback snapshot identically", () => {
    const layout = parseHyprMonitors(`local omarchy_gdk_scale = 1
hl.env("GDK_SCALE", tostring(omarchy_gdk_scale))
-- Secondary: 32" 4K 60Hz on the left
hl.monitor({ output = "DP-1", mode = "3840x2160@60", position = "0x0", scale = 1.6 })
-- Primary: 27" 2K 240Hz on the right, centered at same height as 4K monitor
hl.monitor({ output = "DP-2", mode = "2560x1440@240", position = "3840x360", scale = 1.25 })`);
    expect(layout.gdkScale).toBe(1);
    expect(layout.monitors).toEqual([
      { output: "DP-1", mode: "3840x2160@60", position: "0x0", scale: 1.6 },
      { output: "DP-2", mode: "2560x1440@240", position: "3840x360", scale: 1.25 },
    ]);
  });

  it("returns an empty layout for unrecognized content", () => {
    expect(parseHyprMonitors("nothing here")).toEqual({ gdkScale: null, monitors: [] });
  });
});

describe("parseBrewfile", () => {
  it("splits formulae from casks and ignores comments", () => {
    const list = parseBrewfile(`# header
brew "age"
brew "fzf"
cask "ghostty"
`);
    expect(list.formulae).toEqual(["age", "fzf"]);
    expect(list.casks).toEqual(["ghostty"]);
  });
});

describe("parseListFile", () => {
  it("skips blanks and comments", () => {
    expect(parseListFile("# c\n\n--smart-case\n--follow\n")).toEqual([
      "--smart-case",
      "--follow",
    ]);
  });
});

describe("parseLazyvimExtras / parseLazyLock", () => {
  it("reads extras arrays from lazyvim.json", () => {
    const extras = parseLazyvimExtras(
      `{"extras":["lazyvim.plugins.extras.lang.typescript"],"version":8}`,
    );
    expect(extras).toEqual(["lazyvim.plugins.extras.lang.typescript"]);
  });

  it("truncates commits to 7 chars in lazy-lock.json", () => {
    const plugins = parseLazyLock(
      `{"LazyVim":{"branch":"main","commit":"c10948c50b18fae7f256433afdef09e432410480"}}`,
    );
    expect(plugins).toEqual([["LazyVim", "c10948c"]]);
  });

  it("returns empty results for invalid JSON", () => {
    expect(parseLazyvimExtras("{oops")).toEqual([]);
    expect(parseLazyLock("{oops")).toEqual([]);
  });
});

describe("parseHerdrPlugins", () => {
  it("extracts plugin metadata, actions, and source repo", () => {
    const json = JSON.stringify([
      {
        plugin_id: "test.plugin",
        name: "Test Plugin",
        version: "1.0.0",
        min_herdr_version: "0.8.0",
        description: "A test plugin for herdr",
        enabled: true,
        platforms: ["linux"],
        actions: [{ id: "act1", title: "Action One", description: "Desc" }],
        source: { kind: "github", owner: "test", repo: "plugin" },
      },
    ]);
    const plugins = parseHerdrPlugins(json);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe("test.plugin");
    expect(plugins[0].name).toBe("Test Plugin");
    expect(plugins[0].version).toBe("1.0.0");
    expect(plugins[0].minHerdrVersion).toBe("0.8.0");
    expect(plugins[0].enabled).toBe(true);
    expect(plugins[0].actions).toEqual([{ id: "act1", title: "Action One", description: "Desc" }]);
    expect(plugins[0].sourceRepo).toBe("test/plugin");
  });

  it("handles empty or invalid JSON gracefully", () => {
    expect(parseHerdrPlugins("not valid json")).toEqual([]);
    expect(parseHerdrPlugins("{}")).toEqual([]);
  });
});

describe("parseHerdrConfig", () => {
  it("extracts prefix, theme, agent settings, key commands, and supported agents", () => {
    const toml = `
prefix = "ctrl+space"

[theme]
name = "terminal"

[ui]
accent = "blue"
agent_panel_sort = "priority"

[session]
resume_agents_on_restore = true

[worktrees]
directory = "~/.herdr/worktrees"

[keys]
previous_agent = "alt+shift+up"
next_agent = "alt+shift+down"

[[keys.command]]
key = "prefix+l"
type = "plugin_action"
command = "harlan.corral.toggle"
description = "Toggle Linear panel"

[ui.sidebar.agents.rows_by_agent]
claude = [["agent"]]
codex = [["agent"]]
`;
    const cfg = parseHerdrConfig(toml);
    expect(cfg.prefix).toBe("ctrl+space");
    expect(cfg.theme).toBe("terminal");
    expect(cfg.accent).toBe("blue");
    expect(cfg.agentPanelSort).toBe("priority");
    expect(cfg.resumeAgents).toBe(true);
    expect(cfg.worktreesDir).toBe("~/.herdr/worktrees");
    expect(cfg.supportedAgents).toEqual(["claude", "codex"]);
    expect(cfg.agentKeybinds).toEqual([
      { action: "previous_agent", key: "alt+shift+up" },
      { action: "next_agent", key: "alt+shift+down" },
    ]);
    expect(cfg.keyCommands).toEqual([
      {
        key: "prefix+l",
        type: "plugin_action",
        command: "harlan.corral.toggle",
        description: "Toggle Linear panel",
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Manifest-driven builders (D4 wiring)
// ---------------------------------------------------------------------------

import { buildCard, cardKeys } from "./cardsData";
import { MANIFEST } from "../../src/manifest";

/** Every *source / *Source field in a card payload must be live|fallback. */
function sourceFields(data: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(data).filter(
    ([key, value]) =>
      (key === "source" || key.endsWith("Source")) && typeof value !== "object",
  );
}

describe("cards: manifest-driven builders", () => {
  it("serves exactly the manifest's live cards", () => {
    const expected = MANIFEST.filter((e) => e.kind === "live").map((e) => e.id).sort();
    expect([...cardKeys()].sort()).toEqual(expected);
  });

  it("builds every card with valid provenance fields", () => {
    for (const key of cardKeys()) {
      const data = buildCard(key) as Record<string, unknown> | undefined;
      expect(data, `${key} builds`).toBeDefined();
      for (const [field, value] of sourceFields(data ?? {})) {
        expect(
          value === "live" || value === "fallback",
          `${key}.${field} = ${String(value)}`,
        ).toBe(true);
      }
    }
  });

  it("keeps each card's payload shape stable", () => {
    const shapes: Record<string, string[]> = {
      ghostty: ["mainSource", "themeSource", "fontFamily", "fontSize", "keybinds", "theme"],
      mise: ["source", "tools"],
      packages: ["brewSource", "formulae", "casks", "pacmanSource", "pacman"],
      hyprland: ["source", "gdkScale", "monitors"],
      dots: ["source", "commands", "warnings"],
      neovim: ["extrasSource", "lockSource", "extras", "plugins"],
      ripgrep: ["source", "flags"],
      lazygit: ["source", "content"],
      herdr: ["configSource", "pluginsSource", "config", "plugins", "rawConfig", "rawPlugins"],
      "agent-skills": ["source", "skills", "harnesses"],
      "git-core": ["source", "ignoresSource", "user", "signing", "aliases", "policies", "credentialHelpers", "safeDirs", "ignores", "rawConfig"],
    };
    for (const [key, fields] of Object.entries(shapes)) {
      const data = buildCard(key) as Record<string, unknown>;
      for (const field of fields) {
        expect(field in data, `${key}.${field} present`).toBe(true);
      }
    }
  });

  it("returns undefined for unknown keys", () => {
    expect(buildCard("nonexistent")).toBeUndefined();
  });
});

describe("parseSkillFrontmatter", () => {
  it("extracts name and description from the YAML frontmatter", () => {
    const front = parseSkillFrontmatter(`---
name: tdd
description: Test-driven development. Use when the user wants red-green-refactor.
---

# Test-Driven Development
`);
    expect(front).toEqual({
      name: "tdd",
      description: "Test-driven development. Use when the user wants red-green-refactor.",
    });
  });

  it("returns empty fields when no frontmatter block exists", () => {
    expect(parseSkillFrontmatter("# No frontmatter here\n")).toEqual({ name: "", description: "" });
  });

  it("strips YAML block-scalar indicators from folded descriptions", () => {
    const front = parseSkillFrontmatter(`---
name: autopilot
description: >-
  Keep a PR merge-ready by triaging comments.
---

# Autopilot
`);
    expect(front).toEqual({
      name: "autopilot",
      description: "Keep a PR merge-ready by triaging comments.",
    });
  });
});

describe("parseAgentSkillsCategories", () => {
  const yaml = `agentSkills:
  portableLocal:
    - dots
    - frontier-sweep
  packs:
    mattpocock:
      repo: mattpocock/skills
      skills:
        - tdd
        - triage
    supabase:
      repo: supabase/agent-skills
      skills: [supabase, supabase-postgres-best-practices]
  sharedExtras:
    - name: omarchy
      sourcePath: /usr/share/omarchy/default/agents/skills/omarchy
  impeccableProviders:
    - name: claude
      skillPath: .claude/skills/impeccable/SKILL.md
`;
  it("maps block lists, inline flow lists, portable locals and shared extras", () => {
    const map = parseAgentSkillsCategories(yaml);
    expect(map.get("dots")).toBe("local");
    expect(map.get("tdd")).toBe("mattpocock");
    expect(map.get("supabase")).toBe("supabase");
    expect(map.get("supabase-postgres-best-practices")).toBe("supabase");
    expect(map.get("omarchy")).toBe("shared");
    expect(map.has("claude")).toBe(false);
    expect(map.has("impeccable")).toBe(false);
  });
});

describe("parseAgentSkillsSnapshot", () => {
  it("parses the bundled snapshot shape and drops malformed rows", () => {
    const skills = parseAgentSkillsSnapshot(
      JSON.stringify({
        skills: [
          { name: "tdd", description: "d", category: "mattpocock", harnesses: ["claude", 42] },
          { name: "", description: "nameless" },
          "not-an-object",
        ],
      }),
    );
    expect(skills).toEqual([
      { name: "tdd", description: "d", category: "mattpocock", harnesses: ["claude"] },
    ]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parseAgentSkillsSnapshot("nope{")).toEqual([]);
  });
});

describe("parseGitConfig", () => {
  const sample = `[alias]
\tco = checkout
[credential "https://github.com"]
\thelper =
\thelper = !/usr/bin/gh auth git-credential
[user]
\tname = Example User
[commit]
\tverbose = true           # Include diff
`;
  it("parses sections, subsections and repeated keys", () => {
    const sections = parseGitConfig(sample);
    expect(sections.map((s) => s.section)).toEqual([
      "alias",
      'credential "https://github.com"',
      "user",
      "commit",
    ]);
    expect(gitValue(sections, "alias", "co")).toBe("checkout");
    expect(gitValue(sections, "user", "name")).toBe("Example User");
    const helpers = sections
      .find((s) => s.section.startsWith("credential"))!
      .entries.find(([k]) => k === "helper")!;
    expect(helpers[1]).toEqual(["", "!/usr/bin/gh auth git-credential"]);
  });

  it("summarizes signing posture and detects an unset state", () => {
    const signing = summarizeGitSigning(parseGitConfig(sample));
    expect(signing).toEqual({
      commitGpgsign: null,
      tagGpgsign: null,
      gpgFormat: null,
      gpgProgram: null,
      signingKeySet: false,
    });
    const signed = summarizeGitSigning(
      parseGitConfig("[commit]\n\tgpgsign = true\n[gpg]\n\tformat = ssh\n\tprogram = /usr/bin/op-ssh-sign\n[user]\n\tsigningkey = ssh-ed25519 AAAA\n"),
    );
    expect(signed.commitGpgsign).toBe("true");
    expect(signed.gpgFormat).toBe("ssh");
    expect(signed.gpgProgram).toBe("/usr/bin/op-ssh-sign");
    expect(signed.signingKeySet).toBe(true);
  });
});

describe("splitGitconfigFallback", () => {
  it("splits the ignore snapshot past the marker", () => {
    const split = splitGitconfigFallback("[user]\n\tname = Example User\n\n# --- global ignores snapshot (live source: ~/.config/git/ignore) ---\n#i **/.claude/settings.local.json\n#i .DS_Store\n");
    expect(split.configText).toContain("[user]");
    expect(split.configText).not.toContain("#i");
    expect(split.ignorePatterns).toEqual(["**/.claude/settings.local.json", ".DS_Store"]);
  });

  it("returns the whole content when no marker is present", () => {
    const split = splitGitconfigFallback("[user]\n");
    expect(split.ignorePatterns).toEqual([]);
  });
});
