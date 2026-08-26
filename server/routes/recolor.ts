import { Hono } from "hono";
import { ansiToHtml } from "../lib/ansi";
import { explainRecolor, type ShellMode, type TrueColor } from "../lib/recolor";
import { loadGhosttyTheme } from "../lib/theme";

const MAX_INPUT = 4096;

// Default TC-01 proposed-fix preview palette (matches the served starship config).
const DEFAULT_TRUECOLOR: TrueColor = { cyan: [46, 222, 250], red: [255, 102, 92] };

export const recolorApp = new Hono();

recolorApp.post("/recolor", async (c) => {
  try {
    const body = await c.req.json<{
      input?: unknown;
      shell?: unknown;
      status?: unknown;
      trueColor?: unknown;
    }>();
    const input = typeof body.input === "string" ? body.input : "";
    const shell: ShellMode = body.shell === "bash" ? "bash" : "zsh";
    const status = typeof body.status === "number" ? body.status : 1;
    const trueColor =
      body.trueColor === true || (body.trueColor && typeof body.trueColor === "object")
        ? DEFAULT_TRUECOLOR
        : undefined;

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
        trueColor: !!trueColor,
        theme: { background: theme.background, foreground: theme.foreground, source: theme.source },
      });
    }

    const { output, spans } = explainRecolor(input, shell, trueColor);
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
      trueColor: !!trueColor,
      theme: { background: theme.background, foreground: theme.foreground, source: theme.source },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});
