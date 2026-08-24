import type { ReactNode } from "react";

export type SourceKind = "live" | "fallback" | "simulated" | "static";

const SOURCE_STYLES: Record<SourceKind, string> = {
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  fallback: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  simulated: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  static: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  live: "LIVE",
  fallback: "FALLBACK",
  simulated: "SIMULATED",
  static: "STATIC",
};

export function SourceBadge({ source }: { source: SourceKind }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${SOURCE_STYLES[source]}`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function CardShell({
  title,
  blurb,
  badges,
  children,
}: {
  title: string;
  blurb?: string;
  badges?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="content-panel max-w-4xl">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {blurb && <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">{blurb}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">{badges}</div>
      </div>
      {children}
    </section>
  );
}

export function Term({ children, html }: { children?: ReactNode; html?: string }) {
  if (html !== undefined) {
    return (
      <pre
        className="code-surface overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono-nerd text-sm leading-relaxed [&_i]:italic"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre className="code-surface overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-xs">
      {children}
    </span>
  );
}
