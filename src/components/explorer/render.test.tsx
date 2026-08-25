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
const { recolorSourceKind } = await import("./RecolorCard");
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

  it("recolor badge never claims LIVE while degraded (spec §5b/§6)", () => {
    // A degraded /api/starship response must render a FALLBACK badge, not LIVE,
    // so it never sits as "LIVE" above the "NOT a live render" banner.
    expect(recolorSourceKind("prompt", true)).toBe("fallback");
    expect(recolorSourceKind("prompt", false)).toBe("live");
    // Custom/preset mode is always a client-side simulation.
    expect(recolorSourceKind("custom", false)).toBe("simulated");
  });
});

describe("hyprland geometry fidelity", () => {
  it("keeps physical footprints flush (no phantom gap) and reports the physical bounding box", () => {
    // Matches fallback/hypr-monitors.lua: DP-1 3840x2160@60 at 0x0, DP-2
    // 2560x1440@240 at 3840x360 (flush after DP-1, vertically centered).
    current = {
      data: {
        source: "live",
        gdkScale: 1,
        monitors: [
          { output: "DP-1", mode: "3840x2160@60", position: "0x0", scale: 1.6 },
          { output: "DP-2", mode: "2560x1440@240", position: "3840x360", scale: 1.25 },
        ],
      },
      error: null,
    };
    const html = render(HyprlandCard);
    // React SSR may split text at expression boundaries with "<!-- -->".
    const text = html.replace(/<!--.*?-->/gs, "");
    expect(text).toContain("DP-1");
    expect(text).toContain("DP-2");
    expect(text).toContain("PRIMARY");
    // Physical union: maxX = 3840 + 2560 = 6400, maxY = max(2160, 360 + 1440) = 2160.
    expect(text).toContain("bounding box 6400×2160 physical");
  });
});
