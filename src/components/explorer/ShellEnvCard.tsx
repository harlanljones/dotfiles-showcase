import { useState } from "react";
import { useJson } from "../../lib/useApi";
import {
  buildParity,
  type ParityStatus,
  type ShellEnvPayload,
  type ShellProfile,
} from "../../lib/shellEnv";
import { CardShell, SourceBadge, ToggleGroup } from "./ui";

type ShellTab = "zsh" | "bash";

const STATUS_STYLE: Record<ParityStatus, string> = {
  shared: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  diverged: "border-amber-400/30 bg-amber-400/15 text-amber-300",
  unique: "border-white/10 bg-white/5 text-white/55",
};

function ProfilePath({ profile }: { profile: ShellProfile }) {
  if (profile.path.length === 0) {
    return <p className="font-mono text-xs text-white/55">no PATH exports recorded</p>;
  }
  return (
    <ol className="space-y-1">
      {profile.path.map((entry, i) => (
        <li
          key={`${entry}-${i}`}
          className="flex items-baseline gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5"
        >
          <span className="w-6 shrink-0 font-mono text-[11px] text-white/40">{i + 1}</span>
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-cyan-300">{entry}</code>
          {i === 0 && (
            <span className="shrink-0 font-mono text-[10px] tracking-wider text-emerald-300">
              WINS
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function ShellEnvCard() {
  const { data, error } = useJson<ShellEnvPayload>("/api/cards/shell-env");
  const [shell, setShell] = useState<ShellTab>("zsh");
  const [query, setQuery] = useState("");
  const [showStartup, setShowStartup] = useState(false);

  const profile = data ? data[shell] : null;
  const q = query.trim().toLowerCase();
  const exports = q && profile
    ? profile.exports.filter(
        (e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q),
      )
    : (profile?.exports ?? []);
  const parity = data ? buildParity(data.zsh, data.bash, data.env) : [];

  return (
    <CardShell
      title="Shell Profiles & Environment"
      blurb="How each login shell boots, which directories win PATH precedence, and which session exports both shells agree on. Live rc files are parsed read-only; anything missing degrades to the sanitized snapshot."
      badges={
        data ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/40">zsh</span>
              <SourceBadge source={data.zshSource} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/40">bash</span>
              <SourceBadge source={data.bashSource} />
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-white/40">env.d</span>
              <SourceBadge source={data.envSource} />
            </span>
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {!data && !error && (
          <p className="font-mono text-xs text-cyan-200">loading shell profiles…</p>
        )}
        {data && (
          <>
            {data.warnings.map((w) => (
              <p
                key={w}
                role="status"
                className="border border-[#b16371]/35 bg-[#b16371]/10 px-3 py-2 font-mono text-xs text-[#d38290]"
              >
                {w}
              </p>
            ))}

            <ToggleGroup
              value={shell}
              options={[
                { value: "zsh", label: "zsh" },
                { value: "bash", label: "bash" },
              ]}
              onChange={(v) => setShell(v as ShellTab)}
            />

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowStartup((s) => !s)}
                aria-expanded={showStartup}
                className="font-mono text-xs text-white/50 hover:text-white/80"
              >
                {showStartup ? "hide" : "show"} {shell} startup sequence
              </button>
              {showStartup && (
                <ol className="space-y-1">
                  {data.startup[shell].map((stage) => (
                    <li
                      key={stage.file}
                      className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-baseline sm:gap-3"
                    >
                      <code className="shrink-0 font-mono text-xs text-cyan-300">
                        {stage.file}
                      </code>
                      <span className="flex-1 text-xs text-white/50">
                        <span className="font-mono text-[10px] tracking-wider text-white/40">
                          {stage.when}
                        </span>{" "}
                        — {stage.note}
                      </span>
                      {stage.managed && (
                        <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-emerald-300">
                          CHEZMOI
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/50">
                PATH precedence — earlier entries win
              </div>
              {profile && <ProfilePath profile={profile} />}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <span className="font-mono text-xs text-white/50">filter exports</span>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="KEY or value…"
                    className="w-44 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-xs text-white outline-none focus:border-cyan-300/50"
                  />
                </label>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/70">
                  {exports.length} export{exports.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                      <th scope="col" className="px-3 py-2 font-medium">key</th>
                      <th scope="col" className="px-3 py-2 font-medium">value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exports.map((e) => (
                      <tr key={`${e.key}-${e.value}`} className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-cyan-300">{e.key}</td>
                        <td className="break-all px-3 py-2 text-white/80">{e.value}</td>
                      </tr>
                    ))}
                    {exports.length === 0 && (
                      <tr>
                        <td className="px-3 py-3 text-white/55" colSpan={2}>
                          {profile && profile.exports.length === 0
                            ? "no exports recorded"
                            : `no exports match "${query}"`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/50">
                environment.d — systemd user-session files
              </div>
              {data.env.length === 0 && (
                <p className="font-mono text-xs text-white/55">no environment.d files recorded</p>
              )}
              {data.env.map((f) => (
                <div key={f.file} className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                  <code className="font-mono text-xs text-cyan-300">{f.file}</code>
                  <ul className="mt-1 space-y-0.5">
                    {f.vars.map((v) => (
                      <li key={v.key} className="font-mono text-xs text-white/70">
                        <span className="text-white/90">{v.key}</span>
                        <span className="text-white/40"> = </span>
                        <span className="break-all">{v.value}</span>
                      </li>
                    ))}
                    {f.vars.length === 0 && (
                      <li className="font-mono text-xs text-white/55">no variables</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="font-mono text-xs text-white/50">
                cross-shell parity — zsh vs bash vs environment.d
              </div>
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04] text-left text-white/50">
                      <th scope="col" className="px-3 py-2 font-medium">key</th>
                      <th scope="col" className="px-3 py-2 font-medium">zsh</th>
                      <th scope="col" className="px-3 py-2 font-medium">bash</th>
                      <th scope="col" className="px-3 py-2 font-medium">env.d</th>
                      <th scope="col" className="px-3 py-2 font-medium">status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parity.map((row) => (
                      <tr key={row.key} className="border-b border-white/5 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-cyan-300">{row.key}</td>
                        <td className="break-all px-3 py-2 text-white/70">{row.zsh ?? "—"}</td>
                        <td className="break-all px-3 py-2 text-white/70">{row.bash ?? "—"}</td>
                        <td className="break-all px-3 py-2 text-white/70">{row.env ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] tracking-wider ${STATUS_STYLE[row.status]}`}
                          >
                            {row.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {parity.length === 0 && (
                      <tr>
                        <td className="px-3 py-3 text-white/55" colSpan={5}>
                          no exports to compare
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs leading-5 text-white/55">
              Startup order is fixed shell knowledge; exports and PATH are parsed
              read-only from <span className="font-mono">~/.zshrc</span>,{" "}
              <span className="font-mono">~/.bashrc</span>, and{" "}
              <span className="font-mono">~/.config/environment.d/*.conf</span>.
              Sensitive-looking values are redacted before display.
            </p>
          </>
        )}
      </div>
    </CardShell>
  );
}
