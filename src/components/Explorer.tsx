import { Suspense, lazy, useEffect, useRef } from "react";
import { MANIFEST, type CardId } from "../manifest";
import { useRouter, type RoomId } from "../lib/router";
import StarshipCard from "./explorer/StarshipCard";

const ROOMS = ["starship", "ghostty", "hyprland", "dots"] as const;
const LEFTOVERS = ["git-safety", "lazygit", "fuzzy", "mise", "packages", "neovim", "ripgrep"] as const;

const LazyGitSafetyCard = lazy(() => import("./explorer/GitSafetyCard"));
const LazyLazygitCard = lazy(() => import("./explorer/LazygitCard"));
const LazyFuzzyToolsCard = lazy(() => import("./explorer/FuzzyToolsCard"));
const LazyGhosttyPaletteCard = lazy(() => import("./explorer/GhosttyPaletteCard"));
const LazyMiseCard = lazy(() => import("./explorer/MiseCard"));
const LazyPackagesCard = lazy(() => import("./explorer/PackagesCard"));
const LazyHyprlandCard = lazy(() => import("./explorer/HyprlandCard"));
const LazyDotsCliCard = lazy(() => import("./explorer/DotsCliCard"));
const LazyNeovimCard = lazy(() => import("./explorer/NeovimCard"));
const LazyRipgrepCard = lazy(() => import("./explorer/RipgrepCard"));

/**
 * PERF-03 chunk map (D8): the wake room (StarshipCard, which also serves the
 * `recolor` id) stays in the initial bundle; the other 10 card components split
 * into on-demand chunks via React.lazy with Vite default chunking.
 */
const CARDS: Record<CardId, React.ComponentType> = {
  starship: StarshipCard,
  recolor: StarshipCard,
  "git-safety": LazyGitSafetyCard,
  lazygit: LazyLazygitCard,
  fuzzy: LazyFuzzyToolsCard,
  ghostty: LazyGhosttyPaletteCard,
  mise: LazyMiseCard,
  packages: LazyPackagesCard,
  hyprland: LazyHyprlandCard,
  dots: LazyDotsCliCard,
  neovim: LazyNeovimCard,
  ripgrep: LazyRipgrepCard,
};

const ROOM_WORD: Record<RoomId, string> = {
  starship: "prompt",
  ghostty: "palette",
  hyprland: "desk",
  dots: "dots",
};

function ChunkWait() {
  return (
    <div className="flex items-center gap-2 py-6" role="status" aria-label="Loading card">
      <span className="block-cursor" aria-hidden="true" />
      <span className="font-mono text-xs text-[#5f656e]">loading…</span>
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
  const active = route.room;
  const indexOpen = route.indexOpen;
  const ActiveCard = CARDS[active];

  // If landing on root "/", normalize URL to canonical path without adding a history entry
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "")) {
      navigate({ room: "starship", indexOpen: false }, true);
    }
  }, [navigate]);

  const openRoom = (id: RoomId) => {
    navigate({ room: id, indexOpen: false });
  };

  const toggleIndex = () => {
    navigate({ indexOpen: !indexOpen });
  };

  // UX-01: ESC closes the index overlay and returns focus to the toggle so the
  // keyboard never strands inside the annex.
  const indexToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!indexOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate({ indexOpen: false });
        indexToggleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [indexOpen, navigate]);

  return (
    <>
      <header className="chrome">
        <nav className="room-names" aria-label="Rooms">
          {ROOMS.map((id) => (
            <button
              key={id}
              type="button"
              aria-current={!indexOpen && active === id ? "page" : undefined}
              onClick={() => openRoom(id)}
            >
              {ROOM_WORD[id]}
            </button>
          ))}
        </nav>
        <div className="chrome-words">
          <button
            ref={indexToggleRef}
            type="button"
            aria-pressed={indexOpen}
            onClick={toggleIndex}
          >
            index
          </button>
          <a href="https://github.com/harlanljones/dotfiles">source</a>
        </div>
      </header>

      {indexOpen ? (
        <div className="index-overlay">
          <div className="index-list">
            {LEFTOVERS.map((id) => {
              const entry = MANIFEST.find((e) => e.id === id);
              return (
                <details key={id}>
                  <summary>{entry?.title ?? id}</summary>
                  <div className="annex-body">
                    <CardWithSuspense id={id} />
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ) : (
        <main className="field">
          <div className="room-field">
            <CardWithSuspense id={active} />
          </div>
        </main>
      )}
    </>
  );
}
