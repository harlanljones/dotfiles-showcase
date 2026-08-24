import { describe, expect, test } from "bun:test";
import { loadGhosttyTheme, parseGhosttyTheme } from "./theme";

describe("parseGhosttyTheme", () => {
  test("parses background, foreground, and the 16-entry palette", () => {
    const t = parseGhosttyTheme(
      [
        "background = #060912",
        "foreground = #959aa4",
        "palette = 0=#0d0f16",
        "palette = 1=#b16371",
        "palette = 6=#508381",
        "palette = 15=#a5aab4",
        "# comment line",
      ].join("\n"),
    );
    expect(t.background).toBe("#060912");
    expect(t.foreground).toBe("#959aa4");
    expect(t.palette).toHaveLength(16);
    expect(t.palette[0]).toBe("#0d0f16");
    expect(t.palette[1]).toBe("#b16371");
    expect(t.palette[6]).toBe("#508381");
    expect(t.palette[15]).toBe("#a5aab4");
  });

  test("tolerates missing entries with sane defaults", () => {
    const t = parseGhosttyTheme("nothing here");
    expect(t.background).toBe("#000000");
    expect(t.foreground).toBe("#e6e6e6");
    expect(t.palette).toHaveLength(16);
  });
});

describe("loadGhosttyTheme", () => {
  test("never throws; returns a usable theme from live config or fallback", () => {
    const t = loadGhosttyTheme();
    expect(["live", "fallback"]).toContain(t.source);
    expect(t.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.foreground).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.palette.filter((c) => /^#[0-9a-f]{6}$/.test(c))).toHaveLength(16);
  });
});
