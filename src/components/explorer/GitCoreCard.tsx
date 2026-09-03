import { useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

export interface GitSigningSummary {
  commitGpgsign: string | null;
  tagGpgsign: string | null;
  gpgFormat: string | null;
  gpgProgram: string | null;
  signingKeySet: boolean;
}

export interface GitCoreData {
  source: "live" | "fallback";
  ignoresSource: "live" | "fallback";
  user: { name: string | null; email: string | null };
  signing: GitSigningSummary;
  aliases: Array<[string, string]>;
  policies: Array<{ section: string; entries: Array<[string, string]> }>;
  credentialHelpers: string[];
  safeDirs: string[];
  ignores: string[];
  rawConfig: string;
}

type SourceToggle = "served" | "fallback";

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/5 pb-1.5 last:border-0">
      <span className="text-white/70">{label}</span>
      <span
        className={`rounded px-2 py-0.5 ${
          active ? "bg-white/10 text-cyan-300" : "bg-white/5 text-white/55"
        }`}
      >
        {value}
      </span>
    </li>
  );
}

export default function GitCoreCard() {
  const { data, error } = useJson<GitCoreData>("/api/cards/git-core");
  const [sourceMode, setSourceMode] = useState<SourceToggle>("served");

  const isSimulatedFallback = sourceMode === "fallback";
  const displayedSource = isSimulatedFallback ? "fallback" : (data?.source ?? "fallback");
  const displayedIgnoresSource = isSimulatedFallback ? "fallback" : (data?.ignoresSource ?? "fallback");

  const signing = data?.signing;
  const signingActive =
    !!signing &&
    (signing.commitGpgsign === "true" ||
      signing.tagGpgsign === "true" ||
      signing.signingKeySet);

  return (
    <CardShell
      title="Git Core & Security"
      blurb="The global git config: who signs what, the aliases and safety policies every repo inherits, and the global ignore list."
      badges={
        data ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5">
              <SourceBadge source={displayedSource} />
              <SourceBadge source={displayedIgnoresSource} />
            </div>
            {isSimulatedFallback && (
              <span className="rounded border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-amber-300">
                FALLBACK PREVIEW
              </span>
            )}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-white/55">loading git config…</p>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <span className="font-mono text-xs text-white/55">
                ~/.config/git/config + global ignores
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-white/55">source:</span>
                <button
                  type="button"
                  onClick={() => setSourceMode("served")}
                  aria-pressed={sourceMode === "served"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "served"
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  served ({data.source})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode("fallback")}
                  aria-pressed={sourceMode === "fallback"}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    sourceMode === "fallback"
                      ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                      : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                  }`}
                >
                  fallback snapshot
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                  Commit signing
                </div>
                <ul className="space-y-1.5 font-mono text-xs">
                  <StatusRow
                    label="commit.gpgsign"
                    value={signing?.commitGpgsign ?? "not set"}
                    active={signing?.commitGpgsign === "true"}
                  />
                  <StatusRow
                    label="tag.gpgsign"
                    value={signing?.tagGpgsign ?? "not set"}
                    active={signing?.tagGpgsign === "true"}
                  />
                  <StatusRow
                    label="gpg.format"
                    value={signing?.gpgFormat ?? "not set"}
                    active={!!signing?.gpgFormat}
                  />
                  <StatusRow
                    label="gpg.program"
                    value={signing?.gpgProgram ?? "not set"}
                    active={!!signing?.gpgProgram}
                  />
                  <StatusRow
                    label="user.signingkey"
                    value={signing?.signingKeySet ? "set (redacted)" : "not set"}
                    active={!!signing?.signingKeySet}
                  />
                </ul>
                <p className="mt-2 text-xs leading-5 text-white/55">
                  {signingActive
                    ? "Signing is wired up — commits are verified."
                    : "No signing configured in the global config — commits are unsigned."}
                </p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                  Identity & trust
                </div>
                <ul className="space-y-1.5 font-mono text-xs">
                  <StatusRow
                    label="user.name"
                    value={data.user.name ?? "not set"}
                    active={!!data.user.name}
                  />
                  <StatusRow
                    label="user.email"
                    value={data.user.email ?? "not set"}
                    active={!!data.user.email}
                  />
                </ul>
                <div className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                  safe.directory ({data.safeDirs.length})
                </div>
                {data.safeDirs.length > 0 ? (
                  <ul className="space-y-1 font-mono text-xs text-white/70">
                    {data.safeDirs.map((dir) => (
                      <li key={dir}>{dir}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-xs text-white/55">
                    no safe.directory entries — dubious-ownership guard at default
                  </p>
                )}
                <div className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
                  credential helpers
                </div>
                {data.credentialHelpers.length > 0 ? (
                  <ul className="space-y-1 font-mono text-xs text-white/70">
                    {data.credentialHelpers.map((helper) => (
                      <li key={helper}>{helper}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-mono text-xs text-white/55">no credential helpers</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 font-mono text-xs text-white/60">
                Aliases ({data.aliases.length})
              </div>
              {data.aliases.length > 0 ? (
                <ul className="space-y-1.5 font-mono text-xs">
                  {data.aliases.map(([name, value]) => (
                    <li
                      key={name}
                      className="flex items-center justify-between gap-3 border-b border-white/5 pb-1 last:border-0"
                    >
                      <span className="text-cyan-300">{name}</span>
                      <span className="text-white/70">{value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-xs text-white/55">no aliases defined</p>
              )}
            </div>

            {data.policies.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                      <th className="px-3 py-2 font-medium">section.key</th>
                      <th className="px-3 py-2 font-medium">value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.policies.flatMap((policy) =>
                      policy.entries.map(([key, value]) => (
                        <tr
                          key={`${policy.section}.${key}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-3 py-2 text-cyan-300">
                            {policy.section}.{key}
                          </td>
                          <td className="px-3 py-2 text-white/70">{value}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 font-mono text-xs text-white/60">
                Global ignores ({data.ignores.length})
              </div>
              {data.ignores.length > 0 ? (
                <ul className="space-y-1 font-mono text-xs text-white/70">
                  {data.ignores.map((pattern) => (
                    <li key={pattern}>{pattern}</li>
                  ))}
                </ul>
              ) : (
                <p className="font-mono text-xs text-white/55">no global ignore patterns</p>
              )}
            </div>

            <div>
              <div className="mb-1 font-mono text-xs text-white/60">
                ~/.config/git/config ({displayedSource})
              </div>
              <Term>{data.rawConfig}</Term>
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}
