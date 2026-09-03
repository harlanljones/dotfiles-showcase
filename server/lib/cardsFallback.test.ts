import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cardsApp } from "../routes/cards";
import { buildCard, cardKeys } from "./cardsData";
import { MANIFEST } from "../../src/manifest";

/**
 * Fallback coverage guarantee (M4-2): with every live home config hidden,
 * each manifest-backed card still serves HTTP 200 rendered entirely from
 * the bundled fallback files — including derived sources whose command
 * cannot run. This is the executable form of the §2 metric "all live reads
 * have a fallback path".
 */

let savedHome = "";
let savedPath = "";
let savedOverride = "";
let sandboxHome = "";

beforeEach(() => {
  savedHome = process.env.HOME ?? "";
  savedPath = process.env.PATH ?? "";
  savedOverride = process.env.DOTFILES_SHOWCASE_HOME ?? "";
  // Fresh empty sandbox: every "~/" live path resolves to a missing file.
  sandboxHome = mkdtempSync(join(tmpdir(), "dotfiles-fallback-"));
  process.env.HOME = sandboxHome;
  process.env.DOTFILES_SHOWCASE_HOME = sandboxHome;
  // PATH stripped: `pacman -Qe` (the derived source) cannot run either.
  process.env.PATH = "";
});

afterEach(() => {
  process.env.HOME = savedHome;
  process.env.PATH = savedPath;
  if (savedOverride) process.env.DOTFILES_SHOWCASE_HOME = savedOverride;
  else delete process.env.DOTFILES_SHOWCASE_HOME;
});

const LIVE_CARD_IDS = MANIFEST.filter((e) => e.kind === "live").map((e) => e.id);

/** Every provenance field on the payload must report the bundled fallback. */
function assertAllFallback(key: string, data: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(data)) {
    if ((field === "source" || field.endsWith("Source")) && typeof value !== "object") {
      expect(value, `${key}.${field}`).toBe("fallback");
    }
  }
}

describe("fallback coverage: builders render without any live config", () => {
  for (const id of LIVE_CARD_IDS) {
    it(`${id}: builds from bundled fallbacks only`, () => {
      const data = buildCard(id) as Record<string, unknown>;
      expect(data).toBeDefined();
      assertAllFallback(id, data);
    });
  }

  it("lazygit fallback serves real config text", () => {
    const data = buildCard("lazygit") as { content: string };
    expect(data.content).toContain("customCommands");
  });

  it("mise fallback serves the tools table", () => {
    const data = buildCard("mise") as { tools: Array<[string, string]> };
    expect(data.tools.length).toBeGreaterThan(0);
  });

  it("packages brew live-miss falls back to the bundled Brewfile", () => {
    const data = buildCard("packages") as { brewSource: string; formulae: unknown[] };
    expect(data.brewSource).toBe("fallback");
    expect(data.formulae.length).toBeGreaterThan(0);
  });

  it("pacman derived source degrades to the bundled package list", () => {
    const data = buildCard("packages") as { pacmanSource: string; pacman: string[] };
    expect(data.pacmanSource).toBe("fallback");
    expect(data.pacman.length).toBeGreaterThan(0);
  });

  it("dots fallback preserves all ten parsed commands", () => {
    const data = buildCard("dots") as { source: string; commands: unknown[]; warnings: string[] };
    expect(data.source).toBe("fallback");
    expect(data.commands).toHaveLength(10);
    expect(data.warnings).toEqual([]);
  });

  it("dots retries the fallback when a live script is incomplete", () => {
    const liveDir = join(sandboxHome, ".local", "bin");
    mkdirSync(liveDir, { recursive: true });
    writeFileSync(join(liveDir, "dots"), "#!/usr/bin/env bash\necho incomplete\n");

    const data = buildCard("dots") as { source: string; commands: unknown[]; warnings: string[] };
    expect(data.source).toBe("fallback");
    expect(data.commands).toHaveLength(10);
    expect(data.warnings[0]).toContain("Live dots source was incomplete");
  });

  it("herdr fallback serves config summary and plugins list", () => {
    const data = buildCard("herdr") as {
      configSource: string;
      pluginsSource: string;
      config: { prefix: string; resumeAgents: boolean; supportedAgents: string[] };
      plugins: unknown[];
    };
    expect(data.configSource).toBe("fallback");
    expect(data.pluginsSource).toBe("fallback");
    expect(data.config.prefix).toBe("ctrl+space");
    expect(data.config.resumeAgents).toBe(true);
    expect(data.config.supportedAgents.length).toBeGreaterThan(0);
    expect(data.plugins.length).toBeGreaterThan(0);
  });
});

describe("fallback coverage: HTTP surface", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = "";

  beforeEach(() => {
    server = Bun.serve({ port: 0, fetch: cardsApp.fetch });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterEach(() => server.stop(true));

  for (const id of LIVE_CARD_IDS) {
    it(`GET /api/cards/${id} → 200 with fallback payload`, async () => {
      const res = await fetch(`${baseUrl}/${id}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      assertAllFallback(id, body);
    });
  }

  it("every served key answers 200 under total live-config loss", async () => {
    for (const key of cardKeys()) {
      const res = await fetch(`${baseUrl}/${key}`);
      expect(res.status, `key ${key}`).toBe(200);
    }
  });
});
