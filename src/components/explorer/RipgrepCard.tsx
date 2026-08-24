import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface RipgrepData {
  source: "live" | "fallback";
  flags: string[];
}

const FLAG_DOCS: Record<string, string> = {
  "--smart-case": "case-insensitive unless the pattern has uppercase",
  "--max-columns=160": "truncate lines longer than 160 columns",
  "--max-columns-preview": "show a preview of truncated matches",
  "--follow": "follow symlinked files",
  "--hidden": "search hidden files and directories too",
  "--glob=!.git/": "but never descend into .git",
};

export default function RipgrepCard() {
  const { data, error } = useJson<RipgrepData>("/api/cards/ripgrep");

  return (
    <CardShell
      title="ripgrep Defaults"
      blurb="Every rg invocation inherits these flags via RIPGREP_CONFIG_PATH, so searches are smart-case, fast, and repo-aware by default."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="space-y-4">
          <div className="space-y-1">
            {data.flags.map((f) => (
              <div key={f} className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                <code className="shrink-0 font-mono text-xs text-emerald-300">{f}</code>
                <span className="text-xs text-white/50">
                  {FLAG_DOCS[f] ?? "custom flag"}
                </span>
              </div>
            ))}
            {data.flags.length === 0 && (
              <p className="font-mono text-xs text-white/40">no flags configured</p>
            )}
          </div>
          <Term>
            <span className="text-white/50"># loaded automatically</span>
            {"\n"}export RIPGREP_CONFIG_PATH=~/.config/ripgrep/rc
          </Term>
        </div>
      )}
    </CardShell>
  );
}
