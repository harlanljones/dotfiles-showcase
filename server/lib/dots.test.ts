import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { DOTS_COMMAND_NAMES } from "../../src/lib/dotsCli";
import { parseDotsScript } from "./dots";

const FALLBACK_DOTS = readFileSync(join(import.meta.dir, "../../fallback/dots"), "utf8");

describe("parseDotsScript", () => {
  it("parses every canonical command in help order from the bundled Bash source", () => {
    const parsed = parseDotsScript(FALLBACK_DOTS);

    expect(parsed.missing).toEqual([]);
    expect(parsed.commands.map((command) => command.name)).toEqual(DOTS_COMMAND_NAMES);
    expect(parsed.commands.map((command) => command.aliases)).toEqual([
      ["apply"],
      [],
      ["st"],
      ["add"],
      ["ed"],
      [],
      ["pull"],
      ["pp"],
      [],
      ["-h", "--help"],
    ]);
  });

  it("classifies effects and serves exact handler functions without neighboring source", () => {
    const parsed = parseDotsScript(FALLBACK_DOTS);
    const effects = Object.fromEntries(parsed.commands.map(({ name, effect }) => [name, effect]));
    expect(effects).toEqual({
      sync: "write",
      diff: "read",
      status: "read",
      absorb: "write",
      edit: "write",
      cd: "navigate",
      update: "write",
      push: "write",
      doctor: "read",
      help: "read",
    });

    const push = parsed.commands.find((command) => command.name === "push");
    expect(push?.handler).toBe("cmd_push");
    expect(push?.handlerSource).toContain('exec dots-push "$@"');
    expect(push?.handlerSource).not.toContain("cmd_doctor()");
    expect(push?.handlerSource.trimEnd().endsWith("}")).toBe(true);
  });

  it("marks absent canonical commands without throwing", () => {
    const parsed = parseDotsScript("usage() {\n  echo help\n}\nmain() {\n  :\n}\n");
    expect(parsed.commands).toEqual([]);
    expect(parsed.missing).toEqual(DOTS_COMMAND_NAMES);
  });

  it("includes future documented commands as write operations by default", () => {
    const cyan = "$" + "{CYAN}";
    const reset = "$" + "{NC}";
    const extra = FALLBACK_DOTS
      .replace(
        "  " + cyan + "help" + reset + "              Show this help message",
        "  " + cyan + "ship" + reset + "              Publish a future snapshot\n"
          + "  " + cyan + "help" + reset + "              Show this help message",
      )
      .replace(
        "    help|-h|--help) usage ;;",
        '    ship)           cmd_ship "$@" ;;\n    help|-h|--help) usage ;;',
      )
      .replace(
        "# Subcommand dispatch",
        "cmd_ship() {\n  printf '%s\\n' \"future\"\n}\n\n# Subcommand dispatch",
      );

    const parsed = parseDotsScript(extra);
    const ship = parsed.commands.find((command) => command.name === "ship");
    expect(ship?.effect).toBe("write");
    expect(ship?.handler).toBe("cmd_ship");
    expect(parsed.missing).toEqual([]);
  });
});
