import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Pill } from "./ui";

interface GhosttyTerminalData {
  source: "live" | "fallback";
  fontFamily: string | null;
  fontStyle: string | null;
  fontSize: number | null;
  paddingX: number | null;
  paddingY: number | null;
  windowTheme: string | null;
  asyncBackend: string | null;
  cursorStyle: string | null;
  cursorBlink: boolean | null;
  shellIntegration: string[];
  scrollMultiplier: number | null;
  confirmClose: string | null;
  resizeOverlay: string | null;
  keybinds: string[];
  csiExamples: string[];
  themeRef: string | null;
}

interface Bind {
  key: string;
  action: string;
}

function parseBind(bind: string): Bind | null {
  const i = bind.indexOf("=");
  if (i === -1) return null;
  return { key: bind.slice(0, i), action: bind.slice(i + 1) };
}

const PAD_MIN = 0;
const PAD_MAX = 32;

const SAMPLE_LINE = "$ ghostty +list-fonts | head && echo ready";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 py-1">
      <span className="font-mono text-[11px] text-white/50">{label}</span>
      <span className="font-mono text-xs text-white/85">{value}</span>
    </div>
  );
}

export default function GhosttyTerminalCard() {
  const { data, error } = useJson<GhosttyTerminalData>("/api/cards/ghostty-terminal");
  const [filter, setFilter] = useState("");
  const [padX, setPadX] = useState<number | null>(null);
  const [padY, setPadY] = useState<number | null>(null);

  const activePadX = padX ?? data?.paddingX ?? 14;
  const activePadY = padY ?? data?.paddingY ?? 14;
  const padTouched = padX !== null || padY !== null;

  const binds = (data?.keybinds ?? [])
    .map(parseBind)
    .filter((b): b is Bind => b !== null);
  const query = filter.trim().toLowerCase();
  const visible = query
    ? binds.filter(
        (b) =>
          b.key.toLowerCase().includes(query) ||
          b.action.toLowerCase().includes(query),
      )
    : binds;

  const activeCsi = binds.filter((b) => b.action.includes("csi:"));

  return (
    <CardShell
      title="Ghostty Terminal"
      blurb="Terminal behavior from ~/.config/ghostty/config — the Wayland backend fix, the CSI-u key protocol, window padding, font, and keybinds. The palette lives in the Omarchy Palette card."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/55">loading ghostty config…</p>
        )}
        {data && (
          <>
            <div className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="font-mono text-xs text-white/80">
                backend:{" "}
                <span className="text-[#6fa3a0]">
                  async-backend = {data.asyncBackend ?? "unset"}
                </span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-white/55">
                epoll works around general slowness on Hyprland/Wayland
                (ghostty-org/ghostty#3224). Without it the terminal polls the
                Wayland socket the slow way.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/60">
                CSI-u key protocol{" "}
                <span className="text-white/50">
                  — lets TUIs tell modified keys apart from plain ones
                </span>
              </div>
              {activeCsi.length > 0 ? (
                <ul className="space-y-1">
                  {activeCsi.map((b) => (
                    <li
                      key={`${b.key}=${b.action}`}
                      className="flex flex-wrap items-center gap-2 py-1"
                    >
                      <kbd className="border border-[#959aa4]/20 px-1.5 py-0.5 font-mono text-[11px] text-[#959aa4]">
                        {b.key}
                      </kbd>
                      <span className="font-mono text-xs text-[#6fa3a0]">
                        {b.action}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-[11px] text-white/55">
                  no CSI-u binds active — the config documents them as opt-in
                  (commented) examples:
                </p>
              )}
              {data.csiExamples.length > 0 && (
                <ul className="space-y-1">
                  {data.csiExamples.map((ex) => (
                    <li key={ex} className="font-mono text-[11px] text-white/55">
                      <span className="text-[#868b93]"># keybind = </span>
                      <span className="text-white/75">{ex}</span>{" "}
                      <span className="text-[#868b93]">(opt-in)</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.csiExamples.length === 0 && activeCsi.length === 0 && (
                <p className="font-mono text-[11px] text-white/55">
                  documented opt-ins:{" "}
                  <span className="text-white/75">
                    shift+enter=csi:13;2u
                  </span>{" "}
                  (Shift+Enter ≠ Enter) and{" "}
                  <span className="text-white/75">alt+shift+enter=csi:13;4u</span>{" "}
                  (so tmux can match M-S-Enter).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-white/60">
                <span>
                  window-padding:{" "}
                  <span className="text-white/85">
                    x={activePadX}px y={activePadY}px
                  </span>
                </span>
                {padTouched && (
                  <Pill>preview (client-side) — config stays {data.paddingX ?? "?"}×{data.paddingY ?? "?"}</Pill>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="font-mono text-[11px] text-white/60">
                    padding-x — {activePadX}px
                  </span>
                  <input
                    type="range"
                    min={PAD_MIN}
                    max={PAD_MAX}
                    step={1}
                    value={activePadX}
                    onChange={(e) => setPadX(Number(e.target.value))}
                    className="mt-1 w-full accent-[#6fa3a0]"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[11px] text-white/60">
                    padding-y — {activePadY}px
                  </span>
                  <input
                    type="range"
                    min={PAD_MIN}
                    max={PAD_MAX}
                    step={1}
                    value={activePadY}
                    onChange={(e) => setPadY(Number(e.target.value))}
                    className="mt-1 w-full accent-[#6fa3a0]"
                  />
                </label>
              </div>
              <pre
                className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 font-mono text-xs leading-relaxed text-[#959aa4]"
                style={{
                  paddingLeft: `${activePadX}px`,
                  paddingRight: `${activePadX}px`,
                  paddingTop: `${activePadY}px`,
                  paddingBottom: `${activePadY}px`,
                }}
              >
                {SAMPLE_LINE}
              </pre>
            </div>

            <div className="grid gap-x-6 sm:grid-cols-2">
              <div className="divide-y divide-white/5">
                <Fact label="font" value={`${data.fontFamily ?? "?"}${data.fontStyle ? ` ${data.fontStyle}` : ""}${data.fontSize ? ` @ ${data.fontSize}px` : ""}`} />
                <Fact label="window-theme" value={data.windowTheme ?? "unset"} />
                <Fact
                  label="cursor"
                  value={`${data.cursorStyle ?? "?"}${data.cursorBlink === null ? "" : data.cursorBlink ? " (blink)" : " (steady)"}`}
                />
              </div>
              <div className="divide-y divide-white/5">
                <Fact
                  label="shell-integration"
                  value={data.shellIntegration.length > 0 ? data.shellIntegration.join(", ") : "unset"}
                />
                <Fact
                  label="scroll multiplier"
                  value={data.scrollMultiplier !== null ? String(data.scrollMultiplier) : "unset"}
                />
                <Fact
                  label="confirm-close / overlay"
                  value={`${data.confirmClose ?? "?"} / ${data.resizeOverlay ?? "?"}`}
                />
              </div>
            </div>
            {data.themeRef && (
              <p className="font-mono text-[11px] text-white/50">
                palette loads dynamically from{" "}
                <span className="text-white/75">{data.themeRef}</span> — see the
                Omarchy Palette card.
              </p>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-xs text-white/60">
                  keybinds{" "}
                  <span className="text-white/50">
                    ({visible.length}/{binds.length})
                  </span>
                </div>
                <label className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-white/50">filter</span>
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="key or action…"
                    className="w-40 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                  />
                </label>
              </div>
              {visible.length === 0 ? (
                <p className="font-mono text-xs text-white/55">
                  {binds.length === 0 ? "no keybinds in this payload (fallback)." : `no keybinds match "${filter}"`}
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {visible.map((b) => (
                    <li
                      key={`${b.key}=${b.action}`}
                      className="flex flex-wrap items-center gap-2 py-1.5"
                    >
                      <kbd className="border border-[#959aa4]/20 px-1.5 py-0.5 font-mono text-[11px] text-[#959aa4]">
                        {b.key}
                      </kbd>
                      <span className="font-mono text-xs text-white/50">{b.action}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
