import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Matches the API server's PORT env (server/index.ts); default 3000.
      "/api": `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
});
