import { describe, expect, it } from "bun:test";
import { searchCorpus, type SearchCorpus } from "./search";

const CORPUS: SearchCorpus = {
  demos: [
    { id: "starship", word: "starship", title: "Starship Prompt", route: "/shell#starship" },
    { id: "ghostty", word: "ghostty", title: "Omarchy Palette", route: "/system#ghostty" },
    { id: "mise", word: "mise", title: "mise Toolchains", route: "/editor#mise" },
  ],
  configs: [
    {
      demoId: "starship",
      configPath: "~/.config/starship.toml",
      fallbackFile: "starship.toml",
      key: "directory.truncation_length",
      value: "2",
    },
    {
      demoId: "starship",
      configPath: "~/.config/starship.toml",
      fallbackFile: "starship.toml",
      key: "character.success_symbol",
      value: "[❯](bold cyan)",
    },
    {
      demoId: "mise",
      configPath: "~/.config/mise/config.toml",
      fallbackFile: "mise.toml",
      key: "tools.node",
      value: "24",
    },
  ],
};

describe("search: demo-name hits", () => {
  it("matches a demo on exact word", () => {
    const [hit] = searchCorpus(CORPUS, "starship");
    expect(hit?.kind).toBe("demo");
    expect(hit?.demoId).toBe("starship");
  });

  it("matches a demo on prefix and on title substring", () => {
    expect(searchCorpus(CORPUS, "star").some((r) => r.demoId === "starship")).toBe(true);
    expect(searchCorpus(CORPUS, "palette").some((r) => r.demoId === "ghostty")).toBe(true);
  });

  it("ranks an exact demo hit above config hits for the same query", () => {
    const results = searchCorpus(CORPUS, "mise");
    expect(results[0]?.kind).toBe("demo");
    expect(results[0]?.demoId).toBe("mise");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(searchCorpus(CORPUS, "  STARSHIP ").length).toBeGreaterThan(0);
  });
});

describe("search: configuration-content hits", () => {
  it("matches a setting on exact key", () => {
    const [hit] = searchCorpus(CORPUS, "tools.node");
    expect(hit?.kind).toBe("config");
    expect(hit?.demoId).toBe("mise");
  });

  it("matches on key prefix and key substring", () => {
    expect(searchCorpus(CORPUS, "tools.").some((r) => r.kind === "config")).toBe(true);
    expect(searchCorpus(CORPUS, "truncation").some((r) => r.kind === "config")).toBe(true);
  });

  it("matches on value and on config path content", () => {
    expect(searchCorpus(CORPUS, "bold cyan").some((r) => r.kind === "config")).toBe(true);
    expect(searchCorpus(CORPUS, "mise/config").every((r) => r.kind === "config")).toBe(true);
  });

  it("maps every config hit back to the demo that renders it", () => {
    for (const hit of searchCorpus(CORPUS, "starship.toml")) {
      expect(hit.kind).toBe("config");
      expect(hit.demoId).toBe("starship");
    }
  });
});

describe("search: result shape", () => {
  it("returns no results for empty or blank queries", () => {
    expect(searchCorpus(CORPUS, "")).toEqual([]);
    expect(searchCorpus(CORPUS, "   ")).toEqual([]);
  });

  it("returns no results when nothing matches", () => {
    expect(searchCorpus(CORPUS, "zzz-no-such-setting")).toEqual([]);
  });

  it("caps results at the requested limit, best first", () => {
    const results = searchCorpus(CORPUS, "a", 2);
    expect(results.length).toBeLessThanOrEqual(2);
    const untruncated = searchCorpus(CORPUS, "a");
    expect(results[0]).toEqual(untruncated[0]);
  });
});
