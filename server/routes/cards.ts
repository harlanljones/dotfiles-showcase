import { Hono } from "hono";
import { buildCard, cardKeys } from "../lib/cardsData";

export const cardsApp = new Hono();

// PERF-02 (HJ-574): immutable-ish caching for fallback-served payloads on Workers.
// Fallback snapshots are content-addressed at deploy time → long max-age + SWR.
// Live reads reflect the host filesystem → short max-age so mutations surface quickly.
const FALLBACK_CACHE = "public, max-age=3600, stale-while-revalidate=86400";
const LIVE_CACHE = "public, max-age=60";

function isFallbackPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if ((key === "source" || key.endsWith("Source")) && value === "fallback") return true;
  }
  return false;
}

cardsApp.get("/", (c) => {
  // Card index is static (manifest keys) and safe to cache as immutable.
  c.header("Cache-Control", FALLBACK_CACHE);
  return c.json({ cards: cardKeys() });
});

cardsApp.get("/:key", (c) => {
  const key = c.req.param("key");
  try {
    const data = buildCard(key);
    if (data === undefined) return c.json({ error: `unknown card: ${key}` }, 404);
    c.header("Cache-Control", isFallbackPayload(data) ? FALLBACK_CACHE : LIVE_CACHE);
    return c.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});
