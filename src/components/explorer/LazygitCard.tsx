import { useEffect, useRef, useState } from "react";
import { useJson } from "../../lib/useApi";
import { CardShell, SourceBadge, Term } from "./ui";

interface LazygitData {
  source: "live" | "fallback";
  content: string;
}

const LOADING_TEXT = "Generating commit message with Ollama...";

const SAMPLE_DIFF = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index abc1234..def5678 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -10,7 +10,7 @@ export function Button({ children, onClick }: ButtonProps) {
-  return <button className="px-4 py-2">{children}</button>;
+  return <button className="px-4 py-2 rounded-lg" onClick={onClick}>{children}</button>;
@@ -34,7 +34,7 @@ export function IconButton({ icon, onClick }: IconButtonProps) {
-  return <button className="p-2">{icon}</button>;
+  return <button className="p-2 rounded-full" onClick={onClick}>{icon}</button>;
diff --git a/src/utils/format.ts b/src/utils/format.ts
index aaa0000..bbb1111 100644
--- a/src/utils/format.ts
+++ b/src/utils/format.ts
@@ -2,6 +2,9 @@ export function formatLabel(s: string): string {
   return s.trim();
+export function formatTitle(s: string): string {
+  return s.trim().toUpperCase();
+}
`;

interface DiffContext {
  files: number;
  modules: string[];
  insertions: number;
  deletions: number;
}

function extractDiffContext(diff: string): DiffContext {
  const modules: string[] = [];
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    const m = line.match(/^diff --git a\/.+? b\/(.+)$/);
    if (m) {
      files += 1;
      const path = m[1];
      const base = path.split("/").pop() ?? path;
      modules.push(base.replace(/\.[^.]+$/, ""));
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) insertions += 1;
    else if (line.startsWith("-")) deletions += 1;
  }
  return { files, modules, insertions, deletions };
}

function buildCandidates(diff: string): string[] {
  const ctx = extractDiffContext(diff);
  const primary = ctx.modules[0] ?? "core";
  const fileWord = ctx.files === 1 ? "file" : "files";
  return [
    `feat(${primary}): wire onClick handler and round corners (+${ctx.insertions} -${ctx.deletions})`,
    `refactor(${primary}): forward click prop across ${ctx.files} ${fileWord}`,
    `chore: tidy ${ctx.files} ${fileWord}, ${ctx.insertions} insertions, ${ctx.deletions} deletions`,
  ];
}

const CANDIDATES = buildCandidates(SAMPLE_DIFF);

type Phase = "idle" | "loading" | "review" | "pushed";

function DiffPreview({ diff }: { diff: string }) {
  const lines = diff.split("\n");
  return (
    <pre className="code-surface overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const tone =
          line.startsWith("+++")
            ? "text-emerald-200/80"
            : line.startsWith("---")
              ? "text-red-200/80"
              : line.startsWith("+")
                ? "text-emerald-300"
                : line.startsWith("-")
                  ? "text-red-300"
                  : line.startsWith("diff ")
                    ? "text-cyan-300 font-semibold"
                    : line.startsWith("@@")
                      ? "text-violet-300"
                      : "text-white/70";
        return (
          <div key={i} className={tone}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </pre>
  );
}

function HighlightedConfig({
  content,
  showCommands,
}: {
  content: string;
  showCommands: boolean;
}) {
  if (!showCommands) return <Term>{content}</Term>;
  const lines = content.split("\n");
  return (
    <pre className="code-surface overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const hit = line.includes("<c-g>");
        return (
          <div
            key={i}
            className={
              hit
                ? "border-l-2 border-cyan-400 bg-cyan-300/10 pl-2 text-cyan-50"
                : ""
            }
          >
            {line || "\u00A0"}
          </div>
        );
      })}
    </pre>
  );
}

export default function LazygitCard() {
  const { data, error } = useJson<LazygitData>("/api/cards/lazygit");
  const [showCommands, setShowCommands] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidateIdx, setCandidateIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const currentMessage =
    phase === "review" || phase === "pushed"
      ? CANDIDATES[candidateIdx % CANDIDATES.length]
      : null;

  const startLoading = (advance: boolean) => {
    setPhase("loading");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (advance) setCandidateIdx((i) => (i + 1) % CANDIDATES.length);
      setPhase("review");
    }, 600);
  };

  const handleGenerate = () => {
    if (phase === "loading") return;
    startLoading(phase !== "idle");
  };

  const handleAccept = () => setPhase("pushed");
  const handleAbort = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("idle");
  };

  const generateLabel =
    phase === "loading"
      ? "generating…"
      : phase === "idle"
        ? "generate commit message"
        : "regenerate commit message";

  return (
    <CardShell
      title="lazygit + Ollama Commits"
      blurb="Inside lazygit, Ctrl+G pipes the staged diff through a local Ollama model and opens the generated message for review."
      badges={
        <div className="flex gap-1.5">
          {data ? <SourceBadge source={data.source} /> : null}
          <span className="rounded border border-violet-500/30 bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-violet-300">
            SIMULATED
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="rounded bg-white/10 px-2 py-1">Ctrl+G (files panel)</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">lazygit-ollama-commit.sh</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">ollama (local LLM)</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-300">
            draft
          </span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">$EDITOR review</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">git commit</span>
          <span className="text-white/30">→</span>
          <span className="rounded bg-white/10 px-2 py-1">git push*</span>
        </div>
        <p className="font-mono text-[10px] text-white/35">
          * auto-push after the editor closes — set{" "}
          <span className="text-white/55">LAZYGIT_OLLAMA_NO_PUSH=1</span> to commit only
        </p>

        <p className="text-xs leading-relaxed text-white/50">
          The script hands the draft to{" "}
          <span className="font-mono">git commit --edit</span>, so you review and
          tweak the message in $EDITOR before anything is committed — nothing
          lands until you save. It then runs <span className="font-mono">git push</span>{" "}
          by default; set <span className="font-mono">LAZYGIT_OLLAMA_NO_PUSH=1</span> for
          commit-only.
        </p>

        <div className="space-y-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-xs text-violet-200">
              simulated ollama commit generator
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCommands((v) => !v)}
                aria-pressed={showCommands}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                  showCommands
                    ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                {showCommands ? "hide <c-g> highlight" : "highlight <c-g> binding"}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={phase === "loading"}
                className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                  phase === "loading"
                    ? "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                }`}
              >
                {generateLabel}
              </button>
            </div>
          </div>

          <div className="font-mono text-[10px] text-white/35">
            model=<span className="text-white/60">qwen2.5-coder:7b</span> · host=
            <span className="text-white/60">localhost:11434</span> · output=
            <span className="text-white/60">terminal</span>
          </div>

          <div className="space-y-1">
            <div className="font-mono text-[11px] text-white/45">
              sample staged diff (hardcoded fixture)
            </div>
            <DiffPreview diff={SAMPLE_DIFF} />
          </div>

          <div aria-live="polite" className="space-y-1">
            {phase === "loading" && (
              <div>
                <div className="font-mono text-[11px] text-white/45">
                  calling ollama…
                </div>
                <pre className="animate-pulse rounded-lg border border-violet-500/20 bg-violet-500/[0.07] p-3 font-mono text-xs text-violet-100">
                  {LOADING_TEXT}
                </pre>
              </div>
            )}
            {currentMessage !== null && (
              <div className="space-y-1">
                <div className="font-mono text-[11px] text-white/45">
                  generated commit message · candidate{" "}
                  {(candidateIdx % CANDIDATES.length) + 1} / {CANDIDATES.length}
                </div>
                <div className="overflow-hidden rounded-lg border border-emerald-500/20">
                  <div className="border-b border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-[10px] text-white/45">
                    -- EDIT DRAFT -- save:y abort:n --
                  </div>
                  <pre className="overflow-x-auto bg-emerald-500/[0.07] p-3 font-mono text-xs text-emerald-100">
                    {currentMessage}
                  </pre>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {phase === "review" ? (
                    <>
                      <button
                        type="button"
                        onClick={handleAccept}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs text-emerald-200 transition-colors hover:bg-emerald-500/25"
                      >
                        accept (save:y)
                      </button>
                      <button
                        type="button"
                        onClick={handleAbort}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/60 transition-colors hover:bg-white/10"
                      >
                        abort (abort:n)
                      </button>
                    </>
                  ) : (
                    <span className="rounded border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-1 font-mono text-[11px] text-emerald-200/80">
                      ✓ accepted → git commit --edit → git push*
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-xs text-white/60">lazygit config</div>
            {data && (
              <span className="font-mono text-[11px] text-white/40">
                from {data.source} source
              </span>
            )}
          </div>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          {!data && !error && (
            <p className="font-mono text-xs text-white/40">loading config…</p>
          )}
          {data && (
            <HighlightedConfig
              content={data.content}
              showCommands={showCommands}
            />
          )}
        </div>

        <p className="text-xs leading-5 text-white/35">
          Real ollama runs are out of scope for v1; this is a client-side simulation
          that mimics the message shape the dotfiles' script would produce.
        </p>
      </div>
    </CardShell>
  );
}
