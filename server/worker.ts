import { app } from "./app";

// Workers entry — same Hono app as Bun, served via workerd + assets.
// Local `bun run dev` (server/index.ts) remains the canonical path with
// real starship binary; Workers is the degraded read-only mirror (ADR-001).
export default {
  fetch: app.fetch,
};
