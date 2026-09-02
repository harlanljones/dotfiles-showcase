import { describe, expect, it } from "bun:test";
import type { DotsCommand } from "./dotsCli";
import {
  DOTS_WORKFLOWS,
  NO_EXECUTION_DISCLOSURE,
  UNSUPPORTED_DISCLOSURE,
  getWorkflow,
  projectDotsWorkflow,
} from "./dotsWorkflow";

const FAKE_CMD = (name: string, overrides: Partial<DotsCommand> = {}): DotsCommand => ({
  name,
  aliases: [],
  description: `${name} does something`,
  effect: "read",
  handler: `cmd_${name}`,
  handlerSource: `${name}() { :; }`,
  ...overrides,
});

describe("dotsWorkflow: supported commands", () => {
  it("exports all ten canonical commands", () => {
    expect(DOTS_WORKFLOWS.map((w) => w.name).sort()).toEqual([
      "absorb", "cd", "diff", "doctor", "edit", "help", "push", "status", "sync", "update",
    ]);
  });

  for (const workflow of DOTS_WORKFLOWS) {
    it(`${workflow.name}: projects parsed evidence and simulated scenario`, () => {
      const cmd = FAKE_CMD(workflow.name, { aliases: ["x"], effect: workflow.effect });
      const view = projectDotsWorkflow(cmd);

      expect(view.supported).toBe(true);
      expect(view.scenario.trace.length).toBeGreaterThan(0);
      expect(view.scenario.disclosure).toBe(NO_EXECUTION_DISCLOSURE);

      // First line is always the command line
      expect(view.scenario.trace[0].kind).toBe("command");
      expect(view.scenario.trace[0].text).toContain(`dots ${workflow.name}`);

      // Contains evidence lines (handler, effect)
      const evidence = view.scenario.trace.filter((l) => l.kind === "evidence");
      expect(evidence.length).toBeGreaterThanOrEqual(2);
      expect(evidence.some((l) => l.text.includes(`cmd_${workflow.name}`))).toBe(true);
      expect(evidence.some((l) => l.text.includes(workflow.effect))).toBe(true);

      // Contains simulated lines
      const simulated = view.scenario.trace.filter((l) => l.kind === "simulated");
      expect(simulated.length).toBeGreaterThan(0);
    });

    it(`${workflow.name}: controls match the workflow declaration`, () => {
      const wf = getWorkflow(workflow.name)!;
      const view = projectDotsWorkflow(FAKE_CMD(workflow.name));
      expect(view.controls.map((c) => c.id)).toEqual(wf.controls.map((c) => c.id));
    });
  }
});

describe("dotsWorkflow: control behavior", () => {
  it("sync: dry-run changes the simulated output", () => {
    const cmd = FAKE_CMD("sync", { effect: "write" });
    const normal = projectDotsWorkflow(cmd, {});
    const dryRun = projectDotsWorkflow(cmd, { "--dry-run": true });

    const normalText = normal.scenario.trace.map((l) => l.text).join("\n");
    const dryRunText = dryRun.scenario.trace.map((l) => l.text).join("\n");

    expect(normalText).toContain("== Synchronizing dotfiles ==");
    expect(normalText).toContain("✓ Simulated apply complete");
    expect(dryRunText).toContain("== Dry Run: Inspecting pending changes ==");
    expect(dryRunText).toContain("No files changed.");
  });

  it("sync: command line includes active flags", () => {
    const cmd = FAKE_CMD("sync");
    const view = projectDotsWorkflow(cmd, { "--dry-run": true, "--verbose": true });
    expect(view.scenario.commandLine).toBe("dots sync --dry-run --verbose");
  });

  it("diff: --all changes the simulated output", () => {
    const cmd = FAKE_CMD("diff");
    const plain = projectDotsWorkflow(cmd, {});
    const all = projectDotsWorkflow(cmd, { "--all": true });

    expect(plain.scenario.commandLine).toBe("dots diff");
    expect(all.scenario.commandLine).toBe("dots diff --all");
    const plainText = plain.scenario.trace.map((l) => l.text).join("\n");
    const allText = all.scenario.trace.map((l) => l.text).join("\n");
    expect(plainText).toContain("script contents hidden");
    expect(allText).toContain("generated scripts included");
  });

  it("absorb: editable target affects only the local display model", () => {
    const cmd = FAKE_CMD("absorb");
    const view = projectDotsWorkflow(cmd, { target: "~/.zshrc" });
    expect(view.scenario.commandLine).toBe("dots absorb ~/.zshrc");
    const text = view.scenario.trace.map((l) => l.text).join("\n");
    expect(text).toContain("~/.zshrc");
  });

  it("absorb: falls back to the default target when blank", () => {
    const cmd = FAKE_CMD("absorb");
    const view = projectDotsWorkflow(cmd, { target: "" });
    expect(view.scenario.commandLine).toContain("~/.config/starship.toml");
  });

  it("cd: --print toggles the output", () => {
    const cmd = FAKE_CMD("cd");
    const plain = projectDotsWorkflow(cmd, {});
    const printed = projectDotsWorkflow(cmd, { "--print": true });

    expect(plain.scenario.commandLine).toBe("dots cd");
    expect(printed.scenario.commandLine).toBe("dots cd --print");
    const plainText = plain.scenario.trace.map((l) => l.text).join("\n");
    const printedText = printed.scenario.trace.map((l) => l.text).join("\n");
    expect(plainText).toContain("Would enter");
    expect(printedText).toContain("~/.local/share/chezmoi");
  });

  it("edit: target text affects only the local display", () => {
    const cmd = FAKE_CMD("edit");
    const view = projectDotsWorkflow(cmd, { target: "~/.zshrc" });
    expect(view.scenario.commandLine).toContain("~/.zshrc");
    const text = view.scenario.trace.map((l) => l.text).join("\n");
    expect(text).toContain("~/.zshrc");
  });
});

