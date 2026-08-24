import { useEffect, useState } from "react";

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
};

export default function StarshipPlayground() {
  const [s, setS] = useState<State>(DEFAULT);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/starship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setHtml(data.html ?? "");
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [s]);

  const set = <K extends keyof State>(k: K, v: State[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold">Controls</h2>

        <label className="block text-sm">
          <span className="text-white/60">Branch</span>
          <input
            className="mt-1 w-full rounded bg-black/40 px-2 py-1 text-white outline-none ring-cyan-500/50 focus:ring"
            value={s.branch}
            onChange={(e) => set("branch", e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-4 text-sm">
          <Toggle label="Dirty" on={s.dirty} onClick={() => set("dirty", !s.dirty)} />
          <Toggle label="Detached HEAD" on={s.detached} onClick={() => set("detached", !s.detached)} />
          <Toggle label="SSH session" on={s.ssh} onClick={() => set("ssh", !s.ssh)} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <NumberField label="Ahead" value={s.ahead} onChange={(v) => set("ahead", v)} />
          <NumberField label="Behind" value={s.behind} onChange={(v) => set("behind", v)} />
        </div>

        <label className="block text-sm">
          <span className="text-white/60">Git state</span>
          <select
            className="mt-1 w-full rounded bg-black/40 px-2 py-1 text-white outline-none"
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
            <option value="zsh">zsh (cyan→red only)</option>
            <option value="bash">bash (all foreground→red)</option>
          </select>
        </label>

        <div className="text-sm">
          <span className="text-white/60">Last command</span>
          <div className="mt-1 flex gap-2">
            <button
              className={`flex-1 rounded px-2 py-1 ${s.status === 0 ? "bg-cyan-600" : "bg-white/10"}`}
              onClick={() => set("status", 0)}
            >
              Success
            </button>
            <button
              className={`flex-1 rounded px-2 py-1 ${s.status === 1 ? "bg-red-600" : "bg-white/10"}`}
              onClick={() => set("status", 1)}
            >
              Error
            </button>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-white/60">
            Duration (ms) — note: this starship.toml has no $cmd_duration module
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded bg-black/40 px-2 py-1 text-white outline-none"
            value={s.durationMs}
            onChange={(e) => set("durationMs", Number(e.target.value))}
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-white/10 bg-black p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-white/40">
            <span>live terminal preview</span>
            {loading && <span>rendering…</span>}
          </div>
          <pre
            className="font-mono-nerd whitespace-pre-wrap break-words text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html || "" }}
          />
        </div>
        {error && (
          <p className="rounded bg-red-900/40 p-2 text-xs text-red-300">
            {error}
          </p>
        )}
        <p className="text-xs text-white/40">
          Rendered by the real <code>starship</code> binary (forced to 8-color so
          the dotfiles&apos; recolor code applies). Truecolor TTYs are a known
          limitation.
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
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs ${on ? "bg-cyan-600" : "bg-white/10"}`}
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
        className="mt-1 w-full rounded bg-black/40 px-2 py-1 text-white outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
