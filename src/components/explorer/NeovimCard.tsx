import { useMemo, useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, Pill, SourceBadge } from "./ui";

interface NeovimData {
  extrasSource: "live" | "fallback";
  lockSource: "live" | "fallback";
  extras: string[];
  plugins: Array<[string, string]>;
}

const GROUP_LABELS: Record<string, string> = {
  editor: "editor",
  lang: "languages",
  util: "utilities",
  test: "testing",
  diagnostics: "diagnostics",
  formatting: "formatting",
  linting: "linting",
};

function normalizeExtra(extra: string): string {
  return extra.replace(/^lazyvim\.plugins\.extras\./, "");
}

function groupOf(extra: string): string {
  const parts = normalizeExtra(extra).split(".");
  const g = parts.length >= 2 ? parts[0] : "other";
  return GROUP_LABELS[g] ?? g;
}

const EXTRA_PLUGIN_MAP: Record<string, string[]> = {
  "editor.dial": ["dial.nvim"],
  "editor.inc-rename": ["inc-rename.nvim"],
  "editor.neo-tree": ["neo-tree.nvim"],
  "lang.astro": ["nvim-ts-autotag"],
  "lang.json": ["SchemaStore.nvim"],
  "lang.markdown": ["markdown-preview.nvim", "render-markdown.nvim"],
  "lang.python": ["venv-selector.nvim"],
  "lang.tailwind": ["nvim-ts-autotag"],
  "lang.toml": ["SchemaStore.nvim"],
  "lang.typescript": ["ts-comments.nvim", "nvim-ts-autotag"],
  "util.chezmoi": ["chezmoi.nvim", "chezmoi.vim"],
  "util.dot": ["nvim-treesitter", "nvim-treesitter-textobjects"],
};

function pluginsForExtra(extra: string): string[] {
  return EXTRA_PLUGIN_MAP[normalizeExtra(extra)] ?? [];
}

function shortHash(commit: string): string {
  return commit ? commit.slice(0, 7) : "?";
}

