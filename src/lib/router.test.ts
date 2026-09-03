import { describe, expect, it } from "bun:test";
import { CATALOGUE, cardPath } from "./catalogue";
import { parseRoute, getRoutePath } from "./router";

describe("parseRoute: category routes", () => {
  it("defaults / and empty string to system", () => {
    expect(parseRoute("/", "")).toMatchObject({ category: "system" });
    expect(parseRoute("", "")).toMatchObject({ category: "system" });
  });

  it("maps /system, /shell, /editor, /agents to their respective category views", () => {
    expect(parseRoute("/system", "")).toMatchObject({ category: "system" });
    expect(parseRoute("/shell", "")).toMatchObject({ category: "shell" });
    expect(parseRoute("/editor", "")).toMatchObject({ category: "editor" });
    expect(parseRoute("/agents", "")).toMatchObject({ category: "agents" });
  });

  it("is case-insensitive and trims trailing slashes", () => {
    expect(parseRoute("/System/", "")).toMatchObject({ category: "system" });
    expect(parseRoute("/SHELL", "")).toMatchObject({ category: "shell" });
    expect(parseRoute("/Editor/", "")).toMatchObject({ category: "editor" });
    expect(parseRoute("/AGENTS/", "")).toMatchObject({ category: "agents" });
  });

  it("falls back to system for unknown paths", () => {
    expect(parseRoute("/unknown", "")).toMatchObject({ category: "system" });
    expect(parseRoute("/shell/extra", "")).toMatchObject({ category: "system" });
  });
});

describe("parseRoute: URL hash deep-linking (/<category>#<cardId>)", () => {
  it("parses hash deep-links for each category", () => {
    expect(parseRoute("/system", "#hyprland")).toMatchObject({
      category: "system",
      targetCard: "hyprland",
    });
    expect(parseRoute("/shell", "#starship")).toMatchObject({
      category: "shell",
      targetCard: "starship",
    });
    expect(parseRoute("/editor", "#neovim")).toMatchObject({
      category: "editor",
      targetCard: "neovim",
    });
    expect(parseRoute("/agents", "#herdr")).toMatchObject({
      category: "agents",
      targetCard: "herdr",
    });
  });

  it("handles leading hash slash like #/starship", () => {
    expect(parseRoute("/shell", "#/starship")).toMatchObject({
      category: "shell",
      targetCard: "starship",
    });
  });

  it("rejects unknown card ids as targetCard", () => {
    expect(parseRoute("/shell", "#nonexistent").targetCard).toBeUndefined();
    expect(parseRoute("/system", "#fakecard").targetCard).toBeUndefined();
  });
});

describe("parseRoute: backwards-compatibility aliases", () => {
  it("maps legacy room paths to their category and card", () => {
    expect(parseRoute("/prompt", "")).toMatchObject({ category: "shell", targetCard: "starship" });
    expect(parseRoute("/starship", "")).toMatchObject({ category: "shell", targetCard: "starship" });
    expect(parseRoute("/palette", "")).toMatchObject({ category: "system", targetCard: "ghostty" });
    expect(parseRoute("/ghostty", "")).toMatchObject({ category: "system", targetCard: "ghostty" });
    expect(parseRoute("/desk", "")).toMatchObject({ category: "system", targetCard: "hyprland" });
    expect(parseRoute("/hyprland", "")).toMatchObject({ category: "system", targetCard: "hyprland" });
    expect(parseRoute("/dots", "")).toMatchObject({ category: "system", targetCard: "dots" });
  });

  it("maps /annex and /index with card hash to correct category", () => {
    expect(parseRoute("/annex", "#git-safety")).toMatchObject({
      category: "agents",
      targetCard: "git-safety",
    });
    expect(parseRoute("/index", "#lazygit")).toMatchObject({
      category: "agents",
      targetCard: "lazygit",
    });
  });

  it("handles hash-only navigation from root", () => {
    expect(parseRoute("/", "#shell")).toMatchObject({ category: "shell" });
    expect(parseRoute("/", "#/editor")).toMatchObject({ category: "editor" });
    expect(parseRoute("/", "#starship")).toMatchObject({ category: "shell", targetCard: "starship" });
    expect(parseRoute("/", "#hyprland")).toMatchObject({ category: "system", targetCard: "hyprland" });
  });
});

describe("getRoutePath", () => {
  it("returns canonical paths for categories", () => {
    expect(getRoutePath({ category: "system" })).toBe("/system");
    expect(getRoutePath({ category: "shell" })).toBe("/shell");
    expect(getRoutePath({ category: "editor" })).toBe("/editor");
    expect(getRoutePath({ category: "agents" })).toBe("/agents");
  });

  it("returns canonical path with hash when targetCard is present", () => {
    expect(getRoutePath({ category: "shell", targetCard: "starship" })).toBe("/shell#starship");
    expect(getRoutePath({ category: "system", targetCard: "hyprland" })).toBe("/system#hyprland");
    expect(getRoutePath({ category: "editor", targetCard: "neovim" })).toBe("/editor#neovim");
    expect(getRoutePath({ category: "agents", targetCard: "herdr" })).toBe("/agents#herdr");
  });
});

describe("route round-trip", () => {
  it("parse -> getRoutePath is stable for all 4 categories", () => {
    for (const path of ["/system", "/shell", "/editor", "/agents"]) {
      const parsed = parseRoute(path, "");
      const out = getRoutePath(parsed);
      expect(out).toBe(path);
    }
  });

  it("round-trips every card deep-link in the catalogue", () => {
    for (const entry of CATALOGUE) {
      const canonical = cardPath(entry.id);
      const parsed = parseRoute(`/${entry.category}`, `#${entry.id}`);
      expect(parsed.category).toBe(entry.category);
      expect(parsed.targetCard).toBe(entry.id);
      expect(getRoutePath(parsed)).toBe(canonical);
    }
  });
});
