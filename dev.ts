const client = Bun.spawn(["bun", "x", "vite"], {
  stdout: "inherit",
  stderr: "inherit",
});

const server = Bun.spawn(["bun", "run", "server/index.ts"], {
  stdout: "inherit",
  stderr: "inherit",
});

function shutdown(code = 0) {
  client.kill();
  server.kill();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// If either process exits, shut the other down so we never leave orphans.
Promise.race([client.exited, server.exited]).then(() => shutdown(0));
