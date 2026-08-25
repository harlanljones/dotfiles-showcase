import { describe, expect, test } from "bun:test";
import { applyFailureColor, explainRecolor, recolor } from "./recolor";

const ESC = "\x1b[";

describe("recolor — zsh (cyan-only, 8 variants)", () => {
  const variants = ["", "1;", "2;", "3;", "1;2;", "1;3;", "2;3;", "1;2;3;"];

  for (const p of variants) {
    test(`recolors ${JSON.stringify(p)}36m -> ${p}31m`, () => {
      expect(recolor(`${ESC}${p}36mhello`)).toBe(`${ESC}${p}31mhello`);
    });
  }

  test("does NOT touch non-cyan foreground colors", () => {
    expect(recolor(`${ESC}32mgreen`)).toBe(`${ESC}32mgreen`);
    expect(recolor(`${ESC}1;32mbold green`)).toBe(`${ESC}1;32mbold green`);
  });

  test("recolors multiple segments", () => {
    const input = `${ESC}36ma${ESC}0m ${ESC}1;36mb`;
    const expected = `${ESC}31ma${ESC}0m ${ESC}1;31mb`;
    expect(recolor(input)).toBe(expected);
  });
});

describe("recolor — bash (all foreground -> red)", () => {
  test("recolors green to red, preserving prefix", () => {
    expect(recolor(`${ESC}32mgreen`, "bash")).toBe(`${ESC}31mgreen`);
    expect(recolor(`${ESC}1;32mbold green`, "bash")).toBe(`${ESC}1;31mbold green`);
  });

  test("recolors cyan to red", () => {
    expect(recolor(`${ESC}36mcyan`, "bash")).toBe(`${ESC}31mcyan`);
    expect(recolor(`${ESC}1;3;36m`, "bash")).toBe(`${ESC}1;3;31m`);
  });

  test("recolors bright foreground (90-97) to red", () => {
    expect(recolor(`${ESC}90m`, "bash")).toBe(`${ESC}31m`);
    expect(recolor(`${ESC}96m`, "bash")).toBe(`${ESC}31m`);
  });

  test("does not recolor background-only escapes", () => {
    // 40-47 / 100-107 are backgrounds; bash wrapper only matches fg list.
    expect(recolor(`${ESC}42m`, "bash")).toBe(`${ESC}42m`);
  });
});

describe("applyFailureColor", () => {
  test("status 0 is a no-op (zsh)", () => {
    expect(applyFailureColor(`${ESC}36mhi`, { status: 0 })).toBe(`${ESC}36mhi`);
  });
  test("status 1 recolors (zsh)", () => {
    expect(applyFailureColor(`${ESC}36mhi`, { status: 1 })).toBe(`${ESC}31mhi`);
  });
  test("status 1 recolors (bash)", () => {
    expect(applyFailureColor(`${ESC}32mhi`, { status: 1, shell: "bash" })).toBe(
      `${ESC}31mhi`,
    );
  });
});

describe("explainRecolor — ledger matches recolor()", () => {
  const corpus = [
    `${ESC}36mhi`,
    `${ESC}1;36mhi`,
    `${ESC}4;36mhi`,
    `${ESC}32mhi`,
    `${ESC}1;32mhi`,
    `${ESC}90mhi`,
    `${ESC}42mhi`,
    `${ESC}0mhi`,
    `${ESC}1;2;3;36mhi`,
    `${ESC}38;2;12;34;56mhi`,
    `${ESC}38;5;36mhi`,
    `${ESC}38;2;1;2;33mhi`,
    `${ESC}36ma${ESC}0m ${ESC}1;36mb`,
    `${ESC}30m30 ${ESC}32m32 ${ESC}36m36`,
  ];
  for (const input of corpus) {
    for (const shell of ["zsh", "bash"] as const) {
      test(`ledger output equals recolor(${JSON.stringify(input)}, ${shell})`, () => {
        expect(explainRecolor(input, shell).output).toBe(recolor(input, shell));
      });
    }
  }

  test("zsh leaves 4;36m untouched with prefix-not-in-list reason", () => {
    const { spans } = explainRecolor(`${ESC}4;36mhi`, "zsh");
    expect(spans[0].recolored).toBe(false);
    expect(spans[0].reason).toBe("untouched:prefix-not-in-zsh-list");
  });

  test("bash recolors 4;36m", () => {
    const { spans } = explainRecolor(`${ESC}4;36mhi`, "bash");
    expect(spans[0].recolored).toBe(true);
    expect(spans[0].reason).toBe("bash:fg-to-red");
    expect(spans[0].after).toBe(`${ESC}4;31m`);
  });

  test("truecolor 38;2;12;34;56m untouched in both shells", () => {
    for (const shell of ["zsh", "bash"] as const) {
      const { spans } = explainRecolor(`${ESC}38;2;12;34;56mhi`, shell);
      expect(spans[0].recolored).toBe(false);
      expect(spans[0].reason).toBe("untouched:truecolor-tail");
    }
  });

  test("bash tail-matches 38;5;36m (256-color) to 38;5;31m", () => {
    const zsh = explainRecolor(`${ESC}38;5;36mhi`, "zsh");
    expect(zsh.spans[0].recolored).toBe(false);
    const bash = explainRecolor(`${ESC}38;5;36mhi`, "bash");
    expect(bash.spans[0].recolored).toBe(true);
    expect(bash.spans[0].reason).toBe("bash:tail-256");
    expect(bash.output).toBe(`${ESC}38;5;31mhi`);
  });

  test("bash tail-matches 38;2;1;2;33m to 38;2;1;2;31m", () => {
    const bash = explainRecolor(`${ESC}38;2;1;2;33mhi`, "bash");
    expect(bash.spans[0].recolored).toBe(true);
    expect(bash.spans[0].reason).toBe("bash:tail-truecolor");
  });
});
