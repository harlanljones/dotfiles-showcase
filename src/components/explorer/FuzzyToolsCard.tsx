import { useMemo, useState, type ReactNode, type KeyboardEvent } from "react";
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

interface DirEntry {
  path: string;
  visits: number;
  lastVisit: number;
}

const SEED_DIRS: DirEntry[] = [
  { path: "~/.local/share/chezmoi", visits: 6, lastVisit: 90 },
  { path: "~/.config", visits: 5, lastVisit: 99 },
  { path: "~/.config/ghostty", visits: 4, lastVisit: 98 },
  { path: "~/.config/hypr", visits: 2, lastVisit: 70 },
  { path: "~/.config/nvim", visits: 3, lastVisit: 85 },
];

interface HistEntry {
  cmd: string;
  exit: number;
  ts: string;
  sortTs: number;
  synced: boolean;
}

const HISTORY: HistEntry[] = [
  { cmd: "chezmoi apply --dry-run", exit: 0, ts: "2026-08-25 09:48", sortTs: 100, synced: true },
  { cmd: "chezmoi edit ~/.config/starship.toml", exit: 0, ts: "2026-08-25 09:42", sortTs: 99, synced: true },
  { cmd: "bun test", exit: 1, ts: "2026-08-25 09:30", sortTs: 98, synced: true },
  { cmd: "git status -sb", exit: 0, ts: "2026-08-25 09:15", sortTs: 97, synced: false },
  { cmd: "lazygit", exit: 0, ts: "2026-08-25 08:50", sortTs: 96, synced: true },
  { cmd: "pacman -Qe | wc -l", exit: 0, ts: "2026-08-24 22:10", sortTs: 95, synced: false },
  { cmd: "starship prompt --status=1", exit: 1, ts: "2026-08-24 21:55", sortTs: 94, synced: true },
  { cmd: "mise ls", exit: 0, ts: "2026-08-24 20:30", sortTs: 93, synced: true },
  { cmd: "rg --smart-case TODO", exit: 0, ts: "2026-08-24 18:12", sortTs: 92, synced: true },
  { cmd: "fzf --height 40%", exit: 0, ts: "2026-08-24 16:40", sortTs: 91, synced: false },
];

const inputCls =
  "mb-2 w-full rounded border border-white/15 bg-black/40 px-2 py-1.5 font-mono text-xs text-white outline-none placeholder:text-white/25 focus:border-emerald-500/50";

function Pane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 font-mono text-xs text-cyan-300">{label}</div>
      {children}
    </div>
  );
}

interface FuzzyMatch {
  score: number;
  positions: number[];
}

function fuzzyMatch(item: string, query: string): FuzzyMatch | null {
  const s = item.toLowerCase();
  const q = query.toLowerCase();
  const n = s.length;
  const m = q.length;
  if (m === 0) return { score: 0, positions: [] };
  if (m > n) return null;

  const isBoundary = (idx: number): boolean =>
    idx === 0 || /[/_.\-]/.test(s[idx - 1]);

  const f: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n }, () => -Infinity),
  );
  const back: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n }, () => -1),
  );

  for (let i = 0; i < n; i++) {
    if (s[i] !== q[0]) continue;
    let b = 1;
    if (isBoundary(i)) b += 6;
    if (i === 0) b += 3;
    f[1][i] = b;
  }

  const CONSEC = 10;
  for (let j = 2; j <= m; j++) {
    for (let i = j - 1; i < n; i++) {
      if (s[i] !== q[j - 1]) continue;
      let best = -Infinity;
      let bestK = -1;
      for (let k = j - 2; k < i; k++) {
        const prev = f[j - 1][k];
        if (prev === -Infinity) continue;
        let val = prev;
        if (k === i - 1) val += CONSEC;
        if (isBoundary(i)) val += 6;
        if (val > best) {
          best = val;
          bestK = k;
        }
      }
      f[j][i] = best;
      back[j][i] = bestK;
    }
  }

  let endIdx = -1;
  let bestScore = -Infinity;
  for (let i = m - 1; i < n; i++) {
    if (f[m][i] > bestScore) {
      bestScore = f[m][i];
      endIdx = i;
    }
  }
  if (endIdx === -1 || bestScore === -Infinity) return null;

  const positions: number[] = [];
  let cur = endIdx;
  let level = m;
  while (level >= 1 && cur !== -1) {
    positions.push(cur);
    cur = back[level][cur];
    level -= 1;
  }
  positions.reverse();
  return { score: bestScore, positions };
}

