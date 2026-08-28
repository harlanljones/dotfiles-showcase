import { Hono } from "hono";
import { telemetryApp } from "./routes/telemetry";
import { app } from "./app";

// Workers entry — same Hono app as Bun, served via workerd + assets.
// Local `bun run dev` (server/index.ts) remains the canonical path with
// real starship binary; Workers is the degraded read-only mirror (ADR-001).
//
// /api/t (ANALYTICS-01) is registered on the Workers composition only: the
// local Bun server never mounts it and the client never emits on localhost
// (src/lib/telemetry.ts), so local dev is telemetry-free end to end.
const workerApp = new Hono<{ Bindings: Env }>();
workerApp.route("/", telemetryApp);
workerApp.route("/", app);

export default {
  fetch: workerApp.fetch,
};
