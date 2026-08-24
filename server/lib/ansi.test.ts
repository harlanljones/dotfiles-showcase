import { describe, expect, test } from "bun:test";
import { ansiToHtml } from "./ansi";

const ESC = "\x1b[";

describe("ansiToHtml", () => {
  test("converts a basic 8-color escape", () => {
    const html = ansiToHtml(`${ESC}36mhello${ESC}0m`);
    expect(html).toContain("hello");
    expect(html).toContain("color");
  });

  test("converts prefixed variants (1;36m, 3;36m, 1;3;36m, 2;36m)", () => {
    for (const p of ["1;", "3;", "2;", "1;3;"]) {
      const html = ansiToHtml(`${ESC}${p}36mhi`);
      expect(html).toContain("hi");
    }
  });

  test("converts truecolor 38;2;r;g;b", () => {
    const html = ansiToHtml(`${ESC}38;2;12;34;56mhi`);
    expect(html).toContain("hi");
    // 24-bit color produces an rgb() style.
    expect(html.toLowerCase()).toMatch(/rgb\(|#0c2238|color/);
  });

  test("escapes HTML/XML so markup cannot be injected", () => {
    const html = ansiToHtml(`${ESC}36m<script>alert(1)</script>`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("handles empty input without throwing", () => {
    expect(ansiToHtml("")).toBe("");
  });

  test("preserves newlines from add_newline prompts", () => {
    const html = ansiToHtml(`\n${ESC}36mhi`);
    expect(html).toContain("hi");
  });

  test("strips bash readline wrappers \\[ \\] (invisible in a real terminal)", () => {
    const html = ansiToHtml(`${ESC}36m\\[user\\]@\\[host\\]`);
    expect(html).not.toContain("\\[");
    expect(html).not.toContain("\\]");
    expect(html).toContain("user@host");
  });

  test("strips zsh prompt wrappers %{ %}", () => {
    const html = ansiToHtml(`%{${ESC}36m%}harlan%{${ESC}0m%}`);
    expect(html).not.toContain("%{");
    expect(html).not.toContain("%}");
    expect(html).toContain("harlan");
  });

  test("strips OSC sequences (e.g. OSC 8/133)", () => {
    const html = ansiToHtml(`${ESC}36mhi\x1b]8;;http://x\x1b\\\\link\x07${ESC}0m`);
    expect(html).toContain("hi");
    expect(html).toContain("link");
    expect(html).not.toContain("http://x");
  });

  test("maps SGR colors through a supplied terminal palette", () => {
    // Ghostty-style palette: index 6 = cyan, index 9 = bright red.
    const palette = new Array(16).fill("#101010");
    palette[6] = "#508381"; // SGR 36 -> colors[6]
    palette[9] = "#d38290"; // SGR 91 -> colors[8 + (91-90)]
    const html = ansiToHtml(`${ESC}36mc${ESC}0m ${ESC}91mr`, { palette });
    expect(html.toLowerCase()).toContain("#508381");
    expect(html.toLowerCase()).toContain("#d38290");
  });

  test("palette conversion still escapes markup", () => {
    const palette = new Array(16).fill("#101010");
    const html = ansiToHtml(`${ESC}36m<b>bold</b>`, { palette });
    expect(html).not.toContain("<b>");
  });
});
