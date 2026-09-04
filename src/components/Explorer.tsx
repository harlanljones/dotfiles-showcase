import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { getManifestEntry, type CardId } from "../manifest";
import { useRouter } from "../lib/router";
import {
  CATEGORIES,
  CATALOGUE,
  cardsForCategory,
  getCategoryForCard,
  type CategoryId,
} from "../lib/catalogue";
import { emit } from "../lib/telemetry";
import {
  createPager,
  formatIdleLine,
  formatStatusLine,
  nextPage,
  noteScrollIntent,
  openDemo,
  prevPage,
  remeasure,
  type PagerState,
} from "../lib/pager";
import {
  markDemoSeen,
  pagerModeOverride,
  seenDemos,
  setPagerModeOverride,
} from "../lib/session";
import type { DemoRef } from "../lib/search";
import { SourceBadge } from "./explorer/ui";
import StarshipCard from "./explorer/StarshipCard";
import Palette from "./Palette";
import "./Explorer.grid.css";

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
  "shell-env": () => import("./explorer/ShellEnvCard"),
  "agent-skills": () => import("./explorer/AgentSkillsCard"),
  "git-core": () => import("./explorer/GitCoreCard"),
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

/** matchMedia queries are inputs here, never inside the pager module. */
function mediaMatches(query: string): boolean {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function measureViewport(): number {
  try {
    return typeof window !== "undefined" ? window.innerHeight || 0 : 0;
  } catch {
    return 0;
  }
}

function measureDetail(demo: CardId): number {
  try {
    if (typeof document === "undefined") return 0;
    const el = document.getElementById(`card-detail-${demo}`);
    return el ? el.scrollHeight || 0 : 0;
  } catch {
    return 0;
  }
}

export default function Explorer() {
  const { route, navigate } = useRouter();
  const activeCategory = route.category;

  // Track expanded cards. Deep-linked targetCard is expanded on arrival.
  const [expandedCards, setExpandedCards] = useState<Set<CardId>>(
    () => new Set<CardId>(route.targetCard ? [route.targetCard] : []),
  );

  const targetRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<number>(0);

  // Pager (HJ-715 wave 1): pure state; DOM metrics flow in as inputs.
  // Mode branches on pointer coarseness, never viewport width.
  const [coarse] = useState(() => mediaMatches("(pointer: coarse)"));
  const [reducedMotion] = useState(() => mediaMatches("(prefers-reduced-motion: reduce)"));
  const [pager, setPager] = useState<PagerState>(() =>
    createPager({
      pointer: mediaMatches("(pointer: coarse)") ? "coarse" : "fine",
      viewportHeight: measureViewport(),
      contentHeight: 0,
      sessionOverride: pagerModeOverride(),
    }),
  );

  // Performance tracking: a demo performs the first time it opens in a
  // session and renders instantly on every later visit. Keyed on the
  // seen-set, never on the veil awake flag — skipping the gate must not
  // cost the visitor the main event. The seen-set is written the moment the
  // performance starts; the performing marker plays out its handoff and
  // clears, so a revisit mid-performance is still remembered as seen.
  const [performingId, setPerformingId] = useState<CardId | null>(null);

  // The `/` palette.
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  // The demo the pager, status line and performance gate follow: the
  // deep-linked target first, else the earliest expanded card, else none.
  const currentDemo: CardId | null =
    route.targetCard ?? (expandedCards.size > 0 ? [...expandedCards][0] : null);
  const currentWord = currentDemo
    ? (categoryCards.find((c) => c.id === currentDemo)?.word ?? currentDemo)
    : null;

  // Opening a demo (deep link, rail walk, palette jump, expand): start at
  // page one, and record the performance so revisits are instant.
  // Paging never writes history — back moves between demos, not pages.
  useEffect(() => {
    if (!currentDemo) return;
    const viewport = measureViewport();
    viewportRef.current = viewport;
    setPager((prev) => openDemo(prev, measureDetail(currentDemo), viewport));
    const alreadySeen = seenDemos().has(currentDemo);
    if (!alreadySeen) markDemoSeen(currentDemo);
    if (reducedMotion || alreadySeen) {
      setPerformingId(null);
      return;
    }
    const id = currentDemo;
    setPerformingId(id);
    const timer = window.setTimeout(() => {
      setPerformingId((cur) => (cur === id ? null : cur));
    }, 350);
    return () => window.clearTimeout(timer);
    // currentDemo identity is the trigger; activeCategory narrows re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDemo, activeCategory]);

  // Re-derive page count on resize.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const viewport = measureViewport();
      viewportRef.current = viewport;
      if (!currentDemo) return;
      setPager((prev) => remeasure(prev, measureDetail(currentDemo), viewport));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [currentDemo]);

  // Scroll-escalation: the first wheel intent over a paged field flashes the
  // key hints; continued intent yields to native scrolling for the session.
  // Coarse pointers never engage — they scroll natively from the start.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || coarse || typeof el.addEventListener !== "function") return;
    const onWheel = (e: WheelEvent) => {
      setPager((prev) => {
        if (prev.mode !== "paged") return prev;
        e.preventDefault();
        const next = noteScrollIntent(prev);
        if (next.mode === "native") setPagerModeOverride("native");
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [coarse]);

  const applyPageScroll = (page: number) => {
    if (!currentDemo || typeof document === "undefined") return;
    const detail = document.getElementById(`card-detail-${currentDemo}`);
    if (detail) {
      detail.scrollTop = (page - 1) * (viewportRef.current || detail.clientHeight || 0);
    }
  };

  const walkSiblings = (dir: 1 | -1) => {
    if (categoryCards.length === 0) return;
    const idx = currentDemo ? categoryCards.findIndex((c) => c.id === currentDemo) : -1;
    const next = categoryCards[Math.min(categoryCards.length - 1, Math.max(0, idx + dir))];
    if (!next || next.id === currentDemo) return;
    setExpandedCards(new Set([next.id]));
    navigate({ category: activeCategory, targetCard: next.id });
  };

  const selectPaletteDemo = (id: string) => {
    setPaletteOpen(false);
    if (!getCategoryForCard(id as CardId)) return;
    const demo = id as CardId;
    const cat = getCategoryForCard(demo)!;
    if (cat !== activeCategory) {
      emit("room_switch", { from: activeCategory, to: cat });
      navigate({ category: cat, targetCard: demo });
    } else {
      navigate({ targetCard: demo });
    }
    setExpandedCards(new Set([demo]));
  };

  const demoRefs: DemoRef[] = CATALOGUE.map((entry) => ({
    id: entry.id,
    word: entry.word,
    title: getManifestEntry(entry.id)?.title ?? entry.word,
    route: entry.route,
  }));

  // Key handling maps keys to intents here, not in a separate module:
  // j/k/space page the open demo, h/l walk siblings, / opens the palette.
  // (Re-subscribed every render so the closure always sees fresh state.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (paletteOpen) {
        if (e.key === "Escape") setPaletteOpen(false);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "j" || e.key === " ") {
        e.preventDefault();
        const n = nextPage(pager);
        setPager(n);
        applyPageScroll(n.page);
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        const n = prevPage(pager);
        setPager(n);
        applyPageScroll(n.page);
        return;
      }
      if (e.key === "h") {
        walkSiblings(-1);
        return;
      }
      if (e.key === "l") {
        walkSiblings(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
          <button
            type="button"
            className="chrome-search"
            aria-label="Search demos and configuration"
            onClick={() => setPaletteOpen(true)}
          >
            search <kbd>/</kbd>
          </button>
          <a href="https://github.com/harlanljones/dotfiles">source</a>
        </div>
      </header>

      <main className="field" ref={fieldRef} data-pager={pager.mode}>
        <div className="explorer-content">
          <div
            key={activeCategory}
            className="category-grid"
            role="region"
            aria-label={currentCategory?.label ?? "Cards"}
          >
            {categoryCards.map((entry) => {
              const manifest = getManifestEntry(entry.id);
              const isExpanded = expandedCards.has(entry.id);
              const isTargeted = route.targetCard === entry.id;
              const performing = entry.id === performingId && isExpanded;

              return (
                <article
                  key={entry.id}
                  id={entry.id}
                  data-card={entry.id}
                  ref={isTargeted ? targetRef : undefined}
                  data-performing={performing ? "true" : undefined}
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

      <div
        className="pager-status"
        role="status"
        data-hint={pager.hintFlash ? "true" : "false"}
      >
        <span className="block-cursor" aria-hidden="true" />
        <span>
          {currentDemo && currentWord
            ? formatStatusLine(currentWord, pager)
            : formatIdleLine(categoryCards.length)}
          {pager.hintFlash ? " — scroll again for native scrolling" : ""}
        </span>
      </div>

      {paletteOpen && (
        <Palette demos={demoRefs} onSelect={selectPaletteDemo} onClose={() => setPaletteOpen(false)} />
      )}
    </>
  );
}
