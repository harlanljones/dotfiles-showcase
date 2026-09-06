import { describe, expect, it } from "bun:test";
import {
  clampPage,
  computePageCount,
  initialPagerState,
  onScrollIntent,
  pageDown,
  pageUp,
  percentThrough,
  siblingIndex,
  type PagerState,
} from "./pager";

/**
 * HJ-722: the pager is a pure module with no DOM access. Pointer
 * coarseness, viewport size, and content height are plain inputs — these
 * tests exercise mode selection, page math boundaries, and the yield
 * escalation entirely with values, no DOM required.
 */

describe("initialPagerState", () => {
  it("starts paged on a fine pointer with no override", () => {
    expect(initialPagerState("fine", null)).toEqual({ yield: "paged", hinted: false });
  });

  it("a fine pointer with a 'native' override resumes scrolling silently", () => {
    expect(initialPagerState("fine", "native")).toEqual({ yield: "scrolling", hinted: false });
  });

  it("a fine pointer with a 'paged' override still starts paged", () => {
    expect(initialPagerState("fine", "paged")).toEqual({ yield: "paged", hinted: false });
  });

  it("a coarse pointer always starts scrolling, no hint, regardless of override", () => {
    expect(initialPagerState("coarse", null)).toEqual({ yield: "scrolling", hinted: false });
    expect(initialPagerState("coarse", "paged")).toEqual({ yield: "scrolling", hinted: false });
    expect(initialPagerState("coarse", "native")).toEqual({ yield: "scrolling", hinted: false });
  });
});

describe("onScrollIntent (yield escalation)", () => {
  it("the first scroll intent while paged flashes the hint and stays paged", () => {
    const state: PagerState = { yield: "paged", hinted: false };
    const result = onScrollIntent(state);
    expect(result.state).toEqual({ yield: "paged", hinted: true });
    expect(result.showHint).toBe(true);
    expect(result.yielded).toBe(false);
  });

  it("a second scroll intent while paged hands over to scrolling, no further hint", () => {
    const state: PagerState = { yield: "paged", hinted: true };
    const result = onScrollIntent(state);
    expect(result.state).toEqual({ yield: "scrolling", hinted: true });
    expect(result.showHint).toBe(false);
    expect(result.yielded).toBe(true);
  });

  it("once scrolling, further intents are a no-op — sticky for the session", () => {
    const state: PagerState = { yield: "scrolling", hinted: true };
    const result = onScrollIntent(state);
    expect(result.state).toBe(state);
    expect(result.showHint).toBe(false);
    expect(result.yielded).toBe(false);
  });

  it("a coarse-pointer initial state (scrolling, unhinted) never shows a hint on scroll", () => {
    const state: PagerState = initialPagerState("coarse", null);
    const result = onScrollIntent(state);
    expect(result.showHint).toBe(false);
    expect(result.state.yield).toBe("scrolling");
  });
});

describe("computePageCount", () => {
  it("is always at least 1 page", () => {
    expect(computePageCount(0, 800)).toBe(1);
    expect(computePageCount(100, 800)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(computePageCount(1601, 800)).toBe(3);
    expect(computePageCount(1600, 800)).toBe(2);
  });

  it("degrades to 1 page for non-positive viewport height", () => {
    expect(computePageCount(2000, 0)).toBe(1);
    expect(computePageCount(2000, -10)).toBe(1);
  });
});

describe("clampPage / pageDown / pageUp boundaries", () => {
  it("clamps below zero up to 0", () => {
    expect(clampPage(-3, 5)).toBe(0);
  });

  it("clamps above the last index down to pageCount - 1", () => {
    expect(clampPage(99, 5)).toBe(4);
  });

  it("pageDown stops at the last page", () => {
    expect(pageDown(4, 5)).toBe(4);
    expect(pageDown(3, 5)).toBe(4);
  });

  it("pageUp stops at the first page", () => {
    expect(pageUp(0, 5)).toBe(0);
    expect(pageUp(1, 5)).toBe(0);
  });

  it("a single-page field never moves", () => {
    expect(pageDown(0, 1)).toBe(0);
    expect(pageUp(0, 1)).toBe(0);
  });
});

describe("percentThrough", () => {
  it("reports 100% for a single-page field", () => {
    expect(percentThrough(0, 1)).toBe(100);
  });

  it("reports 0% on the first page of a multi-page field", () => {
    expect(percentThrough(0, 4)).toBe(0);
  });

  it("reports 100% on the last page", () => {
    expect(percentThrough(3, 4)).toBe(100);
  });

  it("reports an intermediate percent partway through", () => {
    expect(percentThrough(1, 4)).toBe(33);
    expect(percentThrough(2, 4)).toBe(67);
  });
});

describe("siblingIndex (h/l rail walking)", () => {
  it("moves forward and backward within bounds", () => {
    expect(siblingIndex(1, 5, 1)).toBe(2);
    expect(siblingIndex(1, 5, -1)).toBe(0);
  });

  it("stays put at the last index when walking past the end", () => {
    expect(siblingIndex(4, 5, 1)).toBe(4);
  });

  it("stays put at the first index when walking past the start", () => {
    expect(siblingIndex(0, 5, -1)).toBe(0);
  });

  it("is a no-op on an empty rail", () => {
    expect(siblingIndex(0, 0, 1)).toBe(0);
  });
});
