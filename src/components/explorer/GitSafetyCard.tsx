import { CardShell } from "./ui";

const AGENTS = [
  {
    name: "Cline",
    rules: ["deny: git commit", "deny: git push", "auto-approve off by default"],
  },
  {
    name: "Codex",
    rules: ["sandboxed exec", "network + git write blocked", "approval per command"],
  },
  {
    name: "Claude Code",
    rules: ["permission deny list", "deny: git commit*", "deny: git push*"],
  },
  {
    name: "OpenCode",
    rules: ["permission rules in opencode.json", "bash deny patterns", "git write refused"],
  },
];

export default function GitSafetyCard() {
  return (
    <CardShell
      title="Git Safety Guardrails"
      blurb="Every coding agent on this machine is configured so it can stage and diff, but never commit or push without a human."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AGENTS.map((agent) => (
            <div key={agent.name} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-2 font-mono text-sm text-cyan-300">{agent.name}</div>
              <ul className="space-y-1">
                {agent.rules.map((rule) => (
                  <li key={rule} className="font-mono text-[11px] text-white/60">
                    <span className={rule.startsWith("deny") ? "text-red-400" : "text-white/40"}>
                      {rule.startsWith("deny") ? "✗" : "•"}
                    </span>{" "}
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3">
          <span className="font-mono text-xs text-white/50">4 agents</span>
          <span className="text-white/30">→</span>
          <span className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-300">
            commit / push blocked
          </span>
          <span className="text-white/30">→</span>
          <span className="font-mono text-xs text-emerald-300">history stays human</span>
        </div>

        <p className="text-xs leading-relaxed text-white/40">
          The trade-off is deliberate: agents prepare work, humans own history. When a
          commit is wanted, the agent reports the exact commands to run instead of running
          them. (This very app was built under the same rule.)
        </p>
      </div>
    </CardShell>
  );
}
