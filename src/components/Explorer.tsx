import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { getManifestEntry, type CardId } from "../manifest";
import { useRouter } from "../lib/router";
import {
  CATEGORIES,
  CATALOGUE,
  cardsForCategory,
  type CategoryId,
} from "../lib/catalogue";
import { emit } from "../lib/telemetry";
import { SourceBadge } from "./explorer/ui";
import StarshipCard from "./explorer/StarshipCard";

/**
 * PERF-03 chunk map: the wake path (StarshipCard) stays in the initial bundle;
 * other card components split into on-demand chunks via React.lazy.
 */
const EAGER: Partial<Record<CardId, React.ComponentType<{ onOpenPlayground?: () => void }>>> = {
  starship: StarshipCard,
};

const LOADERS: Record<string, () => Promise<{ default: React.ComponentType<{ onOpenPlayground?: () => void }> }>> = {
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
};

const CARDS = {} as Record<CardId, React.ComponentType<{ onOpenPlayground?: () => void }>>;
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
      <span className="font-mono text-xs text-[#868b93]">loading…</span>
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

export default function Explorer() {
  const { route, navigate } = useRouter();
  const activeCategory = route.category;

  // Track expanded cards. Deep-linked targetCard is expanded on arrival.
  const [expandedCards, setExpandedCards] = useState<Set<CardId>>(
    () => new Set<CardId>(route.targetCard ? [route.targetCard] : []),
  );

  const targetRef = useRef<HTMLElement>(null);

  // If landing on root "/", normalize URL to canonical path without adding a history entry
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "")) {
      navigate({ category: "system" }, true);
    }
  }, [navigate]);

  // Handle URL hash deep-linking arrival & scrolling
  useEffect(() => {
    if (!route.targetCard) return;
    const target = route.targetCard;
    setExpandedCards((current) => new Set(current).add(target));
    const timer = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [route.category, route.targetCard]);

  const openCategory = (id: CategoryId) => {
    if (id !== activeCategory) {
      emit("room_switch", { from: activeCategory, to: id });
    }
    navigate({ category: id, targetCard: undefined });
  };

  const toggleCard = (id: CardId) => {
    setExpandedCards((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        if (route.targetCard === id) {
          navigate({ targetCard: undefined }, true);
        }
      } else {
        next.add(id);
        navigate({ targetCard: id });
      }
      return next;
    });
  };

  const categoryCards = cardsForCategory(activeCategory);
  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory);

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
          <div
            className="category-grid"
            role="region"
            aria-label={currentCategory?.label ?? "Cards"}
          >
            {categoryCards.map((entry) => {
              const manifest = getManifestEntry(entry.id);
              const isExpanded = expandedCards.has(entry.id);
              const isTargeted = route.targetCard === entry.id;

              return (
                <article
                  key={entry.id}
                  id={entry.id}
                  data-card={entry.id}
                  ref={isTargeted ? targetRef : undefined}
                  className={`showcase-card ${isExpanded ? "showcase-card-expanded" : "showcase-card-collapsed"}${isTargeted ? " card-focused" : ""}`}
                >
                  <div
                    className="showcase-card-header"
                    onClick={() => toggleCard(entry.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="showcase-card-meta">
                      <h2 className="showcase-card-title">{manifest?.title ?? entry.word}</h2>
                      {manifest?.kind && (
                        <SourceBadge source={manifest.kind} />
                      )}
                    </div>
                    <button
                      type="button"
                      className="showcase-expand-btn"
                      aria-expanded={isExpanded}
                      aria-controls={`card-detail-${entry.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCard(entry.id);
                      }}
                    >
                      {isExpanded ? "collapse ▴" : "expand ▾"}
                    </button>
                  </div>
                  {manifest?.blurb && (
                    <p className="showcase-card-blurb">{manifest.blurb}</p>
                  )}
                  {isExpanded && (
                    <div id={`card-detail-${entry.id}`} className="showcase-card-body">
                      <CardWithSuspense id={entry.id} />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}