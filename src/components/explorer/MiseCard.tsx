import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge } from "./ui";

interface MiseData {
  source: "live" | "fallback";
  tools: Array<[string, string]>;
}

export default function MiseCard() {
  const { data, error } = useJson<MiseData>("/api/cards/mise");

  return (
    <CardShell
      title="mise Toolchains"
      blurb="One declarative config manages every runtime, pinned or latest — activated on cd via mise's shell hook."
      badges={data ? <SourceBadge source={data.source} /> : undefined}
    >
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {data && (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                <th className="px-3 py-2 font-medium">tool</th>
                <th className="px-3 py-2 font-medium">version</th>
              </tr>
            </thead>
            <tbody>
              {data.tools.map(([name, version]) => (
                <tr key={name} className="border-b border-white/5 last:border-0">
                  <td className="px-3 py-1.5 text-cyan-300">{name}</td>
                  <td className="px-3 py-1.5 text-white/70">{version}</td>
                </tr>
              ))}
              {data.tools.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-white/40" colSpan={2}>
                    no tools configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}
