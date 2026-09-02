import type { DotsCommand, DotsEffect } from "./dotsCli";

export const NO_EXECUTION_DISCLOSURE =
  "Simulated for display only — no subprocess is started, no dotfile is created or modified.";

export const UNSUPPORTED_DISCLOSURE =
  "This command has no authored safe scenario. Shown as parsed handler evidence only — the showcase does not execute it.";

export type DotsControlValue = boolean | string;
export type DotsControlValues = Record<string, DotsControlValue>;

export type DotsControl =
  | { kind: "toggle"; id: string; label: string; flag: string }
  | { kind: "text"; id: string; label: string; defaultValue: string };

export type DotsTraceKind = "command" | "evidence" | "simulated";

export interface DotsTraceLine {
  kind: DotsTraceKind;
  text: string;
}

export interface DotsScenario {
  /** Exact simulated command line, e.g. "dots sync --dry-run". */
  commandLine: string;
  /** Ordered trace lines (command line first, then evidence, then simulated). */
  trace: DotsTraceLine[];
  /** Persistent no-execution disclosure for this scenario. */
  disclosure: string;
}

export interface DotsWorkflow {
  /** Canonical command name this declaration owns. */
  name: string;
  /** Canonical effect (read | navigate | write). */
  effect: DotsEffect;
  /** Permitted preview controls for this command. */
  controls: readonly DotsControl[];
  /** Builds the safe scenario from parsed facts + local-only values. */
  scenario: (command: DotsCommand, values: DotsControlValues) => DotsScenario;
}

export interface DotsWorkflowView {
  supported: boolean;
  command: DotsCommand;
  scenario: DotsScenario;
  controls: readonly DotsControl[];
  values: DotsControlValues;
}

// ---------------------------------------------------------------------------
// Evidence lines derived from parsed command facts
// ---------------------------------------------------------------------------