describe("dotsWorkflow: unsupported commands", () => {
  it("unknown parsed command shows unsupported evidence", () => {
    const cmd = FAKE_CMD("ship", { handler: "cmd_ship" });
    const view = projectDotsWorkflow(cmd);

    expect(view.supported).toBe(false);
    expect(view.scenario.trace[0].kind).toBe("command");
    expect(view.scenario.trace[0].text).toContain("dots ship");

    // No simulated lines — only evidence
    const simulated = view.scenario.trace.filter((l) => l.kind === "simulated");
    expect(simulated.length).toBe(0);
    expect(view.scenario.trace.some((l) => l.text.includes("cmd_ship"))).toBe(true);
    expect(view.scenario.disclosure).toBe(UNSUPPORTED_DISCLOSURE);
  });

  it("unsupported command carries parsed evidence", () => {
    const cmd = FAKE_CMD("ship", { handler: "cmd_ship", effect: "write", aliases: ["sh"] });
    const view = projectDotsWorkflow(cmd);
    const evidence = view.scenario.trace.filter((l) => l.kind === "evidence");
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    expect(evidence.some((l) => l.text.includes("cmd_ship()"))).toBe(true);
    expect(evidence.some((l) => l.text.includes("write"))).toBe(true);
    expect(evidence.some((l) => l.text.includes("sh"))).toBe(true);
  });
});

describe("dotsWorkflow: no-execution and safety", () => {
  for (const wf of DOTS_WORKFLOWS) {
    it(`${wf.name}: disclosure is always present`, () => {
      const view = projectDotsWorkflow(FAKE_CMD(wf.name));
      expect(view.scenario.disclosure).toBe(NO_EXECUTION_DISCLOSURE);
    });
  }

  it("no-execution disclosure is also present for unsupported commands", () => {
    const view = projectDotsWorkflow(FAKE_CMD("unknown"));
    expect(view.scenario.disclosure).toBe(UNSUPPORTED_DISCLOSURE);
  });
});

describe("dotsWorkflow: controls", () => {
  it("sync has three toggle controls", () => {
    const wf = getWorkflow("sync")!;
    expect(wf.controls.length).toBe(3);
    expect(wf.controls.every((c) => c.kind === "toggle")).toBe(true);
  });

  it("absorb has a text control with default", () => {
    const wf = getWorkflow("absorb")!;
    expect(wf.controls.length).toBe(1);
    expect(wf.controls[0].kind).toBe("text");
    if (wf.controls[0].kind === "text") {
      expect(wf.controls[0].defaultValue).toBe("~/.config/starship.toml");
    }
  });

  it("status has no controls", () => {
    const wf = getWorkflow("status")!;
    expect(wf.controls.length).toBe(0);
  });
});