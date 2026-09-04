import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Pill } from "./ui";

interface BtopData {
  source: "live" | "fallback";
  settings: Record<string, string>;
  order: string[];
}

/** Strip one layer of surrounding quotes for display (`"braille"` → `braille`). */
function unquote(value: string): string {
  const m = value.match(/^"(.*)"$/s);
  return m ? m[1] : value;
}

function isTrue(value: string | undefined): boolean {
  return value === "true" || value === "True";
}

const MS_MIN = 500;
const MS_MAX = 5000;
const MS_STEP = 100;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 py-1">
      <span className="font-mono text-[11px] text-white/50">{label}</span>
      <span className="font-mono text-xs text-white/85">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="font-mono text-xs text-white/60">{children}</div>
  );
}

/** `cpu:1:default,proc:0:default` → [{box, pos, graph}]. */
function parsePreset(preset: string): Array<{ box: string; pos: string; graph: string }> {
  return preset
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [box = entry, pos = "", graph = ""] = entry.split(":");
      return { box, pos, graph };
    });
}

export default function BtopCard() {
  const { data, error } = useJson<BtopData>("/api/cards/btop");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [presetIdx, setPresetIdx] = useState(0);
  const [msOverride, setMsOverride] = useState<number | null>(null);

  const settings = data?.settings ?? {};
  const boxes = (settings.shown_boxes ? unquote(settings.shown_boxes).split(/\s+/).filter(Boolean) : []);
  const visibleBoxes = boxes.filter((b) => !hidden[b]);
  const presets = (settings.presets ? unquote(settings.presets).split(/\s+/).filter(Boolean) : []);
  const activePreset = presets.length > 0 ? presets[presetIdx % presets.length] : null;
  const liveMs = Number(settings.update_ms ?? 2000);
  const activeMs = msOverride ?? (Number.isFinite(liveMs) ? liveMs : 2000);

  const graphVariants = (["cpu", "gpu", "mem", "net", "proc"] as const)
    .map((k) => ({ box: k, graph: settings[`graph_symbol_${k}`] ? unquote(settings[`graph_symbol_${k}`]) : null }))
    .filter((g) => g.graph !== null);

  return (
    <CardShell
      title="System Monitor"
      blurb="btop's layout boxes, theme, and monitoring knobs from ~/.config/btop/btop.conf — toggle boxes and presets to preview arrangements. Read-only: nothing here changes your config."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/55">loading btop config…</p>
        )}
        {data && (
          <>
            <div className="space-y-2">
              <SectionTitle>layout — boxes &amp; presets</SectionTitle>
              {boxes.length === 0 ? (
                <p className="font-mono text-xs text-white/55">
                  no boxes declared in this payload (fallback).
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {boxes.map((box) => (
                      <button
                        key={box}
                        type="button"
                        onClick={() => setHidden((h) => ({ ...h, [box]: !h[box] }))}
                        aria-pressed={!hidden[box]}
                        className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition-colors ${hidden[box] ? "border-white/10 bg-white/5 text-white/55" : "border-phosphor/40 bg-phosphor/15 text-phosphor"}`}
                      >
                        {box} {hidden[box] ? "off" : "on"}
                      </button>
                    ))}
                    {visibleBoxes.length !== boxes.length && (
                      <Pill>preview (client-side)</Pill>
                    )}
                  </div>
                  <div
                    className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-black/40 p-2"
                    aria-label={`visible boxes: ${visibleBoxes.join(", ") || "none"}`}
                  >
                    {boxes.map((box) => (
                      <div
                        key={box}
                        className={`flex-1 rounded border px-2 py-3 text-center font-mono text-xs ${hidden[box] ? "border-white/5 text-white/55 opacity-40" : "border-phosphor/35 bg-phosphor/[0.07] text-phosphor"}`}
                      >
                        {box}
                        {hidden[box] && <span className="block text-[10px]">off</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {presets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-white/50">
                      presets ({presets.length}):
                    </span>
                    {presets.map((p, i) => (
                      <button
                        key={`${p}-${i}`}
                        type="button"
                        onClick={() => setPresetIdx(i)}
                        aria-pressed={i === presetIdx % presets.length}
                        className={`rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${i === presetIdx % presets.length ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {activePreset && (
                    <div className="font-mono text-[11px] leading-relaxed text-white/55">
                      preset {(presetIdx % presets.length) + 1}:{" "}
                      <span className="text-white/75">{activePreset}</span>
                      <span className="text-white/50">
                        {" "}→ {parsePreset(activePreset).map((e) => `${e.box}${e.graph && e.graph !== "default" ? ` (${e.graph})` : ""}`).join(" · ")}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div className="divide-y divide-white/5">
                  <Fact label="shown_gpus" value={settings.shown_gpus ? unquote(settings.shown_gpus) : "unset"} />
                  <Fact label="proc_left" value={settings.proc_left ?? "?"} />
                </div>
                <div className="divide-y divide-white/5">
                  <Fact label="mem_below_net" value={settings.mem_below_net ?? "?"} />
                  <Fact label="cpu_bottom / single" value={`${settings.cpu_bottom ?? "?"} / ${settings.cpu_single_graph ?? "?"}`} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <SectionTitle>theme</SectionTitle>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div className="divide-y divide-white/5">
                  <Fact label="color_theme" value={settings.color_theme ? unquote(settings.color_theme) : "?"} />
                  <Fact label="truecolor" value={settings.truecolor ?? "?"} />
                  <Fact label="theme_background" value={settings.theme_background ?? "?"} />
                </div>
                <div className="divide-y divide-white/5">
                  <Fact label="graph_symbol" value={settings.graph_symbol ? unquote(settings.graph_symbol) : "?"} />
                  <Fact label="rounded_corners" value={settings.rounded_corners ?? "?"} />
                  <Fact label="terminal_sync" value={settings.terminal_sync ?? "?"} />
                </div>
              </div>
              {graphVariants.length > 0 && (
                <p className="font-mono text-[11px] text-white/55">
                  per-box symbols:{" "}
                  {graphVariants.map((g) => (
                    <span key={g.box} className="mr-2">
                      <span className="text-white/75">{g.box}</span>={g.graph}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <SectionTitle>monitoring</SectionTitle>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 font-mono text-xs text-white/60">
                  <span>
                    update_ms: <span className="text-white/85">{activeMs}ms</span>
                  </span>
                  {msOverride !== null && <Pill>preview (client-side)</Pill>}
                </div>
                <label className="block max-w-sm">
                  <span className="font-mono text-[11px] text-white/50">
                    refresh interval preview — {activeMs}ms
                  </span>
                  <input
                    type="range"
                    min={MS_MIN}
                    max={MS_MAX}
                    step={MS_STEP}
                    value={activeMs}
                    onChange={(e) => setMsOverride(Number(e.target.value))}
                    className="mt-1 w-full accent-phosphor"
                  />
                </label>
              </div>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div className="divide-y divide-white/5">
                  <Fact label="proc_sorting" value={settings.proc_sorting ? unquote(settings.proc_sorting) : "?"} />
                  <Fact label="proc tree / colors" value={`${settings.proc_tree ?? "?"} / ${settings.proc_colors ?? "?"}`} />
                  <Fact label="temp" value={`${settings.check_temp ?? "?"}${settings.cpu_sensor ? ` via ${unquote(settings.cpu_sensor)}` : ""} (${settings.temp_scale ? unquote(settings.temp_scale) : "?"})`} />
                  <Fact label="cpu freq" value={settings.show_cpu_freq ?? "?"} />
                </div>
                <div className="divide-y divide-white/5">
                  <Fact label="memory" value={`graphs=${settings.mem_graphs ?? "?"} swap=${settings.show_swap ?? "?"} disks=${settings.show_disks ?? "?"}`} />
                  <Fact label="network" value={`auto=${settings.net_auto ?? "?"} sync=${settings.net_sync ?? "?"} ↓${settings.net_download ?? "?"} ↑${settings.net_upload ?? "?"}`} />
                  <Fact label="battery" value={settings.show_battery ?? "?"} />
                  <Fact label="clock / log" value={`${settings.clock_format ? unquote(settings.clock_format) : "?"} / ${settings.log_level ? unquote(settings.log_level) : "?"}`} />
                </div>
              </div>
              <p className="font-mono text-[11px] text-white/50">
                vim_keys={settings.vim_keys ?? "?"} · {isTrue(settings.vim_keys) ? "h,j,k,l,g,G navigate lists" : "arrows navigate lists"} ·{" "}
                {(data.order?.length ?? 0)} effective settings parsed from btop.conf
              </p>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
