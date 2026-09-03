import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  FALLBACK_FILES,
  MANIFEST,
  getManifestEntry,
  type ManifestEntry,
} from "./manifest";

const FALLBACK_DIR = join(import.meta.dir, "..", "fallback");

function sourcesOf(entry: ManifestEntry) {
  return entry.sources ?? [];
}

describe("manifest schema (D4)", () => {
  it("enumerates every required Explorer card with unique ids", () => {
    const ids = MANIFEST.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "starship",
      "recolor",
      "git-safety",
      "lazygit",
      "fuzzy",
      "ghostty",
      "mise",
      "packages",
      "hyprland",
      "dots",
      "neovim",
      "ripgrep",
      "herdr",
      "shell-env",
    ]);
  });

  it("requires live cards to declare at least one config source", () => {
    for (const entry of MANIFEST) {
      if (entry.kind === "live") {
        expect(sourcesOf(entry).length, `${entry.id} needs sources`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("declares well-formed provenance on every declared source", () => {
    for (const entry of MANIFEST) {
      for (const source of sourcesOf(entry)) {
        expect(source.livePath.length, `${entry.id} livePath`).toBeGreaterThan(0);
        expect(FALLBACK_FILES).toContain(source.fallbackFile);
        // Host paths use the ~/ convention; derived sources are prefixed.
        expect(
          source.livePath.startsWith("~/") || source.livePath.startsWith("derived:"),
          `${entry.id} livePath convention: ${source.livePath}`,
        ).toBe(true);
      }
    }
  });

  it("references only fallback files that actually exist on disk", () => {
    const onDisk = new Set(readdirSync(FALLBACK_DIR));
    for (const entry of MANIFEST) {
      for (const source of sourcesOf(entry)) {
        expect(onDisk.has(source.fallbackFile), `${source.fallbackFile} exists`).toBe(true);
      }
    }
  });

  it("leaves no bundled fallback file orphaned", () => {
    const referenced = new Set(MANIFEST.flatMap((e) => sourcesOf(e).map((s) => s.fallbackFile)));
    for (const file of FALLBACK_FILES) {
      expect(referenced.has(file), `${file} is referenced by some card`).toBe(true);
    }
    const onDisk = new Set(readdirSync(FALLBACK_DIR));
    for (const file of FALLBACK_FILES) {
      expect(onDisk.has(file), `${file} exists on disk`).toBe(true);
    }
  });
});

describe("manifest accessors", () => {
  it("looks entries up by id and returns undefined for unknown ids", () => {
    expect(getManifestEntry("ghostty")?.title).toContain("Ghostty");
    expect(getManifestEntry("nonexistent" as never)).toBeUndefined();
  });

  it("exposes multi-source cards with their full provenance list", () => {
    const ghostty = getManifestEntry("ghostty");
    expect(ghostty?.sources?.map((s) => s.fallbackFile)).toEqual([
      "ghostty-config",
      "ghostty-theme.conf",
    ]);
  });
});
