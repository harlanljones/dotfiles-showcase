import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface GhosttyData {
  mainSource: "live" | "fallback";
  themeSource: "live" | "fallback";
  fontFamily: string | null;
  fontSize: number | null;
  keybinds: string[];
  themeRef: string | null;
  theme: {
    background: string | null;
    foreground: string | null;
    palette: Record<string, string>;
  };
}

export default function GhosttyPaletteCard() {
  const { data, error } = useJson<GhosttyData>("/api/cards/ghostty");

  return (
    <CardShell
      title="Ghostty Theme"
      blurb="The terminal pulls its palette at runtime from omarchy's current-theme state file — swap themes without touching the config."
      badges={
        data ? (
          <div className="flex gap-1.5">
            <SourceBadge source={data.mainSource} />
            <SourceBadge source={data.themeSource} />
          </div>
        ) : undefined
      }
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded bg-white/5 px-2 py-1">
              font: <span className="text-white/80">{data.fontFamily ?? "?"}</span>{" "}
              {data.fontSize && <span className="text-white/50">@ {data.fontSize}px</span>}
            </span>
            {data.themeRef && (
              <span className="rounded bg-white/5 px-2 py-1 text-white/50">
                theme ← {data.themeRef}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.theme.palette)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([n, hex]) => (
                <div key={n} className="w-[72px] rounded border border-white/10 p-1.5" style={{ background: "#0d1117" }}>
                  <div className="h-6 w-full rounded-sm border border-black/40" style={{ background: hex }} />
                  <div className="mt-1 flex justify-between font-mono text-[9px] text-white/40">
                    <span>{n}</span>
                    <span>{hex}</span>
                  </div>
                </div>
              ))}
          </div>

          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {(["background", "foreground"] as const).map((k) =>
              data.theme[k] ? (
                <span key={k} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border border-black/40"
                    style={{ background: data.theme[k] ?? "" }}
                  />
                  {k}: {data.theme[k]}
                </span>
              ) : null,
            )}
          </div>

          {data.keybinds.length > 0 && (
            <Term>{data.keybinds.join("\n")}</Term>
          )}
        </div>
      )}
    </CardShell>
  );
}
