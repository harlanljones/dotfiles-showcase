import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import type { CardId } from "../manifest";
import { useRouter } from "../lib/router";
import {
  CATEGORIES,
  CATALOGUE,
  cardsForCategory,
  type CategoryId,
} from "../lib/catalogue";
import { emit } from "../lib/telemetry";
import { markDemoSeen, seenDemos } from "../lib/session";
import { prefersReducedMotion } from "../lib/reducedMotion";
import StarshipCard from "./explorer/StarshipCard";

/**
 * PERF-03 chunk map: the wake path (StarshipCard) stays in the initial bundle;
 * other card components split into on-demand chunks via React.lazy.
 */
const EAGER: Partial<Record<CardId, React.ComponentType>> = {
  starship: StarshipCard,
};

const LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "git-safety": () => import("./explorer/GitSafetyCard"),
  lazygit: () => import("./explorer/LazygitCard"),
  fuzzy: () => import("./explorer/FuzzyToolsCard"),
  ghostty: () => import("./explorer/GhosttyPaletteCard"),
  "ghostty-terminal": () => import("./explorer/GhosttyTerminalCard"),
  btop: () => import("./explorer/BtopCard"),
  mise: () => import("./explorer/MiseCard"),
  packages: () => import("./explorer/PackagesCard"),
  hyprland: () => import("./explorer/HyprlandCard"),
  dots: () => import("./explorer/DotsCliCard"),
  neovim: () => import("./explorer/NeovimCard"),
  ripgrep: () => import("./explorer/RipgrepCard"),
  herdr: () => import("./explorer/HerdrCard"),
  recolor: () => import("./explorer/RecolorCard"),
  "shell-env": () => import("./explorer/ShellEnvCard"),
  "agent-skills": () => import("./explorer/AgentSkillsCard"),
  "git-core": () => import("./explorer/GitCoreCard"),
};

const CARDS = {} as Record<CardId, React.ComponentType>;
for (const entry of CATALOGUE) {
  if (entry.lazy) {
    CARDS[entry.id] = lazy(LOADERS[entry.id]);
  } else {
    CARDS[entry.id] = EAGER[entry.id]!;
  }
}

function ChunkWait() {
  return (
    <div className="flex items-center gap-2 py-6" role="status" aria-label="Loading card">
      <span className="block-cursor" aria-hidden="true" />
      <span className="font-mono text-xs text-ash-dim">loading…</span>
    </div>
  );
}

function CardWithSuspense({ id }: { id: CardId }) {
  const Card = CARDS[id];
  return (
    <Suspense fallback={<ChunkWait />}>
      <Card />
    </Suspense>
  );
}

/**
 * HJ-721: the veil hands off to the performance. The showcase demo the
 * visitor lands on renders itself in rather than appearing finished — the
 * same block-cursor from the veil sweeps across the demo, drawing it in.
 *
 * The veil and the performance are separate mechanisms (session.ts, HJ-717
 * design note): a demo performs once per session, the first time it's
 * shown, whether or not the visitor ever saw the veil this session. Once
 * `seenDemos()` has it, or under a reduced-motion preference, it renders
 * complete and immediately — no ambient motion, no transition.
 *
 * `key={id}` on the parent `.demo-hero` remounts this on every demo switch,
 * so `useState`'s initializer re-evaluates "should this perform" fresh per
 * demo without extra effects.
 */
function DemoPerformance({ id, children }: { id: CardId; children: ReactNode }) {
  const [performing, setPerforming] = useState(() => !prefersReducedMotion() && !seenDemos().has(id));

  useEffect(() => {
    if (!performing) markDemoSeen(id);
  }, [performing, id]);

  return (
    <div className={`demo-performance${performing ? " is-performing" : ""}`}>
      <div
        className="demo-performance-content"
        onAnimationEnd={performing ? () => setPerforming(false) : undefined}
      >
        {children}
      </div>
      {performing && <span className="demo-performance-cursor" aria-hidden="true" />}
    </div>
  );
}

export default function Explorer() {
  const { route, navigate } = useRouter();
  const activeCategory = route.category;

  // Landing on root "/" resolves to Shell & Navigation with Starship open —
  // the desk's signature, and already the eager (chunk-free) demo — rather
  // than a bare category. Normalizes the URL without adding a history entry.
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "")) {
      navigate({ category: "shell", targetCard: "starship" }, true);
    }
  }, [navigate]);

  const openCategory = (id: CategoryId) => {
    if (id !== activeCategory) {
      emit("room_switch", { from: activeCategory, to: id });
    }
    navigate({ category: id, targetCard: undefined });
  };

  const categoryCards = cardsForCategory(activeCategory);
  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory);

  // The open demo is whatever the URL names, or the category's first demo
  // when none is named (e.g. after switching categories via the tabs).
  const activeCardId: CardId | undefined =
    route.targetCard && categoryCards.some((entry) => entry.id === route.targetCard)
      ? route.targetCard
      : categoryCards[0]?.id;

  const selectCard = (id: CardId) => {
    if (id !== activeCardId) {
      navigate({ targetCard: id });
    }
  };

  return (
    <>
      <header className="chrome">
        <nav className="category-tabs room-names" aria-label="Categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className="category-tab"
              aria-current={activeCategory === cat.id ? "page" : undefined}
              onClick={() => openCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </nav>
        <div className="chrome-words">
          <a href="https://github.com/harlanljones/dotfiles">source</a>
        </div>
      </header>

      <main className="field">
        <div className="explorer-content">
          <nav className="demo-rail" aria-label={`${currentCategory?.label ?? "Category"} demos`}>
            {categoryCards.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="demo-rail-word"
                aria-current={entry.id === activeCardId ? "true" : undefined}
                onClick={() => selectCard(entry.id)}
              >
                {entry.word}
              </button>
            ))}
          </nav>

          <div key={activeCardId ?? activeCategory} className="demo-hero" role="region" aria-label={currentCategory?.label ?? "Demo"}>
            {activeCardId && (
              <DemoPerformance id={activeCardId}>
                <CardWithSuspense id={activeCardId} />
              </DemoPerformance>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
