import { CardShell, Pill } from "./ui";

const MODULES = [
  ["username", "bold blue — shown locally too"],
  ["hostname", "only over SSH (yellow)"],
  ["directory", "cyan, truncation_length = 2"],
  ["git_branch", "purple branch name"],
  ["git_status", "cyan ⇡/⇣/⇕ ahead-behind markers"],
  ["custom.git_dirty", "cyan dot when the tree is dirty"],
  ["cmd_duration", "yellow after 2s"],
  ["character", "green ❯ on success, red ❯ on failure"],
] as const;

export default function StarshipCard({ onOpenPlayground }: { onOpenPlayground: () => void }) {
  return (
    <CardShell
      title="Starship Prompt"
      blurb="The prompt is configured in starship.toml and rendered by the real starship binary."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {MODULES.map(([name, desc]) => (
            <div key={name} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="font-mono text-xs text-cyan-300">{name}</div>
              <div className="text-xs text-white/50">{desc}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onOpenPlayground}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
        >
          Open the Playground →
        </button>
        <p className="text-xs text-white/40">
          The Playground builds a throwaway git repo for any state (branch, dirty, ahead/
          behind, rebase/merge, detached) and renders it with the real binary — including
          the exact <Pill>36m → 31m</Pill> recolor your shells apply on failure.
        </p>
      </div>
    </CardShell>
  );
}
