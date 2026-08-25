import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isBunRuntime, isWorkerd } from "../server/lib/runtime";
import { renderDegradedStarship } from "../server/routes/starship";
import { FALLBACKS } from "../server/lib/fallbacks";
import { MANIFEST } from "../src/manifest";

/**
 * Workers degraded-mode contract (ADR-001 / AGENTS.md §5b):
 * - runtime detection branches Bun (canonical) vs workerd (mirror)
 * - the embedded FALLBACKS bundle covers every manifest fallback file
 * - the degraded starship snapshot always flags degraded:true + warning,
 *   applies the exact recolor for both shells, and no-ops on status 0.
 */

describe("runtime detection", () => {
  it("detects Bun under bun test", () => {
    expect(isBunRuntime()).toBe(true);
    expect(isWorkerd()).toBe(false);
  });
});

describe("fallbacks bundle coverage", () => {
  it("embeds every manifest fallback file", () => {
    const needed = MANIFEST.flatMap((e) => e.sources?.map((s) => s.fallbackFile) ?? []);
    const missing = needed.filter((f) => FALLBACKS[f] === undefined);
    expect(missing).toEqual([]);
  });

  it("embeds non-empty content for each entry", () => {
    for (const [name, content] of Object.entries(FALLBACKS)) {
      expect(content?.length ?? 0, name).toBeGreaterThan(0);
    }
  });

  it("starship fallback carries the recolor-relevant config", () => {
    const starship = FALLBACKS["starship.toml"] ?? "";
    expect(starship).toContain("custom.git_dirty");
    expect(starship).toContain("truncation_length");
  });

  it("embedded bundle is byte-identical to fallback/ (drift guard, Bun only)", () => {
    expect(isBunRuntime()).toBe(true);
    const dir = join(import.meta.dir, "..", "fallback");
    for (const [name, embedded] of Object.entries(FALLBACKS)) {
      const onDisk = readFileSync(join(dir, name), "utf8");
      expect(embedded, name).toBe(onDisk);
    }
  });
});

describe("degraded starship snapshot (workerd path)", () => {
  it("always reports degraded:true with an explicit warning", () => {
    const res = renderDegradedStarship({ branch: "main" });
    expect(res.degraded).toBe(true);
    expect(res.warnings?.length ?? 0).toBeGreaterThan(0);
    expect(res.warnings?.[0]).toContain("bun run dev");
  });

  it("status=0 is a no-op (no recolor, no spans)", () => {
    const res = renderDegradedStarship({ branch: "main", status: 0, shell: "bash" });
    expect(res.degraded).toBe(true);
    expect(res.spans).toEqual([]);
    expect(res.ansi).toBe(res.rawAnsi ?? res.ansi);
    expect(res.ansi).not.toContain("31m");
  });

  it("zsh mode recolors only cyan variants to red on status=1", () => {
    const res = renderDegradedStarship({ branch: "feature", dirty: true, status: 1, shell: "zsh" });
    expect(res.degraded).toBe(true);
    // every recolored span must be a zsh cyan variant -> 36m replaced by 31m
    for (const span of res.spans ?? []) {
      if (span.recolored) {
        expect(span.raw).toMatch(/36m$/);
        expect(span.after).toMatch(/31m$/);
      }
    }
    expect((res.spans ?? []).some((s) => s.recolored)).toBe(true);
    // output contains red escapes but keeps bold/italic prefixes intact
    expect(res.ansi).toContain("\x1b[1;31m");
  });

  it("bash mode recolors all foreground colors to red on status=1", () => {
    const res = renderDegradedStarship({ status: 1, shell: "bash", ahead: 1 });
    for (const span of res.spans ?? []) {
      if (span.recolored && !span.reason.startsWith("untouched")) {
        expect(span.after).toMatch(/31m$/);
      }
    }
    expect((res.spans ?? []).filter((s) => s.reason === "bash:fg-to-red").length).toBeGreaterThan(0);
  });

  it("returns safe HTML (escaped, no raw script injection)", () => {
    const res = renderDegradedStarship({
      branch: '<script>alert(1)</script>',
      status: 1,
      shell: "zsh",
    });
    expect(res.html).not.toContain("<script>");
    expect(res.html.length).toBeGreaterThan(0);
  });

  it("reflects detached/rebase state in the snapshot", () => {
    const res = renderDegradedStarship({ detached: true, state: "rebase", status: 1 });
    expect(res.state.detached).toBe(true);
    expect(res.state.state).toBe("rebase");
    expect(res.rawAnsi).toContain("detached");
    expect(res.rawAnsi).toContain("rebase");
  });
});
