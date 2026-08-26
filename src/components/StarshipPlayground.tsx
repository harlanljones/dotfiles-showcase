import { useEffect, useRef, useState } from "react";
import { SourceBadge } from "./explorer/ui";

export type ApiStatus = "idle" | "live" | "degraded" | "error";

type ShellMode = "zsh" | "bash";
type GitState = "none" | "rebase" | "merge";

interface State {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  detached: boolean;
  state: GitState;
  ssh: boolean;
  shell: ShellMode;
  status: number;
  durationMs: number;
  width: number;
  /** TC-01 opt-in: render with true_color=true and recolor truecolor cyan→red (proposed-fix preview). */
  trueColor: boolean;
}

const DEFAULT: State = {
  branch: "main",
  dirty: false,
  ahead: 0,
  behind: 0,
  detached: false,
  state: "none",
  ssh: false,
  shell: "zsh",
  status: 0,
  durationMs: 0,
  width: 200,
  trueColor: false,
};

type ScenarioState = Omit<State, "width" | "durationMs" | "trueColor">;

interface Scenario {
  key: string;
  label: string;
  state: ScenarioState;
  keepShell?: boolean;
}

const SCENARIOS: Scenario[] = [
  { key: "clean-main", label: "clean main", state: { branch: "main", dirty: false, ahead: 0, behind: 0, detached: false, state: "none", ssh: false, shell: "zsh", status: 0 } },
  { key: "dirty-feature", label: "dirty feature work", state: { branch: "feat/ghostty-palette", dirty: true, ahead: 0, behind: 0, detached: false, state: "none", ssh: false, shell: "zsh", status: 1 } },
  { key: "rebase-wrong", label: "rebase gone wrong", state: { branch: "main", dirty: true, ahead: 0, behind: 0, detached: false, state: "rebase", ssh: false, shell: "zsh", status: 1 }, keepShell: true },
  { key: "diverged", label: "diverged", state: { branch: "main", dirty: false, ahead: 3, behind: 5, detached: false, state: "none", ssh: false, shell: "zsh", status: 1 } },
  { key: "ssh-hotfix", label: "SSH detached hotfix", state: { branch: "hotfix/ssh", dirty: false, ahead: 0, behind: 0, detached: true, state: "none", ssh: true, shell: "zsh", status: 1 } },
];

type RenderResponse = {
  error?: string;
  ansi?: string;
  html?: string;
  rawAnsi?: string;
  rawHtml?: string;
  spans?: Array<{ recolored?: boolean; reason?: string; [k: string]: unknown }>;
  theme?: { background?: string; foreground?: string; source?: "live" | "fallback" };
  warnings?: string[];
  degraded?: boolean;
};

