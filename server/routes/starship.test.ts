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
    const { ansi } = render({ branch: "main", dirty: true });
    expect(ansi).toContain("");
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
