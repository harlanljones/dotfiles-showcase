import { useEffect, useState } from "react";
import { CardShell, SourceBadge, ToggleGroup, Notice, type SourceKind } from "./ui";
import { postJson } from "../../lib/useApi";
import type { SgrSpan } from "../../../server/lib/recolor";

type ShellMode = "zsh" | "bash";
type PlaygroundMode = "prompt" | "custom";

interface StarshipResult {
  ansi: string;
  html: string;
  rawAnsi: string;
  rawHtml: string;
  spans: SgrSpan[];
  theme: { background: string; foreground: string; source: "live" | "fallback" };
  warnings?: string[];
  degraded?: boolean;
}

interface RecolorResult {
  input: string;
  output: string;
  htmlBefore: string;
  htmlAfter: string;
  spans: SgrSpan[];
  shell: ShellMode;
  status: number;
  theme: { background: string; foreground: string; source: "live" | "fallback" };
}

const CUSTOM_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Cyan 36m", value: "\x1b[36mhello\x1b[0m" },
  { label: "Bold cyan 1;36m", value: "\x1b[1;36mhello\x1b[0m" },
  { label: "Italic cyan 3;36m", value: "\x1b[3;36mhello\x1b[0m" },
  { label: "Underline cyan 4;36m — diverges (zsh×, bash✓)", value: "\x1b[4;36munderline cyan\x1b[0m" },
  { label: "Green 32m — bash only", value: "\x1b[32mgreen\x1b[0m" },
  { label: "Blue 34m — bash only", value: "\x1b[34mblue\x1b[0m" },
  { label: "All FG rainbow", value: "\x1b[30m30 \x1b[32m32 \x1b[33m33 \x1b[34m34 \x1b[35m35 \x1b[36m36 \x1b[37m37 \x1b[90m90 \x1b[92m92 \x1b[96m96\x1b[0m" },
  { label: "Truecolor 38;2;80;130;150m — untouched", value: "\x1b[38;2;80;130;150mtruecolor\x1b[0m" },
  { label: "256-color 38;5;36m — bash tails", value: "\x1b[38;5;36m256-color\x1b[0m" },
  { label: "Mixed cyan + truecolor", value: "\x1b[36mcyan\x1b[0m \x1b[38;2;80;130;150mtruecolor\x1b[0m \x1b[1;32mgreen\x1b[0m" },
];

function reasonLabel(r: SgrSpan["reason"]): { text: string; tone: string } {
  switch (r) {
    case "zsh:cyan-variant": return { text: "zsh cyan → red", tone: "text-emerald-300" };
    case "bash:fg-to-red": return { text: "bash fg → red", tone: "text-emerald-300" };
    case "bash:tail-256": return { text: "bash tails 256-color → red", tone: "text-amber-300" };
    case "bash:tail-truecolor": return { text: "bash tails truecolor → red", tone: "text-amber-300" };
    case "untouched:not-cyan": return { text: "not cyan (zsh×)", tone: "text-white/55" };
    case "untouched:prefix-not-in-zsh-list": return { text: "prefix not in zsh 8 (zsh×)", tone: "text-white/55" };
    case "untouched:truecolor-tail": return { text: "truecolor — known gap (×)", tone: "text-white/55" };
    case "untouched:256color-tail": return { text: "256-color — not recolored", tone: "text-white/55" };
    case "untouched:no-fg-code": return { text: "no fg code", tone: "text-white/50" };
    case "untouched:non-sgr": return { text: "non-SGR", tone: "text-white/50" };
    default: return { text: r, tone: "text-white/55" };
  }
}

function escapeLabel(s: string): string {
  return s.replace("\x1b", "ESC").replace(/\x1b/g, "ESC");
}

export function recolorSourceKind(mode: "prompt" | "custom", degraded: boolean): SourceKind {
  return mode === "prompt" ? (degraded ? "fallback" : "live") : "simulated";
}

export default function RecolorCard() {
  const [shell, setShell] = useState<ShellMode>("zsh");
  const [mode, setMode] = useState<PlaygroundMode>("prompt");
  const [dirty, setDirty] = useState(false);
  const [ssh, setSsh] = useState(false);
  const [ahead, setAhead] = useState(0);
  const [status, setStatus] = useState(1);
  const [customInput, setCustomInput] = useState(CUSTOM_PRESETS[0].value);
  const [presetLabel, setPresetLabel] = useState(CUSTOM_PRESETS[0].label);

  const [promptResult, setPromptResult] = useState<StarshipResult | null>(null);
  const [customResult, setCustomResult] = useState<RecolorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Prompt mode: fetch real starship render with raw + recolored
  useEffect(() => {
    if (mode !== "prompt") return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      postJson<StarshipResult>("/api/starship", {
        branch: "main",
        dirty,
        ahead,
        ssh,
        status,
        shell,
      })
        .then((data) => {
          if (cancelled) return;
          setPromptResult(data);
          setWarnings(data.warnings ?? []);
          setCustomResult(null);
        })
        .catch((e) => {
          if (cancelled || e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, shell, dirty, ssh, ahead, status]);

  // Custom mode: call /api/recolor
  useEffect(() => {
    if (mode !== "custom") return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      postJson<RecolorResult>("/api/recolor", {
        input: customInput,
        shell,
        status,
      })
        .then((data) => {
          if (cancelled) return;
          setCustomResult(data);
          setPromptResult(null);
          setWarnings([]);
        })
        .catch((e) => {
          if (cancelled || e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mode, shell, customInput, status]);

  const active = mode === "prompt" ? promptResult : customResult;
  const htmlBefore = mode === "prompt" ? promptResult?.rawHtml ?? "" : customResult?.htmlBefore ?? "";
  const htmlAfter = mode === "prompt" ? promptResult?.html ?? "" : customResult?.htmlAfter ?? "";
  const spans: SgrSpan[] = (mode === "prompt" ? promptResult?.spans : customResult?.spans) ?? [];
  const themeBg = active?.theme.background ?? "#060912";
  const themeFg = active?.theme.foreground ?? "#959aa4";
  const themeSource = active?.theme.source;
  const recoloredCount = spans.filter((s) => s.recolored).length;
  const rawBytes = escapeLabel(customInput);
  const preClass = "overflow-x-auto rounded-lg border border-white/10 p-3 font-mono-nerd text-sm leading-relaxed [&_i]:italic";
  const preStyle = { background: themeBg, color: themeFg };

  return (
    <CardShell
      title="Failure Recolor"
      blurb="On non-zero exit the shell rewrites the prompt's colors before drawing. Flip shell and input to see what each wrapper really matches."
      badges={
        <div className="flex gap-1.5">
          {mode === "prompt" ? <SourceBadge source={recolorSourceKind(mode, promptResult?.degraded ?? false)} /> : <SourceBadge source="simulated" />}
          <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-cyan-200">8-COLOR</span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Shell + mode toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={shell}
            onChange={(v) => setShell(v as ShellMode)}
            options={[
              { value: "zsh", label: "zsh (cyan only)" },
              { value: "bash", label: "bash (all → red)" },
            ]}
          />
          <ToggleGroup
            value={mode}
            onChange={(v) => setMode(v as PlaygroundMode)}
            options={[
              { value: "prompt", label: "real prompt" },
              { value: "custom", label: "custom escapes" },
            ]}
          />
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            <button
              onClick={() => setStatus(0)}
              aria-pressed={status === 0}
              className={`px-3 py-1.5 font-mono text-xs transition-colors ${status === 0 ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/5"}`}
            >
              status 0 (no-op)
            </button>
            <button
              onClick={() => setStatus(1)}
              aria-pressed={status === 1}
              className={`px-3 py-1.5 font-mono text-xs transition-colors ${status === 1 ? "bg-red-500/20 text-red-300" : "text-white/50 hover:bg-white/5"}`}
            >
              status 1 (recolor)
            </button>
          </div>
          {loading && <span className="font-mono text-xs text-cyan-200">rendering…</span>}
        </div>

        {/* Mode-specific controls */}
        {mode === "prompt" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDirty((v) => !v)}
              aria-pressed={dirty}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${dirty ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}
            >
              Dirty
            </button>
            <button
              type="button"
              onClick={() => setSsh((v) => !v)}
              aria-pressed={ssh}
              className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${ssh ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}
            >
              SSH
            </button>
            <label className="flex items-center gap-2 font-mono text-xs text-white/60">
              Ahead
              <input
                type="number"
                min={0}
                max={9}
                value={ahead}
                onChange={(e) => setAhead(Math.max(0, Math.min(9, Number(e.target.value))))}
                className="w-16 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setPresetLabel(p.label);
                    setCustomInput(p.value);
                  }}
                  className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${presetLabel === p.label ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="font-mono text-xs text-white/50">ANSI input (ESC sequences — paste or pick a preset)</span>
              <textarea
                value={customInput}
                onChange={(e) => {
                  setPresetLabel("");
                  setCustomInput(e.target.value);
                }}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                placeholder="e.g. \x1b[36mhello\x1b[0m"
              />
            </label>
            <p className="font-mono text-[11px] text-white/55">Raw bytes: {rawBytes.slice(0, 120)}{rawBytes.length > 120 ? "…" : ""} · {customInput.length} chars</p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-white/50">
          <span className="font-mono text-white/70">zsh</span> rewrites only <span className="font-mono">36m</span> with one of 8 exact style prefixes (<span className="font-mono">"" / 1; / 2; / 3; / 1;2; / 1;3; / 2;3; / 1;2;3;</span>).{" "}
          <span className="font-mono text-white/70">bash</span> rewrites every 8-color foreground (<span className="font-mono">30|32|33|34|35|36|37|90|92|93|94|95|96|97</span>) and will tail-match the end of 256-color/truecolor sequences.{" "}
          {mode === "custom" && <span className="text-amber-300/80">Try "Underline cyan" and flip zsh→bash — only bash moves.</span>}
        </p>

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {mode === "prompt" && promptResult?.degraded && !error && (
          <Notice tone="warning">⚠ Degraded snapshot — no starship binary on this deployment. NOT a live render; run `bun run dev` locally.</Notice>
        )}
        {warnings.map((w) => (
          <Notice key={w} tone="warning">{w}</Notice>
        ))}

        {/* Before / After panes */}
        {active && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="font-mono text-xs text-white/50">Before (status {status === 0 ? "0 — no recolor" : "1 — pre-recolor"})</div>
                {htmlBefore ? (
                  <pre className={preClass} style={preStyle} dangerouslySetInnerHTML={{ __html: htmlBefore }} />
                ) : (
                  <pre className={preClass} style={preStyle}><span className="text-white/50">empty</span></pre>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="font-mono text-xs text-white/50">After — {shell} recolor {recoloredCount === 0 ? "(no change)" : `(${recoloredCount} escape${recoloredCount === 1 ? "" : "s"} recolored)`}</div>
                {htmlAfter ? (
                  <pre className={preClass} style={preStyle} dangerouslySetInnerHTML={{ __html: htmlAfter }} />
                ) : (
                  <pre className={preClass} style={preStyle}><span className="text-white/50">empty</span></pre>
                )}
              </div>
            </div>
            <p className="font-mono text-[11px] text-white/55">
              {themeSource === "fallback" ? "theme from bundled snapshot" : "theme from live host"}
            </p>
          </>
        )}

        {/* Escape ledger */}
        {active && spans.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-xs text-white/60">
              Escape ledger — {spans.length} SGR escape{spans.length === 1 ? "" : "s"} in input · {recoloredCount} recolored · {spans.length - recoloredCount} untouched
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">escape</th>
                    <th className="px-2 py-1.5 font-medium">after</th>
                    <th className="px-2 py-1.5 font-medium">verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {spans.map((s, i) => {
                    const lbl = reasonLabel(s.reason);
                    return (
                      <tr key={`${s.offset}-${i}`} className="border-b border-white/5 last:border-0">
                        <td className="px-2 py-1 text-white/55">{i + 1}</td>
                        <td className="px-2 py-1 text-white/80">{escapeLabel(s.raw)}</td>
                        <td className="px-2 py-1 text-white/60">{s.recolored ? escapeLabel(s.after) : "—"}</td>
                        <td className={`px-2 py-1 ${lbl.tone}`}>{s.recolored ? "● " : "○ "}{lbl.text}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {active && spans.length === 0 && status !== 0 && (
          <p className="font-mono text-xs text-white/55">No SGR escapes matched in this input — try a preset with color codes.</p>
        )}

        <p className="text-xs leading-5 text-white/55">
          {mode === "prompt" && promptResult?.degraded ? (
            <>Degraded mode: reconstructed from <code>fallback/starship.toml</code> in 8-color so the recolor code demonstrably applies. The local app renders with the real binary.</>
          ) : (
            <>Rendered by the real <code>starship</code> binary in 8-color mode so the recolor code demonstrably applies. Truecolor TTYs (<span className="font-mono">38;2;r;g;b</span>) are a known limitation — neither wrapper recolors them.</>
          )}
        </p>
      </div>
    </CardShell>
  );
}
