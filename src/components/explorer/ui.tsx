import type { ReactNode } from "react";
import { getManifestEntry, type CardId } from "../../manifest";

export type SourceKind = "live" | "fallback" | "simulated" | "static" | "interactive";

const SOURCE_STYLES: Record<SourceKind, string> = {
  live: "text-phosphor",
  fallback: "text-fail",
  simulated: "text-ash",
  static: "text-ash-dim",
  interactive: "text-phosphor",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  live: "LIVE",
  fallback: "FALLBACK",
  simulated: "SIMULATED",
  static: "STATIC",
  interactive: "INTERACTIVE",
};

export function SourceBadge({ source }: { source: SourceKind }) {
  return (
    <span className={`font-mono text-[10px] tracking-[0.18em] ${SOURCE_STYLES[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-0 py-1 font-mono text-xs tracking-wide ${value === o.value ? "text-phosphor" : "text-ash-dim hover:text-ash"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NOTICE_TONES: Record<"warning" | "info" | "error", string> = {
  warning: "border-fail/35 bg-fail/10 text-[#d38290]",
  info: "border-phosphor/30 bg-phosphor/10 text-phosphor",
  error: "border-fail/40 bg-fail/12 text-[#d38290]",
};

export function Notice({
  tone,
  children,
}: {
  tone: "warning" | "info" | "error";
  children?: ReactNode;
}) {
  return (
    <p role="status" className={`border px-3 py-2 font-mono text-xs ${NOTICE_TONES[tone]}`}>
      {children}
    </p>
  );
}

/**
 * Manifest provenance, rendered inline and permanently (HJ-720): the source
 * path(s) a card reads, plus the count of sources when there is more than
 * one to distinguish. The live/fallback/simulated variant itself is carried
 * by the card's own `badges` (SourceBadge), since only the card knows which
 * variant is actually being served.
 */
function ManifestProvenance({ id }: { id: CardId }) {
  const entry = getManifestEntry(id);
  const sources = entry?.sources;
  if (!sources || sources.length === 0) return null;

  return (
    <p className="orientation-provenance">
      {sources.map((source, index) => (
        <span key={source.livePath}>
          {index > 0 && " · "}
          <code>{source.livePath}</code> (fallback: <code>{source.fallbackFile}</code>)
        </span>
      ))}
      {sources.length > 1 && ` · ${sources.length} sources`}
    </p>
  );
}

export function CardShell({
  id,
  title,
  blurb,
  badges,
  notes,
  children,
}: {
  id: CardId;
  title: string;
  blurb?: string;
  badges?: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="content-panel">
      <div className="orientation">
        <p className="orientation-line">
          <span className="orientation-title">{title}</span>
          {blurb && <span className="orientation-blurb"> — {blurb}</span>}
        </p>
        {badges && <div className="orientation-badges">{badges}</div>}
        <ManifestProvenance id={id} />
        {notes}
      </div>
      {children}
    </section>
  );
}

export function Term({ children, html }: { children?: ReactNode; html?: string }) {
  if (html !== undefined) {
    return (
      <pre
        className="code-surface overflow-x-auto p-3 font-mono-nerd text-sm leading-relaxed [&_i]:italic"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre className="code-surface overflow-x-auto p-3 font-mono text-xs leading-relaxed text-ash">
      {children}
    </pre>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-wide text-ash-dim">{children}</span>
  );
}
