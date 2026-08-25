import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface HyprData {
  source: "live" | "fallback";
  gdkScale: number | null;
  monitors: Array<{ output: string; mode: string; position: string; scale: number }>;
}

interface ParsedMonitor {
  output: string;
  mode: string;
  position: string;
  w: number;
  h: number;
  hz: string | null;
  x: number;
  y: number;
  baseScale: number;
  scale: number;
}

interface DrawEntry {
  p: ParsedMonitor;
  lw: number;
  lh: number;
  drawX: number;
  drawY: number;
}

function parseMode(mode: string): { w: number; h: number; hz: string | null } {
  const m = mode.match(/^(\d+)x(\d+)(?:@(\d+))?/);
  return m
    ? { w: Number(m[1]), h: Number(m[2]), hz: m[3] ?? null }
    : { w: 16, h: 9, hz: null };
}

function parsePosition(position: string): { x: number; y: number } {
  const m = position.match(/^(-?\d+)x(-?\d+)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}

const DIAGRAM_W = 640;
const DIAGRAM_H = 220;
const SCALE_MIN = 0.5;
const SCALE_MAX = 3;
const SCALE_STEP = 0.25;

export default function HyprlandCard() {
  const { data, error } = useJson<HyprData>("/api/cards/hyprland");
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});
  const [swapped, setSwapped] = useState(false);
  const [scaleOverrides, setScaleOverrides] = useState<Record<string, number>>({});

  const baseMonitors = data?.monitors ?? [];
  const parsed: ParsedMonitor[] = baseMonitors.map((m) => {
    const { w, h, hz } = parseMode(m.mode);
    const { x, y } = parsePosition(m.position);
    const scale = scaleOverrides[m.output] ?? m.scale;
    return { output: m.output, mode: m.mode, position: m.position, w, h, hz, x, y, baseScale: m.scale, scale };
  });
  const visible = parsed.filter((p) => !disabled[p.output]);
  const logical = visible.map((p) => ({ p, x: p.x, y: p.y, lw: p.w / p.scale, lh: p.h / p.scale }));

  let drawList: DrawEntry[] = [];
  let scaleFit = 1;
  let boxW = 0;
  let boxH = 0;

  if (logical.length > 0) {
    const minX = logical.reduce((mn, e) => Math.min(mn, e.x), 0);
    const minY = logical.reduce((mn, e) => Math.min(mn, e.y), 0);
    const maxX = logical.reduce((mx, e) => Math.max(mx, e.x + e.lw), 0);
    const maxY = logical.reduce((mx, e) => Math.max(mx, e.y + e.lh), 0);
    boxW = Math.max(maxX - minX, 1);
    boxH = Math.max(maxY - minY, 1);
    scaleFit = Math.min(DIAGRAM_W / boxW, DIAGRAM_H / boxH);
    drawList = logical.map((e) => {
      const mirrorX = swapped ? minX + maxX - e.x - e.lw : e.x;
      return {
        p: e.p,
        lw: e.lw * scaleFit,
        lh: e.lh * scaleFit,
        drawX: (mirrorX - minX) * scaleFit,
        drawY: (e.y - minY) * scaleFit,
      };
    });
  }

  const hasMonitors = baseMonitors.length > 0;
  const allOff = visible.length === 0;

  return (
    <CardShell
      title="Hyprland Monitors"
      blurb="Declared in omarchy's lua config; the diagram places each output to scale from its mode and position — toggle, swap, and rescale to see how the desktop rearranges."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/40">loading monitors…</p>
        )}
        {data && !hasMonitors && (
          <p className="font-mono text-xs text-white/40">
            no monitors reported (fallback) — nothing to draw.
          </p>
        )}
        {data && hasMonitors && (
          <>
            {data.gdkScale !== null && (
              <div className="font-mono text-xs text-white/50">
                GDK_SCALE = {data.gdkScale}
              </div>
            )}
            <div className="rounded-lg border border-white/10 bg-black/40 p-3">
              <div className="overflow-x-auto">
                <div className="relative" style={{ width: DIAGRAM_W, height: DIAGRAM_H }}>
                  {allOff && (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/40">
                      all monitors off — toggle one on
                    </div>
                  )}
                  {drawList.map((d) => (
                    <div
                      key={d.p.output}
                      className="absolute flex flex-col justify-between overflow-hidden rounded border border-emerald-500/40 bg-emerald-500/[0.08] p-1.5"
                      style={{ left: d.drawX, top: d.drawY, width: d.lw, height: d.lh }}
                    >
                      <span className="font-mono text-[11px] font-semibold text-emerald-300">
                        {d.p.output}
                      </span>
                      <span className="font-mono text-[10px] leading-tight text-white/55">
                        {d.p.w}×{d.p.h}
                        {d.p.hz ? `@${d.p.hz}` : ""} · scale {d.p.scale.toFixed(2)} →{" "}
                        {Math.round(d.p.w / d.p.scale)}×
                        {Math.round(d.p.h / d.p.scale)} logical
                      </span>
                    </div>
                  ))}
                  <span className="absolute left-1 top-1 font-mono text-[9px] text-white/25">
                    0,0
                  </span>
                </div>
              </div>
              <div className="mt-2 font-mono text-[10px] text-white/40">
                bounding box {Math.round(boxW)}×{Math.round(boxH)} logical · fit{" "}
                {scaleFit.toFixed(3)}
                {swapped ? " · mirrored" : ""}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSwapped((v) => !v)}
                  aria-pressed={swapped}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${swapped ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}
                >
                  Swap L/R{swapped ? " (on)" : ""}
                </button>
                {parsed.map((p) => (
                  <button
                    key={p.output}
                    type="button"
                    onClick={() =>
                      setDisabled((s) => ({ ...s, [p.output]: !s[p.output] }))
                    }
                    aria-pressed={!disabled[p.output]}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${disabled[p.output] ? "border-white/10 bg-white/5 text-white/40 hover:bg-white/10" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"}`}
                  >
                    {p.output} {disabled[p.output] ? "off" : "on"}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {parsed.map((p) => (
                  <label key={p.output} className="block">
                    <span className="font-mono text-[11px] text-white/60">
                      {p.output} scale — {p.scale.toFixed(2)}
                      {p.scale !== p.baseScale ? ` (base ${p.baseScale})` : ""}
                    </span>
                    <input
                      type="range"
                      min={SCALE_MIN}
                      max={SCALE_MAX}
                      step={SCALE_STEP}
                      value={p.scale}
                      onChange={(e) =>
                        setScaleOverrides((s) => ({
                          ...s,
                          [p.output]: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full accent-emerald-400"
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
