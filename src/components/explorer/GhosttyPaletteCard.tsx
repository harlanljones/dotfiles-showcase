import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term, Pill } from "./ui";

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

const ANSI_BASE_NAMES = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

function ansiLabel(idx: number): string {
  const base = idx < 8 ? idx : idx - 8;
  const name = ANSI_BASE_NAMES[base] ?? String(base);
  return idx < 8 ? `${idx} ${name}` : `${idx} bright ${name}`;
}

const SAMPLE_LINE = "$ ls -la ~/dev && git status --short --branch && echo done";

export default function GhosttyPaletteCard() {
  const { data, error } = useJson<GhosttyData>("/api/cards/ghostty");
  const [selected, setSelected] = useState<number>(0);
  const [showFont, setShowFont] = useState<boolean>(true);

  const palette: Array<[number, string]> = data
    ? Object.entries(data.theme.palette)
        .map(([k, v]) => [Number(k), v] as [number, string])
        .sort((a, b) => a[0] - b[0])
    : [];

  const selectedHex = palette.find(([n]) => n === selected)?.[1] ?? null;
  const pairIdx = selected < 8 ? selected + 8 : selected - 8;
  const pairHex = palette.find(([n]) => n === pairIdx)?.[1] ?? null;
  const selectedKind = selected < 8 ? "regular" : "bright";
  const pairKind = selected < 8 ? "bright" : "regular";
  const pairDelta = selected < 8 ? `${selected}+8` : `${selected}-8`;

  const bg = data?.theme.background ?? "#060912";
  const fg = data?.theme.foreground ?? "#959aa4";
  const fontFam = data?.fontFamily ?? "monospace";
  const fontSz = data?.fontSize ?? 12;

  return (
    <CardShell
      title="Ghostty Theme"
      blurb="The terminal pulls its palette at runtime from omarchy's current-theme state file — swap themes without touching the config. Click a swatch to preview it as terminal foreground on the theme background."
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
      {!data && !error && (
        <p className="font-mono text-xs text-white/40">loading ghostty config…</p>
      )}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="rounded bg-white/5 px-2 py-1">
              font: <span className="text-white/80">{data.fontFamily ?? "?"}</span>{" "}
              {data.fontSize && <span className="text-white/50">@ {data.fontSize}px</span>}
            </span>
            {data.themeRef && (
              <span className="rounded bg-white/5 px-2 py-1 text-white/50">
                theme ← {data.themeRef}
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowFont((v) => !v)}
              aria-pressed={showFont}
              className={`rounded-lg border px-3 py-1 font-mono text-xs transition-colors ${
                showFont
                  ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
              }`}
            >
              font preview
            </button>
            {data.mainSource !== data.themeSource && (
              <Pill>
                main:{data.mainSource} · theme:{data.themeSource}
              </Pill>
            )}
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

          {showFont && (
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/50">
                Font preview — {fontFam} @ {fontSz}px on theme background
              </div>
              <pre
                className="overflow-x-auto rounded-lg border border-white/10 p-3 leading-relaxed"
                style={{
                  background: bg,
                  color: fg,
                  fontFamily: `"${fontFam}", monospace`,
                  fontSize: `${fontSz}px`,
                }}
              >
                {SAMPLE_LINE}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            <div className="font-mono text-xs text-white/50">
              ANSI palette — click a swatch to preview as foreground
            </div>
            {palette.length === 0 ? (
              <p className="font-mono text-xs text-white/35">
                No palette entries in this payload (fallback).
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {palette.map(([n, hex]) => {
                  const isSelected = n === selected;
                  const isBright = n >= 8;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelected(n)}
                      aria-pressed={isSelected}
                      title={ansiLabel(n)}
                      className={`rounded border p-1.5 text-left transition-colors ${
                        isSelected
                          ? "border-cyan-300/50 bg-cyan-300/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/10"
                      }`}
                    >
                      <div
                        className="h-8 w-full rounded-sm border border-black/40"
                        style={{ background: hex }}
                      />
                      <div className="mt-1 flex items-baseline justify-between font-mono text-[9px]">
                        <span className={isSelected ? "text-cyan-200" : "text-white/55"}>{n}</span>
                        <span className="text-white/35">{isBright ? "bright" : "reg"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedHex && (
            <div className="space-y-2">
              <div className="font-mono text-xs text-white/60">
                Selected: <span className="text-cyan-200">{ansiLabel(selected)}</span> ·{" "}
                <span className="text-white/80">{selectedHex}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-white/50">
                    {selectedKind} (SGR {selected})
                  </div>
                  <pre
                    className="overflow-x-auto rounded-lg border border-white/10 p-3 font-mono text-sm leading-relaxed"
                    style={{ background: bg, color: selectedHex }}
                  >
                    {SAMPLE_LINE}
                  </pre>
                </div>
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-white/50">
                    {pairKind} pair (SGR {pairIdx} = {pairDelta})
                  </div>
                  <pre
                    className="overflow-x-auto rounded-lg border border-white/10 p-3 font-mono text-sm leading-relaxed"
                    style={{
                      background: bg,
                      color: pairHex ?? selectedHex,
                      opacity: pairHex ? 1 : 0.5,
                    }}
                  >
                    {pairHex ? SAMPLE_LINE : "(pair index not in palette)"}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {data.keybinds.length > 0 && <Term>{data.keybinds.join("\n")}</Term>}
        </div>
      )}
    </CardShell>
  );
}
