import { useState } from "react";
import { postJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface RenderResult {
  ansi: string;
  html: string;
}

type ShellMode = "zsh" | "bash";

export default function RecolorCard() {
  const [shell, setShell] = useState<ShellMode>("zsh");
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setResult(
        await postJson<RenderResult>("/api/starship", {
          branch: "main",
          status: 1,
          shell,
        }),
      );
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  return (
    <CardShell
      title="Failure Recolor"
      blurb="On a non-zero exit, the shell rewrites the prompt's colors before drawing. The two shells disagree — run it to see."
      badges={<SourceBadge source="live" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/15">
            {(["zsh", "bash"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setShell(s)}
                className={`px-3 py-1.5 font-mono text-xs transition-colors ${
                  shell === s ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/5"
                }`}
              >
                {s === "zsh" ? "zsh (cyan only)" : "bash (all → red)"}
              </button>
            ))}
          </div>
          <button
            onClick={run}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 transition-colors hover:bg-emerald-500/20"
          >
            render status=1
          </button>
        </div>

        <p className="text-xs leading-relaxed text-white/50">
          <span className="font-mono text-white/70">dot_zshrc</span> replaces{" "}
          <span className="font-mono">36m → 31m</span> across exactly 8 style-prefix
          variants — cyan turns red, everything else is untouched.{" "}
          <span className="font-mono text-white/70">dot_bashrc</span> instead maps every
          foreground color (30|32|33|34|35|36|37|90|92|93|94|95|96|97) to red.
        </p>

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        {result && (
          <Term html={result.html} />
        )}
        {result && (
          <p className="text-xs text-white/40">
            Rendered by the real starship binary in 8-color mode so the recolor code
            demonstrably applies.
          </p>
        )}
      </div>
    </CardShell>
  );
}
