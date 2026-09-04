import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildIndex,
  buildIndexModule,
  extractBrewfile,
  extractFlags,
  extractIniLike,
  extractJson,
  extractLineList,
  extractLua,
  extractShellFunctions,
  extractSettings,
  extractYamlish,
  generate,
  type SearchIndexEntry,
} from "../scripts/generate-search-index";
import { findHostLeaks } from "../scripts/refresh-fallbacks";
import type { ManifestEntry } from "../src/manifest";

// ---------------------------------------------------------------------------
// Format-specific extractors
// ---------------------------------------------------------------------------

describe("extractJson", () => {
  test("walks nested objects/arrays to dotted-path leaves", () => {
    const settings = extractJson('{"tools":{"bun":"latest"},"list":[1,"two",true]}');
    expect(settings).toEqual([
      { key: "tools.bun", value: "latest" },
      { key: "list[0]", value: "1" },
      { key: "list[1]", value: "two" },
      { key: "list[2]", value: "true" },
    ]);
  });
  test("returns empty on invalid JSON instead of throwing", () => {
    expect(extractJson("{not json")).toEqual([]);
  });
});

describe("extractIniLike", () => {
  test("tracks sections and strips comments/quotes", () => {
    const content = [
      "# header comment",
      "add_newline = true",
      "",
      "[character]",
      'error_symbol = "[x](bold red)"  # trailing comment',
      "; also a comment",
    ].join("\n");
    expect(extractIniLike(content)).toEqual([
      { key: "add_newline", value: "true" },
      { key: "character.error_symbol", value: "[x](bold red)" },
    ]);
  });
  test("handles tab-indented gitconfig style with no spaces around =", () => {
    const content = "[init]\n\tdefaultBranch=master\n";
    expect(extractIniLike(content)).toEqual([{ key: "init.defaultBranch", value: "master" }]);
  });
});

describe("extractYamlish", () => {
  test("extracts flat key: value pairs, list markers stripped", () => {
    const content = ["customCommands:", "  - key: '<c-g>'", "    context: 'files'", "    output: terminal"].join("\n");
    expect(extractYamlish(content)).toEqual([
      { key: "key", value: "<c-g>" },
      { key: "context", value: "files" },
      { key: "output", value: "terminal" },
    ]);
  });
});

describe("extractLua", () => {
  test("extracts key = value pairs from function-call table literals", () => {
    const content = 'hl.monitor({ output = "DP-3", mode = "2560x1440@60", scale = 1.25 })';
    expect(extractLua(content)).toEqual([
      { key: "output", value: "DP-3" },
      { key: "mode", value: "2560x1440@60" },
      { key: "scale", value: "1.25" },
    ]);
  });
});

describe("extractBrewfile", () => {
  test("extracts brew/cask/tap DSL lines", () => {
    const content = 'brew "fzf"\ncask "ghostty"\ntap "foo/bar"\n# comment\n';
    expect(extractBrewfile(content)).toEqual([
      { key: "brew", value: "fzf" },
      { key: "cask", value: "ghostty" },
      { key: "tap", value: "foo/bar" },
    ]);
  });
});

describe("extractLineList", () => {
  test("emits one entry per non-empty, non-comment line under a shared key", () => {
    expect(extractLineList("# header\n\npkg-a\npkg-b\n", "package")).toEqual([
      { key: "package", value: "pkg-a" },
      { key: "package", value: "pkg-b" },
    ]);
  });
});

describe("extractFlags", () => {
  test("splits --flag=value and keeps bare flags with an empty value", () => {
    expect(extractFlags("--smart-case\n--max-columns=160\n# comment\n")).toEqual([
      { key: "--smart-case", value: "" },
      { key: "--max-columns", value: "160" },
    ]);
  });
});

describe("extractShellFunctions", () => {
  test("extracts top-level bash function names", () => {
    const content = "ensure_chezmoi() {\n  echo hi\n}\n\nmain() {\n  :\n}\n";
    expect(extractShellFunctions(content)).toEqual([
      { key: "function", value: "ensure_chezmoi" },
      { key: "function", value: "main" },
    ]);
  });
});

