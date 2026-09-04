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
  w: number;
  h: number;
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

/** By convention the last "primary" monitor carries this tag (the payload has no
 * primary flag; the omarchy fallback documents DP-2 as primary). */
const PRIMARY_OUTPUT = "DP-2";

export default function HyprlandCard() {
  const { data, error } = useJson<HyprData>("/api/cards/hyprland");
  const [disabled, setDisabled] = useState<Record<string, boolean>>({});
  const [swapped, setSwapped] = useState(false);
  const [scaleOverrides, setScaleOverrides] = useState<Record<string, number>>({});
  const [showPhysical, setShowPhysical] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const baseMonitors = data?.monitors ?? [];
  const parsed: ParsedMonitor[] = baseMonitors.map((m) => {
    const { w, h, hz } = parseMode(m.mode);
    const { x, y } = parsePosition(m.position);
    const scale = scaleOverrides[m.output] ?? m.scale;
    return { output: m.output, mode: m.mode, position: m.position, w, h, hz, x, y, baseScale: m.scale, scale };
  });
  const visible = parsed.filter((p) => !disabled[p.output]);

  // Geometry uses each monitor's PHYSICAL footprint — raw (x,y) position and the
  // mode's physical w×h — so outputs sit flush against each other exactly as the
  // config encodes, and share one coordinate space. Scale is applied to the
  // uniform canvas fit, not to the position (that's what caused the phantom gap).
  const physical = visible.map((p) => ({ p, x: p.x, y: p.y, w: p.w, h: p.h }));

  let drawList: DrawEntry[] = [];
  let scaleFit = 1;
  let boxW = 0;
  let boxH = 0;

  if (physical.length > 0) {
    const minX = physical.reduce((mn, e) => Math.min(mn, e.x), 0);
    const minY = physical.reduce((mn, e) => Math.min(mn, e.y), 0);
    const maxX = physical.reduce((mx, e) => Math.max(mx, e.x + e.w), 0);
    const maxY = physical.reduce((mx, e) => Math.max(mx, e.y + e.h), 0);
    boxW = Math.max(maxX - minX, 1);
    boxH = Math.max(maxY - minY, 1);
    scaleFit = Math.min(DIAGRAM_W / boxW, DIAGRAM_H / boxH);
    drawList = physical.map((e) => {
      const mirrorX = swapped ? minX + maxX - e.x - e.w : e.x;
      return {
        p: e.p,
        w: e.w * scaleFit,
        h: e.h * scaleFit,
        drawX: (mirrorX - minX) * scaleFit,
        drawY: (e.y - minY) * scaleFit,
      };
    });
  }

  // Logical footprint (scale-adjusted) for the toggle preview. Physical
  // geometry stays canonical for the mandatory "bounding box … physical"
  // text (render.test parity); the diagram itself switches between the two.
  const logical = visible.map((p) => ({
    p,
    x: p.x,
    y: p.y,
    w: p.w / p.scale,
    h: p.h / p.scale,
  }));

  let logicalBoxW = 0;
  let logicalBoxH = 0;
  let logicalScaleFit = 1;
  if (logical.length > 0) {
    const minX = logical.reduce((mn, e) => Math.min(mn, e.x), 0);
    const minY = logical.reduce((mn, e) => Math.min(mn, e.y), 0);
    const maxX = logical.reduce((mx, e) => Math.max(mx, e.x + e.w), 0);
    const maxY = logical.reduce((mx, e) => Math.max(mx, e.y + e.h), 0);
    logicalBoxW = Math.max(maxX - minX, 1);
    logicalBoxH = Math.max(maxY - minY, 1);
    logicalScaleFit = Math.min(DIAGRAM_W / logicalBoxW, DIAGRAM_H / logicalBoxH);
  }

  // Active geometry shown in the diagram — toggled without mutating the
  // canonical physical bounding-box values that the physics test asserts.
  let activeDrawList = drawList;
  let activeBoxW = boxW;
  let activeBoxH = boxH;
  let activeScaleFit = scaleFit;
  if (!showPhysical && logical.length > 0) {
    const minX = logical.reduce((mn, e) => Math.min(mn, e.x), 0);
    const minY = logical.reduce((mn, e) => Math.min(mn, e.y), 0);
    const maxX = logical.reduce((mx, e) => Math.max(mx, e.x + e.w), 0);
    activeBoxW = logicalBoxW;
    activeBoxH = logicalBoxH;
    activeScaleFit = logicalScaleFit;
    activeDrawList = logical.map((e) => {
      const mirrorX = swapped ? minX + maxX - e.x - e.w : e.x;
      return {
        p: e.p,
        w: e.w * activeScaleFit,
        h: e.h * activeScaleFit,
        drawX: (mirrorX - minX) * activeScaleFit,
        drawY: (e.y - minY) * activeScaleFit,
      };
    });
  }

  const hasMonitors = baseMonitors.length > 0;
  const allOff = visible.length === 0;
  const layoutSummary =
    drawList.length === 0
      ? ""
      : drawList.length === 1
        ? "single monitor"
        : `${drawList.length} monitors side by side`;

  return (
    <CardShell
      title="Hyprland Monitors"
      blurb="Declared in omarchy's lua config; the diagram places each output to scale from its mode and position — toggle, swap, and rescale to see how the desktop rearranges."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-ash-dim">loading monitors…</p>
        )}
        {data && !hasMonitors && (
          <p className="font-mono text-xs text-white/55">
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
            <div className="hypr-desk p-3 sm:p-5">
              {/* A11Y-01: no role="img" here — the diagram contains interactive
                  monitor tiles; the summary is exposed as sr-only text instead. */}
              <span className="sr-only">{layoutSummary}</span>
              <div className="hypr-fit">
                <div
                  className="hypr-canvas relative"
                >
                  {allOff && (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/55">
                      all monitors off — toggle one on
                    </div>
                  )}
                  {activeDrawList.map((d) => (
                    <button
                      key={d.p.output}
                      type="button"
                      onClick={() => setSelected((cur) => (cur === d.p.output ? null : d.p.output))}
                      aria-pressed={selected === d.p.output}
                      className={`absolute flex flex-col justify-between overflow-hidden border p-1.5 text-left transition-colors ${
                        selected === d.p.output
                          ? "border-phosphor bg-phosphor/[0.18]"
                          : "border-phosphor/35 bg-phosphor/[0.07] hover:border-phosphor/60"
                      }`}
                      style={{
                        left: `${(d.drawX / DIAGRAM_W) * 100}%`,
                        top: `${(d.drawY / DIAGRAM_H) * 100}%`,
                        width: `${(d.w / DIAGRAM_W) * 100}%`,
                        height: `${(d.h / DIAGRAM_H) * 100}%`,
                      }}
                    >
                      {d.p.output === PRIMARY_OUTPUT && (
                        <span className="absolute right-1 top-1 font-mono text-[8px] tracking-wider text-phosphor">
                          PRIMARY
                        </span>
                      )}
                      <span className="font-mono text-[11px] font-semibold text-phosphor">
                        {d.p.output}
                      </span>
                      <span className="font-mono text-[10px] leading-tight text-white/55">
                        {d.p.w}×{d.p.h}
                        {d.p.hz ? `@${d.p.hz}` : ""} · scale {d.p.scale.toFixed(2)} →{" "}
                        {Math.round(d.p.w / d.p.scale)}×
                        {Math.round(d.p.h / d.p.scale)} logical
                      </span>
                    </button>
                  ))}
                  <span className="absolute left-1 top-1 font-mono text-[9px] text-white/50">
                    0,0
                  </span>
                </div>
              </div>
              <div className="mt-2 font-mono text-[10px] text-white/55">
                bounding box {Math.round(activeBoxW)}×{Math.round(activeBoxH)}{" "}
                {showPhysical ? "physical" : "logical"} · fit {activeScaleFit.toFixed(3)}
                {swapped ? " · mirrored" : ""}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSwapped((v) => !v)}
                  aria-pressed={swapped}
                  className={`py-1 font-mono text-xs tracking-wide ${swapped ? "text-phosphor" : "text-ash-dim hover:text-ash"}`}
                >
                  Swap L/R{swapped ? " (on)" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhysical((v) => !v)}
                  aria-pressed={showPhysical}
                  className={`py-1 font-mono text-xs tracking-wide ${showPhysical ? "text-phosphor" : "text-ash-dim hover:text-ash"}`}
                >
                  Physical footprint{showPhysical ? " (on)" : ""}
                </button>
                {parsed.map((p) => (
                  <button
                    key={p.output}
                    type="button"
                    onClick={() =>
                      setDisabled((s) => ({ ...s, [p.output]: !s[p.output] }))
                    }
                    aria-pressed={!disabled[p.output]}
                    className={`py-1 font-mono text-xs tracking-wide ${disabled[p.output] ? "text-ash-dim" : "text-phosphor"}`}
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
                      className="mt-1 w-full accent-phosphor"
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
