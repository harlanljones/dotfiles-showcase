/**
 * ANALYTICS-01 client beacon (grill D10).
 *
 * Aggregate-only: event names from a fixed allowlist (mirrors
 * server/routes/telemetry.ts); field values are short aggregate tokens.
 * No free-text state (branch names, repo contents) is ever emitted.
 *
 * Local-first contract: emits nothing on localhost/127.0.0.1/::1/*.local and
 * in non-browser environments (tests, SSR). Send failures are swallowed —
 * telemetry must never surface to the UI.
 */

const HOST_BLOCKLIST = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);

export function telemetryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const host = window.location.hostname.toLowerCase();
    if (HOST_BLOCKLIST.has(host)) return false;
    if (host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export function emit(name: string, fields?: Record<string, string | number>): void {
  if (!telemetryEnabled()) return;
  const payload = JSON.stringify(fields ? { n: name, f: fields } : { n: name });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/t", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    /* telemetry must never surface */
  }
}
