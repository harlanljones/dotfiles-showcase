import Explorer from "./components/Explorer";

export default function App() {
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
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:py-12">
        <section className="intro mb-8">
          <div>
            <p className="section-eyebrow">01 / configuration atlas</p>
            <h2 className="mb-2 text-3xl font-semibold tracking-tight sm:text-4xl">Explore the system</h2>
            <p className="max-w-2xl text-sm leading-6 text-white/55 sm:text-base">Live reads, bundled fallbacks, and small interactive demos from the tools that shape your shell.</p>
          </div>
        </section>
        <Explorer />
      </main>
    </div>
  );
}
