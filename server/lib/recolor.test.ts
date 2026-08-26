import { describe, expect, test } from "bun:test";
import { applyFailureColor, explainRecolor, recolor, type TrueColor } from "./recolor";

const ESC = "\x1b[";

// TC-01 proposed-fix preview: the palette cyan/red the truecolor path targets.
const TC: TrueColor = { cyan: [46, 222, 250], red: [255, 102, 92] };

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

describe("recolor — truecolor opt-in (TC-01 proposed-fix preview)", () => {
  const variants = ["", "1;", "2;", "3;", "1;2;", "1;3;", "2;3;", "1;2;3;"];

  for (const p of variants) {
    test(`zsh recolors ${JSON.stringify(p)}38;2;cyan -> ${p}38;2;red`, () => {
      const input = `${ESC}${p}38;2;46;222;250mhi`;
      const expected = `${ESC}${p}38;2;255;102;92mhi`;
      expect(recolor(input, "zsh", TC)).toBe(expected);
    });
  }

  test("zsh leaves non-cyan truecolor untouched", () => {
    expect(recolor(`${ESC}38;2;255;0;0mred`, "zsh", TC)).toBe(`${ESC}38;2;255;0;0mred`);
    expect(recolor(`${ESC}1;38;2;0;128;0mgreen`, "zsh", TC)).toBe(`${ESC}1;38;2;0;128;0mgreen`);
  });

  test("zsh leaves truecolor background (48;2) untouched", () => {
    expect(recolor(`${ESC}48;2;46;222;250m`, "zsh", TC)).toBe(`${ESC}48;2;46;222;250m`);
  });

  test("bash recolors any truecolor foreground to red RGB", () => {
    expect(recolor(`${ESC}38;2;46;222;250mcyan`, "bash", TC)).toBe(`${ESC}38;2;255;102;92mcyan`);
    expect(recolor(`${ESC}1;38;2;0;128;0mgreen`, "bash", TC)).toBe(`${ESC}1;38;2;255;102;92mgreen`);
  });

  test("bash leaves truecolor background (48;2) untouched", () => {
    expect(recolor(`${ESC}48;2;46;222;250m`, "bash", TC)).toBe(`${ESC}48;2;46;222;250m`);
  });

  test("trueColor undefined keeps the 8-color-only behavior (no 38;2 handling)", () => {
    // Without opt-in the cyan truecolor stays as-is (matches shipped dotfiles).
    expect(recolor(`${ESC}38;2;46;222;250mhi`, "zsh")).toBe(`${ESC}38;2;46;222;250mhi`);
    expect(recolor(`${ESC}38;2;46;222;250mhi`, "bash")).toBe(`${ESC}38;2;46;222;250mhi`);
  });

  test("trueColor on recolors BOTH 8-color and truecolor in one pass", () => {
    const input = `${ESC}36m8c${ESC}0m ${ESC}38;2;46;222;250mtc`;
    const out = recolor(input, "zsh", TC);
    expect(out).toBe(`${ESC}31m8c${ESC}0m ${ESC}38;2;255;102;92mtc`);
  });

  test("applyFailureColor status 0 is a no-op even with trueColor", () => {
    expect(applyFailureColor(`${ESC}38;2;46;222;250mhi`, { status: 0, trueColor: TC })).toBe(
      `${ESC}38;2;46;222;250mhi`,
    );
  });
});

describe("explainRecolor — truecolor ledger matches recolor()", () => {
  const corpus = [
    `${ESC}38;2;46;222;250mhi`,
    `${ESC}1;38;2;46;222;250mhi`,
    `${ESC}38;2;255;0;0mred`,
    `${ESC}48;2;46;222;250m`,
    `${ESC}38;2;46;222;250ma${ESC}0m ${ESC}1;38;2;46;222;250mb`,
  ];
  for (const input of corpus) {
    for (const shell of ["zsh", "bash"] as const) {
      test(`ledger output equals recolor(${JSON.stringify(input)}, ${shell}, TC)`, () => {
        expect(explainRecolor(input, shell, TC).output).toBe(recolor(input, shell, TC));
      });
    }
  }

  test("zsh truecolor-cyan span is flagged and explained", () => {
    const { spans } = explainRecolor(`${ESC}38;2;46;222;250mhi`, "zsh", TC);
    expect(spans[0].recolored).toBe(true);
    expect(spans[0].reason).toBe("zsh:truecolor-cyan");
  });

  test("zsh non-cyan truecolor span is untouched:truecolor-not-cyan", () => {
    const { spans } = explainRecolor(`${ESC}38;2;255;0;0mhi`, "zsh", TC);
    expect(spans[0].recolored).toBe(false);
    expect(spans[0].reason).toBe("untouched:truecolor-not-cyan");
  });

  test("bash truecolor-foreground span is flagged bash:truecolor-fg-to-red", () => {
    const { spans } = explainRecolor(`${ESC}38;2;46;222;250mhi`, "bash", TC);
    expect(spans[0].recolored).toBe(true);
    expect(spans[0].reason).toBe("bash:truecolor-fg-to-red");
  });
});
