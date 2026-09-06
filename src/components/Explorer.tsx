import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { CardId } from "../manifest";
import { useRouter } from "../lib/router";
import {
  CATEGORIES,
  CATALOGUE,
  cardsForCategory,
  type CategoryId,
} from "../lib/catalogue";
import { emit } from "../lib/telemetry";
import {
  clampPage,
  computePageCount,
  initialPagerState,
  onScrollIntent,
  pageDown,
  pageUp,
  percentThrough,
  siblingIndex,
  type PagerState,
  type PointerCoarseness,
} from "../lib/pager";
import { markDemoSeen, pagerModeOverride, seenDemos, setPagerModeOverride } from "../lib/session";
import { prefersReducedMotion } from "../lib/reducedMotion";
import StarshipCard from "./explorer/StarshipCard";
import StatusLine from "./StatusLine";

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
 * Mode selection branches on pointer coarseness, not viewport width, so
 * touch laptops and large tablets are classified by how they're actually
 * driven rather than how wide their screen happens to be (HJ-722).
 */
function detectPointerCoarseness(): PointerCoarseness {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "fine";
  try {
    return window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine";
  } catch {
    return "fine";
  }
}

const HINT_FLASH_MS = 1800;

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

  const selectCard = useCallback(
    (id: CardId) => {
      if (id !== activeCardId) {
        navigate({ targetCard: id });
      }
    },
    [activeCardId, navigate],
  );

  // --- Pager (HJ-722) ---------------------------------------------------
  //
  // Mode is decided once, from pointer coarseness and any session override
  // — never from viewport width. Page position/count come from measuring
  // the hero viewport and its content; the escalation itself (first scroll
  // flashes the hints, the next hands over to native scrolling) is the
  // pure state machine in ../lib/pager, fed these DOM-derived numbers.
  const [pointer] = useState<PointerCoarseness>(detectPointerCoarseness);
  const [pagerState, setPagerState] = useState<PagerState>(() => initialPagerState(pointer, pagerModeOverride()));
  const [hintFlash, setHintFlash] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [fieldHeightPx, setFieldHeightPx] = useState<number | null>(null);
  const [viewportHeightPx, setViewportHeightPx] = useState(0);

  const fieldRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const heroTrackRef = useRef<HTMLDivElement | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const paged = pagerState.yield === "paged";

  // A demo swap (rail click, category switch, deep link) always opens on
  // its first page.
  useEffect(() => {
    setPage(0);
  }, [activeCardId]);

  // Clip the field to exactly the space below the header while paged, so
  // the hero viewport below it has a definite height to clip/translate
  // within. Reverts to natural (growable, scrollable) sizing once yielded.
  useLayoutEffect(() => {
    if (!paged) {
      setFieldHeightPx(null);
      return;
    }
    const field = fieldRef.current;
    if (!field) return;
    const measure = () => {
      const top = field.getBoundingClientRect().top;
      setFieldHeightPx(Math.max(0, window.innerHeight - top));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [paged]);

  // Measure the hero viewport/content to compute how many pages this demo
  // needs. Content height, viewport height, and pointer coarseness are the
  // only inputs the pure pager module ever sees.
  useLayoutEffect(() => {
    if (!paged) return;
    const viewport = heroRef.current;
    const track = heroTrackRef.current;
    if (!viewport || !track) return;

    const measure = () => {
      const vh = viewport.clientHeight;
      const ch = track.scrollHeight;
      setViewportHeightPx(vh);
      setPageCount(computePageCount(ch, vh));
    };
    measure();

    const RO = window.ResizeObserver;
    let observer: ResizeObserver | undefined;
    if (RO) {
      observer = new RO(measure);
      observer.observe(viewport);
      observer.observe(track);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [paged, activeCardId, fieldHeightPx]);

  // Content shrinking (or a demo swap) can leave `page` past the new end.
  useEffect(() => {
    setPage((p) => clampPage(p, pageCount));
  }, [pageCount]);

  const flashHint = useCallback(() => {
    setHintFlash(true);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => setHintFlash(false), HINT_FLASH_MS);
  }, []);

  useEffect(() => () => {
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
  }, []);

  // A visitor who scrolls is never silently ignored: the first attempt
  // flashes the hints and stays paged; a second attempt hands over to
  // native scrolling for the rest of the session (remembered via
  // session.ts, HJ-717). Coarse pointers never reach "paged" in the first
  // place, so this listener never even attaches for them.
  useEffect(() => {
    if (!paged) return;
    const viewport = heroRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const result = onScrollIntent(pagerState);
      setPagerState(result.state);
      if (result.showHint) flashHint();
      if (result.yielded) setPagerModeOverride("native");
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [paged, pagerState, flashHint]);

  // j/k/space page the hero; h/l walk the sibling rail. Never touches
  // history or the URL beyond the existing rail navigation (`navigate`),
  // which already replaces rather than pushes for same-category moves.
  useEffect(() => {
    if (!paged) return;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "j" || e.key === " ") {
        e.preventDefault();
        setPage((p) => pageDown(p, pageCount));
      } else if (e.key === "k") {
        e.preventDefault();
        setPage((p) => pageUp(p, pageCount));
      } else if (e.key === "l" || e.key === "h") {
        e.preventDefault();
        const idx = categoryCards.findIndex((entry) => entry.id === activeCardId);
        if (idx === -1) return;
        const nextIdx = siblingIndex(idx, categoryCards.length, e.key === "l" ? 1 : -1);
        const next = categoryCards[nextIdx];
        if (next) selectCard(next.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [paged, pageCount, categoryCards, activeCardId, selectCard]);

  const activeEntry = categoryCards.find((entry) => entry.id === activeCardId);

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

      <main
        className="field"
        ref={fieldRef}
        style={fieldHeightPx !== null ? { height: fieldHeightPx, overflow: "hidden" } : undefined}
      >
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

          <div
            key={activeCardId ?? activeCategory}
            className="demo-hero"
            role="region"
            aria-label={currentCategory?.label ?? "Demo"}
            ref={heroRef}
            style={paged ? { overflow: "hidden" } : undefined}
          >
            <div
              className="demo-hero-track"
              ref={heroTrackRef}
              style={paged ? { transform: `translateY(-${page * viewportHeightPx}px)` } : undefined}
            >
              {activeCardId && (
                <DemoPerformance id={activeCardId}>
                  <CardWithSuspense id={activeCardId} />
                </DemoPerformance>
              )}
            </div>
          </div>

          {pointer === "fine" && paged && activeEntry && (
            <StatusLine
              demoWord={activeEntry.word}
              page={page}
              pageCount={pageCount}
              percent={percentThrough(page, pageCount)}
              flash={hintFlash}
            />
          )}
        </div>
      </main>
    </>
  );
}
