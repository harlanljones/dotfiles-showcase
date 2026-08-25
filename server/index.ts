import { Hono } from "hono";
import { cardsApp } from "./routes/cards";
import { recolorApp } from "./routes/recolor";
import { starshipApp } from "./routes/starship";

const app = new Hono();

app.get("/api/health", (c) =>
  c.json({ ok: true, ts: new Date().toISOString() }),
);

app.route("/api", starshipApp);
app.route("/api", recolorApp);
app.route("/api/cards", cardsApp);

const port = Number(process.env.PORT ?? 3000);
Bun.serve({ fetch: app.fetch, port, reusePort: true });
console.log(`[api] listening on http://localhost:${port}`);
