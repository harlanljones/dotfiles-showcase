import { useState } from "react";
import { MANIFEST, type CardId } from "../manifest";
import FuzzyToolsCard from "./explorer/FuzzyToolsCard";
import DotsCliCard from "./explorer/DotsCliCard";
import GhosttyPaletteCard from "./explorer/GhosttyPaletteCard";
import GitSafetyCard from "./explorer/GitSafetyCard";
import HyprlandCard from "./explorer/HyprlandCard";
import LazygitCard from "./explorer/LazygitCard";
import MiseCard from "./explorer/MiseCard";
import NeovimCard from "./explorer/NeovimCard";
import PackagesCard from "./explorer/PackagesCard";
import RipgrepCard from "./explorer/RipgrepCard";
import StarshipCard from "./explorer/StarshipCard";

const ROOMS = ["starship", "ghostty", "hyprland", "dots"] as const;
const LEFTOVERS = ["git-safety", "lazygit", "fuzzy", "mise", "packages", "neovim", "ripgrep"] as const;

const CARDS: Record<CardId, React.ComponentType> = {
  starship: StarshipCard,
  recolor: StarshipCard,
  "git-safety": GitSafetyCard,
  lazygit: LazygitCard,
  fuzzy: FuzzyToolsCard,
  ghostty: GhosttyPaletteCard,
  mise: MiseCard,
  packages: PackagesCard,
  hyprland: HyprlandCard,
  dots: DotsCliCard,
  neovim: NeovimCard,
  ripgrep: RipgrepCard,
};

const ROOM_WORD = {
  starship: "prompt",
  ghostty: "palette",
  hyprland: "desk",
  dots: "dots",
} as const;

export default function Explorer() {
  const [active, setActive] = useState<CardId>("starship");
  const [indexOpen, setIndexOpen] = useState(false);
  const ActiveCard = CARDS[active];

  const openRoom = (id: CardId) => {
    setIndexOpen(false);
    setActive(id);
  };

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
            type="button"
            aria-pressed={indexOpen}
            onClick={() => setIndexOpen((v) => !v)}
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
              const Card = CARDS[id];
              const entry = MANIFEST.find((e) => e.id === id);
              return (
                <details key={id}>
                  <summary>{entry?.title ?? id}</summary>
                  <div className="annex-body">
                    <Card />
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ) : (
        <main className="field">
          <div className="room-field">
            <ActiveCard />
          </div>
        </main>
      )}
    </>
  );
}
