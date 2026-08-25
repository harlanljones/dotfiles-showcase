import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { recolorApp } from "./recolor";

describe("POST /api/recolor", () => {
  let server: ReturnType<typeof Bun.serve>;
  let base = "";

  beforeEach(() => {
    server = Bun.serve({ port: 0, fetch: recolorApp.fetch });
    base = `http://localhost:${server.port}`;
  });
  afterEach(() => server.stop(true));

  test("recolors cyan in zsh", async () => {
    const res = await fetch(`${base}/recolor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "\x1b[36mhello\x1b[0m", shell: "zsh", status: 1 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { output: string; htmlBefore: string; htmlAfter: string; spans: unknown[] };
    expect(body.output).toContain("\x1b[31m");
    expect(body.htmlAfter).toContain("hello");
    expect(body.spans.length).toBeGreaterThan(0);
  });

  test("status 0 is a no-op with empty ledger", async () => {
    const res = await fetch(`${base}/recolor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "\x1b[36mhi", shell: "zsh", status: 0 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { output: string; spans: unknown[] };
    expect(body.output).toBe("\x1b[36mhi");
    expect(body.spans.length).toBe(0);
  });

  test("bash recolors green, zsh does not", async () => {
    const input = "\x1b[32mgreen\x1b[0m";
    const zsh = await fetch(`${base}/recolor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, shell: "zsh" }) }).then((r) => r.json() as Promise<{ output: string }>);
    const bash = await fetch(`${base}/recolor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, shell: "bash" }) }).then((r) => r.json() as Promise<{ output: string }>);
    expect(zsh.output).toBe(input);
    expect(bash.output).toContain("\x1b[31m");
  });

  test("escapes HTML in output", async () => {
    const res = await fetch(`${base}/recolor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "\x1b[36m<script>alert(1)</script>", shell: "bash" }),
    });
    const body = (await res.json()) as { htmlAfter: string };
    expect(body.htmlAfter).not.toContain("<script>");
    expect(body.htmlAfter).toContain("&lt;script&gt;");
  });

  test("rejects input too large", async () => {
    const big = "a".repeat(5000);
    const res = await fetch(`${base}/recolor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: big, shell: "zsh" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns themed palette", async () => {
    const res = await fetch(`${base}/recolor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: "hello", shell: "zsh" }),
    });
    const body = (await res.json()) as { theme: { background: string; foreground: string } };
    expect(body.theme.background).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("ledger exposes divergence on 4;36m", async () => {
    const input = "\x1b[4;36mhi";
    const zsh = await fetch(`${base}/recolor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, shell: "zsh" }) }).then((r) => r.json() as Promise<{ spans: Array<{ recolored: boolean }> }>);
    const bash = await fetch(`${base}/recolor`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input, shell: "bash" }) }).then((r) => r.json() as Promise<{ spans: Array<{ recolored: boolean }> }>);
    expect(zsh.spans[0].recolored).toBe(false);
    expect(bash.spans[0].recolored).toBe(true);
  });
});
