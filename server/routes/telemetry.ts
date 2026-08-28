import { Hono } from "hono";

/**
 * ANALYTICS-01 (HJ-581): Workers-only telemetry endpoint.
 *
 * Writes one Analytics Engine data point per validated event. NOT mounted in
 * server/app.ts — the local Bun server has no TELEMETRY binding and local dev
 * must never emit (client guard + absence of this route on the local path).
 *
 * Aggregate-only contract (ADR-003 / grill D10): event names come from a fixed
 * allowlist; field values are short aggregate tokens (room names, scenario
 * keys, shell names, clamped numbers). No free-text state (branch names, repo
 * contents) is ever accepted. Values are length-capped and count-capped here
 * so a hostile payload cannot smuggle state into the dataset.
 */

const EVENT_NAMES = new Set([
  "room_switch",
  "annex_opened",
  "annex_closed",
  "preset_applied",
  "status_changed",
  "shell_changed",
  "recolor_toggled",
  "flag_toggled",
  "range_committed",
  "copy_ansi",
  "copy_link",
]);

const MAX_BODY_BYTES = 512;
const MAX_FIELDS = 4;
const MAX_FIELD_KEY = 16;
const MAX_FIELD_VALUE = 24;

interface TelemetryPayload {
  n?: unknown;
  f?: unknown;
}

export const telemetryApp = new Hono<{ Bindings: Env }>();

telemetryApp.post("/api/t", async (c) => {
  const raw = await c.req.text();
  if (raw.length > MAX_BODY_BYTES) return c.body(null, 413);

  let payload: TelemetryPayload;
  try {
    payload = JSON.parse(raw) as TelemetryPayload;
  } catch {
    return c.body(null, 400);
  }

  const name = typeof payload.n === "string" ? payload.n : "";
  if (!EVENT_NAMES.has(name)) return c.body(null, 400);

  const blobs: string[] = [name];
  if (payload.f && typeof payload.f === "object" && !Array.isArray(payload.f)) {
    const entries = Object.entries(payload.f as Record<string, unknown>)
      .filter(([k, v]) => {
        if (typeof v !== "string" && typeof v !== "number") return false;
        if (Number.isNaN(v as number)) return false;
        return k.length > 0 && k.length <= MAX_FIELD_KEY;
      })
      .slice(0, MAX_FIELDS);
    for (const [k, v] of entries) {
      const value = typeof v === "number" ? String(Math.max(-1e9, Math.min(1e9, Math.round(v)))) : v;
      blobs.push(`${k.slice(0, MAX_FIELD_KEY)}=${String(value).slice(0, MAX_FIELD_VALUE)}`);
    }
  }

  const dataset = c.env?.TELEMETRY;
  if (dataset && typeof dataset.writeDataPoint === "function") {
    dataset.writeDataPoint({
      // index: queryable key (event name); blobs: name + capped k=v fields.
      indexes: [name.slice(0, 96)],
      blobs: blobs.map((b) => b.slice(0, 96)),
      doubles: [1],
    });
  }
  // 204 whether or not the binding is provisioned yet — the endpoint is
  // fire-and-forget by contract and must never surface errors to the UI.
  return c.body(null, 204);
});
