import { useState } from "react";
import Explorer from "./components/Explorer";
import StarshipPlayground from "./components/StarshipPlayground";

type Tab = "playground" | "explorer";

export default function App() {
  const [tab, setTab] = useState<Tab>("playground");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Dotfiles Showcase</h1>
            <p className="text-sm text-white/60">
              Interactive visualization of your chezmoi-managed dotfiles.
            </p>
          </div>
          <nav className="flex overflow-hidden rounded-lg border border-white/15">
            {(
              [
                ["playground", "Starship Playground"],
                ["explorer", "Explorer"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-2 text-sm transition-colors ${
                  tab === id ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        {tab === "playground" ? (
          <>
            <section className="mb-6">
              <h2 className="mb-1 text-lg font-semibold">Starship Playground</h2>
              <p className="text-sm text-white/50">
                Drives the real <code>starship</code> binary to reproduce your exact
                prompt for any shell state.
              </p>
            </section>
            <StarshipPlayground />
          </>
        ) : (
          <Explorer onOpenPlayground={() => setTab("playground")} />
        )}
      </main>
    </div>
  );
}
