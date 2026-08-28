import { useEffect, useRef, useState } from "react";
import {
  decodePromptState,
  encodePromptState,
  DEFAULT_PROMPT_STATE,
  type PromptState,
  type ShellMode,
  type GitState,
} from "../lib/urlParams";

export type ApiStatus = "idle" | "live" | "degraded" | "error";

type State = PromptState;
const DEFAULT: State = DEFAULT_PROMPT_STATE;

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

function findScenarioKey(state: PromptState): string {
  for (const sc of SCENARIOS) {
    const a = sc.state;
    if (
      state.branch === a.branch &&
      state.dirty === a.dirty &&
      state.ahead === a.ahead &&
      state.behind === a.behind &&
      state.detached === a.detached &&
      state.state === a.state &&
      state.ssh === a.ssh &&
      state.shell === a.shell &&
      state.status === a.status
    ) {
      return sc.key;
    }
  }
  return "";
}

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

export default function StarshipPlayground({
  onRenderOutcome,
  onNotes,
}: {
  onRenderOutcome?: (status: ApiStatus) => void;
  onNotes?: (notes: string[]) => void;
}) {
  const [s, setS] = useState<State>(() => {
    if (typeof window !== "undefined" && window.location.search) {
      return decodePromptState(window.location.search);
    }
    return DEFAULT;
  });
  const [html, setHtml] = useState("");
  const [rawHtml, setRawHtml] = useState("");
  const [ansi, setAnsi] = useState("");
  const [rawAnsi, setRawAnsi] = useState("");
  const [recoloredCount, setRecoloredCount] = useState(0);
  const [theme, setTheme] = useState({ background: "#060912", foreground: "#959aa4" });
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [view, setView] = useState<"after" | "before">("after");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [scenarioKey, setScenarioKey] = useState(() => findScenarioKey(s));

  const onRenderOutcomeRef = useRef(onRenderOutcome);
  onRenderOutcomeRef.current = onRenderOutcome;
  const onNotesRef = useRef(onNotes);
  onNotesRef.current = onNotes;

  useEffect(() => {
    if (typeof window === "undefined" || !window.history) return;
    const timer = window.setTimeout(() => {
      const qs = encodePromptState(s);
      const currentQs = window.location.search;
      if (qs !== currentQs) {
        const newUrl = `${window.location.pathname}${qs}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", newUrl);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [s]);

  useEffect(() => {
    const handlePopState = () => {
      const next = decodePromptState(window.location.search);
      setS(next);
      setScenarioKey(findScenarioKey(next));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
          const nextWarnings = Array.isArray(data.warnings) ? data.warnings : [];
          setDegraded(!!data.degraded);
          setLatencyMs(ms);
          onRenderOutcomeRef.current?.(data.degraded ? "degraded" : "live");
          onNotesRef.current?.(
            s.trueColor
              ? [
                  ...nextWarnings,
                  "Proposed-fix preview — not current behavior. true_color plus 38;2 cyan→red. Shipped wrappers still match 8-color only.",
                ]
              : nextWarnings,
          );
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

  const copyLink = async () => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      const qs = encodePromptState(s);
      const url = `${window.location.origin}${window.location.pathname}${qs}${window.location.hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const narrowPreview = s.width <= 140;
  const hasRecolor = s.status !== 0;
  const failed = s.status !== 0;

  useEffect(() => {
    document.documentElement.dataset.failed = failed ? "1" : "0";
    return () => {
      delete document.documentElement.dataset.failed;
    };
  }, [failed]);

  return (
    <div className="prompt-stage" data-failed={failed ? "1" : "0"}>
      <div
        className="terminal-window"
        style={{ background: theme.background, color: theme.foreground }}
      >
        <div className="terminal-meta">
          <span>
            <span className="terminal-dot" />
            {loading ? "rendering" : latencyMs != null ? `${latencyMs} ms` : "ready"}
          </span>
          <span>{s.trueColor ? "truecolor preview" : "8-color"}</span>
        </div>

        {hasRecolor && (
          <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] tracking-wide text-[#5f656e]">
            <span>
              {recoloredCount} escape{recoloredCount === 1 ? "" : "s"} recolored
            </span>
            <span className="flex gap-3" role="group" aria-label="Preview recolor state">
              <button
                type="button"
                aria-pressed={view === "after"}
                onClick={() => setView("after")}
                className={view === "after" ? "text-[#6fa3a0]" : "hover:text-[#959aa4]"}
              >
                after
              </button>
              <button
                type="button"
                aria-pressed={view === "before"}
                onClick={() => setView("before")}
                className={view === "before" ? "text-[#6fa3a0]" : "hover:text-[#959aa4]"}
              >
                before
              </button>
            </span>
            <button type="button" onClick={copyAnsi} className="hover:text-[#959aa4]">
              {copied ? "copied" : "copy ANSI"}
            </button>
          </div>
        )}

        <pre
          aria-label="Rendered Starship prompt"
          aria-busy={loading}
          className={`font-mono-nerd min-h-8 text-[1.05rem] leading-relaxed sm:text-lg ${narrowPreview ? "overflow-x-auto whitespace-pre" : "whitespace-pre-wrap break-words"}`}
          style={{ color: theme.foreground }}
          dangerouslySetInnerHTML={{ __html: view === "before" ? rawHtml : html }}
        />
      </div>

      {error && (
        <div role="alert" className="border border-[#b16371]/35 bg-[#b16371]/10 p-3 text-sm text-[#d38290]">
          <div className="flex items-start justify-between gap-3">
            <p>{error}</p>
            <span className="shrink-0 text-[10px] tracking-wider text-[#5f656e]">stale</span>
          </div>
          <button type="button" className="mt-2 text-xs underline underline-offset-4" onClick={() => setS((prev) => ({ ...prev }))}>
            Retry render
          </button>
        </div>
      )}
      {degraded && !error && (
        <p role="status" className="border border-[#b16371]/35 bg-[#b16371]/10 p-3 text-xs text-[#d38290]">
          Degraded snapshot — the <code>starship</code> binary is unavailable on this
          deployment, so this preview is a static reconstruction from the bundled
          config with recolor applied. It is not a live render. Run{" "}
          <code>bun run dev</code> locally for the real binary.
        </p>
      )}


      <div className="control-panel">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-label="Scenario presets">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.key}
                type="button"
                aria-pressed={scenarioKey === sc.key}
                onClick={() => applyScenario(sc)}
                className={`py-1 font-mono text-[11px] tracking-wide ${scenarioKey === sc.key ? "text-[#6fa3a0]" : "text-[#5f656e] hover:text-[#959aa4]"}`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <label className="block text-sm text-[#5f656e]">
            Branch
            <input
              aria-label="Git branch"
              className="mt-1 w-full border-b border-[#959aa4]/20 bg-transparent px-0 py-1.5 text-[#959aa4] outline-none focus:border-[#6fa3a0]"
              value={s.branch}
              onChange={(e) => set("branch", e.target.value)}
            />
          </label>

          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="sr-only">Session flags</legend>
            <Toggle label="Dirty" on={s.dirty} onClick={() => set("dirty", !s.dirty)} />
            <Toggle label="Detached HEAD" on={s.detached} onClick={() => set("detached", !s.detached)} />
            <Toggle label="SSH session" on={s.ssh} onClick={() => set("ssh", !s.ssh)} />
          </fieldset>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <NumberField label="Ahead" value={s.ahead} onChange={(v) => set("ahead", v)} />
            <NumberField label="Behind" value={s.behind} onChange={(v) => set("behind", v)} />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-[#5f656e]">
            Git state
            <select
              className="mt-1 w-full border-b border-[#959aa4]/20 bg-transparent px-0 py-1.5 text-[#959aa4] outline-none"
              value={s.state}
              onChange={(e) => set("state", e.target.value as GitState)}
            >
              <option value="none">none</option>
              <option value="rebase">rebase</option>
              <option value="merge">merge</option>
            </select>
          </label>

          <label className="block text-sm text-[#5f656e]">
            Shell recolor
            <select
              className="mt-1 w-full border-b border-[#959aa4]/20 bg-transparent px-0 py-1.5 text-[#959aa4] outline-none"
              value={s.shell}
              onChange={(e) => set("shell", e.target.value as ShellMode)}
            >
              <option value="zsh">zsh — cyan only</option>
              <option value="bash">bash — all foreground → red</option>
            </select>
          </label>

          <label className="block text-sm text-[#5f656e]">
            Truecolor preview (proposed fix)
            <div className="mt-1">
              <Toggle
                label="true_color + 38;2 cyan→red"
                on={s.trueColor}
                onClick={() => set("trueColor", !s.trueColor)}
              />
            </div>
          </label>

          <label className="block text-sm text-[#5f656e]">
            Terminal width
            <input
              type="range"
              min={60}
              max={200}
              step={10}
              aria-label="Terminal width"
              value={s.width}
              onChange={(e) => set("width", Number(e.target.value))}
              className="mt-2 w-full accent-[#6fa3a0]"
            />
          </label>

          <fieldset className="text-sm">
            <legend className="mb-2 text-[#5f656e]">Last command</legend>
            <div className="flex gap-4">
              <button
                className={`py-1 ${s.status === 0 ? "text-[#6fa3a0]" : "text-[#5f656e] hover:text-[#959aa4]"}`}
                type="button"
                aria-pressed={s.status === 0}
                onClick={() => set("status", 0)}
              >
                Success
              </button>
              <button
                className={`py-1 ${s.status === 1 ? "text-[#b16371]" : "text-[#5f656e] hover:text-[#959aa4]"}`}
                type="button"
                aria-pressed={s.status === 1}
                onClick={() => set("status", 1)}
              >
                Error
              </button>
            </div>
          </fieldset>

          <label className="block text-sm text-[#5f656e]">
            Duration (ms)
            <input
              type="number"
              min={0}
              className="mt-1 w-full border-b border-[#959aa4]/20 bg-transparent px-0 py-1.5 text-[#959aa4] outline-none"
              value={s.durationMs}
              onChange={(e) => set("durationMs", Number(e.target.value))}
            />
          </label>
          <div className="pt-2">
            <button
              type="button"
              onClick={copyLink}
              className="text-xs tracking-wide text-[#5f656e] hover:text-[#959aa4] underline underline-offset-4"
              aria-label="Copy share link"
            >
              {copiedLink ? "link copied" : "copy link"}
            </button>
          </div>
        </div>
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
      className={`py-1 text-xs tracking-wide ${on ? "text-[#6fa3a0]" : "text-[#5f656e] hover:text-[#959aa4]"}`}
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
    <label className="block text-sm text-[#5f656e]">
      {label}
      <input
        type="number"
        min={0}
        aria-label={`${label} commits`}
        className="mt-1 w-full border-b border-[#959aa4]/20 bg-transparent px-0 py-1.5 text-[#959aa4] outline-none"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
    </label>
  );
}
