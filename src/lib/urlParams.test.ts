import { describe, expect, it } from "bun:test";
import { decodePromptState, encodePromptState, DEFAULT_PROMPT_STATE } from "./urlParams";

describe("decodePromptState", () => {
  it("returns defaults for empty search", () => {
    expect(decodePromptState("")).toEqual(DEFAULT_PROMPT_STATE);
    expect(decodePromptState("?")).toEqual(DEFAULT_PROMPT_STATE);
  });

  it("parses branch and dirty", () => {
    const s = decodePromptState("?branch=feat%2Ffoo&dirty=1");
    expect(s.branch).toBe("feat/foo");
    expect(s.dirty).toBe(true);
  });

  it("parses numeric ahead/behind", () => {
    const s = decodePromptState("?ahead=3&behind=5");
    expect(s.ahead).toBe(3);
    expect(s.behind).toBe(5);
  });

  it("ignores invalid numeric values", () => {
    const s = decodePromptState("?ahead=NaN&behind=-1");
    expect(s.ahead).toBe(DEFAULT_PROMPT_STATE.ahead);
    expect(s.behind).toBe(DEFAULT_PROMPT_STATE.behind);
  });

  it("parses git state and ssh", () => {
    expect(decodePromptState("?state=rebase").state).toBe("rebase");
    expect(decodePromptState("?state=merge").state).toBe("merge");
    expect(decodePromptState("?state=bad").state).toBe("none");
    expect(decodePromptState("?ssh=1").ssh).toBe(true);
    expect(decodePromptState("?ssh=true").ssh).toBe(true);
    expect(decodePromptState("?ssh=0").ssh).toBe(false);
  });

  it("parses shell and status", () => {
    expect(decodePromptState("?shell=bash").shell).toBe("bash");
    expect(decodePromptState("?shell=zsh").shell).toBe("zsh");
    expect(decodePromptState("?shell=fish").shell).toBe("zsh");
    expect(decodePromptState("?status=1").status).toBe(1);
    expect(decodePromptState("?status=0").status).toBe(0);
    expect(decodePromptState("?status=2").status).toBe(1);
  });

  it("parses trueColor via both keys", () => {
    expect(decodePromptState("?trueColor=1").trueColor).toBe(true);
    expect(decodePromptState("?tc=1").trueColor).toBe(true);
    expect(decodePromptState("?trueColor=0").trueColor).toBe(false);
  });

  it("parses detached and width bounds", () => {
    expect(decodePromptState("?detached=1").detached).toBe(true);
    expect(decodePromptState("?width=100").width).toBe(100);
    // out of bounds -> default
    expect(decodePromptState("?width=10").width).toBe(DEFAULT_PROMPT_STATE.width);
    expect(decodePromptState("?width=500").width).toBe(DEFAULT_PROMPT_STATE.width);
  });

  it("accepts duration alias", () => {
    expect(decodePromptState("?duration=5000").durationMs).toBe(5000);
    expect(decodePromptState("?durationMs=123").durationMs).toBe(123);
  });
});

describe("encodePromptState", () => {
  it("produces empty string for defaults", () => {
    expect(encodePromptState(DEFAULT_PROMPT_STATE)).toBe("");
  });

  it("encodes dirty branch diff", () => {
    const s = { ...DEFAULT_PROMPT_STATE, branch: "feat/x", dirty: true, status: 1 };
    const qs = encodePromptState(s);
    expect(qs).toContain("branch=feat");
    expect(qs).toContain("dirty=1");
    expect(qs).toContain("status=1");
  });

  it("encodes ahead/behind and git state", () => {
    const s = { ...DEFAULT_PROMPT_STATE, ahead: 2, behind: 3, state: "rebase" as const };
    const qs = encodePromptState(s);
    expect(qs).toContain("ahead=2");
    expect(qs).toContain("behind=3");
    expect(qs).toContain("state=rebase");
  });

  it("round-trips through decode", () => {
    const original = {
      ...DEFAULT_PROMPT_STATE,
      branch: "hotfix/ssh",
      dirty: true,
      ahead: 3,
      behind: 5,
      detached: true,
      state: "merge" as const,
      ssh: true,
      shell: "bash" as const,
      status: 1,
      durationMs: 1234,
      width: 120,
      trueColor: true,
    };
    const qs = encodePromptState(original);
    const decoded = decodePromptState(qs);
    expect(decoded).toEqual(original);
  });

  it("does not emit defaults", () => {
    const s = { ...DEFAULT_PROMPT_STATE, branch: "main" };
    expect(encodePromptState(s)).toBe("");
  });
});