function Highlighted({ text, positions }: { text: string; positions: number[] }) {
  const set = new Set(positions);
  return (
    <>
      {text.split("").map((ch, i) => (
        <span key={i} className={set.has(i) ? "text-emerald-300 font-semibold" : ""}>
          {ch}
        </span>
      ))}
    </>
  );
}

/** Clamp a selected index to a valid list position (or 0 when empty). */
function clampSel(sel: number, len: number): number {
  if (len <= 0) return 0;
  return Math.min(Math.max(sel, 0), len - 1);
}

function FzfPane({ items }: { items: string[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [accepted, setAccepted] = useState<string | null>(null);

  const scored = useMemo(() => {
    const needle = q.trim();
    if (!needle) {
      return items.map((item) => ({ item, score: 0, positions: [] as number[] }));
    }
    const out: { item: string; score: number; positions: number[] }[] = [];
    for (const item of items) {
      const m = fuzzyMatch(item, needle);
      if (m) out.push({ item, score: m.score, positions: m.positions });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [q, items]);

  const safeIdx = clampSel(sel, scored.length);
  const preview = scored[safeIdx]?.item ?? "";

  const accept = (idx: number) => {
    const item = scored[idx]?.item;
    if (!item) return;
    setAccepted(item);
    window.setTimeout(() => setAccepted((a) => (a === item ? null : a)), 800);
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => clampSel(s + 1, scored.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => clampSel(s - 1, scored.length));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      accept(safeIdx);
    }
  };

  return (
    <Pane label="fzf — fuzzy file finder">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKey}
        placeholder="fuzzy-match files…"
        className={inputCls}
      />
      <ul role="listbox" aria-label="matching files" className="max-h-40 space-y-0.5 overflow-y-auto">
        {scored.map((m, i) => (
          <li
            key={m.item}
            role="option"
            aria-selected={i === safeIdx}
            tabIndex={0}
            onClick={() => setSel(i)}
            onKeyDown={onKey}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-0.5 font-mono text-[11px] ${
              i === safeIdx ? "bg-emerald-500/15 text-white" : "bg-white/[0.04] text-white/70"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">
              <Highlighted text={m.item} positions={m.positions} />
            </span>
            <span className="shrink-0 text-white/30">{m.score}</span>
          </li>
        ))}
        {scored.length === 0 && (
          <li className="px-2 py-0.5 font-mono text-[11px] text-white/30">no match</li>
        )}
      </ul>
      <div className="mt-2 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white/60">
        {accepted ? (
          <>
            <span className="text-emerald-300/80">✓ would exec $EDITOR</span> {accepted}
          </>
        ) : (
          <>
            <span className="text-emerald-300/80">would open:</span>{" "}
            {preview || <span className="text-white/30">—</span>}
          </>
        )}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 font-mono text-[10px] leading-relaxed text-white/35">
        <div>
          <span className="text-white/50">FZF_DEFAULT_COMMAND</span>={" "}
          <span className="text-white/60">'fd --type f --hidden --follow --exclude .git'</span>
        </div>
        <div>
          <span className="text-white/50">FZF_DEFAULT_OPTS</span>={" "}
          <span className="text-white/60">'--height=40% --layout=reverse --border --info=inline'</span>
        </div>
      </div>
    </Pane>
  );
}

function ZoxidePane({ initial }: { initial: DirEntry[] }) {
  const [state, setState] = useState({ now: 100, dirs: initial });
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  const ranked = state.dirs
    .map((d) => {
      const age = state.now - d.lastVisit;
      const recency = Math.pow(0.85, age);
      const score = d.visits * recency;
      return { ...d, age, recency, score };
    })
    .sort((a, b) => b.score - a.score);

  function visit(path: string) {
    setState((prev) => {
      const now = prev.now + 1;
      return {
        now,
        dirs: prev.dirs.map((d) =>
          d.path === path ? { ...d, visits: d.visits + 1, lastVisit: now } : d,
        ),
      };
    });
  }

  const needle = q.trim();
  const candidates = needle
    ? ranked
        .map((d) => ({ d, positions: fuzzyMatch(d.path, needle)?.positions ?? null }))
        .filter((c) => c.positions !== null)
        .map((c) => ({ d: c.d, positions: c.positions as number[] }))
    : ranked.map((d) => ({ d, positions: [] as number[] }));
  const target = candidates[0]?.d ?? null;
  const safeSel = clampSel(sel, candidates.length);
  const activable = candidates[safeSel];

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => clampSel(s + 1, candidates.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => clampSel(s - 1, candidates.length));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activable) visit(activable.d.path);
    }
  };

  return (
    <Pane label="zoxide — frecency smart-cd">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKey}
        placeholder="z <query>… (try 'ghostty')"
        className={inputCls}
      />
      <ul aria-label="matching directories" role="listbox" className="max-h-40 space-y-0.5 overflow-y-auto">
        {candidates.map(({ d, positions }, i) => {
          const isTarget = !!needle && !!target && d.path === target.path;
          const isSel = i === safeSel;
          return (
            <li
              key={d.path}
              role="option"
              aria-selected={isSel}
              tabIndex={0}
              onClick={() => {
                setSel(i);
                visit(d.path);
              }}
              onKeyDown={onKey}
              title={`visits ${d.visits} · age ${d.age}`}
              className={`flex cursor-pointer items-center justify-between gap-2 truncate rounded px-2 py-0.5 font-mono text-[11px] ${
                isTarget || isSel
                  ? "border-l-2 border-emerald-400 bg-emerald-500/10 text-white"
                  : "bg-white/[0.04] text-white/70"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <Highlighted text={d.path} positions={positions} />
              </span>
              <span className="shrink-0 text-white/35">{d.score.toFixed(2)}</span>
            </li>
          );
        })}
        {candidates.length === 0 && (
          <li className="px-2 py-0.5 font-mono text-[11px] text-white/30">no match</li>
        )}
      </ul>
      <div className="mt-2 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white/60">
        {needle ? (
          <>
            <span className="text-emerald-300/80">z {needle}</span> →{" "}
            {target ? target.path : <span className="text-red-300/70">no match</span>}
          </>
        ) : (
          <span className="text-white/40">click a dir to bump frecency</span>
        )}
      </div>
    </Pane>
  );
}

type ExitFilter = "all" | "ok" | "fail";

function AtuinPane({ items }: { items: HistEntry[] }) {
  const [q, setQ] = useState("");
  const [exitFilter, setExitFilter] = useState<ExitFilter>("all");
  const [sel, setSel] = useState(0);
  const [ran, setRan] = useState<string | null>(null);

  const needle = q.trim();
  const results = items
    .filter((h) => (needle ? fuzzyMatch(h.cmd, needle) !== null : true))
    .filter((h) =>
      exitFilter === "all" ? true : exitFilter === "ok" ? h.exit === 0 : h.exit !== 0,
    )
    .sort((a, b) => b.sortTs - a.sortTs);

  const safeSel = clampSel(sel, results.length);
  const activable = results[safeSel];

  const run = (cmd: string) => {
    setRan(cmd);
    window.setTimeout(() => setRan((r) => (r === cmd ? null : r)), 800);
  };

  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => clampSel(s + 1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => clampSel(s - 1, results.length));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activable) run(activable.cmd);
    }
  };

  const syncedCount = items.filter((h) => h.synced).length;

  return (
    <Pane label="atuin — synced history search">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKey}
        placeholder="full-text search history…"
        className={inputCls}
      />
      <div className="mb-2 flex items-center gap-1">
        {(["all", "ok", "fail"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setExitFilter(f)}
            aria-pressed={exitFilter === f}
            className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
              exitFilter === f
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            {f === "all" ? "all" : f === "ok" ? "exit 0" : "exit ≠ 0"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-white/35">
          {syncedCount}/{items.length} synced
        </span>
      </div>
      <ul aria-label="history results" role="listbox" className="max-h-40 space-y-0.5 overflow-y-auto">
        {results.map((h, i) => {
          const m = needle ? fuzzyMatch(h.cmd, needle) : null;
          return (
            <li
              key={`${h.cmd}-${h.sortTs}-${i}`}
              role="option"
              aria-selected={i === safeSel}
              tabIndex={0}
              onClick={() => setSel(i)}
              onKeyDown={onKey}
              className={`flex items-center gap-2 rounded px-2 py-0.5 font-mono text-[11px] ${
                i === safeSel ? "bg-emerald-500/15 text-white" : "bg-white/[0.04] text-white/70"
              }`}
            >
              <span className="shrink-0 text-white/30">{h.ts.slice(5)}</span>
              <span className="min-w-0 flex-1 truncate">
                <Highlighted text={h.cmd} positions={m?.positions ?? []} />
              </span>
              <span
                className={`shrink-0 rounded px-1 ${
                  h.exit === 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}
              >
                {h.exit}
              </span>
              <span
                className={`shrink-0 text-[10px] ${
                  h.synced ? "text-emerald-300/70" : "text-amber-300/70"
                }`}
              >
                {h.synced ? "synced" : "local"}
              </span>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="px-2 py-0.5 font-mono text-[11px] text-white/30">no match</li>
        )}
      </ul>
      <div className="mt-2 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-white/60">
        {ran ? (
          <>
            <span className="text-emerald-300/80">✓ would run</span> {ran}
          </>
        ) : (
          <span className="text-white/40">Enter would run the selected command</span>
        )}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 font-mono text-[10px] leading-relaxed text-white/35">
        <div>
          <span className="text-white/50">↑</span> scoped to this directory ·{" "}
          <span className="text-white/50">Ctrl+R</span> global
        </div>
        <div>
          <span className="text-white/50">enter_accept</span> = true · E2E sync every{" "}
          <span className="text-white/50">5m</span> ·{" "}
          <span className="text-white/50">search_mode</span> = <span className="text-white/60">fuzzy</span>
        </div>
      </div>
    </Pane>
  );
}

export default function FuzzyToolsCard() {
  return (
    <CardShell
      title="fzf · zoxide · atuin"
      blurb="Wired into zsh with one guarded eval line each. These are client-side simulations of the real tools' ranking behavior: fzf subsequence scoring with contiguous and word-boundary bonuses, zoxide frequency × recency, and atuin fuzzy full-text history."
      badges={<SourceBadge source="simulated" />}
    >
      <Term>
        <span className="text-white/50"># dot_zshrc:53-55</span>
        {"\n"}command -v zoxide &gt;/dev/null 2&gt;&amp;1 &amp;&amp; eval "$(zoxide init zsh)"
        {"\n"}command -v fzf &gt;/dev/null 2&gt;&amp;1 &amp;&amp; source &lt;(fzf --zsh)
        {"\n"}command -v atuin &gt;/dev/null 2&gt;&amp;1 &amp;&amp; eval "$(atuin init zsh)"
      </Term>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FzfPane items={FILES} />
        <ZoxidePane initial={SEED_DIRS} />
        <AtuinPane items={HISTORY} />
      </div>

      <p className="mt-3 text-xs text-white/40">
        Simulated rankings: fzf scores ordered subsequence matches with contiguous
        and word-boundary bonuses; zoxide ranks by frequency × recency decay
        (0.85^age); atuin fuzzy-matches full-text history by exit code and sync
        state, sorted newest-first.
      </p>
    </CardShell>
  );
}
