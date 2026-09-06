/**
 * Pager (HJ-722): pure paging/yield logic for the demo field.
 *
 * No DOM access lives here. Pointer coarseness, viewport size, and content
 * height are inputs supplied by the caller — never queried inside this
 * module — so the mode selection, page math, and yield escalation are all
 * testable with plain values.
 *
 * State transitions (see ticket table):
 *   paged      + first scroll intent      -> paged      (flash key hints)
 *   paged      + continued scroll intent  -> scrolling  (native takes over)
 *   scrolling  + anything                 -> scrolling  (sticky for session)
 *   coarse pointer                        -> scrolling from the start, no hint
 */

export type PointerCoarseness = "fine" | "coarse";

/** The visitor's persisted override, mirrors session.ts's PagerMode. */
export type PagerModeOverride = "native" | "paged" | null;

export type YieldState = "paged" | "scrolling";

export interface PagerState {
  /** Current yield state: whether the field is still pager-driven. */
  yield: YieldState;
  /** Whether the first-scroll-intent hint has already been flashed. */
  hinted: boolean;
}

/**
 * Decide the field's starting state.
 *
 * Coarse pointers never engage the pager, regardless of any stored override
 * — touch devices always start (and stay) in "scrolling", with no hint.
 * On a fine pointer, an explicit "native" override resumes scrolling mode
 * silently (the visitor already chose it this session); otherwise the field
 * starts paged.
 */
export function initialPagerState(pointer: PointerCoarseness, override: PagerModeOverride): PagerState {
  if (pointer === "coarse") {
    return { yield: "scrolling", hinted: false };
  }
  if (override === "native") {
    return { yield: "scrolling", hinted: false };
  }
  return { yield: "paged", hinted: false };
}

export interface ScrollIntentResult {
  state: PagerState;
  /** Whether this intent should flash the key hints in the status line. */
  showHint: boolean;
  /** Whether this intent is the moment the field yields to native scrolling. */
  yielded: boolean;
}

/**
 * Apply one "scroll intent" (a wheel/touch gesture while paged) to the
 * state machine. Once `yield` is "scrolling" this is a no-op forever —
 * the mode is sticky for the rest of the session.
 */
export function onScrollIntent(state: PagerState): ScrollIntentResult {
  if (state.yield === "scrolling") {
    return { state, showHint: false, yielded: false };
  }
  if (!state.hinted) {
    return { state: { yield: "paged", hinted: true }, showHint: true, yielded: false };
  }
  return { state: { yield: "scrolling", hinted: true }, showHint: false, yielded: true };
}

/** Number of pages a hero of `contentHeight` needs at `viewportHeight`. Always at least 1. */
export function computePageCount(contentHeight: number, viewportHeight: number): number {
  if (!(viewportHeight > 0) || !(contentHeight > 0)) return 1;
  return Math.max(1, Math.ceil(contentHeight / viewportHeight));
}

/** Clamp a page index into the valid [0, pageCount - 1] range. */
export function clampPage(page: number, pageCount: number): number {
  const max = Math.max(0, pageCount - 1);
  return Math.min(Math.max(page, 0), max);
}

/** Page forward (space/j), clamped at the last page. */
export function pageDown(page: number, pageCount: number): number {
  return clampPage(page + 1, pageCount);
}

/** Page back (k), clamped at the first page. */
export function pageUp(page: number, pageCount: number): number {
  return clampPage(page - 1, pageCount);
}

/** Percent through the hero, as `less` reports it ("100%" on a single page). */
export function percentThrough(page: number, pageCount: number): number {
  if (pageCount <= 1) return 100;
  return Math.round((clampPage(page, pageCount) / (pageCount - 1)) * 100);
}

/**
 * Move to a sibling index (h/l on the rail), clamped at the ends of the
 * list — walking off either edge stays put rather than wrapping.
 */
export function siblingIndex(current: number, length: number, direction: -1 | 1): number {
  if (length <= 0) return current;
  return Math.min(Math.max(current + direction, 0), length - 1);
}