function evidenceTrace(command: DotsCommand): DotsTraceLine[] {
  const lines: DotsTraceLine[] = [
    { kind: "evidence", text: `handler: ${command.handler}()` },
    { kind: "evidence", text: `effect: ${command.effect}` },
  ];
  if (command.aliases.length > 0) {
    lines.push({ kind: "evidence", text: `aliases: ${command.aliases.join(", ")}` });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Command-line builder helpers
// ---------------------------------------------------------------------------

const DEFAULT_TARGET = "~/.config/starship.toml";

function activeFlags(values: DotsControlValues, ...flags: string[]): string {
  return flags.filter((f) => values[f]).join(" ");
}

// ---------------------------------------------------------------------------
// Per-command workflow declarations
// ---------------------------------------------------------------------------

const SYNC_FLAGS = ["--dry-run", "--verbose", "--force"];

const syncWorkflow: DotsWorkflow = {
  name: "sync",
  effect: "write",
  controls: [
    { kind: "toggle", id: "--dry-run", label: "dry run", flag: "--dry-run" },
    { kind: "toggle", id: "--verbose", label: "verbose", flag: "--verbose" },
    { kind: "toggle", id: "--force", label: "force", flag: "--force" },
  ],
  scenario(command, values) {
    const flags = activeFlags(values, ...SYNC_FLAGS);
    const cmdLine = flags ? `dots sync ${flags}` : "dots sync";
    const dryRun = Boolean(values["--dry-run"]);
    const simulated: DotsTraceLine[] = [
      { kind: "simulated", text: dryRun ? "== Dry Run: Inspecting pending changes ==" : "== Synchronizing dotfiles ==" },
      { kind: "simulated", text: "  inspect  ~/.config/starship.toml" },
      { kind: "simulated", text: dryRun ? "No files changed." : "✓ Simulated apply complete. No files changed by this showcase." },
    ];
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        ...simulated,
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const diffWorkflow: DotsWorkflow = {
  name: "diff",
  effect: "read",
  controls: [
    { kind: "toggle", id: "--all", label: "include generated scripts", flag: "--all" },
  ],
  scenario(command, values) {
    const all = Boolean(values["--all"]);
    const cmdLine = all ? "dots diff --all" : "dots diff";
    const simulated: DotsTraceLine[] = [
      { kind: "simulated", text: all ? "diff -- generated scripts included" : "diff -- script contents hidden" },
      { kind: "simulated", text: "--- source/starship.toml" },
      { kind: "simulated", text: "+++ ~/.config/starship.toml" },
      { kind: "simulated", text: "@@ pending local drift (sanitized) @@" },
    ];
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        ...simulated,
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const statusWorkflow: DotsWorkflow = {
  name: "status",
  effect: "read",
  controls: [],
  scenario(command, _values) {
    const cmdLine = "dots status";
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "simulated", text: "Managed Dotfiles Status:" },
        { kind: "simulated", text: "  modified:   ~/.config/starship.toml" },
        { kind: "simulated", text: "  modified:   ~/.config/ghostty/config" },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const absorbWorkflow: DotsWorkflow = {
  name: "absorb",
  effect: "write",
  controls: [
    { kind: "text", id: "target", label: "target", defaultValue: DEFAULT_TARGET },
  ],
  scenario(command, values) {
    const target = (values.target as string || DEFAULT_TARGET).trim() || DEFAULT_TARGET;
    const cmdLine = `dots absorb ${target}`;
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "simulated", text: "Re-adding target into chezmoi source:" },
        { kind: "simulated", text: `  ${target}` },
        { kind: "simulated", text: "✓ Simulated capture trace. Source remains untouched." },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const editWorkflow: DotsWorkflow = {
  name: "edit",
  effect: "write",
  controls: [
    { kind: "text", id: "target", label: "target", defaultValue: DEFAULT_TARGET },
  ],
  scenario(command, values) {
    const target = (values.target as string || DEFAULT_TARGET).trim() || DEFAULT_TARGET;
    const cmdLine = `dots edit ${target}`;
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "simulated", text: "Would open the source template for:" },
        { kind: "simulated", text: `  ${target}` },
        { kind: "simulated", text: "Editor launch suppressed in this read-only showcase." },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const cdWorkflow: DotsWorkflow = {
  name: "cd",
  effect: "navigate",
  controls: [
    { kind: "toggle", id: "--print", label: "print instead of entering a shell", flag: "--print" },
  ],
  scenario(command, values) {
    const printPath = Boolean(values["--print"]);
    const cmdLine = printPath ? "dots cd --print" : "dots cd";
    const simulated: DotsTraceLine[] = [
      { kind: "simulated", text: printPath ? "~/.local/share/chezmoi" : "Would enter ~/.local/share/chezmoi in an interactive shell." },
    ];
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        ...simulated,
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const updateWorkflow: DotsWorkflow = {
  name: "update",
  effect: "write",
  controls: [
    { kind: "toggle", id: "--dry-run", label: "dry run", flag: "--dry-run" },
    { kind: "toggle", id: "--verbose", label: "verbose", flag: "--verbose" },
    { kind: "toggle", id: "--force", label: "force", flag: "--force" },
  ],
  scenario(command, values) {
    const flags = activeFlags(values, ...SYNC_FLAGS);
    const cmdLine = flags ? `dots update ${flags}` : "dots update";
    const simulated: DotsTraceLine[] = [
      { kind: "simulated", text: "Pulling latest changes in ~/.local/share/chezmoi\u2026" },
      { kind: "simulated", text: "git pull --rebase" },
      { kind: "evidence", text: "handoff \u2192 cmd_sync" },
      { kind: "simulated", text: "Network and apply steps suppressed." },
    ];
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        ...simulated,
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const pushWorkflow: DotsWorkflow = {
  name: "push",
  effect: "write",
  controls: [],
  scenario(command, _values) {
    const cmdLine = "dots push";
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "evidence", text: "handoff \u2192 dots-push" },
        { kind: "simulated", text: "documented stages: re-add \u2192 stage \u2192 local Ollama message \u2192 commit \u2192 origin" },
        { kind: "simulated", text: "Commit, model, and network steps suppressed." },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const doctorWorkflow: DotsWorkflow = {
  name: "doctor",
  effect: "read",
  controls: [],
  scenario(command, _values) {
    const cmdLine = "dots doctor";
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "simulated", text: "=== Dotfiles Health & Diagnostics ===" },
        { kind: "simulated", text: " \u2713 chezmoi: available" },
        { kind: "simulated", text: " \u2713 source repo: clean" },
        { kind: "simulated", text: " \u2013 age key: path redacted" },
        { kind: "simulated", text: "Diagnostics shown as a sanitized simulation." },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

const helpWorkflow: DotsWorkflow = {
  name: "help",
  effect: "read",
  controls: [],
  scenario(command, _values) {
    const cmdLine = "dots help";
    return {
      commandLine: cmdLine,
      trace: [
        { kind: "command", text: `$ ${cmdLine}` },
        ...evidenceTrace(command),
        { kind: "simulated", text: "dots <command> [options] [arguments]" },
        { kind: "simulated", text: "Ten workflows are documented by the served Bash source." },
      ],
      disclosure: NO_EXECUTION_DISCLOSURE,
    };
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const WORKFLOWS: Record<string, DotsWorkflow> = {
  sync: syncWorkflow,
  diff: diffWorkflow,
  status: statusWorkflow,
  absorb: absorbWorkflow,
  edit: editWorkflow,
  cd: cdWorkflow,
  update: updateWorkflow,
  push: pushWorkflow,
  doctor: doctorWorkflow,
  help: helpWorkflow,
};

export const DOTS_WORKFLOWS: readonly DotsWorkflow[] = Object.values(WORKFLOWS);

export function getWorkflow(name: string): DotsWorkflow | undefined {
  return WORKFLOWS[name];
}

// ---------------------------------------------------------------------------
// Projection — turns parsed facts + control values into a display model
// ---------------------------------------------------------------------------

function unsupportedScenario(command: DotsCommand): DotsScenario {
  const cmdLine = `dots ${command.name}`;
  return {
    commandLine: cmdLine,
    trace: [
      { kind: "command", text: `$ ${cmdLine}` },
      ...evidenceTrace(command),
      { kind: "evidence", text: "no authored safe scenario — unsupported parsed evidence" },
    ],
    disclosure: UNSUPPORTED_DISCLOSURE,
  };
}

function mergeDefaults(controls: readonly DotsControl[], values: DotsControlValues): DotsControlValues {
  const merged: DotsControlValues = { ...values };
  for (const c of controls) {
    if (c.kind === "toggle") {
      if (merged[c.id] === undefined) merged[c.id] = false;
    } else if (c.kind === "text") {
      if (merged[c.id] === undefined) merged[c.id] = c.defaultValue;
    }
  }
  return merged;
}

export function projectDotsWorkflow(
  command: DotsCommand,
  values: DotsControlValues = {},
): DotsWorkflowView {
  const workflow = WORKFLOWS[command.name];
  if (!workflow) {
    return {
      supported: false,
      command,
      scenario: unsupportedScenario(command),
      controls: [],
      values,
    };
  }
  const merged = mergeDefaults(workflow.controls, values);
  const scenario = workflow.scenario(command, merged);
  return {
    supported: true,
    command,
    scenario,
    controls: workflow.controls,
    values: merged,
  };
}