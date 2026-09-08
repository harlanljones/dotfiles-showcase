import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * HJ-726: an artifact region owns its sideways travel. A table of config
 * values cannot reflow below its character width, so the element wrapping it
 * must scroll (`overflow-x-auto`) rather than clip (`overflow-hidden`) — under
 * the body's `overflow-x: clip`, a clipped table is content the visitor on a
 * phone can never reach.
 *
 * A source guard rather than a DOM test on purpose: happy-dom has no layout
 * engine, so the clipping this prevents is invisible to the render suites.
 * Browser review at 375px is what found it; this keeps it from coming back.
 */
const CARDS_DIR = join(import.meta.dir, "..", "src", "components", "explorer");

function cardSources(): Array<{ file: string; lines: string[] }> {
  return readdirSync(CARDS_DIR)
    .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
    .map((file) => ({ file, lines: readFileSync(join(CARDS_DIR, file), "utf8").split("\n") }));
}

describe("HJ-726: artifact regions carry their own horizontal overflow", () => {
  it("finds tables to check (guards against the scan silently matching nothing)", () => {
    const tables = cardSources().flatMap(({ lines }) => lines.filter((l) => l.includes("<table")));
    expect(tables.length).toBeGreaterThan(4);
  });

  it("no explorer card clips a table inside an overflow-hidden wrapper", () => {
    const offenders: string[] = [];
    for (const { file, lines } of cardSources()) {
      lines.forEach((line, i) => {
        if (!line.includes("<table")) return;
        // The wrapper is the nearest preceding element with an overflow class.
        for (let back = 1; back <= 3 && i - back >= 0; back += 1) {
          const prev = lines[i - back];
          if (!prev.includes("overflow-")) continue;
          if (prev.includes("overflow-hidden")) {
            offenders.push(`${file}:${i - back + 1} — ${prev.trim()}`);
          }
          break;
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