describe("extractSettings dispatch", () => {
  test("routes by filename/extension", () => {
    expect(extractSettings("mise.toml", "[tools]\nbun = \"latest\"\n")).toEqual([{ key: "tools.bun", value: "latest" }]);
    expect(extractSettings("plugins.json", '{"a":1}')).toEqual([{ key: "a", value: "1" }]);
    expect(extractSettings("Brewfile", 'brew "fzf"\n')).toEqual([{ key: "brew", value: "fzf" }]);
    expect(extractSettings("pacman.txt", "pkg\n")).toEqual([{ key: "package", value: "pkg" }]);
    expect(extractSettings("ripgrep-rc", "--hidden\n")).toEqual([{ key: "--hidden", value: "" }]);
    expect(extractSettings("dots", "run() {\n}\n")).toEqual([{ key: "function", value: "run" }]);
    expect(extractSettings("monitors.lua", 'x = "y"')).toEqual([{ key: "x", value: "y" }]);
    expect(extractSettings("lazygit.yml", "key: value\n")).toEqual([{ key: "key", value: "value" }]);
  });
});

// ---------------------------------------------------------------------------
// buildIndex / buildIndexModule
// ---------------------------------------------------------------------------

const FIXTURE_MANIFEST: ManifestEntry[] = [
  {
    id: "starship",
    title: "Starship",
    blurb: "b",
    kind: "interactive",
    sources: [{ livePath: "~/.config/starship.toml", fallbackFile: "starship.toml" }],
  },
  {
    id: "mise",
    title: "mise",
    blurb: "b",
    kind: "live",
    sources: [{ livePath: "~/.config/mise/config.toml", fallbackFile: "mise.toml" }],
  },
  // No `sources` — should contribute nothing to the index.
  { id: "recolor", title: "Recolor", blurb: "b", kind: "interactive" },
];

const FIXTURE_FILES: Record<string, string> = {
  "starship.toml": "add_newline = true\n[character]\nerror_symbol = \"x\"\n",
  "mise.toml": "[tools]\nbun = \"latest\"\n",
};

describe("buildIndex", () => {
  test("walks manifest sources and carries demoId/configPath/fallbackFile through", () => {
    const entries = buildIndex(FIXTURE_MANIFEST, (file) => FIXTURE_FILES[file] ?? null);
    expect(entries).toEqual([
      { demoId: "starship", configPath: "~/.config/starship.toml", fallbackFile: "starship.toml", key: "add_newline", value: "true" },
      { demoId: "starship", configPath: "~/.config/starship.toml", fallbackFile: "starship.toml", key: "character.error_symbol", value: "x" },
      { demoId: "mise", configPath: "~/.config/mise/config.toml", fallbackFile: "mise.toml", key: "tools.bun", value: "latest" },
    ]);
  });

  test("skips a source whose fallback file is missing (returns null) without throwing", () => {
    const entries = buildIndex(FIXTURE_MANIFEST, () => null);
    expect(entries).toEqual([]);
  });
});

describe("buildIndexModule", () => {
  test("emits a valid TS module with the SEARCH_INDEX export", () => {
    const entries: SearchIndexEntry[] = [
      { demoId: "starship", configPath: "~/.config/starship.toml", fallbackFile: "starship.toml", key: "k", value: "v" },
    ];
    const out = buildIndexModule(entries);
    expect(out).toContain("export const SEARCH_INDEX: SearchIndexEntry[] = [");
    expect(out).toContain('{"demoId":"starship","configPath":"~/.config/starship.toml","fallbackFile":"starship.toml","key":"k","value":"v"}');
    expect(out.trimEnd().endsWith("];")).toBe(true);
  });

  test("is deterministic for the same input", () => {
    const entries: SearchIndexEntry[] = [
      { demoId: "starship", configPath: "p", fallbackFile: "f", key: "k", value: "v" },
    ];
    expect(buildIndexModule(entries)).toBe(buildIndexModule(entries));
  });
});

// ---------------------------------------------------------------------------
// Integration: generate() against a temp repo (write mode, check mode, drift)
// ---------------------------------------------------------------------------

interface Sandbox {
  repoRoot: string;
  cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const repoRoot = mkdtempSync(join(tmpdir(), "search-index-"));
  mkdirSync(join(repoRoot, "fallback"), { recursive: true });
  for (const [file, content] of Object.entries(FIXTURE_FILES)) {
    writeFileSync(join(repoRoot, "fallback", file), content);
  }
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) };
}

const IDENTITY = { user: "testuser", host: "" };

