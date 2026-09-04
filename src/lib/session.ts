/**
 * Session-scoped persistence (grill HJ-717).
 *
 * Single module owning every value the app remembers for the life of a
 * browser tab: the veil "awake" flag today, and — designed in but not yet
 * wired up — the set of showcase demos a visitor has watched perform
 * (HJ-721) and the pager's mode override (HJ-722).
 *
 * Local-first contract: reads and writes never throw. Private-mode or
 * blocked storage degrades to "nothing remembered" — reads return their
 * default/empty value, writes silently no-op.
 */

const AWAKE_KEY = "display-awake";
const SEEN_DEMOS_KEY = "seen-demos";
const PAGER_MODE_KEY = "pager-mode";

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage: nothing remembered */
  }
}

/** Has this visitor already woken the display this session? */
export function isAwake(): boolean {
  return readSession(AWAKE_KEY) === "1";
}

/** Record that the visitor has woken the display this session. */
export function setAwake(): void {
  writeSession(AWAKE_KEY, "1");
}

/** Showcase demo ids the visitor has already seen perform this session. */
export function seenDemos(): Set<string> {
  const raw = readSession(SEEN_DEMOS_KEY);
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((id): id is string => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

/** Mark a showcase demo as seen for the rest of this session. */
export function markDemoSeen(id: string): void {
  const next = seenDemos();
  next.add(id);
  writeSession(SEEN_DEMOS_KEY, JSON.stringify([...next]));
}

export type PagerMode = "native" | "paged";

/** The visitor's explicit pager mode override for this session, if any. */
export function pagerModeOverride(): PagerMode | null {
  const raw = readSession(PAGER_MODE_KEY);
  return raw === "native" || raw === "paged" ? raw : null;
}

/** Set (or clear, with `null`) the visitor's pager mode override. */
export function setPagerModeOverride(mode: PagerMode | null): void {
  if (mode === null) {
    try {
      sessionStorage.removeItem(PAGER_MODE_KEY);
    } catch {
      /* private mode / blocked storage: nothing remembered */
    }
    return;
  }
  writeSession(PAGER_MODE_KEY, mode);
}
