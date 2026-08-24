import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { homePath, readConfig } from "./configs";

describe("homePath", () => {
  it("joins segments under the real home directory", () => {
    expect(homePath(".config", "ghostty", "config")).toBe(
      join(homedir(), ".config", "ghostty", "config"),
    );
  });
});

describe("readConfig", () => {
  it("uses the bundled fallback when no live path exists", () => {
    const res = readConfig(homePath("does", "not", "exist"), "mise.toml");
    expect(res.source).toBe("fallback");
    expect(res.content).toContain("[tools]");
    expect(res.content).toContain('bun = "latest"');
  });

  it("falls back gracefully on an empty candidate list", () => {
    const res = readConfig([], "ripgrep-rc");
    expect(res.source).toBe("fallback");
    expect(res.content).toContain("--smart-case");
  });

  it("prefers the first existing live path over the fallback", () => {
    const dir = mkdtempSync(join(tmpdir(), "cfg-live-"));
    const file = join(dir, "live.toml");
    writeFileSync(file, "# live marker\n");
    const res = readConfig([file], "mise.toml");
    expect(res.source).toBe("live");
    expect(res.content).toContain("# live marker");
  });

  it("skips missing earlier candidates and uses a later live one", () => {
    const dir = mkdtempSync(join(tmpdir(), "cfg-live2-"));
    const file = join(dir, "later.txt");
    writeFileSync(file, "second\n");
    const res = readConfig(["/nonexistent/a", file], "mise.toml");
    expect(res.source).toBe("live");
    expect(res.content).toBe("second\n");
  });
});
