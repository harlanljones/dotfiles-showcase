import { useState } from "react";
import StarshipPlayground, { type ApiStatus } from "../StarshipPlayground";
import { CardShell, SourceBadge, type SourceKind } from "./ui";

/** Provenance badge matches the served variant: degraded ⇒ fallback, else live. */
function sourceKind(status: ApiStatus): SourceKind {
  return status === "degraded" ? "fallback" : "live";
}

export default function StarshipCard() {
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [notes, setNotes] = useState<string[]>([]);

  return (
    <CardShell
      title="Starship Prompt"
      blurb="Rendered by the real starship binary against an isolated git repo. Failure recolors cyan to red in zsh, every foreground color in bash."
      badges={<SourceBadge source={sourceKind(status)} />}
      notes={
        notes.length > 0
          ? notes.map((n) => (
              <p key={n}>{n}</p>
            ))
          : undefined
      }
    >
      <StarshipPlayground onRenderOutcome={setStatus} onNotes={setNotes} />
    </CardShell>
  );
}
