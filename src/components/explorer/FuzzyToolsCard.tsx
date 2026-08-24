import { useState } from "react";
import { CardShell, SourceBadge, Term } from "./ui";

const FILES = [
  "~/.local/share/chezmoi/dot_zshrc",
  "~/.local/share/chezmoi/dot_bashrc",
  "~/.config/starship.toml",
  "~/.config/ghostty/config",
  "~/.config/hypr/monitors.lua",
  "~/.config/lazygit/config.yml",
  "~/.config/mise/config.toml",
  "~/.config/ripgrep/rc",
  "~/.config/nvim/lazyvim.json",
  "~/.Brewfile",
];

const DIRS = [
  ["dotf", "~/.local/share/chezmoi"],
  ["conf", "~/.config"],
  ["ghos", "~/.config/ghostty"],
  ["hypr", "~/.config/hypr"],
  ["nvim", "~/.config/nvim"],
];

const HISTORY = [
  "chezmoi apply --dry-run",
  "chezmoi edit ~/.config/starship.toml",
  "bun test",
  "git status -sb",
  "lazygit",
  "pacman -Qe | wc -l",
  "starship prompt --status=1",
  "mise ls",
];

function filterList(items: string[], q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => i.toLowerCase().includes(needle));
}

function FuzzyPane({
  label,
  placeholder,
  items,
}: {
  label: string;
  placeholder: string;
  items: string[];
}) {
  const [q, setQ] = useState("");
  const matches = filterList(items, q);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 font-mono text-xs text-cyan-300">{label}</div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="mb-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs outline-none placeholder:text-white/25 focus:border-emerald-500/50"
      />
      <ul className="max-h-32 space-y-0.5 overflow-y-auto">
        {matches.map((m) => (
          <li key={m} className="truncate rounded bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] text-white/70">
            {m}
          </li>
        ))}
        {matches.length === 0 && (
          <li className="px-2 py-0.5 font-mono text-[11px] text-white/30">no match</li>
        )}
      </ul>
    </div>
  );
}

export default function FuzzyToolsCard() {
  return (
    <CardShell
      title="fzf · zoxide · atuin"
      blurb="Wired into zsh with one guarded eval line each. The real tools are TUI/native-DB apps, so these are client-side simulations of their behavior."
      badges={<SourceBadge source="simulated" />}
    >
      <Term>
        <span className="text-white/50"># dot_zshrc:53-55</span>
        {"\n"}command -v zoxide &gt;/dev/null 2&gt;&amp;1 &amp;&amp; eval "$(zoxide init zsh)"
        {"\n"}command -v fzf &gt;/dev/null 2&gt;&amp;1 &amp;&amp; source &lt;(fzf --zsh)
        {"\n"}command -v atuin &gt;/dev/null 2&gt;&amp;1 &amp;&amp; eval "$(atuin init zsh)"
      </Term>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FuzzyPane label="fzf — file finder" placeholder="filter files…" items={FILES} />
        <FuzzyPane label="zoxide — smart cd" placeholder="try 'ghos'…" items={DIRS.map(([, p]) => p)} />
        <FuzzyPane label="atuin — history" placeholder="search history…" items={HISTORY} />
      </div>

      <p className="mt-3 text-xs text-white/40">
        Simulated ranking — substring matching only. The live tools use fuzzy scoring
        (fzf), a frecency database (zoxide), and full-text history search with sync
        (atuin).
      </p>
    </CardShell>
  );
}
