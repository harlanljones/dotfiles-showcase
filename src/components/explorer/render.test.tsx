import { describe, expect, it, mock } from "bun:test";
import { renderToString } from "react-dom/server";

/**
 * Render-parity suite (IC-4 evidence): every Explorer card renders without
 * throwing for both `live` and `fallback` API shapes, and the rendered
 * provenance badge matches the served variant.
 */

// Controls what the mocked useJson returns for the next render.
let current: { data: unknown; error: string | null } = { data: null, error: null };

mock.module("../../lib/useApi", () => ({
  useJson: () => current,
  postJson: async () => {
    throw new Error("network disabled in render tests");
  },
}));

const { default: LazygitCard } = await import("./LazygitCard");
const { default: GhosttyPaletteCard } = await import("./GhosttyPaletteCard");
const { default: MiseCard } = await import("./MiseCard");
const { default: PackagesCard } = await import("./PackagesCard");
const { default: HyprlandCard } = await import("./HyprlandCard");
const { default: NeovimCard } = await import("./NeovimCard");
const { default: RipgrepCard } = await import("./RipgrepCard");
const { default: FuzzyToolsCard } = await import("./FuzzyToolsCard");
const { default: GitSafetyCard } = await import("./GitSafetyCard");
const { default: RecolorCard } = await import("./RecolorCard");
const { default: StarshipCard } = await import("./StarshipCard");

type Payload = Record<string, unknown>;

interface FetcherCase {
  name: string;
  component: React.ComponentType<{ onOpenPlayground?: () => void }>;
  live: Payload;
  fallback: Payload;
}

const FETCHERS: FetcherCase[] = [
  {
    name: "lazygit",
    component: LazygitCard,
    live: { source: "live", content: "customCommands:\n  - key: '<c-g>'\n" },
    fallback: { source: "fallback", content: "customCommands:\n" },
  },
  {
    name: "ghostty",
    component: GhosttyPaletteCard,
    live: {
      mainSource: "live",
      themeSource: "live",
      fontFamily: "JetBrainsMono Nerd Font",
      fontSize: 9,
      keybinds: ["shift+insert=paste_from_clipboard"],
      theme: { background: "#060912", foreground: "#959aa4", palette: { "0": "#0d0f16" } },
    },
    fallback: {
      mainSource: "fallback",
      themeSource: "fallback",
      fontFamily: "JetBrainsMono Nerd Font",
      fontSize: 9,
      keybinds: [],
      theme: { background: "#060912", foreground: "#959aa4", palette: {} },
    },
  },
  {
    name: "mise",
    component: MiseCard,
    live: { source: "live", tools: [["bun", "latest"]] },
    fallback: { source: "fallback", tools: [["node", "22"]] },
  },
  {
    name: "packages",
    component: PackagesCard,
    live: { brewSource: "live", formulae: ["age"], casks: [], pacmanSource: "live", pacman: ["age"] },
    fallback: {
      brewSource: "fallback",
      formulae: ["age"],
      casks: [],
      pacmanSource: "fallback",
      pacman: ["age"],
    },
  },
  {
    name: "hyprland",
    component: HyprlandCard,
    live: {
      source: "live",
      gdkScale: 1,
      monitors: [{ output: "DP-1", mode: "3440x1440", position: "0x0", scale: 1 }],
    },
    fallback: { source: "fallback", gdkScale: null, monitors: [] },
  },
  {
    name: "neovim",
    component: NeovimCard,
    live: {
      extrasSource: "live",
      lockSource: "live",
      extras: ["lang.typescript"],
      plugins: [["blink.cmp", "abc1234"]],
    },
    fallback: {
      extrasSource: "fallback",
      lockSource: "fallback",
      extras: [],
      plugins: [],
    },
  },
  {
    name: "ripgrep",
    component: RipgrepCard,
    live: { source: "live", flags: ["--smart-case"] },
    fallback: { source: "fallback", flags: ["--smart-case"] },
  },
];

/** Distinct provenance values declared by a payload's top-level source fields. */
function expectedBadges(payload: Payload): string[] {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(payload)) {
    if ((key === "source" || key.endsWith("Source")) && typeof value === "string") {
      out.add(value.toUpperCase());
    }
  }
  return [...out].sort();
}

function render(Card: React.ElementType): string {
  return renderToString(<Card onOpenPlayground={() => {}} />);
}

describe("explorer card render parity", () => {
  for (const { name, component, live, fallback } of FETCHERS) {
    it(`${name}: renders the live variant with matching badges`, () => {
      current = { data: live, error: null };
      const html = render(component);
      expect(html.length).toBeGreaterThan(100);
      for (const badge of expectedBadges(live)) {
        expect(html).toContain(badge);
      }
    });

    it(`${name}: renders the fallback variant with matching badges`, () => {
      current = { data: fallback, error: null };
      const html = render(component);
      expect(html.length).toBeGreaterThan(100);
      for (const badge of expectedBadges(fallback)) {
        expect(html).toContain(badge);
      }
    });

    it(`${name}: degrades gracefully to an error state`, () => {
      current = { data: null, error: "HTTP 500" };
      expect(() => render(component)).not.toThrow();
    });
  }

  it("static and simulated cards render without any fetched data", () => {
    for (const card of [StarshipCard, GitSafetyCard, RecolorCard, FuzzyToolsCard]) {
      current = { data: null, error: null };
      const html = render(card);
      expect(html.length).toBeGreaterThan(100);
    }
  });

  it("fuzzy card is labeled simulated", () => {
    const html = render(FuzzyToolsCard);
    expect(html).toContain("SIMULATED");
  });
});