export default function StarshipPlayground({ onRenderOutcome }: { onRenderOutcome?: (status: ApiStatus) => void }) {
  const [s, setS] = useState<State>(DEFAULT);
  const [html, setHtml] = useState("");
  const [rawHtml, setRawHtml] = useState("");
  const [ansi, setAnsi] = useState("");
  const [rawAnsi, setRawAnsi] = useState("");
  const [recoloredCount, setRecoloredCount] = useState(0);
  const [theme, setTheme] = useState({ background: "#060912", foreground: "#959aa4" });
  const [themeSource, setThemeSource] = useState<"live" | "fallback">("live");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [view, setView] = useState<"after" | "before">("after");
  const [copied, setCopied] = useState(false);
  const [scenarioKey, setScenarioKey] = useState("clean-main");

  const onRenderOutcomeRef = useRef(onRenderOutcome);
  onRenderOutcomeRef.current = onRenderOutcome;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLatencyMs(null);
    onRenderOutcomeRef.current?.("idle");
    const started = performance.now();
    const timer = window.setTimeout(() => fetch("/api/starship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = (await r.json()) as RenderResponse;
        if (!r.ok) throw new Error(data.error ?? `Render failed (${r.status})`);
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const ms = Math.round(performance.now() - started);
        if (data.error) setError(data.error);
        else {
          setHtml(data.html ?? "");
          setRawHtml(data.rawHtml ?? data.html ?? "");
          setAnsi(data.ansi ?? "");
          setRawAnsi(data.rawAnsi ?? data.ansi ?? "");
          setRecoloredCount(Array.isArray(data.spans) ? data.spans.filter((sp) => sp.recolored).length : 0);
          if (data.theme?.background) {
            setTheme((prev) => ({ background: data.theme!.background as string, foreground: data.theme!.foreground || prev.foreground }));
          }
          if (data.theme?.source) setThemeSource(data.theme.source);
          setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
          setDegraded(!!data.degraded);
          setLatencyMs(ms);
          onRenderOutcomeRef.current?.(data.degraded ? "degraded" : "live");
        }
      })
      .catch((e) => {
        if (cancelled || e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
        onRenderOutcomeRef.current?.("error");
      })
      .finally(() => !cancelled && setLoading(false)), 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [s]);

  const set = <K extends keyof State>(k: K, v: State[K]) => {
    setScenarioKey("");
    setS((prev) => ({ ...prev, [k]: v }));
  };

  const applyScenario = (sc: Scenario) => {
    setScenarioKey(sc.key);
    setS((prev) => ({
      ...prev,
      ...sc.state,
      width: prev.width,
      durationMs: prev.durationMs,
      shell: sc.keepShell ? prev.shell : sc.state.shell,
    }));
  };

  const copyAnsi = async () => {
    const target = view === "before" ? rawAnsi : ansi;
    if (target && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(target);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable — ignore */
      }
    }
  };

  const narrowPreview = s.width <= 140;
  const hasRecolor = s.status !== 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <div className="control-panel space-y-5 rounded-2xl border border-white/10 bg-white/[.045] p-5">
        <div className="space-y-2">
          <p className="section-eyebrow">scenarios</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scenario presets">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.key}
                type="button"
                aria-pressed={scenarioKey === sc.key}
                onClick={() => applyScenario(sc)}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${scenarioKey === sc.key ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start justify-between gap-4"><div><p className="section-eyebrow">shell state</p><h2 className="mt-1 font-semibold">Tune the scene</h2></div><span className={`rounded-full border px-2 py-1 font-mono text-[10px] ${s.trueColor ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"}`}>{s.trueColor ? "TRUECOLOR (preview)" : "8-COLOR"}</span></div>
        <p className="text-xs leading-5 text-white/45">Every change renders against an isolated temporary Git repo.</p>

        <label className="block text-sm">
          <span className="text-white/60">Branch</span>
          <input
            aria-label="Git branch"
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
            value={s.branch}
            onChange={(e) => set("branch", e.target.value)}
          />
        </label>

        <fieldset className="flex flex-wrap gap-2 text-sm"><legend className="sr-only">Session flags</legend>
          <Toggle label="Dirty" on={s.dirty} onClick={() => set("dirty", !s.dirty)} />
          <Toggle label="Detached HEAD" on={s.detached} onClick={() => set("detached", !s.detached)} />
          <Toggle label="SSH session" on={s.ssh} onClick={() => set("ssh", !s.ssh)} />
        </fieldset>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <NumberField label="Ahead" value={s.ahead} onChange={(v) => set("ahead", v)} />
          <NumberField label="Behind" value={s.behind} onChange={(v) => set("behind", v)} />
        </div>

        <label className="block text-sm">
          <span className="text-white/60">Git state</span>
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
            value={s.state}
            onChange={(e) => set("state", e.target.value as GitState)}
          >
            <option value="none">none</option>
            <option value="rebase">rebase</option>
            <option value="merge">merge</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-white/60">Shell recolor mode</span>
          <select
            className="mt-1 w-full rounded bg-black/40 px-2 py-1 text-white outline-none"
            value={s.shell}
            onChange={(e) => set("shell", e.target.value as ShellMode)}
          >
            <option value="zsh">zsh — hadrian (cyan→red only)</option>
            <option value="bash">bash — augustus (all fg→red)</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-white/60">Truecolor preview (proposed fix)</span>
          <div className="mt-1">
            <Toggle
              label="Render with true_color=true and recolor 38;2 cyan→red"
              on={s.trueColor}
              onClick={() => set("trueColor", !s.trueColor)}
            />
          </div>
          <span className="mt-1 block text-xs leading-4 text-white/35">
            Demonstrates the TC-01 proposed dotfiles fix. Not the current shipped
            behavior — the live recolor only matches 8-color escapes.
          </span>
        </label>

        <label className="block text-sm">
          <span className="text-white/60">Terminal width</span>
          <input
            type="range"
            min={60}
            max={200}
            step={10}
            aria-label="Terminal width"
            value={s.width}
            onChange={(e) => set("width", Number(e.target.value))}
            className="mt-1 w-full accent-cyan-300"
          />
          <span className="mt-1 block text-xs leading-4 text-white/35">
            Drives <code>--terminal-width</code>, which squeezes the directory via{" "}
            <code>truncation_length = 2</code>. Narrow widths truncate the path.
          </span>
        </label>

        <fieldset className="text-sm"><legend className="mb-2 text-white/60">Last command result</legend>
          <div className="mt-1 flex gap-2">
            <button
              className={`flex-1 rounded px-2 py-1 ${s.status === 0 ? "bg-cyan-600" : "bg-white/10"}`}
              type="button" aria-pressed={s.status === 0} onClick={() => set("status", 0)}
            >
              Success
            </button>
            <button
              className={`flex-1 rounded px-2 py-1 ${s.status === 1 ? "bg-red-600" : "bg-white/10"}`}
              type="button" aria-pressed={s.status === 1} onClick={() => set("status", 1)}
            >
              Error
            </button>
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="text-white/60">
            Duration (ms) <span className="text-white/35">· reserved for future module</span>
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
            value={s.durationMs}
            onChange={(e) => set("durationMs", Number(e.target.value))}
          />
        </label>
      </div>

      <div className="space-y-3">
        <div
          className="terminal-window rounded-2xl border border-white/10 p-4 sm:p-5"
          style={{ background: theme.background, color: theme.foreground }}
        >
          <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3 text-xs text-white/40">
            <span className="flex items-center gap-2"><span className="terminal-dot" /> live terminal preview — your ghostty theme <SourceBadge source={themeSource} /></span>
            <span aria-live="polite" className={loading ? "text-cyan-200" : ""}>{loading ? "rendering…" : latencyMs != null ? `ready · ${latencyMs} ms` : "ready"}</span>
          </div>

          {hasRecolor && (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-white/60">
                {recoloredCount} escape{recoloredCount === 1 ? "" : "s"} recolored
              </span>
              <span className="flex overflow-hidden rounded border border-white/15" role="group" aria-label="Preview recolor state">
                <button
                  type="button"
                  aria-pressed={view === "after"}
                  onClick={() => setView("after")}
                  className={`px-2 py-0.5 font-mono transition-colors ${view === "after" ? "bg-cyan-300/15 text-cyan-100" : "text-white/50 hover:bg-white/5"}`}
                >
                  after
                </button>
                <button
                  type="button"
                  aria-pressed={view === "before"}
                  onClick={() => setView("before")}
                  className={`px-2 py-0.5 font-mono transition-colors ${view === "before" ? "bg-cyan-300/15 text-cyan-100" : "text-white/50 hover:bg-white/5"}`}
                >
                  before
                </button>
              </span>
              <button
                type="button"
                onClick={copyAnsi}
                className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-white/60 transition-colors hover:bg-white/10"
              >
                {copied ? "copied" : "copy ANSI"}
              </button>
            </div>
          )}

          <pre
            aria-label="Rendered Starship prompt" aria-busy={loading}
            className={`font-mono-nerd min-h-8 text-sm leading-relaxed ${narrowPreview ? "overflow-x-auto whitespace-pre" : "whitespace-pre-wrap break-words"}`}
            style={{ color: theme.foreground }}
            dangerouslySetInnerHTML={{ __html: view === "before" ? rawHtml : html }}
          />
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-red-300/20 bg-red-900/30 p-3 text-sm text-red-200">
            <div className="flex items-start justify-between gap-3">
              <p>{error}</p>
              <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/45">stale — last good render</span>
            </div>
            <button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => setS((prev) => ({ ...prev }))}>Retry render</button>
          </div>
        )}
        {degraded && !error && (
          <p role="status" className="rounded-xl border border-amber-300/30 bg-amber-900/30 p-3 text-xs font-medium text-amber-200">
            ⚠ Degraded snapshot — the <code>starship</code> binary is unavailable on this
            deployment, so this preview is a static reconstruction from the bundled
            config with recolor applied. It is NOT a live render. Run{" "}
            <code>bun run dev</code> locally for the real binary.
          </p>
        )}
        {warnings.map((w) => (
          <p key={w} role="status" className="rounded-xl border border-amber-300/20 bg-amber-900/25 p-3 text-xs text-amber-200">
            {w}
          </p>
        ))}
        {s.trueColor && !error && (
          <p role="status" className="rounded-xl border border-amber-300/50 bg-amber-900/40 p-3 text-xs font-semibold text-amber-100">
            ⚠ PROPOSED FIX PREVIEW — not current dotfiles behavior. This renders
            starship with <code>true_color=true</code> and recolors the palette cyan
            <code> 38;2;r;g;b</code> → red (TC-01). The shipped wrappers still only
            match 8-color escapes.
          </p>
        )}
        <p className="border-l border-cyan-300/30 pl-3 text-xs leading-5 text-white/45">
          {degraded ? (
            <>Degraded mode: reconstructed from <code>fallback/starship.toml</code> (8-color so the recolor code applies). The local app renders with the real binary.</>
          ) : s.trueColor ? (
            <>Truecolor preview (proposed fix): the real <code>starship</code> binary
            renders with <code>true_color=true</code> and the recolor remaps palette-cyan
            <code> 38;2;r;g;b</code> → red. This demonstrates the proposed dotfiles
            fix (TC-01), not current shipped behavior.</>
          ) : (
            <>Rendered by the real <code>starship</code> binary (forced to 8-color so
            the dotfiles&apos; recolor code applies). Truecolor TTYs are a known
            limitation.</>
          )}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${on ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
    >
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-white/60">{label}</span>
      <input
        type="number"
        min={0}
        aria-label={`${label} commits`}
        className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white outline-none focus:border-cyan-300/50"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
    </label>
  );
}
