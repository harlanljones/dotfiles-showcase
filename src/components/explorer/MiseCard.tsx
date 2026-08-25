import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface MiseData {
  source: "live" | "fallback";
  tools: Array<[string, string]>;
}

type PinMode = "latest" | "pinned";
interface PinState {
  mode: PinMode;
  pin: string;
}

const ALT_VERSIONS: Record<string, string[]> = {
  bun: ["1.2.0", "1.1.4", "1.0.27"],
  node: ["22.11.0", "20.18.0", "18.20.4"],
  python: ["3.13.0", "3.12.7", "3.11.10"],
  go: ["1.23.2", "1.22.8"],
  rust: ["1.82.0", "1.81.0"],
  deno: ["2.1.0", "2.0.6"],
  java: ["23.0.1", "21.0.5"],
  ruby: ["3.3.5", "3.2.6"],
};

function alternatesFor(name: string, served: string): string[] {
  const known = ALT_VERSIONS[name];
  if (known) return known;
  if (/^\d+(\.\d+)*$/.test(served)) {
    const base = served.split(".")[0] ?? served;
    return [`${base}.0.0`, `${base}.1.0`, served];
  }
  return ["1.0.0", "2.0.0", "0.1.0"];
}

export default function MiseCard() {
  const { data, error } = useJson<MiseData>("/api/cards/mise");
  const [pins, setPins] = useState<Record<string, PinState>>({});
  const [search, setSearch] = useState("");

  const tools = data?.tools ?? [];
  const query = search.trim().toLowerCase();
  const filtered = query
    ? tools.filter(([name]) => name.toLowerCase().includes(query))
    : tools;

  function stateOf(name: string, served: string): PinState {
    return (
      pins[name] ??
      (served === "latest"
        ? { mode: "latest", pin: "" }
        : { mode: "pinned", pin: served })
    );
  }

  function setMode(name: string, served: string, mode: PinMode) {
    const cur = stateOf(name, served);
    if (mode === "pinned") {
      const pin = cur.pin || (alternatesFor(name, served)[0] ?? served);
      setPins((p) => ({ ...p, [name]: { mode: "pinned", pin } }));
    } else {
      setPins((p) => ({ ...p, [name]: { mode: "latest", pin: cur.pin } }));
    }
  }

  function setPin(name: string, pin: string) {
    setPins((p) => ({ ...p, [name]: { mode: "pinned", pin } }));
  }

  const pinnedCount = tools.filter(
    ([name, served]) => stateOf(name, served).mode === "pinned",
  ).length;

  return (
    <CardShell
      title="mise Toolchains"
      blurb="One declarative config manages every runtime, pinned or latest — activated on cd via mise's shell hook. Flip a tool between latest and a pinned version to see what mise would resolve."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      <div className="space-y-3">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-cyan-200">loading toolchain…</p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/50">filter</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="tool name…"
                  className="w-44 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                />
              </label>
              <div className="flex gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                  {tools.length} tool{tools.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                  {pinnedCount} pinned
                </span>
                {query && (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 font-mono text-[11px] text-cyan-200">
                    {filtered.length} match{filtered.length === 1 ? "" : "es"}
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                    <th className="px-3 py-2 font-medium">tool</th>
                    <th className="px-3 py-2 font-medium">resolved</th>
                    <th className="px-3 py-2 font-medium">state</th>
                    <th className="px-3 py-2 font-medium">pin</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(([name, served]) => {
                    const st = stateOf(name, served);
                    const resolved = st.mode === "pinned" ? st.pin : "latest";
                    const alts = alternatesFor(name, served);
                    const pinned = st.mode === "pinned";
                    return (
                      <tr key={name} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-cyan-300">{name}</td>
                        <td className="px-3 py-2 font-semibold text-white">{resolved}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] tracking-wider ${pinned ? "border-amber-400/30 bg-amber-400/15 text-amber-300" : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"}`}
                          >
                            {pinned ? "PINNED" : "LATEST"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setMode(name, served, pinned ? "latest" : "pinned")}
                              aria-pressed={pinned}
                              className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${pinned ? "border-amber-400/30 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"}`}
                            >
                              {pinned ? "unpin → latest" : "pin"}
                            </button>
                            {pinned && (
                              <>
                                {alts.map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => setPin(name, v)}
                                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${st.pin === v ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}
                                  >
                                    {v}
                                  </button>
                                ))}
                                <input
                                  type="text"
                                  value={st.pin}
                                  onChange={(e) => setPin(name, e.target.value)}
                                  className="w-24 rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-white outline-none focus:border-cyan-300/50"
                                  placeholder="custom"
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-white/40" colSpan={4}>
                        {tools.length === 0
                          ? "no tools configured"
                          : `no tools match "${search}"`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs leading-5 text-white/35">
              Resolved version is what <code>mise activate</code> would set in the
              shell. Pinning is simulated client-side — the real config lives in{" "}
              <span className="font-mono">~/.config/mise/config.toml</span>.
            </p>
          </>
        )}
      </div>
    </CardShell>
  );
}
