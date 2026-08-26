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

const CARDS: Record<CardId, React.ComponentType> = {
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

export default function Explorer() {
  const [active, setActive] = useState<CardId>("starship");
  const ActiveCard = CARDS[active];

  return (
    <div className="explorer-layout flex flex-col gap-6 lg:flex-row">
      <nav aria-label="Configuration topics" className="explorer-nav flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:w-64 lg:flex-col lg:overflow-visible lg:pb-0">
        {MANIFEST.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setActive(entry.id)}
            aria-current={active === entry.id ? "page" : undefined}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active === entry.id
                ? "active bg-white/10 font-medium text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white/80"
            }`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_DOT[entry.kind]}`} />
            <span className="min-w-0"><span className="block">{entry.title}</span><span className="hidden text-[11px] font-normal text-white/35 lg:block">{entry.kind} surface</span></span>
          </button>
        ))}
      </nav>

      <div className="explorer-content min-w-0 flex-1">
        <ActiveCard />
      </div>
    </div>
  );
}
