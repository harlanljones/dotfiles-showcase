import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

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

function groupOf(extras: string): string {
  const m = extras.match(/extras\.([^.]+)\./);
  return m ? (GROUP_LABELS[m[1]] ?? m[1]) : "other";
}

export default function NeovimCard() {
  const { data, error } = useJson<NeovimData>("/api/cards/neovim");

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
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(
              data.extras.reduce<Record<string, string[]>>((acc, e) => {
                const g = groupOf(e);
                const name = e.replace(/^lazyvim\.plugins\.extras\./, "");
                (acc[g] ??= []).push(name);
                return acc;
              }, {}),
            ).map(([group, items]) => (
              <div key={group} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 font-mono text-xs capitalize text-cyan-300">{group}</div>
                <ul className="space-y-1">
                  {items.map((i) => (
                    <li key={i} className="font-mono text-[11px] leading-snug text-white/70">
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {data.plugins.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                    <th className="px-3 py-2 font-medium">plugin</th>
                    <th className="px-3 py-2 font-medium">pinned commit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plugins.map(([name, commit]) => (
                    <tr key={name} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-1.5 text-white/80">{name}</td>
                      <td className="px-3 py-1.5 text-white/40">{commit || "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
