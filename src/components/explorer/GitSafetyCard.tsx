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
      blurb="Every coding agent on this machine can stage and diff, but never commit or push without a human."
    >
      <div className="space-y-8">
        <p className="max-w-xl text-sm leading-7 text-[#5f656e]">
          Four agents. Commit and push blocked. History stays human.
        </p>
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {AGENTS.map((agent) => (
            <div key={agent.name}>
              <div className="mb-3 font-mono text-sm tracking-wide text-[#6fa3a0]">{agent.name}</div>
              <ul className="space-y-1.5">
                {agent.rules.map((rule) => (
                  <li key={rule} className="font-mono text-[12px] leading-5 text-[#959aa4]">
                    <span className={rule.startsWith("deny") ? "text-[#b16371]" : "text-[#5f656e]"}>
                      {rule.startsWith("deny") ? "×" : "·"}
                    </span>{" "}
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
