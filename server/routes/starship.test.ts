import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { renderStarship } from "./starship";

const STARSHIP_OK = spawnSync("starship", ["--version"]).status === 0;
const it = STARSHIP_OK ? test : test.skip;

function render(state: Parameters<typeof renderStarship>[0]) {
  return renderStarship(state);
}

describe("renderStarship — real binary, behavioral golden", () => {
  it("renders a non-empty prompt with the success character", () => {
    const { ansi, html } = render({ branch: "main" });
    expect(ansi.length).toBeGreaterThan(0);
    expect(ansi).toContain("❯");
    expect(html.length).toBeGreaterThan(0);
  });

  it("includes the branch name", () => {
    const { ansi } = render({ branch: "feature/x" });
    expect(ansi).toContain("feature/x");
  });

  it("shows the dirty glyph when dirty", () => {
    const clean = render({ branch: "main", dirty: false }).ansi;
    const dirty = render({ branch: "main", dirty: true }).ansi;
    // The real binary must observe the dirty working tree and add the
    // configured custom.git_dirty segment. Avoid pinning the user's glyph:
    // live and bundled configs intentionally use different non-secret markers.
    expect(dirty).not.toBe(clean);
    expect(dirty.length).toBeGreaterThan(clean.length);
  });

  it("shows the ahead marker when ahead", () => {
    const { ansi } = render({ branch: "main", ahead: 2 });
    expect(ansi).toContain("⇡");
  });

  it("shows the behind marker when behind", () => {
    const { ansi } = render({ branch: "main", behind: 3 });
    expect(ansi).toContain("⇣");
  });

  it("shows diverged markers when both ahead and behind", () => {
    const { ansi } = render({ branch: "main", ahead: 1, behind: 1 });
    expect(ansi).toContain("⇕");
    expect(ansi).toContain("⇡");
    expect(ansi).toContain("⇣");
  });

  it("renders a detached HEAD hash", () => {
    const { ansi } = render({ branch: "main", detached: true });
    // git_commit: commit_hash_length = 7
    expect(ansi).toMatch(/[0-9a-f]{7}/);
  });

  it("renders rebase state and differs from none", () => {
    const none = render({ branch: "main", state: "none" }).ansi;
    const rebase = render({ branch: "main", state: "rebase" }).ansi;
    expect(rebase).not.toBe(none);
  });

  it("recolors to red on failure (zsh)", () => {
    const { ansi } = render({ branch: "main", status: 1, shell: "zsh" });
    // cyan (36) must become red (31, possibly with a style prefix); assert on that.
    expect(ansi).toContain("31m");
    expect(ansi).not.toContain("36m");
  });

  it("recolors to red on failure (bash)", () => {
    const { ansi } = render({ branch: "main", status: 1, shell: "bash" });
    expect(ansi).toContain("31m");
    expect(ansi).not.toContain("36m");
  });

  it("keeps cyan when status is 0 (no recolor)", () => {
    const { ansi } = render({ branch: "main", status: 0, shell: "zsh" });
    expect(ansi).toContain("36m");
    expect(ansi).not.toContain("31m");
  });

  it("rejects an invalid branch name (security)", () => {
    expect(() => render({ branch: "bad;rm -rf /" })).toThrow();
  });

  it("SSH session shows a host segment", () => {
    const { ansi } = render({ branch: "main", ssh: true });
    // hostname module is ssh_only; output should differ from non-ssh.
    const noSsh = render({ branch: "main", ssh: false }).ansi;
    expect(ansi).not.toBe(noSsh);
  });
});

describe("renderStarship — universal across machines (augustus=bash, hadrian=zsh)", () => {
  it("shows the custom.git_dirty glyph in BOTH shell modes", () => {
    // On a real hadrian (zsh installed) the glyph shows; on augustus (bash)
    // it also shows. Our exec-shell fallback keeps that true even when the
    // requested shell binary is missing on the rendering host.
    for (const shell of ["zsh", "bash"] as const) {
      const { ansi } = render({ branch: "main", dirty: true, shell });
      expect(ansi).toContain("\uEA71");
    }
  });

  it("warns exactly when the requested shell binary is missing", () => {
    for (const shell of ["zsh", "bash"] as const) {
      const { warnings } = render({ branch: "main", shell });
      const missing = !Bun.which(shell);
      if (missing) {
        expect(warnings?.join(" ")).toContain(`no '${shell}' binary`);
      } else {
        expect(warnings ?? []).toEqual([]);
      }
    }
  });

  it("strips both wrapper styles so zsh/bash renders look identical", () => {
    const zshHtml = render({ branch: "main", ssh: true, status: 1, shell: "zsh" }).html;
    const bashHtml = render({ branch: "main", ssh: true, status: 1, shell: "bash" }).html;
    for (const html of [zshHtml, bashHtml]) {
      expect(html).not.toMatch(/\\\[|\\\]|%\{|%\}/);
    }
  });
});

describe("renderStarship — terminal-faithful preview", () => {
  it("HTML contains no invisible shell wrappers (\\[ \\] or %{ %})", () => {
    for (const shell of ["zsh", "bash"] as const) {
      const { html } = render({ branch: "main", status: 1, shell });
      expect(html).not.toContain("\\[");
      expect(html).not.toContain("\\]");
      expect(html).not.toContain("%{");
      expect(html).not.toContain("%}");
    }
  });

  it("returns the ghostty theme so the UI can paint the real terminal colors", () => {
    const { theme, html } = render({ branch: "main" });
    expect(theme.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(theme.foreground).toMatch(/^#[0-9a-f]{6}$/);
    expect(["live", "fallback"]).toContain(theme.source);
    expect(html.length).toBeGreaterThan(0);
  });

  it("maps prompt colors through the ghostty palette (not ansi-to-html defaults)", () => {
    const { html } = render({ branch: "main", ssh: true });
    // The default ansi-to-html cyan (#0ff family) must not appear; the themed
    // palette hexes must.
    expect(html.toLowerCase()).not.toMatch(/#00ffff|#0ff\b/);
    expect(html.toLowerCase()).toMatch(/#[0-9a-f]{6}/);
  });
});
