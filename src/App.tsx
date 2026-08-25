import { useState } from "react";
import Explorer from "./components/Explorer";
import StarshipPlayground, { type ApiStatus } from "./components/StarshipPlayground";

type Tab = "playground" | "explorer";

const SIGNAL: Record<ApiStatus, { label: string; bg: string; glow: string; text: string }> = {
  idle: { label: "local API · idle", bg: "rgba(255,255,255,.25)", glow: "none", text: "text-white/40" },
  live: { label: "live render", bg: "#69e7d1", glow: "0 0 10px #69e7d1", text: "text-white/70" },
  degraded: { label: "degraded snapshot", bg: "#fbbf24", glow: "0 0 10px #fbbf24", text: "text-amber-200" },
  error: { label: "unreachable", bg: "#f87171", glow: "0 0 10px #f87171", text: "text-red-300" },
};

export default function App() {
  const [tab, setTab] = useState<Tab>("playground");
  const [apiStatus, setApiStatus] = useState<ApiStatus>("idle");

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <header className="site-header px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><span /></div>
            <div>
              <p className="brand-kicker">local config / live surface</p>
              <h1 className="text-xl font-bold tracking-tight">Dotfiles Showcase</h1>
              <p className="mt-1 text-sm text-white/55">
                See what your chezmoi-managed environment can do.
              </p>
            </div>
          </div>
          <nav aria-label="Primary" className="top-nav flex overflow-hidden rounded-xl border border-white/15 p-1">
            {(
              [
                ["playground", "Starship Playground"],
                ["explorer", "Explorer"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`px-4 py-2 text-sm transition-colors ${
                  tab === id ? "active bg-white/15 text-white" : "text-white/55 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:py-12">
        {tab === "playground" ? (
          <>
            <section className="intro mb-8">
              <div>
                <p className="section-eyebrow">01 / prompt laboratory</p>
                <h2 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">Starship Playground</h2>
                <p className="max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                  Drive the real <code>starship</code> binary and watch your prompt respond to the shell state.
                </p>
              </div>
              <div className="intro-signal" aria-label={`local render API — ${SIGNAL[apiStatus].label}`}><span style={{ background: SIGNAL[apiStatus].bg, boxShadow: SIGNAL[apiStatus].glow }} /><span className={SIGNAL[apiStatus].text}>{SIGNAL[apiStatus].label}</span></div>
            </section>
            <StarshipPlayground onRenderOutcome={setApiStatus} />
          </>
        ) : (
          <>
          <section className="intro mb-8">
            <div>
              <p className="section-eyebrow">02 / configuration atlas</p>
              <h2 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">Explore the system</h2>
              <p className="max-w-2xl text-sm leading-6 text-white/55 sm:text-base">Live reads, bundled fallbacks, and small interactive demos from the tools that shape your shell.</p>
            </div>
          </section>
          <Explorer onOpenPlayground={() => setTab("playground")} />
          </>
        )}
      </main>
    </div>
  );
}
