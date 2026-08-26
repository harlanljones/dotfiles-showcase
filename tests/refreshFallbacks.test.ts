import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBundle,
  extractColors,
  findHostLeaks,
  findSecretMatches,
  parseManifest,
  refresh,
  regenerateBody,
  sanitizeStarship,
  scrubLiterals,
  splitProvenanceHeader,
  stripLeadingComments,
  trimComments,
  type ManifestEntry,
} from "../scripts/refresh-fallbacks";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST_TABLE = `
## Per-file decisions

| File | Strategy | Live source | Notes |
| --- | --- | --- | --- |
| \`Brewfile\` | SYNTHETIC | none on Linux host | macOS-parity manifest |
| \`ghostty-config\` | TRIMMED-SAMPLE | \`~/.config/ghostty/config\` | comments dropped |
| \`theme.conf\` | TRIMMED-SAMPLE | \`~/.local/state/omarchy/current/theme/ghostty.conf\` | colors only |
| \`monitors.lua\` | FULL-COPY | \`~/.config/hypr/monitors.lua\` | header replaces wiki comments |
| \`plugins.json\` | FULL-COPY (byte-identical) | \`~/.config/nvim/lazy-lock.json\` | JSON: no header |
| \`pacman.txt\` | DERIVED-SNAPSHOT | \`pacman -Qe\` on host | package names |
| \`starship.toml\` | SANITIZED SAMPLE | \`~/.config/starship.toml\` | hostname sanitized away |
`;

function entry(overrides: Partial<ManifestEntry>): ManifestEntry {
  return { file: "x.txt", strategy: "FULL-COPY", liveSource: "", notes: "", ...overrides };
}

// ---------------------------------------------------------------------------
// Manifest parsing
// ---------------------------------------------------------------------------

describe("parseManifest", () => {
  test("parses all rows from the README table", () => {
    const rows = parseManifest(MANIFEST_TABLE);
    expect(rows.map((r) => r.file)).toEqual([
      "Brewfile",
      "ghostty-config",
      "theme.conf",
      "monitors.lua",
      "plugins.json",
      "pacman.txt",
      "starship.toml",
    ]);
  });

  test("normalizes strategy variants and live sources", () => {
    const byFile = new Map(parseManifest(MANIFEST_TABLE).map((r) => [r.file, r]));
    const brew = byFile.get("Brewfile")!;
    expect(brew.strategy).toBe("SYNTHETIC");
    expect(brew.liveSource).toBe("");

    expect(byFile.get("plugins.json")!.strategy).toBe("FULL-COPY");
    expect(byFile.get("pacman.txt")!.strategy).toBe("DERIVED-SNAPSHOT");
    expect(byFile.get("starship.toml")!.strategy).toBe("SANITIZED SAMPLE");
    expect(byFile.get("ghostty-config")!.liveSource).toBe("~/.config/ghostty/config");
    expect(byFile.get("theme.conf")!.notes).toContain("colors only");
  });

  test("ignores separator and malformed rows from the real README shape", () => {
    const rows = parseManifest("| --- | --- | --- | --- |\n| `ok.txt` | FULL-COPY | `~/ok.txt` | n |\nnot a row\n");
    expect(rows.map((r) => r.file)).toEqual(["ok.txt"]);
  });
});

// ---------------------------------------------------------------------------
// Body transformers
// ---------------------------------------------------------------------------

describe("trimComments (TRIMMED-SAMPLE config)", () => {
  test("drops full-line comments, keeps settings and blank separators", () => {
    const live = "# section\nfont-size = 9\n\n# another\nwindow-theme = ghostty\n";
    expect(trimComments(live)).toBe("font-size = 9\n\nwindow-theme = ghostty\n");
  });
});

