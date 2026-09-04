import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Pill } from "./ui";

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

interface Bind {
  key: string;
  action: string;
}

function parseBind(bind: string): Bind | null {
  const i = bind.indexOf("=");
  if (i === -1) return null;
  return { key: bind.slice(0, i), action: bind.slice(i + 1) };
}

function buildBindGroups(binds: string[]): Array<{ label: string | null; items: Bind[] }> {
  const groups: Array<{ label: string | null; items: Bind[] }> = [];
  let run: Bind[] = [];
  const flush = () => {
    if (run.length) {
      groups.push({
        label: run[0].action.startsWith("resize_split") ? "split navigation" : null,
        items: run,
      });
      run = [];
    }
  };
  for (const b of binds) {
    const p = parseBind(b);
    if (!p) continue;
    if (p.action.startsWith("resize_split")) {
      run.push(p);
    } else {
      flush();
      groups.push({ label: null, items: [p] });
    }
  }
  flush();
  return groups;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }
}

function exportPaletteJson(data: GhosttyData): string {
  const entries = Object.entries(data.theme.palette)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0]);
  const obj: Record<string, string> = {};
  for (const [k, v] of entries) obj[String(k)] = v;
  return JSON.stringify(
    {
      background: data.theme.background,
      foreground: data.theme.foreground,
      palette: obj,
    },
    null,
    2,
  );
}

