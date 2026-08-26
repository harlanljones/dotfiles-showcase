import type { ReactNode } from "react";

export type SourceKind = "live" | "fallback" | "simulated" | "static";

const SOURCE_STYLES: Record<SourceKind, string> = {
  live: "text-[#6fa3a0]",
  fallback: "text-[#b16371]",
  simulated: "text-[#959aa4]",
  static: "text-[#5f656e]",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  live: "LIVE",
  fallback: "FALLBACK",
  simulated: "SIMULATED",
  static: "STATIC",
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
          className={`px-0 py-1 font-mono text-xs tracking-wide ${value === o.value ? "text-[#6fa3a0]" : "text-[#5f656e] hover:text-[#959aa4]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NOTICE_TONES: Record<"warning" | "info" | "error", string> = {
  warning: "border-[#b16371]/35 bg-[#b16371]/10 text-[#d38290]",
  info: "border-[#6fa3a0]/30 bg-[#6fa3a0]/10 text-[#6fa3a0]",
  error: "border-[#b16371]/40 bg-[#b16371]/12 text-[#d38290]",
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

export function CardShell({
  title,
  blurb,
  badges,
  notes,
  children,
}: {
  title: string;
  blurb?: string;
  badges?: ReactNode;
  notes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="content-panel">
      <details className="inspect">
        <summary>inspect</summary>
        <div className="inspect-body">
          <p className="m-0 text-sm tracking-wide text-[#959aa4]">{title}</p>
          {badges}
          {blurb && <p>{blurb}</p>}
          {notes}
        </div>
      </details>
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
    <pre className="code-surface overflow-x-auto p-3 font-mono text-xs leading-relaxed text-[#959aa4]">
      {children}
    </pre>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-wide text-[#5f656e]">{children}</span>
  );
}