describe("extractColors (TRIMMED-SAMPLE theme)", () => {
  test("keeps only color-bearing lines", () => {
    const live = "# Background\ncursor-style = block\nbackground = #000000\npalette = 0=#111111\nforeground = #ffffff\n";
    expect(extractColors(live)).toBe("background = #000000\npalette = 0=#111111\nforeground = #ffffff\n");
  });
});

describe("stripLeadingComments (FULL-COPY)", () => {
  test("strips leading # comment lines", () => {
    expect(stripLeadingComments("# a\n# b\nsetting = 1\n", "#")).toBe("setting = 1\n");
  });
  test("strips leading -- comment lines for lua", () => {
    expect(stripLeadingComments("-- wiki\n-- link\nlocal x = 1\n", "--")).toBe("local x = 1\n");
  });
  test("leaves content without leading comments untouched", () => {
    expect(stripLeadingComments("[tools]\nbun = \"latest\"\n", "#")).toBe("[tools]\nbun = \"latest\"\n");
  });
});

describe("sanitizeStarship (SANITIZED SAMPLE)", () => {
  test("genericizes username block and replaces literal hostname with $hostname", () => {
    const live = [
      "[username]",
      "format = \"[$user]($style)@\"",
      "style_user = \"bold cyan\"",
      "",
      "[hostname]",
      "ssh_only = true",
      "format = \"[Augustus](bold dimmed cyan) \"",
      "",
    ].join("\n");
    const out = sanitizeStarship(live);
    expect(out).toContain("format = \"[$user]($style)\"");
    expect(out).toContain("format = \"at [$hostname](bold dimmed cyan) \"");
    expect(out).not.toContain("Augustus");
    // other sections untouched
    expect(out).toContain("style_user = \"bold cyan\"");
    expect(out).toContain("ssh_only = true");
  });

  test("regenerateBody routes SANITIZED SAMPLE through the starship transformer", () => {
    const out = regenerateBody(entry({ file: "starship.toml", strategy: "SANITIZED SAMPLE" }), "[hostname]\nformat = \"[Boxy](red)\"\n");
    expect(out).toContain("at [$hostname]");
  });
});

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

describe("scrubLiterals", () => {
  test("replaces planted username, known host literal, IPv4, and MAC addresses", () => {
    const input = "user=harlan host=Augustus addr=192.168.10.24 mac=aa:bb:cc:dd:ee:ff\n";
    const { content, hits } = scrubLiterals(input, { user: "harlan", host: "" });
    expect(content).toBe("user=<user> host=<host> addr=<ip> mac=<mac>\n");
    expect(hits).toBeGreaterThanOrEqual(4);
  });

  test("does not mangle short or absent identities", () => {
    const { content } = scrubLiterals("plain text\n", { user: "", host: "" });
    expect(content).toBe("plain text\n");
  });
});

describe("findHostLeaks", () => {
  test("flags unique machine hostnames", () => {
    expect(findHostLeaks("at Augustus prompt", "Augustus")).toEqual(["Augustus"]);
  });
  test("allows benign generic tokens like distro names", () => {
    expect(findHostLeaks("state/omarchy/current/theme", "omarchy")).toEqual([]);
  });
});

