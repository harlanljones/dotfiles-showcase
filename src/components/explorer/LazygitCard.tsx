import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface LazygitData {
  source: "live" | "fallback";
  content: string;
}

export default function LazygitCard() {
  const { data, error } = useJson<LazygitData>("/api/cards/lazygit");

  return (
    <CardShell
      title="lazygit + Ollama Commits"
      blurb="Inside lazygit, Ctrl+G pipes the staged diff through a local Ollama model and opens the generated message for review."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="rounded bg-white/10 px-2 py-1">Ctrl+G (files panel)</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">lazygit-ollama-commit.sh</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">ollama (local LLM)</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-300">
            commit message draft
          </span>
        </div>

        <p className="text-xs leading-relaxed text-white/50">
          The command is declared as a lazygit{" "}
          <span className="font-mono">customCommands</span> entry with{" "}
          <span className="font-mono">output: terminal</span>, so the streaming response is
          visible while it generates. The config ships as a chezmoi template that only
          enables the delta pager when delta is installed.
        </p>

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {data && <Term>{data.content}</Term>}
      </div>
    </CardShell>
  );
}