export default function NeovimCard() {
  const { data, error } = useJson<NeovimData>("/api/cards/neovim");

  const [disabled, setDisabled] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [copiedCommit, setCopiedCommit] = useState<string | null>(null);

  const copyCommit = (name: string, commit: string) => {
    setCopiedCommit(name);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(commit).catch(() => {});
    }
    window.setTimeout(() => setCopiedCommit((c) => (c === name ? null : c)), 1400);
  };

  const association = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!data) return map;
    for (const ex of data.extras) {
      map.set(ex, pluginsForExtra(ex));
    }
    return map;
  }, [data]);

  const pluginToExtras = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!data) return map;
    for (const ex of data.extras) {
      for (const name of association.get(ex) ?? []) {
        const arr = map.get(name);
        if (arr) arr.push(ex);
        else map.set(name, [ex]);
      }
    }
    return map;
  }, [data, association]);

  const grouped = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (!data) return map;
    for (const ex of data.extras) {
      (map[groupOf(ex)] ??= []).push(ex);
    }
    return map;
  }, [data]);

  const visiblePlugins = useMemo(() => {
    if (!data) return [] as Array<[string, string]>;
    const q = query.trim().toLowerCase();
    return data.plugins.filter(([name]) => {
      if (q && !name.toLowerCase().includes(q)) return false;
      if (onlyEnabled) {
        let belongs = false;
        for (const ex of data.extras) {
          if (disabled.has(ex)) continue;
          if ((association.get(ex) ?? []).some((n) => n === name)) {
            belongs = true;
            break;
          }
        }
        if (!belongs) return false;
      }
      return true;
    });
  }, [data, query, onlyEnabled, disabled, association]);

  const toggleExtra = (extra: string) => {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(extra)) next.delete(extra);
      else next.add(extra);
      return next;
    });
  };

  const enabledCount = data ? data.extras.length - disabled.size : 0;

  return (
    <CardShell
      title="Neovim / LazyVim"
      blurb="LazyVim distribution with curated extras; plugin revisions are pinned in lazy-lock.json for reproducible edits."
      badges={
        data ? (
          <div className="flex gap-1.5">
            <SourceBadge source={data.extrasSource} />
            <SourceBadge source={data.lockSource} />
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/40">loading neovim config…</p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-white/60">
                <span className="text-emerald-300">{enabledCount}</span>
                /{data.extras.length} extras enabled
              </span>
              <span className="text-white/20">·</span>
              <span className="font-mono text-white/60">
                <span className="text-cyan-300">{visiblePlugins.length}</span>
                /{data.plugins.length} plugins
              </span>
            </div>

            {data.extras.length === 0 && data.plugins.length === 0 ? (
              <p className="rounded-lg border border-amber-300/20 bg-amber-500/[0.04] px-3 py-2 font-mono text-xs text-amber-200/80">
                No live LazyVim config available — showing fallback. Open
                ~/.config/nvim and run :Lazy sync to populate extras and
                lazy-lock.json.
              </p>
            ) : (
              <>
                {data.extras.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-xs text-white/50">
                        LazyVim extras — toggle to simulate enabling/disabling
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setDisabled(new Set())}
                          className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/55 transition-colors hover:bg-white/10"
                        >
                          all
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDisabled(new Set(data.extras))
                          }
                          className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/55 transition-colors hover:bg-white/10"
                        >
                          none
                        </button>
                      </div>
                    </div>
                    {Object.entries(grouped).map(([group, items]) => (
                      <div
                        key={group}
                        className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5"
                      >
                        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                          {group}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((ex) => {
                            const on = !disabled.has(ex);
                            const cnt = association.get(ex)?.length ?? 0;
                            return (
                              <button
                                key={ex}
                                type="button"
                                onClick={() => toggleExtra(ex)}
                                aria-pressed={on}
                                className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                                  on
                                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                                    : "border-white/10 bg-white/[0.02] text-white/35"
                                }`}
                              >
                                {normalizeExtra(ex)}
                                {cnt > 0 && (
                                  <span className="ml-1.5 text-white/40">
                                    +{cnt}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <p className="font-mono text-[10px] leading-relaxed text-white/35">
                      Plugin association is a curated snapshot mapped to the repos
                      pinned here (e.g.{" "}
                      <span className="text-white/50">lang.typescript</span> →{" "}
                      <span className="text-white/50">ts-comments.nvim</span>,{" "}
                      <span className="text-white/50">nvim-ts-autotag</span>).
                      LazyVim's real spec files pull many more plugins than this
                      snapshot lists.
                    </p>
                  </div>
                )}

                {data.plugins.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="filter plugins…"
                        className="min-w-40 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-white outline-none placeholder:text-white/30 focus:border-cyan-300/50"
                      />
                      <button
                        type="button"
                        onClick={() => setOnlyEnabled((v) => !v)}
                        aria-pressed={onlyEnabled}
                        className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                          onlyEnabled
                            ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200"
                            : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                        }`}
                      >
                        only enabled extras
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-white/10">
                      <table className="w-full font-mono text-xs">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                            <th className="px-3 py-2 font-medium">plugin</th>
                            <th className="px-3 py-2 font-medium">
                              pinned commit
                            </th>
                            <th className="px-3 py-2 font-medium">via extra</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visiblePlugins.map(([name, commit]) => {
                            const via = pluginToExtras.get(name) ?? [];
                            return (
                              <tr
                                key={name}
                                className="border-b border-white/5 last:border-0"
                              >
                                <td className="px-3 py-1.5 text-white/80">
                                  {name}
                                </td>
                                <td className="px-3 py-1.5">
                                  <button
                                    type="button"
                                    onClick={() => copyCommit(name, commit)}
                                    title={`copy ${shortHash(commit)} → ${commit}`}
                                    className="font-mono text-white/40 underline-offset-2 transition-colors hover:text-cyan-300 hover:underline"
                                  >
                                    {copiedCommit === name ? (
                                      <span className="text-emerald-300">
                                        copied
                                      </span>
                                    ) : (
                                      shortHash(commit)
                                    )}
                                  </button>
                                </td>
                                <td className="px-3 py-1.5">
                                  {via.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {via.map((v) => (
                                        <Pill key={v}>
                                          {normalizeExtra(v)}
                                        </Pill>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-white/25">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {visiblePlugins.length === 0 && (
                      <p className="font-mono text-xs text-white/35">
                        No plugins match the current filter.
                      </p>
                    )}
                  </div>
                ) : (
                  data.extras.length > 0 && (
                    <p className="font-mono text-xs text-white/35">
                      No lazy-lock.json pins available.
                    </p>
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </CardShell>
  );
}
