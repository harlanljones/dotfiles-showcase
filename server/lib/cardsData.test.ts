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
      neovim: ["extrasSource", "lockSource", "extras", "plugins"],
      ripgrep: ["source", "flags"],
      lazygit: ["source", "content"],
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
