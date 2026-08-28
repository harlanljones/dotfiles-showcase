import { describe, expect, it } from "bun:test";
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

  it("returns /index when indexOpen", () => {
    expect(getRoutePath({ room: "starship", indexOpen: true })).toBe("/index");
  });
});

describe("route round-trip", () => {
  it("parse -> getRoutePath is stable for rooms", () => {
    for (const path of ["/prompt", "/palette", "/desk", "/dots", "/index"]) {
      const parsed = parseRoute(path, "");
      const out = getRoutePath(parsed);
      expect(out).toBe(path);
    }
  });
});
