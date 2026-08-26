import { useState } from "react";
import StarshipPlayground, { type ApiStatus } from "../StarshipPlayground";
import { CardShell, SourceBadge, type SourceKind } from "./ui";

/** Provenance badge matches the served variant: degraded ⇒ fallback, else live. */
function sourceKind(status: ApiStatus): SourceKind {
  return status === "degraded" ? "fallback" : "live";
}

export default function StarshipCard() {
  const [status, setStatus] = useState<ApiStatus>("idle");

  return (
    <CardShell
      title="Starship Prompt"
      blurb="The prompt is configured in starship.toml and rendered by the real starship binary. Drive the shell state below to watch it respond — including the exact 36m → 31m recolor on failure."
      badges={
        <div className="flex gap-1.5">
          <SourceBadge source={sourceKind(status)} />
          <span className="rounded border border-cyan-300/20 bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-cyan-200">8-COLOR</span>
        </div>
      }
    >
      <StarshipPlayground onRenderOutcome={setStatus} />
    </CardShell>
  );
}
