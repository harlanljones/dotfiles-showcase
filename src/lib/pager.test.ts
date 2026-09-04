import { describe, expect, it } from "bun:test";
import {
  createPager,
  formatIdleLine,
  formatStatusLine,
  goToPage,
  nextPage,
  noteScrollIntent,
  openDemo,
  pageCountFor,
  percentThrough,
  prevPage,
  remeasure,
} from "./pager";

describe("pager: page arithmetic", () => {
  it("computes page count as ceil(content / viewport), minimum 1", () => {
    expect(pageCountFor(2000, 800)).toBe(3);
    expect(pageCountFor(1600, 800)).toBe(2);
    expect(pageCountFor(800, 800)).toBe(1);
    expect(pageCountFor(100, 800)).toBe(1);
  });

  it("treats zero/unknown measurements as a single page until measured", () => {
    expect(pageCountFor(0, 800)).toBe(1);
    expect(pageCountFor(2000, 0)).toBe(1);
    expect(pageCountFor(0, 0)).toBe(1);
    expect(pageCountFor(NaN, 800)).toBe(1);
  });

  it("next/previous clamp at the boundaries", () => {
    let s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    expect(s.pageCount).toBe(3);
    s = nextPage(nextPage(nextPage(s)));
    expect(s.page).toBe(3);
    s = prevPage(prevPage(prevPage(prevPage(s))));
    expect(s.page).toBe(1);
  });

  it("goToPage clamps into range and floors fractional input", () => {
    const s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    expect(goToPage(s, 2).page).toBe(2);
    expect(goToPage(s, 99).page).toBe(3);
    expect(goToPage(s, -4).page).toBe(1);
    expect(goToPage(s, 2.7).page).toBe(2);
  });

  it("paging is a no-op outside paged mode", () => {
    const s = createPager({ pointer: "coarse", viewportHeight: 800, contentHeight: 2400 });
    expect(nextPage(s).page).toBe(1);
    expect(prevPage(s).page).toBe(1);
    expect(goToPage(s, 3).page).toBe(1);
  });

  it("opening a demo resets to page one and clears the hint", () => {
    let s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    s = goToPage(s, 3);
    s = noteScrollIntent(s);
    expect(s.hintFlash).toBe(true);
    s = openDemo(s, 2400, 800);
    expect(s.page).toBe(1);
    expect(s.hintFlash).toBe(false);
  });

  it("remeasure keeps the page when it still fits, clamps when it does not", () => {
    let s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    s = goToPage(s, 2);
    s = remeasure(s, 2400, 800);
    expect(s.page).toBe(2);
    s = remeasure(s, 800, 800);
    expect(s.pageCount).toBe(1);
    expect(s.page).toBe(1);
  });
});

describe("pager: mode selection from pointer coarseness", () => {
  it("fine pointers start paged", () => {
    const s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    expect(s.mode).toBe("paged");
  });

  it("coarse pointers start native with no hint and no escalation", () => {
    const s = createPager({ pointer: "coarse", viewportHeight: 1200, contentHeight: 5000 });
    expect(s.mode).toBe("native");
    expect(s.hintFlash).toBe(false);
    expect(s.yielded).toBe(false);
    const after = noteScrollIntent(noteScrollIntent(s));
    expect(after.mode).toBe("native");
    expect(after.hintFlash).toBe(false);
  });

  it("a remembered session yield to native wins over a fine pointer", () => {
    const s = createPager({
      pointer: "fine",
      viewportHeight: 800,
      contentHeight: 2400,
      sessionOverride: "native",
    });
    expect(s.mode).toBe("native");
    expect(s.yielded).toBe(true);
  });

  it("an explicit session override back to paged restores paging", () => {
    const s = createPager({
      pointer: "fine",
      viewportHeight: 800,
      contentHeight: 2400,
      sessionOverride: "paged",
    });
    expect(s.mode).toBe("paged");
  });
});

describe("pager: hint → yield → remember escalation", () => {
  it("first scroll intent flashes hints, continued intent yields to native", () => {
    let s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    s = noteScrollIntent(s);
    expect(s.mode).toBe("paged");
    expect(s.hintFlash).toBe(true);
    s = noteScrollIntent(s);
    expect(s.mode).toBe("native");
    expect(s.hintFlash).toBe(false);
    expect(s.yielded).toBe(true);
  });

  it("yielded state is stable under further scroll intents", () => {
    let s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 2400 });
    s = noteScrollIntent(noteScrollIntent(noteScrollIntent(s)));
    expect(s.mode).toBe("native");
    expect(s.yielded).toBe(true);
  });
});

describe("pager: status line text", () => {
  it("carries demo, position, percent and key hints in paged mode", () => {
    const s = goToPage(createPager({ pointer: "fine", viewportHeight: 1000, contentHeight: 5000 }), 2);
    const line = formatStatusLine("starship", s);
    expect(line).toContain("starship");
    expect(line).toContain("2/5");
    expect(line).toContain("40%");
    expect(line).toContain("j/k");
    expect(line).toContain("/ search");
  });

  it("reports a single page as 100%", () => {
    const s = createPager({ pointer: "fine", viewportHeight: 800, contentHeight: 100 });
    expect(percentThrough(s)).toBe(100);
    expect(formatStatusLine("mise", s)).toContain("1/1");
  });

  it("native mode reports native scroll rather than a position", () => {
    const s = createPager({ pointer: "coarse", viewportHeight: 800, contentHeight: 5000 });
    const line = formatStatusLine("btop", s);
    expect(line).toContain("btop");
    expect(line).toContain("native scroll");
    expect(line).toContain("/ search");
  });

  it("idle line names the catalogue size and the search affordance", () => {
    const line = formatIdleLine(6);
    expect(line).toContain("6 demos");
    expect(line).toContain("/ search");
  });
});
