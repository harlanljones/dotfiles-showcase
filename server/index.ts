import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
Bun.serve({ fetch: app.fetch, port, reusePort: true });
console.log(`[api] listening on http://localhost:${port}`);
