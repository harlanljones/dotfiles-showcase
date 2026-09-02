import { describe, expect, it } from "bun:test";
import { annexInOrder, receiptPath } from "./catalogue";
import { parseRoute, getRoutePath } from "./router";

describe("parseRoute", () => {
  it("defaults / to starship", () => {
    expect(parseRoute("/", "")).toMatchObject({ room: "starship", indexOpen: false });
    expect(parseRoute("", "")).toMatchObject({ room: "starship", indexOpen: false });
  });

  it("maps canonical paths", () => {
    expect(parseRoute("/prompt", "")).toMatchObject({ room: "starship" });
    expect(parseRoute("/starship", "")).toMatchObject({ room: "starship" });
    expect(parseRoute("/palette", "")).toMatchObject({ room: "ghostty" });
    expect(parseRoute("/ghostty", "")).toMatchObject({ room: "ghostty" });
    expect(parseRoute("/desk", "")).toMatchObject({ room: "hyprland" });
    expect(parseRoute("/hyprland", "")).toMatchObject({ room: "hyprland" });
    expect(parseRoute("/dots", "")).toMatchObject({ room: "dots" });
  });

  it("is case-insensitive and trims trailing slashes", () => {
    expect(parseRoute("/Dots/", "")).toMatchObject({ room: "dots" });
    expect(parseRoute("/PALETTE", "")).toMatchObject({ room: "ghostty" });
    expect(parseRoute("/desk/", "")).toMatchObject({ room: "hyprland" });
  });

  it("maps /index and /annex to index overlay", () => {
    expect(parseRoute("/index", "")).toMatchObject({ indexOpen: true });
    expect(parseRoute("/annex", "")).toMatchObject({ indexOpen: true });
    expect(parseRoute("/index/", "")).toMatchObject({ indexOpen: true });
  });

  it("handles hash based navigation", () => {
    expect(parseRoute("/", "#/dots")).toMatchObject({ room: "dots", indexOpen: false });
    expect(parseRoute("/", "#dots")).toMatchObject({ room: "dots", indexOpen: false });
    expect(parseRoute("/", "#/palette")).toMatchObject({ room: "ghostty" });
    expect(parseRoute("/", "#index")).toMatchObject({ indexOpen: true });
    expect(parseRoute("/", "#annex")).toMatchObject({ indexOpen: true });
  });

  it("falls back to starship for unknown paths", () => {
    expect(parseRoute("/unknown", "")).toMatchObject({ room: "starship", indexOpen: false });
    expect(parseRoute("/prompt/extra", "")).toMatchObject({ room: "starship" });
  });
});

describe("getRoutePath", () => {
  it("returns canonical paths for rooms", () => {
    expect(getRoutePath({ room: "starship", indexOpen: false })).toBe("/prompt");
    expect(getRoutePath({ room: "ghostty", indexOpen: false })).toBe("/palette");
    expect(getRoutePath({ room: "hyprland", indexOpen: false })).toBe("/desk");
    expect(getRoutePath({ room: "dots", indexOpen: false })).toBe("/dots");
  });

  it("canonicalizes the annex to /annex (Workers 307s /index to /)", () => {
    expect(getRoutePath({ room: "starship", indexOpen: true })).toBe("/annex");
  });
});

describe("route round-trip", () => {
  it("parse -> getRoutePath is stable for rooms and the annex", () => {
    for (const path of ["/prompt", "/palette", "/desk", "/dots", "/annex"]) {
      const parsed = parseRoute(path, "");
      const out = getRoutePath(parsed);
      expect(out).toBe(path);
    }
  });

  it("/index is an accepted alias resolving to the annex state", () => {
    expect(parseRoute("/index", "")).toMatchObject({ indexOpen: true });
    expect(getRoutePath(parseRoute("/index", ""))).toBe("/annex");
  });
});

describe("annex receipt URLs (catalogue-driven)", () => {
  it("parses /annex#<receipt> into a targeted annex state", () => {
    expect(parseRoute("/annex", "#git-safety")).toMatchObject({
      indexOpen: true,
      targetReceipt: "git-safety",
    });
  });

  it("round-trips every annex receipt path", () => {
    for (const entry of annexInOrder()) {
      const parsed = parseRoute("/annex", `#${entry.id}`);
      expect(parsed.targetReceipt).toBe(entry.id);
      expect(getRoutePath(parsed)).toBe(receiptPath(entry.id));
    }
  });

  it("exposes the target receipt via the canonical route", () => {
    const route = parseRoute("/annex", "#lazygit");
    expect(getRoutePath(route)).toBe("/annex#lazygit");
    // From a browser URL "/annex#lazygit" the pathname is /annex, hash is #lazygit
    expect(parseRoute("/annex", "#lazygit")).toMatchObject({
      indexOpen: true,
      targetReceipt: "lazygit",
    });
  });

  it("rejects absorbed or unknown ids as receipts (no unreachable targets)", () => {
    expect(parseRoute("/annex", "#recolor").targetReceipt).toBeUndefined();
    expect(parseRoute("/annex", "#nonexistent").targetReceipt).toBeUndefined();
    expect(getRoutePath(parseRoute("/annex", "#nonexistent"))).toBe("/annex");
  });
});
