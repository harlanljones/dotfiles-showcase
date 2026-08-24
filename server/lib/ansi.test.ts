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
});