describe("findSecretMatches", () => {
  test("detects credential-like patterns", () => {
    const hits = findSecretMatches(
      ["ghp_abc123def", "github_pat_xyz", "AGE-SECRET-KEY-1QQQ", "-----BEGIN OPENSSH PRIVATE KEY-----", "api_key = abc", "password: hunter2", "token=abc123"].join("\n"),
    );
    expect(hits.length).toBeGreaterThanOrEqual(7);
  });
  test("passes clean content", () => {
    expect(findSecretMatches("font-size = 9\n[tools]\nbun = \"latest\"\n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Provenance header + bundle
// ---------------------------------------------------------------------------

describe("splitProvenanceHeader", () => {
  test("preserves committed header bytes including the blank separator", () => {
    const existing = "# Fallback snapshot: mise.toml.\n# Live source: ~/.config/mise/config.toml\n\n[tools]\nbun = \"latest\"\n";
    expect(splitProvenanceHeader(existing, entry({ file: "mise.toml" }))).toBe(
      "# Fallback snapshot: mise.toml.\n# Live source: ~/.config/mise/config.toml\n\n",
    );
  });
  test("returns empty for JSON snapshots", () => {
    expect(splitProvenanceHeader("{\"a\":1}\n", entry({ file: "lazyvim.json" }))).toBe("");
  });
});

describe("buildBundle", () => {
  test("emits sorted keys, escaped values, and the FALLBACKS export", () => {
    const files = new Map([
      ["b.txt", "line1\nline2\n"],
      ["a.json", "{\"k\":\"v\"}"],
    ]);
    const out = buildBundle(files);
    expect(out).toContain("export const FALLBACKS: Record<string, string> = {");
    expect(out.indexOf("\"a.json\"")).toBeLessThan(out.indexOf("\"b.txt\""));
    expect(out).toContain(`  "b.txt": "line1\\nline2\\n"`);
    expect(out.trimEnd().endsWith("};")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: refresh() against a temp repo/home
// ---------------------------------------------------------------------------

interface Sandbox {
  repoRoot: string;
  home: string;
  cleanup: () => void;
}

function makeSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "fb-refresh-"));
  const repoRoot = join(root, "repo");
  const home = join(root, "home");
  mkdirSync(join(repoRoot, "fallback"), { recursive: true });
  mkdirSync(join(home, ".config"), { recursive: true });
  writeFileSync(join(repoRoot, "fallback", "README.md"), MANIFEST_TABLE);
  return {
    repoRoot,
    home,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function writeLive(home: string, rel: string, content: string): void {
  const p = join(home, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, content);
}

const IDENTITY = { user: "testuser", host: "" };

describe("refresh integration", () => {
  test("write mode: regenerates bodies, skips synthetic/missing/derived-unavailable, writes bundle", () => {
    const sb = makeSandbox();
    try {
      writeLive(sb.home, ".config/ghostty/config", "# c\nfont-size = 9\n");
      writeLive(sb.home, ".local/state/omarchy/current/theme/ghostty.conf", "background = #000000\ncursor-style = block\n");
      writeLive(sb.home, ".config/hypr/monitors.lua", "-- wiki\nmonitor = DP-1\n");
      writeLive(sb.home, ".config/nvim/lazy-lock.json", "{\"plug\": \"abc\"}\n");

      const report = refresh({
        repoRoot: sb.repoRoot,
        home: sb.home,
        identity: IDENTITY,
        runDerived: () => null, // pacman unavailable on this fake host
      });

      const byFile = new Map(report.entries.map((r) => [r.file, r]));
      expect(byFile.get("Brewfile")!.status).toBe("SKIP-SYNTHETIC");
      expect(byFile.get("pacman.txt")!.status).toBe("SKIP-DERIVED-UNAVAILABLE");
      expect(byFile.get("starship.toml")!.status).toBe("SKIP-NO-LIVE");
      expect(byFile.get("ghostty-config")!.status).toBe("STALE"); // no prior snapshot → created

      const cfg = readFileSync(join(sb.repoRoot, "fallback", "ghostty-config"), "utf8");
      expect(cfg).toContain("# Fallback snapshot: ghostty-config.");
      expect(cfg).toContain("font-size = 9");
      expect(cfg).not.toContain("# c");

      const theme = readFileSync(join(sb.repoRoot, "fallback", "theme.conf"), "utf8");
      expect(theme).toContain("background = #000000");
      expect(theme).not.toContain("cursor-style");

      const lua = readFileSync(join(sb.repoRoot, "fallback", "monitors.lua"), "utf8");
      expect(lua).not.toContain("-- wiki");
      expect(lua).toContain("monitor = DP-1");

      const json = readFileSync(join(sb.repoRoot, "fallback", "plugins.json"), "utf8");
      expect(json).toBe("{\"plug\": \"abc\"}\n"); // byte-identical, no header

      expect(existsSync(join(sb.repoRoot, "server", "lib", "fallbacks.ts"))).toBe(true);
      const bundle = readFileSync(join(sb.repoRoot, "server", "lib", "fallbacks.ts"), "utf8");
      expect(bundle).toContain("FALLBACKS");
    } finally {
      sb.cleanup();
    }
  });

  test("derived snapshot runs injected command and sorts package names", () => {
    const sb = makeSandbox();
    try {
      const report = refresh({
        repoRoot: sb.repoRoot,
        home: sb.home,
        identity: IDENTITY,
        runDerived: (_cmd, args) => (args[0] === "-Qe" ? "zzi\naaa-pkg 1.0\nmmv\n" : null),
      });
      const txt = readFileSync(join(sb.repoRoot, "fallback", "pacman.txt"), "utf8");
      expect(txt).toContain("aaa-pkg\nmmv\nzzi\n");
      const rep = report.entries.find((r) => r.file === "pacman.txt")!;
      expect(rep.status).toBe("STALE"); // created fresh
    } finally {
      sb.cleanup();
    }
  });

  test("check mode reports stale but leaves disk untouched; same files are SAME", () => {
    const sb = makeSandbox();
    try {
      writeLive(sb.home, ".config/ghostty/config", "font-size = 9\n");
      refresh({ repoRoot: sb.repoRoot, home: sb.home, identity: IDENTITY, runDerived: () => null }); // initial write
      writeLive(sb.home, ".config/ghostty/config", "font-size = 12\n"); // live drifted

      const before = readFileSync(join(sb.repoRoot, "fallback", "ghostty-config"), "utf8");
      const report = refresh({
        repoRoot: sb.repoRoot,
        home: sb.home,
        identity: IDENTITY,
        checkOnly: true,
        runDerived: () => null,
      });
      const after = readFileSync(join(sb.repoRoot, "fallback", "ghostty-config"), "utf8");

      expect(after).toBe(before); // disk untouched
      expect(report.entries.find((r) => r.file === "ghostty-config")!.status).toBe("STALE");
      expect(report.wrote).toBe(false);

      // A second check right after an unchanged write reports SAME.
      const report2 = refresh({ repoRoot: sb.repoRoot, home: sb.home, identity: IDENTITY, checkOnly: true, runDerived: () => null });
      // ghostty-config is still stale vs drifted live; but Brewfile/synthetic skip and bundle is now SAME
      expect(report2.bundle).toBe("SAME");
      expect(report2.staleCount).toBe(1); // only the drifted file
    } finally {
      sb.cleanup();
    }
  });

  test("hard-fails on credential-like content in live source and writes nothing for that file", () => {
    const sb = makeSandbox();
    try {
      writeLive(sb.home, ".config/ghostty/config", "api_key = supersecret123\n");
      let threw = false;
      try {
        refresh({ repoRoot: sb.repoRoot, home: sb.home, identity: IDENTITY, runDerived: () => null });
      } catch (e) {
        threw = true;
        expect((e as Error).message).toContain("secret-scan FAILED");
        expect((e as Error).message).toContain("ghostty-config");
      }
      expect(threw).toBe(true);
      expect(existsSync(join(sb.repoRoot, "fallback", "ghostty-config"))).toBe(false);
    } finally {
      sb.cleanup();
    }
  });

  test("host-literal guard fails when machine hostname survives sanitization", () => {
    const sb = makeSandbox();
    try {
      writeLive(sb.home, ".config/ghostty/config", "title = box-ne7f3q\n");
      let threw = false;
      try {
        refresh({
          repoRoot: sb.repoRoot,
          home: sb.home,
          identity: { user: "", host: "box-ne7f3q" },
          runDerived: () => null,
        });
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
