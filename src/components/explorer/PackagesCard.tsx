import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface PackagesData {
  brewSource: "live" | "fallback";
  pacmanSource: "live" | "fallback";
  formulae: string[];
  casks: string[];
  pacman: string[];
}

type PkgKind = "formula" | "cask" | "pacman" | "both";
type View = "all" | "brew" | "pacman" | "both";

interface Pkg {
  name: string;
  kind: PkgKind;
}

const KIND_STYLE: Record<PkgKind, string> = {
  formula: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  cask: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  pacman: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  both: "border-violet-500/30 bg-violet-500/10 text-violet-200",
};

const KIND_TAG: Record<PkgKind, string> = {
  formula: "f",
  cask: "c",
  pacman: "p",
  both: "b",
};

/** Homebrew name → pacman name equivalences where the two tools disagree on
 * naming. Only included for honest mappings verified from the fallback data. */
const BREW_TO_PACMAN_ALIAS: Record<string, string> = {
  "font-jetbrainsmono-nerd-font": "ttf-jetbrains-mono-nerd",
  ghostty: "ghostty",
};

const VIEWS: Array<{ key: View; label: string }> = [
  { key: "all", label: "All" },
  { key: "brew", label: "Homebrew" },
  { key: "pacman", label: "pacman" },
  { key: "both", label: "Both" },
];

function PkgPill({ pkg }: { pkg: Pkg }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${KIND_STYLE[pkg.kind]}`}>
      <span className="mr-1 opacity-50">{KIND_TAG[pkg.kind]}</span>
      {pkg.name}
    </span>
  );
}

function LegendChip({ kind, count }: { kind: PkgKind; count: number }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs text-white/50">
      <span className={`rounded-full border px-1.5 py-0.5 ${KIND_STYLE[kind]}`}>{KIND_TAG[kind]}</span>
      {kind} · {count}
    </span>
  );
}

export default function PackagesCard() {
  const { data, error } = useJson<PackagesData>("/api/cards/packages");
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const formula = data?.formulae.length ?? 0;
    const cask = data?.casks.length ?? 0;
    const pacman = data?.pacman.length ?? 0;
    return { formula, cask, pacman, brew: formula + cask, total: formula + cask + pacman };
  }, [data]);

  const all = useMemo<Pkg[]>(() => {
    if (!data) return [];
    return [
      ...data.formulae.map((name): Pkg => ({ name, kind: "formula" })),
      ...data.casks.map((name): Pkg => ({ name, kind: "cask" })),
      ...data.pacman.map((name): Pkg => ({ name, kind: "pacman" })),
    ];
  }, [data]);

  /** Brew names (formulae + casks) that also exist under pacman, honoring the
   * known alias pairs — your portable core. Keyed on the brew-side name. */
  const bothNames = useMemo(() => {
    if (!data) return new Set<string>();
    const pacmanSet = new Set(data.pacman);
    const found = new Set<string>();
    for (const name of [...data.formulae, ...data.casks]) {
      const pacmanCounterpart = BREW_TO_PACMAN_ALIAS[name] ?? name;
      if (pacmanSet.has(pacmanCounterpart)) found.add(name);
    }
    return found;
  }, [data]);

  const filtered = useMemo(() => {
    let list = all;
    if (view === "brew") list = list.filter((p) => p.kind === "formula" || p.kind === "cask");
    else if (view === "pacman") list = list.filter((p) => p.kind === "pacman");
    else if (view === "both") {
      const seen = new Set<string>();
      list = all
        .filter(
          (p) =>
            (p.kind === "formula" || p.kind === "cask") &&
            bothNames.has(p.name) &&
            !seen.has(p.name) &&
            seen.add(p.name),
        )
        .map((p) => ({ ...p, kind: "both" as PkgKind }));
    }
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((p) => p.name.toLowerCase().includes(needle));
    return list;
  }, [all, view, q, bothNames]);

  const countFor = (v: View): number =>
    v === "all"
      ? counts.total
      : v === "brew"
        ? counts.brew
        : v === "pacman"
          ? counts.pacman
          : bothNames.size;

  return (
    <CardShell
      title="Packages"
      blurb="macOS machines restore from the Homebrew Bundle (formulae + casks); this Arch box tracks its explicit pacman set. Search, slice, and compare the two manifests below."
      badges={
        data ? (
          <div className="flex gap-3">
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] text-white/55">brew ·</span>
              <SourceBadge source={data.brewSource} />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-mono text-[9px] text-white/55">pacman ·</span>
              <SourceBadge source={data.pacmanSource} />
            </div>
          </div>
        ) : undefined
      }
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {!data && !error && <p className="font-mono text-xs text-white/55">loading packages…</p>}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-white/15">
              {VIEWS.map((v) => {
                const active = view === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setView(v.key)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 font-mono text-xs transition-colors ${active ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/5"}`}
                  >
                    {v.label}
                    <span className={`ml-1.5 ${active ? "text-white/60" : "text-white/50"}`}>{countFor(v.key)}</span>
                  </button>
                );
              })}
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search packages…"
              className="w-44 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs text-white outline-none placeholder:text-white/50 focus:border-emerald-500/50"
            />
            <span className="font-mono text-xs text-white/55">
              {filtered.length} shown · {counts.total} total
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <LegendChip kind="formula" count={counts.formula} />
            <LegendChip kind="cask" count={counts.cask} />
            <LegendChip kind="pacman" count={counts.pacman} />
            <LegendChip kind="both" count={bothNames.size} />
          </div>

          {filtered.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((p) => (
                <PkgPill key={`${p.kind}:${p.name}`} pkg={p} />
              ))}
            </div>
          ) : (
            <p className="font-mono text-xs text-white/55">
              {q.trim() ? `no packages match "${q.trim()}"` : "no packages in this view"}
            </p>
          )}

          {view === "both" && (
            <p className="text-xs leading-5 text-white/55">
              {bothNames.size} package{bothNames.size === 1 ? "" : "s"} restored on both
              macOS (Homebrew) and Arch (pacman) — your portable core.
            </p>
          )}

          <p className="text-xs leading-5 text-white/55">
            Combined view merges the Brewfile (formulae + casks) with the pacman explicit set. Switch tabs to isolate one source; the search filters across whichever tab is active.
          </p>
        </div>
      )}
    </CardShell>
  );
}
