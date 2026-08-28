import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface RipgrepData {
  source: "live" | "fallback";
  flags: string[];
}

const FLAG_DOCS: Record<string, string> = {
  "--smart-case": "case-insensitive unless the pattern has uppercase",
  "--max-columns": "truncate lines longer than N columns",
  "--max-columns-preview": "show a preview of truncated matches",
  "--follow": "follow symlinked files",
  "--hidden": "search hidden files and directories too",
  "--glob": "exclude paths matching the glob",
};

function flagName(flag: string): string {
  return flag.split("=")[0] ?? flag;
}

const EXPORT_LINE = "export RIPGREP_CONFIG_PATH=~/.config/ripgrep/rc";

export default function RipgrepCard() {
  const { data, error } = useJson<RipgrepData>("/api/cards/ripgrep");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string) => {
    setCopied(text);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {});
    }
    window.setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400);
  };

  const flagCount = data?.flags.length ?? 0;

  return (
    <CardShell
      title="ripgrep Defaults"
      blurb="Every rg invocation inherits these flags via RIPGREP_CONFIG_PATH, so searches are smart-case, fast, and repo-aware by default."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {!data && !error && (
        <p className="font-mono text-xs text-white/55">loading flags…</p>
      )}
      {data && (
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs text-white/50">
              {flagCount} flag{flagCount === 1 ? "" : "s"} loaded via RIPGREP_CONFIG_PATH
            </div>
            {data.flags.map((f) => {
              const name = flagName(f);
              const composed = `rg ${f}`;
              return (
                <div key={f} className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                  <code className="shrink-0 font-mono text-xs text-emerald-300">{f}</code>
                  <span className="flex-1 text-xs text-white/50">
                    {FLAG_DOCS[name] ?? "custom flag"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(composed)}
                    className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      copied === composed
                        ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    {copied === composed ? "copied" : "copy rg …"}
                  </button>
                </div>
              );
            })}
            {data.flags.length === 0 && (
              <p className="font-mono text-xs text-white/55">no flags configured</p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-white/50">
            <span className="font-mono">RIPGREP_CONFIG_PATH</span> makes every
            non-comment line of the rc a default CLI flag; command-line flags{" "}
            <span className="font-mono">override</span> config flags. The export
            lives in the shell rc (<span className="font-mono">dot_zshrc</span>).
          </p>
          <div className="flex items-start gap-2">
            <Term>
              <span className="text-white/50"># ripgrep rc, loaded automatically</span>
              {"\n"}
              {EXPORT_LINE}
            </Term>
            <button
              type="button"
              onClick={() => copy(EXPORT_LINE)}
              className={`shrink-0 rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                copied === EXPORT_LINE
                  ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {copied === EXPORT_LINE ? "copied" : "copy"}
            </button>
          </div>
        </div>
      )}
    </CardShell>
  );
}