function exportPaletteList(data: GhosttyData): string {
  const lines = Object.entries(data.theme.palette)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k} ${v}`);
  if (data.theme.background) lines.unshift(`background ${data.theme.background}`);
  if (data.theme.foreground) lines.push(`foreground ${data.theme.foreground}`);
  return lines.join("\n");
}

export default function GhosttyPaletteCard() {
  const { data, error } = useJson<GhosttyData>("/api/cards/ghostty");
  const [selected, setSelected] = useState<number>(0);
  const [showFont, setShowFont] = useState<boolean>(true);
  const [copied, setCopied] = useState<string | null>(null);

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

  const handleCopy = (hex: string) => {
    setCopied(hex);
    void copyText(hex);
    window.setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1400);
  };

  const keybindGroups = data ? buildBindGroups(data.keybinds) : [];

  const paletteColor = (idx: number): string => palette.find(([n]) => n === idx)?.[1] ?? fg;

  const sampleSegments: Array<{ text: string; color?: string }> = [
    { text: "~/dev/dotfiles-showcase ", color: paletteColor(4) },
    { text: "❯ ", color: paletteColor(12) },
    { text: "rg --smart-case TODO", color: fg },
    { text: "\n", color: fg },
    { text: "✓ ", color: paletteColor(2) },
    { text: "42 matches", color: fg },
    { text: "\n", color: fg },
    { text: "- tsconfig.json", color: paletteColor(1) },
  ];

  return (
    <CardShell
      title="Omarchy Palette"
      blurb="The terminal pulls its palette at runtime from omarchy's current-theme state file — swap themes without touching the config. Click a swatch to preview it as terminal foreground on the theme background. Terminal behavior (backend, padding, keybinds) lives in the Ghostty Terminal card."
      badges={
        data ? (
          <div className="flex gap-1.5">
            <span className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-white/55">config:</span>
              <SourceBadge source={data.mainSource} />
            </span>
            <span className="flex items-center gap-1">
              <span className="font-mono text-[10px] text-white/55">theme:</span>
              <SourceBadge source={data.themeSource} />
            </span>
          </div>
        ) : undefined
      }
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {!data && !error && (
        <p className="font-mono text-xs text-white/55">loading ghostty config…</p>
      )}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-ash-dim">
            <span>
              font: <span className="text-ash">{data.fontFamily ?? "?"}</span>{" "}
              {data.fontSize && <span>@ {data.fontSize}px</span>}
            </span>
            {data.themeRef && <span>theme ← {data.themeRef}</span>}
            <button
              type="button"
              onClick={() => setShowFont((v) => !v)}
              aria-pressed={showFont}
              className={`py-1 ${showFont ? "text-phosphor" : "hover:text-ash"}`}
            >
              font preview
            </button>
            {data.mainSource !== data.themeSource && (
              <Pill>
                main:{data.mainSource} · theme:{data.themeSource}
              </Pill>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {(["background", "foreground"] as const).map((k) =>
              data.theme[k] ? (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleCopy(data.theme[k] ?? "")}
                  title="copy hex"
                  className="flex items-center gap-1.5 py-1 text-ash-dim hover:text-ash"
                >
                  <span
                    className="inline-block h-3 w-3 border border-black/40"
                    style={{ background: data.theme[k] ?? "" }}
                  />
                  {k}: {data.theme[k]}
                </button>
              ) : null,
            )}
            {copied && <span className="text-phosphor">copied {copied}</span>}
          </div>

          {palette.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-ash-dim">export:</span>
              <button
                type="button"
                onClick={() => handleCopy(exportPaletteJson(data))}
                title="copy palette as JSON"
                className="py-1 text-ash-dim underline-offset-4 hover:text-ash hover:underline"
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => handleCopy(exportPaletteList(data))}
                title="copy palette as ghostty-style list"
                className="py-1 text-ash-dim underline-offset-4 hover:text-ash hover:underline"
              >
                hex list
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="font-mono text-xs text-white/50">
              ANSI palette sample — every color through the real palette
            </div>
            <pre
              className="overflow-x-auto border border-line p-3 font-mono text-sm leading-relaxed"
              style={{ background: bg, color: fg }}
            >
              {sampleSegments.map((seg, i) => (
                <span key={i} style={seg.color ? { color: seg.color } : undefined}>
                  {seg.text}
                </span>
              ))}
            </pre>
          </div>

          {showFont && (
            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/50">
                Font preview — {fontFam} @ {fontSz}px on theme background
              </div>
              <pre
                className="overflow-x-auto border border-line p-3 leading-relaxed"
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
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-white/50">
              ANSI palette — click a swatch to preview as foreground &amp; copy its hex
            {copied && <span className="text-phosphor">copied {copied}</span>}
            </div>
            {palette.length === 0 ? (
              <p className="font-mono text-xs text-white/55">
                No palette entries in this payload (fallback).
              </p>
            ) : (
              <div className="swatch-grid grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                {palette.map(([n, hex]) => {
                  const isSelected = n === selected;
                  const isBright = n >= 8;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setSelected(n);
                        handleCopy(hex);
                      }}
                      aria-pressed={isSelected}
                      title={`${ansiLabel(n)} · ${hex}`}
                      className={`border p-1.5 text-left ${
                        isSelected
                          ? "border-phosphor/50 bg-phosphor/10"
                          : "border-ash/15 hover:border-ash/35"
                      }`}
                    >
                      <div
                        className="h-8 w-full border border-black/40"
                        style={{ background: hex }}
                      />
                      <div className="mt-1 flex items-baseline justify-between font-mono text-[9px]">
                        <span className={isSelected ? "text-phosphor" : "text-ash-dim"}>{n}</span>
                        <span className="text-white/55">{isBright ? "bright" : "reg"}</span>
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
                Selected: <span className="text-phosphor">{ansiLabel(selected)}</span> ·{" "}
                <span className="text-white/80">{selectedHex}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-white/50">
                    {selectedKind} (SGR {selected})
                  </div>
                  <pre
                    className="overflow-x-auto border border-line p-3 font-mono text-sm leading-relaxed"
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
                    className="overflow-x-auto border border-line p-3 font-mono text-sm leading-relaxed"
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

          {keybindGroups.length > 0 && (
            <div className="space-y-2">
              <div className="font-mono text-xs text-white/50">keybinds</div>
              {keybindGroups.map((grp, gi) => (
                <div key={gi} className="space-y-1">
                  {grp.label && (
                    <div className="font-mono text-[10px] uppercase tracking-wider text-phosphor/80">
                      {grp.label}
                    </div>
                  )}
                  <ul className="space-y-1">
                    {grp.items.map((b) => (
                        <li
                          key={`${b.key}=${b.action}`}
                          className="flex flex-wrap items-center gap-2 py-1.5"
                        >
                          <kbd className="border border-ash/20 px-1.5 py-0.5 font-mono text-[11px] text-ash">
                          {b.key}
                        </kbd>
                        <span className="font-mono text-xs text-white/50">{b.action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}
