import { Hono } from "hono";
import { buildCard, cardKeys } from "../lib/cardsData";

export const cardsApp = new Hono();

cardsApp.get("/", (c) => c.json({ cards: cardKeys() }));

cardsApp.get("/:key", (c) => {
  const key = c.req.param("key");
  try {
    const data = buildCard(key);
    if (data === undefined) return c.json({ error: `unknown card: ${key}` }, 404);
    return c.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});