describe("generate integration", () => {
  test("write mode creates server/lib/searchIndex.ts from fallback snapshots", () => {
    const sb = makeSandbox();
    try {
      const report = generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY });
      expect(report.status).toBe("CREATED");
      expect(report.wrote).toBe(true);
      expect(report.entryCount).toBe(3);

      const outPath = join(sb.repoRoot, "server", "lib", "searchIndex.ts");
      expect(existsSync(outPath)).toBe(true);
      const content = readFileSync(outPath, "utf8");
      expect(content).toContain('"demoId":"starship"');
      expect(content).toContain('"demoId":"mise"');
    } finally {
      sb.cleanup();
    }
  });

  test("a second run with unchanged snapshots reports SAME and does not rewrite", () => {
    const sb = makeSandbox();
    try {
      generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY });
      const outPath = join(sb.repoRoot, "server", "lib", "searchIndex.ts");
      const before = readFileSync(outPath, "utf8");

      const report = generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY });
      expect(report.status).toBe("SAME");
      expect(report.wrote).toBe(false);
      expect(readFileSync(outPath, "utf8")).toBe(before);
    } finally {
      sb.cleanup();
    }
  });

  test("check mode fails (reports STALE, does not write) when a fallback snapshot drifts", () => {
    const sb = makeSandbox();
    try {
      generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY }); // initial commit
      const outPath = join(sb.repoRoot, "server", "lib", "searchIndex.ts");
      const before = readFileSync(outPath, "utf8");

      // Mutate a bundled fallback snapshot — the exact "run generator, mutate
      // a snapshot, watch check mode fail" scenario from the ticket.
      writeFileSync(join(sb.repoRoot, "fallback", "mise.toml"), "[tools]\nbun = \"1.2.3\"\nnode = \"latest\"\n");

      const report = generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY, checkOnly: true });
      expect(report.status).toBe("STALE");
      expect(report.wrote).toBe(false);
      // Disk untouched by check mode.
      expect(readFileSync(outPath, "utf8")).toBe(before);

      // Write mode picks the drift back up.
      const written = generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY });
      expect(written.status).toBe("STALE");
      expect(written.wrote).toBe(true);
      expect(readFileSync(outPath, "utf8")).toContain('"value":"1.2.3"');
    } finally {
      sb.cleanup();
    }
  });

  test("check mode fails (reports CREATED, does not write) when the index has never been generated", () => {
    const sb = makeSandbox();
    try {
      const report = generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY, checkOnly: true });
      expect(report.status).toBe("CREATED");
      expect(report.wrote).toBe(false);
      expect(existsSync(join(sb.repoRoot, "server", "lib", "searchIndex.ts"))).toBe(false);
    } finally {
      sb.cleanup();
    }
  });

  test("hard-fails and writes nothing when a fallback snapshot carries a credential-like pattern", () => {
    const sb = makeSandbox();
    try {
      writeFileSync(join(sb.repoRoot, "fallback", "mise.toml"), "[tools]\napi_key = supersecret123\n");
      let threw = false;
      try {
        generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: IDENTITY });
      } catch (e) {
        threw = true;
        expect((e as Error).message).toContain("secret-scan FAILED");
      }
      expect(threw).toBe(true);
      expect(existsSync(join(sb.repoRoot, "server", "lib", "searchIndex.ts"))).toBe(false);
    } finally {
      sb.cleanup();
    }
  });

  test("hard-fails when the live machine hostname survives into the generated artifact", () => {
    const sb = makeSandbox();
    try {
      writeFileSync(join(sb.repoRoot, "fallback", "mise.toml"), "[tools]\ntitle = box-ne7f3q\n");
      let threw = false;
      try {
        generate({ repoRoot: sb.repoRoot, manifest: FIXTURE_MANIFEST, identity: { user: "", host: "box-ne7f3q" } });
      } catch (e) {
        threw = true;
        expect((e as Error).message).toContain("host-literal guard FAILED");
      }
      expect(threw).toBe(true);
    } finally {
      sb.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Real repo sanity: the committed index must currently be in sync.
// ---------------------------------------------------------------------------

describe("committed search index (real repo)", () => {
  test("bun run search-index:check passes against the real fallback/* + manifest", () => {
    const repoRoot = join(import.meta.dir, "..");
    const report = generate({ repoRoot, checkOnly: true });
    expect(report.status).toBe("SAME");
  });

  test("no host-identifying literals in the committed index", () => {
    const repoRoot = join(import.meta.dir, "..");
    const outPath = join(repoRoot, "server", "lib", "searchIndex.ts");
    const content = readFileSync(outPath, "utf8");
    // Uses the same benign-token exemption as refresh-fallbacks.ts (a
    // generic distro/project name like "omarchy" is not a unique machine
    // identifier); a real host leak would fail this.
    const host = require("node:os").hostname();
    expect(findHostLeaks(content, host)).toEqual([]);
  });
});
