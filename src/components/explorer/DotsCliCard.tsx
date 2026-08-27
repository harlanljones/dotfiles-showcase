import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import type { DotsCardPayload, DotsCommand } from "../../lib/dotsCli";
import { CardShell, Notice, SourceBadge } from "./ui";

const DEFAULT_TARGET = "~/.config/starship.toml";

const OPTION_LABELS = [
  ["--dry-run", "dry run"],
  ["--verbose", "verbose"],
  ["--force", "force"],
] as const;

function invocation(
  command: DotsCommand,
  syncOptions: Record<string, boolean>,
  includeScripts: boolean,
  printPath: boolean,
  target: string,
): string {
  const args: string[] = [];
  if (command.name === "sync" || command.name === "update") {
    for (const [flag] of OPTION_LABELS) {
      if (syncOptions[flag]) args.push(flag);
    }
  } else if (command.name === "diff" && includeScripts) {
    args.push("--all");
  } else if (command.name === "absorb" || command.name === "edit") {
    args.push(target.trim() || DEFAULT_TARGET);
  } else if (command.name === "cd" && printPath) {
    args.push("--print");
  }
  return ["dots", command.name, ...args].join(" ");
}

function transcript(command: DotsCommand, commandLine: string): string {
  const lines: string[] = ["$ " + commandLine];
  switch (command.name) {
    case "sync":
      lines.push(
        commandLine.includes("--dry-run")
          ? "== Dry Run: Inspecting pending changes =="
          : "== Synchronizing dotfiles ==",
        "  inspect  ~/.config/starship.toml",
        commandLine.includes("--dry-run")
          ? "No files changed."
          : "✓ Simulated apply complete. No files changed by this showcase.",
      );
      break;
    case "diff":
      lines.push(
        commandLine.includes("--all")
          ? "diff -- generated scripts included"
          : "diff -- script contents hidden",
        "--- source/starship.toml",
        "+++ ~/.config/starship.toml",
        "@@ pending local drift (sanitized) @@",
      );
      break;
    case "status":
      lines.push(
        "Managed Dotfiles Status:",
        "  modified:   ~/.config/starship.toml",
        "  modified:   ~/.config/ghostty/config",
      );
      break;
    case "absorb":
      lines.push(
        "Re-adding target into chezmoi source:",
        "  " + (commandLine.split(" ").slice(2).join(" ") || DEFAULT_TARGET),
        "✓ Simulated capture trace. Source remains untouched.",
      );
      break;
    case "edit":
      lines.push(
        "Would open the source template for:",
        "  " + (commandLine.split(" ").slice(2).join(" ") || DEFAULT_TARGET),
        "Editor launch suppressed in this read-only showcase.",
      );
      break;
    case "cd":
      lines.push(
        commandLine.includes("--print")
          ? "~/.local/share/chezmoi"
          : "Would enter ~/.local/share/chezmoi in an interactive shell.",
      );
      break;
    case "update":
      lines.push(
        "Pulling latest changes in ~/.local/share/chezmoi…",
        "git pull --rebase",
        "handoff → cmd_sync",
        "Network and apply steps suppressed.",
      );
      break;
    case "push":
      lines.push(
        "handoff → dots-push",
        "documented stages: re-add → stage → local Ollama message → commit → origin",
        "Commit, model, and network steps suppressed.",
      );
      break;
    case "doctor":
      lines.push(
        "=== Dotfiles Health & Diagnostics ===",
        " ✓ chezmoi: available",
        " ✓ source repo: clean",
        " – age key: path redacted",
        "Diagnostics shown as a sanitized simulation.",
      );
      break;
    default:
      lines.push(
        "dots <command> [options] [arguments]",
        "Ten workflows are documented by the served Bash source.",
      );
  }
  return lines.join("\n");
}

function EffectMark({ effect }: { effect: DotsCommand["effect"] }) {
  return <span className={"dots-effect dots-effect-" + effect}>{effect}</span>;
}

