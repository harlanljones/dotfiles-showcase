import { Hono } from "hono";
import { ansiToHtml } from "../lib/ansi";
import { explainRecolor, type ShellMode } from "../lib/recolor";
import { loadGhosttyTheme } from "../lib/theme";

const MAX_INPUT = 4096;

export const recolorApp = new Hono();

recolorApp.post("/recolor", async (c) => {
  try {
    const body = await c.req.json<{
      input?: unknown;
      shell?: unknown;
      status?: unknown;
    }>();
    const input = typeof body.input === "string" ? body.input : "";
    const shell: ShellMode = body.shell === "bash" ? "bash" : "zsh";
    const status = typeof body.status === "number" ? body.status : 1;

    if (input.length > MAX_INPUT) {
      return c.json({ error: `input too large (max ${MAX_INPUT} chars)` }, 400);
    }

    const theme = loadGhosttyTheme();

    if (status === 0) {
      const html = ansiToHtml(input, { palette: theme.palette });
      return c.json({
        input,
        output: input,
        htmlBefore: html,
        htmlAfter: html,
        spans: [],
        shell,
        status,
        theme: { background: theme.background, foreground: theme.foreground, source: theme.source },
      });
    }

    const { output, spans } = explainRecolor(input, shell);
    const htmlBefore = ansiToHtml(input, { palette: theme.palette });
    const htmlAfter = ansiToHtml(output, { palette: theme.palette });

    return c.json({
      input,
      output,
      htmlBefore,
      htmlAfter,
      spans,
      shell,
      status,
      theme: { background: theme.background, foreground: theme.foreground, source: theme.source },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});
