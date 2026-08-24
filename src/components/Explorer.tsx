import { useState } from "react";
import { MANIFEST, type CardId } from "../manifest";
import FuzzyToolsCard from "./explorer/FuzzyToolsCard";
import GhosttyPaletteCard from "./explorer/GhosttyPaletteCard";
import GitSafetyCard from "./explorer/GitSafetyCard";
import HyprlandCard from "./explorer/HyprlandCard";
import LazygitCard from "./explorer/LazygitCard";
import MiseCard from "./explorer/MiseCard";
import NeovimCard from "./explorer/NeovimCard";
import PackagesCard from "./explorer/PackagesCard";
import RecolorCard from "./explorer/RecolorCard";
import RipgrepCard from "./explorer/RipgrepCard";
import StarshipCard from "./explorer/StarshipCard";

const CARDS: Record<CardId, React.ComponentType<{ onOpenPlayground: () => void }>> = {
  starship: StarshipCard,
  recolor: RecolorCard,
  "git-safety": GitSafetyCard,
  lazygit: LazygitCard,
  fuzzy: FuzzyToolsCard,
  ghostty: GhosttyPaletteCard,
  mise: MiseCard,
  packages: PackagesCard,
  hyprland: HyprlandCard,
  neovim: NeovimCard,
  ripgrep: RipgrepCard,
};

const KIND_DOT: Record<string, string> = {
  live: "bg-emerald-400",
  interactive: "bg-sky-400",
  static: "bg-slate-400",
  simulated: "bg-violet-400",
};

export default function Explorer({ onOpenPlayground }: { onOpenPlayground: () => void }) {
  const [active, setActive] = useState<CardId>("starship");
  const ActiveCard = CARDS[active];

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-60 lg:flex-col lg:overflow-visible">
        {MANIFEST.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setActive(entry.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active === entry.id
                ? "bg-white/10 font-medium text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[entry.kind]}`} />
            {entry.title}
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <ActiveCard onOpenPlayground={onOpenPlayground} />
      </div>
    </div>
  );
}
