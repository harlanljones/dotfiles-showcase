import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { getManifestEntry, type CardId } from "../manifest";
import { useRouter } from "../lib/router";
import { CATALOGUE, annexInOrder, roomsInOrder, type RoomId } from "../lib/catalogue";
import { emit } from "../lib/telemetry";
import StarshipCard from "./explorer/StarshipCard";

/**
 * PERF-03 chunk map (D8): the wake room (StarshipCard, which also serves the
 * `recolor` id) stays in the initial bundle; the other card components split
 * into on-demand chunks via React.lazy with Vite default chunking. Which demo
 * is lazy is declared once in the catalogue (HJ-678) and applied here.
 */
const EAGER: Partial<Record<CardId, React.ComponentType>> = {
  starship: StarshipCard,
  recolor: StarshipCard,
};

const LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "git-safety": () => import("./explorer/GitSafetyCard"),
  lazygit: () => import("./explorer/LazygitCard"),
  fuzzy: () => import("./explorer/FuzzyToolsCard"),
  ghostty: () => import("./explorer/GhosttyPaletteCard"),
  mise: () => import("./explorer/MiseCard"),
  packages: () => import("./explorer/PackagesCard"),
  hyprland: () => import("./explorer/HyprlandCard"),
  dots: () => import("./explorer/DotsCliCard"),
  neovim: () => import("./explorer/NeovimCard"),
  ripgrep: () => import("./explorer/RipgrepCard"),
  herdr: () => import("./explorer/HerdrCard"),
};

const CARDS = {} as Record<CardId, React.ComponentType>;
for (const entry of CATALOGUE) {
  if (entry.lazy) {
    CARDS[entry.id] = lazy(LOADERS[entry.id]);
  } else {
    CARDS[entry.id] = EAGER[entry.id]!;
  }
}
CARDS.recolor = StarshipCard;

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
  const active = route.room;
  const indexOpen = route.indexOpen;
  const ActiveCard = CARDS[active];

  // Focused receipt arrival (HJ-678): a receipt URL like /annex#lazygit both
  // selects and exposes that exact demo when the annex wakes. The set keeps
  // native details toggling under the visitor's control afterwards.
  const [openReceipts, setOpenReceipts] = useState<Set<CardId>>(
    () => new Set<CardId>(route.targetReceipt ? [route.targetReceipt] : []),
  );
  const targetRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!indexOpen || !route.targetReceipt) return;
    const receipt: CardId = route.targetReceipt;
    setOpenReceipts((current) => new Set(current).add(receipt));
    // Defer the scroll until the receipt content mounts and paints.
    const timer = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [indexOpen, route.targetReceipt]);

  // If landing on root "/", normalize URL to canonical path without adding a history entry
  useEffect(() => {
    if (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "")) {
      navigate({ room: "starship", indexOpen: false }, true);
    }
  }, [navigate]);

  const openRoom = (id: RoomId) => {
    if (id !== active) emit("room_switch", { from: active, to: id });
    navigate({ room: id, indexOpen: false });
  };

  const toggleIndex = () => {
    if (indexOpen) emit("annex_closed");
    else emit("annex_opened");
    navigate({ indexOpen: !indexOpen });
  };

  // UX-01: ESC closes the index overlay and returns focus to the toggle so the
  // keyboard never strands inside the annex.
  const indexToggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!indexOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        emit("annex_closed");
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
          {roomsInOrder().map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={!indexOpen && active === entry.id ? "page" : undefined}
              onClick={() => openRoom(entry.id as RoomId)}
            >
              {entry.word}
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
            {annexInOrder().map((entry) => {
              const manifest = getManifestEntry(entry.id);
              const focused = route.targetReceipt === entry.id;
              return (
                <details
                  key={entry.id}
                  ref={focused ? targetRef : undefined}
                  className={focused ? "receipt-focused" : undefined}
                  open={openReceipts.has(entry.id)}
                  onToggle={() => {
                    setOpenReceipts((current) => {
                      const next = new Set(current);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else next.add(entry.id);
                      return next;
                    });
                  }}
                  data-receipt={entry.id}
                >
                  <summary>{manifest?.title ?? entry.word}</summary>
                  <div className="annex-body">
                    <CardWithSuspense id={entry.id} />
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