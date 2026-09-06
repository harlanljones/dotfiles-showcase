import { describe, expect, it } from "bun:test";
import type { CardId } from "../manifest";
import type { PaletteEntry } from "./paletteIndex";
import { searchPalette } from "./paletteSearch";

/**
 * HJ-725: searchPalette is a pure function over a fixture PaletteEntry[] —
 * no fetching, no filesystem access, no component state. It is the module
 * the acceptance criterion "search matching and ranking are tested against
 * a fixture index" points at.
 */

const FIXTURE_INDEX: PaletteEntry[] = [
  {
    kind: "demo",
    demoId: "starship" as CardId,
    category: "shell",
    route: "/shell#starship",
    label: "Starship Prompt",
    blurb: "the real prompt, rendered inline",
  },
  {
    kind: "demo",
    demoId: "hyprland" as CardId,
    category: "system",
    route: "/system#hyprland",
    label: "Hyprland Monitors",
    blurb: "monitor layout, live",
  },
  {
    kind: "config",
    demoId: "starship" as CardId,
    category: "shell",
    route: "/shell#starship",
    configPath: "~/.config/starship.toml",
    key: "add_newline",
    value: "true",
  },
  {
    kind: "config",
    demoId: "starship" as CardId,
    category: "shell",
    route: "/shell#starship",
    configPath: "~/.config/starship.toml",
    key: "directory.truncation_length",
    value: "2",
  },
  {
    kind: "config",
    demoId: "hyprland" as CardId,
    category: "system",
    route: "/system#hyprland",
    configPath: "~/.config/hypr/monitors.lua",
    key: "width",
    value: "3440",
  },
];

describe("searchPalette: empty/blank query", () => {
  it("returns no results for an empty or whitespace-only query", () => {
    expect(searchPalette(FIXTURE_INDEX, "")).toEqual([]);
    expect(searchPalette(FIXTURE_INDEX, "   ")).toEqual([]);
  });
});

describe("searchPalette: matches the showcase catalogue", () => {
  it("matches a demo by its label, case-insensitively", () => {
    const results = searchPalette(FIXTURE_INDEX, "STARSHIP");
    expect(results[0].entry.kind).toBe("demo");
    expect(results[0].entry).toMatchObject({ demoId: "starship" });
  });

  it("matches a demo by a substring of its blurb", () => {
    const results = searchPalette(FIXTURE_INDEX, "monitor layout");
    expect(results.some((r) => r.entry.kind === "demo" && r.entry.demoId === "hyprland")).toBe(true);
  });
});

describe("searchPalette: matches real configuration content", () => {
  it("matches a config entry by its setting key", () => {
    const results = searchPalette(FIXTURE_INDEX, "add_newline");
    expect(results[0].entry).toMatchObject({ kind: "config", key: "add_newline", demoId: "starship" });
  });

  it("matches a config entry by its setting value", () => {
    const results = searchPalette(FIXTURE_INDEX, "3440");
    expect(results[0].entry).toMatchObject({ kind: "config", key: "width", demoId: "hyprland" });
  });

  it("matches a config entry by a segment of its key path", () => {
    const results = searchPalette(FIXTURE_INDEX, "truncation");
    expect(results.some((r) => r.entry.kind === "config" && r.entry.key === "directory.truncation_length")).toBe(true);
  });

  it("returns no results when nothing matches", () => {
    expect(searchPalette(FIXTURE_INDEX, "nonexistent-setting-xyz")).toEqual([]);
  });
});

describe("searchPalette: ranking", () => {
  it("ranks an exact label match above a partial/blurb match", () => {
    // "starship" is an exact demo label match; it also appears nowhere else,
    // so this only exercises the exact-match bonus, not a tie-break.
    const results = searchPalette(FIXTURE_INDEX, "starship");
    expect(results[0].entry).toMatchObject({ kind: "demo", demoId: "starship" });
  });

  it("ranks a prefix match above a mid-string match", () => {
    const index: PaletteEntry[] = [
      { kind: "demo", demoId: "prefix-demo" as CardId, category: "shell", route: "/shell#p", label: "hypr land", blurb: "" },
      { kind: "demo", demoId: "midstring-demo" as CardId, category: "shell", route: "/shell#m", label: "omarchy hyprland", blurb: "" },
    ];
    const results = searchPalette(index, "hypr");
    expect(results[0].entry).toMatchObject({ demoId: "prefix-demo" });
  });

  it("breaks score ties alphabetically by label for stable ordering", () => {
    // Both labels hit via an identical `includes` match so scores tie exactly.
    const tied: PaletteEntry[] = [
      { kind: "demo", demoId: "b-demo" as CardId, category: "shell", route: "/shell#b", label: "xZetax", blurb: "" },
      { kind: "demo", demoId: "a-demo" as CardId, category: "shell", route: "/shell#a", label: "xAlphax", blurb: "" },
    ];
    const results = searchPalette(tied, "x");
    expect(results.map((r) => r.entry.kind === "demo" && r.entry.label)).toEqual(["xAlphax", "xZetax"]);
  });

  it("caps results at the given limit", () => {
    const many: PaletteEntry[] = Array.from({ length: 30 }, (_, i) => ({
      kind: "demo" as const,
      demoId: `demo-${i}` as CardId,
      category: "shell" as const,
      route: `/shell#demo-${i}`,
      label: `matching demo ${i}`,
      blurb: "",
    }));
    expect(searchPalette(many, "matching")).toHaveLength(25);
    expect(searchPalette(many, "matching", 5)).toHaveLength(5);
  });
});
