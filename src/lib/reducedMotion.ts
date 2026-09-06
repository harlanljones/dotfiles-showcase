/**
 * prefers-reduced-motion detection (A11Y-01 contract, HJ-721).
 *
 * Read once per call rather than subscribed live — motion decisions here are
 * made per-mount (whether a showcase demo performs or renders complete), not
 * live-toggled mid-animation. Guarded like session.ts: an environment
 * without `matchMedia` (SSR, some test DOMs) degrades to "no preference"
 * rather than throwing.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