export default function DotsCliCard() {
  const { data, error } = useJson<DotsCardPayload>("/api/cards/dots");
  const [selectedName, setSelectedName] = useState("status");
  const [syncOptions, setSyncOptions] = useState<Record<string, boolean>>({});
  const [includeScripts, setIncludeScripts] = useState(false);
  const [printPath, setPrintPath] = useState(true);
  const [target, setTarget] = useState(DEFAULT_TARGET);

  const selected = data?.commands.find((command) => command.name === selectedName)
    ?? data?.commands[0];
  const commandLine = selected
    ? invocation(selected, syncOptions, includeScripts, printPath, target)
    : "dots status";
  const terminal = useMemo(
    () => selected ? transcript(selected, commandLine) : "",
    [selected, commandLine],
  );

  const toggleSyncOption = (flag: string) => {
    setSyncOptions((current) => ({ ...current, [flag]: !current[flag] }));
  };

  return (
    <CardShell
      title="Dots CLI"
      blurb="The served Bash wrapper is parsed, never executed. Choose a verb to inspect its exact handler and a sanitized, client-side workflow trace."
      badges={data ? (
        <span className="flex gap-4">
          <SourceBadge source={data.source} />
          <SourceBadge source="simulated" />
        </span>
      ) : undefined}
      notes={<p>LIVE/FALLBACK identifies the source file. SIMULATED identifies every transcript.</p>}
    >
      {error && (
        <Notice tone="error">
          Dots source could not be loaded. Check the cards API, then retry.
        </Notice>
      )}
      {!data && !error && <p className="dots-loading">reading the dots command map…</p>}
      {data && (
        <div className="dots-stage">
          {data.warnings.map((warning) => (
            <Notice key={warning} tone="warning">{warning}</Notice>
          ))}

          <div className="dots-workbench">
            <section className="dots-terminal" aria-label="Simulated dots transcript">
              <div className="dots-terminal-meta">
                <span><i className="terminal-dot" />simulated trace</span>
                <span>no subprocess · no writes</span>
              </div>
              <pre className="dots-terminal-copy">{terminal}</pre>
              {selected && (
                <p className="dots-description">
                  <EffectMark effect={selected.effect} />
                  {selected.description}
                </p>
              )}
            </section>

            <nav className="dots-command-list" aria-label="Dots commands">
              {data.commands.map((command) => (
                <button
                  key={command.name}
                  type="button"
                  aria-pressed={command.name === selected?.name}
                  onClick={() => setSelectedName(command.name)}
                >
                  <span className="dots-command-name">{command.name}</span>
                  <span className="dots-command-aliases">
                    {command.aliases.length > 0 ? command.aliases.join(" · ") : "—"}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {selected && (
            <>
              <div className="dots-options" aria-label={"Options for dots " + selected.name}>
                {(selected.name === "sync" || selected.name === "update") && OPTION_LABELS.map(([flag, label]) => (
                  <button
                    key={flag}
                    type="button"
                    aria-pressed={Boolean(syncOptions[flag])}
                    onClick={() => toggleSyncOption(flag)}
                  >
                    <code>{flag}</code>
                    <span>{label}</span>
                  </button>
                ))}
                {selected.name === "diff" && (
                  <button
                    type="button"
                    aria-pressed={includeScripts}
                    onClick={() => setIncludeScripts((value) => !value)}
                  >
                    <code>--all</code>
                    <span>include generated scripts</span>
                  </button>
                )}
                {selected.name === "cd" && (
                  <button
                    type="button"
                    aria-pressed={printPath}
                    onClick={() => setPrintPath((value) => !value)}
                  >
                    <code>--print</code>
                    <span>print instead of entering a shell</span>
                  </button>
                )}
                {(selected.name === "absorb" || selected.name === "edit") && (
                  <label className="dots-target">
                    <span>target</span>
                    <input
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                )}
                {!["sync", "update", "diff", "cd", "absorb", "edit"].includes(selected.name) && (
                  <p>no preview options for this command</p>
                )}
              </div>

              <section className="dots-trace" aria-label="Exact served handler source">
                <header>
                  <span>exact served handler</span>
                  <code>{selected.handler}()</code>
                </header>
                <pre>{selected.handlerSource}</pre>
              </section>
            </>
          )}
        </div>
      )}
    </CardShell>
  );
}
