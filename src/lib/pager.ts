/**
 * Pager state machine (HJ-715 wave 1).
 *
 * Pure module — no DOM access. Pointer coarseness, viewport size and content
 * height are *inputs*, never queried inside, so the mobile branch and the
 * hint → yield escalation are testable with plain data.
 *
 * Behaviour contract (spec §Pager):
 * - `paged`: the field is clamped to the viewport and j/k/space move by page.
 * - `native`: ordinary document scrolling owns the field; the pager only
 *   reports position text.
 * - Mode selection branches on pointer *coarseness*, never viewport width:
 *   coarse pointers start (and stay) native with no hint and no escalation.
 * - Fine pointers start paged. The first scroll intent flashes the key hints
 *   in the status line; continued scroll intent yields to native scrolling.
 *   The yield is remembered for the session by the caller (session module).
 */

export type PointerKind = "fine" | "coarse";
export type PagerMode = "paged" | "native";
export type SessionPagerOverride = "native" | "paged";

export interface PagerInputs {
  /** Pointer coarseness — caller reads `matchMedia("(pointer: coarse)")`. */
  pointer: PointerKind;
  /** Visible field height in px (0/unknown ⇒ single page until measured). */
  viewportHeight: number;
  /** Full hero content height in px (0/unknown ⇒ single page until measured). */
  contentHeight: number;
  /** Session-remembered override; a remembered "native" survives reloads. */
  sessionOverride?: SessionPagerOverride | null;
}

export interface PagerState {
  mode: PagerMode;
  /** 1-based current page. */
  page: number;
  /** ≥ 1. */
  pageCount: number;
  /** Scroll-escalation state (fine-pointer paged mode only). */
  hintFlash: boolean;
  yielded: boolean;
}

/** Pages needed to read `contentHeight` through a `viewportHeight` window. */
export function pageCountFor(contentHeight: number, viewportHeight: number): number {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(viewportHeight)) return 1;
  if (viewportHeight <= 0 || contentHeight <= 0) return 1;
  return Math.max(1, Math.ceil(contentHeight / viewportHeight));
}

function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(pageCount, Math.max(1, Math.floor(page)));
}

export function createPager(inputs: PagerInputs): PagerState {
  const pageCount = pageCountFor(inputs.contentHeight, inputs.viewportHeight);
  if (inputs.sessionOverride === "native") {
    return { mode: "native", page: 1, pageCount, hintFlash: false, yielded: true };
  }
  if (inputs.pointer === "coarse") {
    return { mode: "native", page: 1, pageCount, hintFlash: false, yielded: false };
  }
  return { mode: "paged", page: 1, pageCount, hintFlash: false, yielded: false };
}

/** Re-derive page count after measuring (e.g. demo swap, resize). Keeps the page. */
export function remeasure(state: PagerState, contentHeight: number, viewportHeight: number): PagerState {
  const pageCount = pageCountFor(contentHeight, viewportHeight);
  return { ...state, pageCount, page: clampPage(state.page, pageCount) };
}

/** Open a (possibly different) demo: always starts at page one. */
export function openDemo(state: PagerState, contentHeight: number, viewportHeight: number): PagerState {
  const pageCount = pageCountFor(contentHeight, viewportHeight);
  return { ...state, pageCount, page: 1, hintFlash: false };
}

export function nextPage(state: PagerState): PagerState {
  if (state.mode !== "paged") return state;
  return { ...state, page: clampPage(state.page + 1, state.pageCount) };
}

export function prevPage(state: PagerState): PagerState {
  if (state.mode !== "paged") return state;
  return { ...state, page: clampPage(state.page - 1, state.pageCount) };
}

export function goToPage(state: PagerState, page: number): PagerState {
  if (state.mode !== "paged") return state;
  return { ...state, page: clampPage(page, state.pageCount) };
}

/**
 * A scroll intent arrived while paged (fine pointer only):
 * first intent flashes the key hints; continued intent yields to native
 * scrolling. The caller persists the yield via the session module.
 */
export function noteScrollIntent(state: PagerState): PagerState {
  if (state.mode !== "paged") return state;
  if (!state.hintFlash) return { ...state, hintFlash: true };
  return { ...state, mode: "native", hintFlash: false, yielded: true };
}

/** 0–100 percent through the demo, for the status line. Single page ⇒ 100. */
export function percentThrough(state: PagerState): number {
  if (state.pageCount <= 1) return 100;
  return Math.round((state.page / state.pageCount) * 100);
}

const KEY_HINTS = "j/k page · space more · h/l rail · / search";

/**
 * The `less`-idiom status line: current demo, page position, percent
 * through, and the active key hints. Plain text — position is never
 * conveyed by layout alone.
 */
export function formatStatusLine(demoWord: string, state: PagerState): string {
  if (state.mode === "native") {
    return `${demoWord} · native scroll · / search`;
  }
  return `${demoWord} · ${state.page}/${state.pageCount} · ${percentThrough(state)}% · ${KEY_HINTS}`;
}

/** Idle text when no demo is open (nothing expanded, no deep link). */
export function formatIdleLine(demoCount: number): string {
  return `${demoCount} demos · expand one to read · / search`;
}
