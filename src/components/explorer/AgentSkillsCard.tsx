import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

export interface AgentSkillEntry {
  name: string;
  description: string;
  category: string;
  harnesses: string[];
}

export interface AgentHarness {
  id: string;
  label: string;
  path: string;
}

export interface AgentSkillsData {
  source: "live" | "fallback";
  skills: AgentSkillEntry[];
  harnesses: AgentHarness[];
}

type SourceToggle = "served" | "fallback";

export default function AgentSkillsCard() {
  const { data, error } = useJson<AgentSkillsData>("/api/cards/agent-skills");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sourceMode, setSourceMode] = useState<SourceToggle>("served");

  const skills = data?.skills ?? [];
  const harnesses = data?.harnesses ?? [];

  const isSimulatedFallback = sourceMode === "fallback";
  const displayedSource = isSimulatedFallback ? "fallback" : (data?.source ?? "fallback");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of skills) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [skills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [skills, query, category]);

  const coverage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of skills) {
      for (const h of s.harnesses) counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    return counts;
  }, [skills]);

  return (
    <CardShell
      title="Agent Skills Hub"
      blurb="One shared catalogue (~/.agents/skills) reconciled by chezmoi into every harness discovery root. Search, filter by source pack, and see which harnesses carry each skill."
      badges={
        data ? (
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={displayedSource} />
            {isSimulatedFallback && (
              <span className="rounded border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-300">
                FALLBACK PREVIEW
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/55">loading agent skills…</p>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <label className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/55">search</span>
                <input
                  type="search"
                  aria-label="Search skills"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="name, use, or pack…"
                  className="w-48 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                />
              </label>

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-white/55">source:</span>
                <button
                  type="button"
                  onClick={() => setSourceMode("served")}
                  aria-pressed={sourceMode === "served"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "served"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  served ({data.source})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("fallback")}
                  aria-pressed={sourceMode === "fallback"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "fallback"
                      ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  fallback snapshot
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by skill pack">
              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-pressed={category === "all"}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                  category === "all"
                    ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                all ({skills.length})
              </button>
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={category === cat}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors ${
                    category === cat
                      ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {cat} ({count})
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5" aria-label="Harness coverage">
              {harnesses.map((h) => (
                <span
                  key={h.id}
                  className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70"
                  title={h.path}
                >
                  {h.label}: {coverage.get(h.id) ?? 0}/{skills.length}
                </span>
              ))}
            </div>

            <ul className="space-y-2">
              {filtered.map((skill) => (
                <li
                  key={skill.name}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-white">
                      {skill.name}
                    </span>
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-white/55">
                      {skill.category}
                    </span>
                  </div>
                  {skill.description && (
                    <p className="mt-1 font-sans text-xs leading-5 text-white/60">
                      {skill.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1" aria-label={`Harnesses carrying ${skill.name}`}>
                    {harnesses.map((h) => {
                      const present = skill.harnesses.includes(h.id);
                      return (
                        <span
                          key={h.id}
                          title={present ? `${h.label} (${h.path})` : `${h.label}: not linked`}
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${
                            present
                              ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                              : "border-white/10 bg-transparent text-white/55"
                          }`}
                        >
                          {h.label}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="rounded-lg border border-white/10 p-4 text-center font-mono text-xs text-white/55">
                  {skills.length === 0
                    ? "No skills inventoried"
                    : `No skills match "${query}"${category !== "all" ? ` in ${category}` : ""}`}
                </li>
              )}
            </ul>

            <p className="text-xs leading-5 text-white/55">
              Codex and OpenCode read the shared root directly; the other harnesses
              receive symlinks from the chezmoi sync script. Counts reflect live
              discovery roots when served live.
            </p>
          </>
        )}
      </div>
    </CardShell>
  );
}
