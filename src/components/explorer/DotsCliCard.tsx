import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import type { DotsCardPayload, DotsCommand } from "../../lib/dotsCli";
import {
  projectDotsWorkflow,
  UNSUPPORTED_DISCLOSURE,
  type DotsControl,
  type DotsControlValue,
} from "../../lib/dotsWorkflow";
import { CardShell, Notice, SourceBadge } from "./ui";

function EffectMark({ effect }: { effect: DotsCommand["effect"] }) {
  return <span className={"dots-effect dots-effect-" + effect}>{effect}</span>;
}

export default function DotsCliCard() {
  const { data, error } = useJson<DotsCardPayload>("/api/cards/dots");
  const [selectedName, setSelectedName] = useState("status");
  const [controlValues, setControlValues] = useState<Record<string, DotsControlValue>>({});

  const selected = data?.commands.find((command) => command.name === selectedName)
    ?? data?.commands[0];

  const view = useMemo(
    () => (selected ? projectDotsWorkflow(selected, controlValues) : null),
    [selected, controlValues],
  );

  const setControl = (control: DotsControl, value: DotsControlValue) => {
    setControlValues((current) => ({ ...current, [control.id]: value }));
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
      notes={<p>LIVE/FALLBACK identifies the source file. SIMULATED identifies every transcript. Parsed handler evidence is shown apart from the simulated trace.</p>}
    >
      {error && (
        <Notice tone="error">
          Dots source could not be loaded. Check the cards API, then retry.
        </Notice>
      )}
      {!data && !error && <p className="dots-loading">reading the dots command map…</p>}
      {data && selected && view && (
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
              <pre className="dots-terminal-copy">
                {view.scenario.trace.map((line, index) => (
                  <span key={index} className={`dots-line dots-line-${line.kind}`}>{line.text}{"\n"}</span>
                ))}
              </pre>
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

          {!view.supported && (
            <Notice tone="warning">
              This parsed command has no authored safe scenario — shown as unsupported evidence only.
            </Notice>
          )}

          <div className="dots-options" aria-label={"Options for dots " + selected!.name}>
            {view.controls.length > 0 ? view.controls.map((control) => {
              if (control.kind === "toggle") {
                const active = Boolean(view.values[control.id]);
                return (
                  <button
                    key={control.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setControl(control, !active)}
                  >
                    <code>{control.flag}</code>
                    <span>{control.label}</span>
                  </button>
                );
              }
              return (
                <label key={control.id} className="dots-target">
                  <span>{control.label}</span>
                  <input
                    value={String(view.values[control.id] ?? control.defaultValue)}
                    onChange={(event) => setControl(control, event.target.value)}
                    spellCheck={false}
                  />
                </label>
              );
            }) : (
              <p>no preview options for this command</p>
            )}
          </div>

          <p className="dots-disclosure">
            {view.supported ? view.scenario.disclosure : UNSUPPORTED_DISCLOSURE}
          </p>

          <section className="dots-trace" aria-label="Exact served handler source">
            <header>
              <span>exact served handler</span>
              <code>{selected!.handler}()</code>
            </header>
            <pre>{selected!.handlerSource}</pre>
          </section>
        </div>
      )}
    </CardShell>
  );
}