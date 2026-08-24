import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface HyprData {
  source: "live" | "fallback";
  gdkScale: number | null;
  monitors: Array<{ output: string; mode: string; position: string; scale: number }>;
}

function parseMode(mode: string): { w: number; h: number; hz: string | null } {
  const m = mode.match(/^(\d+)x(\d+)(?:@(\d+))?/);
  return m
    ? { w: Number(m[1]), h: Number(m[2]), hz: m[3] ?? null }
    : { w: 16, h: 9, hz: null };
}

export default function HyprlandCard() {
  const { data, error } = useJson<HyprData>("/api/cards/hyprland");

  return (
    <CardShell
      title="Hyprland Monitors"
      blurb="Declared in omarchy's lua config; boxes below are drawn at relative logical size (physical ÷ scale) — what your desktop actually sees."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="space-y-4">
          {data.gdkScale !== null && (
            <span className="font-mono text-xs text-white/50">GDK_SCALE = {data.gdkScale}</span>
          )}
          <div className="flex items-end gap-3">
            {data.monitors.map((mon) => {
              const { w, h, hz } = parseMode(mon.mode);
              const lw = w / mon.scale;
              const lh = h / mon.scale;
              const boxH = Math.max(60, Math.round((lh / Math.max(...data.monitors.map((m) => parseMode(m.mode).h / m.scale))) * 150));
              const boxW = Math.round((lw / lh) * boxH);
              return (
                <div key={mon.output} className="flex flex-col gap-1.5">
                  <div
                    className="flex flex-col justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-2"
                    style={{ width: boxW, height: boxH }}
                  >
                    <span className="font-mono text-[11px] font-semibold text-emerald-300">{mon.output}</span>
                    <span className="font-mono text-[10px] leading-tight text-white/50">
                      {w}×{h}
                      {hz ? ` @${hz}` : ""}
                      {"\n"}scale {mon.scale} → {Math.round(lw)}×{Math.round(lh)} logical
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-white/35">@ {mon.position}</span>
                </div>
              );
            })}
          </div>
          {data.monitors.length === 0 && (
            <p className="font-mono text-xs text-white/40">no monitors parsed</p>
          )}
        </div>
      )}
    </CardShell>
  );
}
