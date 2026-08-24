import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface PackagesData {
  brewSource: "live" | "fallback";
  pacmanSource: "live" | "fallback";
  formulae: string[];
  casks: string[];
  pacman: string[];
}

function PackagePills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <span key={p} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs text-white/75">
          {p}
        </span>
      ))}
      {items.length === 0 && <span className="text-xs text-white/40">none</span>}
    </div>
  );
}

export default function PackagesCard() {
  const { data, error } = useJson<PackagesData>("/api/cards/packages");
  const [q, setQ] = useState("");

  return (
    <CardShell
      title="Packages"
      blurb="macOS machines restore from the Homebrew Bundle; this Arch box tracks its explicit pacman set."
      badges={
        data ? (
          <div className="flex gap-1.5">
            <SourceBadge source={data.brewSource} />
            <SourceBadge source={data.pacmanSource} />
          </div>
        ) : undefined
      }
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm text-white/70">
              Brewfile —{" "}
              <span className="font-mono text-xs text-white/50">
                {data.formulae.length} formulae · {data.casks.length} casks
              </span>
            </div>
            <PackagePills items={data.formulae} />
            {data.casks.length > 0 && (
              <div className="mt-1.5">
                <PackagePills items={data.casks} />
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm text-white/70">
                pacman (explicit) —{" "}
                <span className="font-mono text-xs text-white/50">{data.pacman.length} packages</span>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="filter…"
                className="w-36 rounded border border-white/15 bg-black/40 px-2 py-1 font-mono text-xs outline-none placeholder:text-white/25 focus:border-emerald-500/50"
              />
            </div>
            <PackagePills
              items={
                q.trim()
                  ? data.pacman.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()))
                  : data.pacman
              }
            />
          </div>
        </div>
      )}
    </CardShell>
  );
}
