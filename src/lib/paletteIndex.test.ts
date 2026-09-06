import { describe, expect, it } from "bun:test";
import type { CardId, ManifestEntry } from "../manifest";
import type { CatalogueEntry } from "./catalogue";
import type { SearchIndexEntry } from "../../server/lib/searchIndex";
import { buildPaletteIndex, type ConfigPaletteEntry, type DemoPaletteEntry } from "./paletteIndex";

/**
 * HJ-725: buildPaletteIndex assembles the flat palette index from an
 * injected fixture catalogue/manifest/search-index — never the real
 * (generated) data, and never a fetch or filesystem read.
 */

const FIXTURE_CATALOGUE: CatalogueEntry[] = [
  { id: "starship" as CardId, category: "shell", route: "/shell#starship", word: "starship", lazy: false },
  { id: "hyprland" as CardId, category: "system", route: "/system#hyprland", word: "hyprland", lazy: true },
];

const FIXTURE_MANIFEST: ManifestEntry[] = [
  { id: "starship" as CardId, title: "Starship Prompt", blurb: "the real prompt, rendered inline", kind: "interactive" },
  { id: "hyprland" as CardId, title: "Hyprland Monitors", blurb: "monitor layout, live", kind: "live" },
];

const FIXTURE_SEARCH_INDEX: SearchIndexEntry[] = [
  { demoId: "starship", configPath: "~/.config/starship.toml", fallbackFile: "starship.toml", key: "add_newline", value: "true" },
  { demoId: "hyprland", configPath: "~/.config/hypr/monitors.lua", fallbackFile: "hypr-monitors.lua", key: "width", value: "3440" },
  // Orphaned: no catalogue entry for this demoId — must be dropped, not surfaced as a dead end.
  { demoId: "retired-demo", configPath: "~/.config/retired.toml", fallbackFile: "retired.toml", key: "x", value: "y" },
];

describe("buildPaletteIndex", () => {
  it("emits one demo entry per catalogue entry, titled from the manifest", () => {
    const index = buildPaletteIndex(FIXTURE_CATALOGUE, FIXTURE_MANIFEST, []);
    const demos = index.filter((e): e is DemoPaletteEntry => e.kind === "demo");
    expect(demos).toHaveLength(2);
    expect(demos.find((d) => d.demoId === "starship")?.label).toBe("Starship Prompt");
    expect(demos.find((d) => d.demoId === "hyprland")?.route).toBe("/system#hyprland");
  });

  it("falls back to the catalogue word when a demo has no manifest entry", () => {
    const index = buildPaletteIndex(FIXTURE_CATALOGUE, [], []);
    const demo = index.find((e): e is DemoPaletteEntry => e.kind === "demo" && e.demoId === "starship");
    expect(demo?.label).toBe("starship");
  });

  it("emits one config entry per search-index row, carrying the owning demo's route and category", () => {
    const index = buildPaletteIndex(FIXTURE_CATALOGUE, FIXTURE_MANIFEST, FIXTURE_SEARCH_INDEX);
    const configs = index.filter((e): e is ConfigPaletteEntry => e.kind === "config");
    expect(configs).toHaveLength(2); // the orphaned row is dropped
    const starshipSetting = configs.find((c) => c.key === "add_newline");
    expect(starshipSetting).toMatchObject({
      demoId: "starship",
      category: "shell",
      route: "/shell#starship",
      configPath: "~/.config/starship.toml",
      value: "true",
    });
  });

  it("drops config entries whose demoId is not reachable through the catalogue", () => {
    const index = buildPaletteIndex(FIXTURE_CATALOGUE, FIXTURE_MANIFEST, FIXTURE_SEARCH_INDEX);
    expect(index.some((e) => e.kind === "config" && (e.demoId as string) === "retired-demo")).toBe(false);
  });

  it("uses the real committed catalogue/manifest/search-index by default (no arguments)", () => {
    const index = buildPaletteIndex();
    expect(index.some((e) => e.kind === "demo" && e.demoId === "starship")).toBe(true);
    expect(index.some((e) => e.kind === "config")).toBe(true);
  });
});
