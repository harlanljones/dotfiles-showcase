import { describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import axe from "axe-core";
import { FETCHERS } from "../src/components/explorer/fixtures";

/**
 * A11Y-01 (HJ-580): strict axe audit — ALL rules enabled, including
 * color-contrast — over every Explorer card in both live and fallback
 * variants (plus the error state). Zero violations allowed; dim chrome was
 * brightened in source rather than disabling rules (grill Q12).
 *
 * happy-dom's DOM types don't match lib.dom, so the window/container handles
 * are typed `any` at this boundary. Globals set for axe are snapshotted and
 * restored after EVERY test — bun test shares one process across files, and
 * a leaked `fetch` stub would poison unrelated suites.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDom = { window: any; container: any };

let current: { data: unknown; error: string | null } = { data: null, error: null };

mock.module("../src/lib/useApi", () => ({
  useJson: () => current,
  postJson: async () => {
    throw new Error("network disabled in axe tests");
  },
}));

const { default: LazygitCard } = await import("../src/components/explorer/LazygitCard");
const { default: GhosttyPaletteCard } = await import("../src/components/explorer/GhosttyPaletteCard");
const { default: MiseCard } = await import("../src/components/explorer/MiseCard");
const { default: PackagesCard } = await import("../src/components/explorer/PackagesCard");
const { default: HyprlandCard } = await import("../src/components/explorer/HyprlandCard");
const { default: NeovimCard } = await import("../src/components/explorer/NeovimCard");
const { default: RipgrepCard } = await import("../src/components/explorer/RipgrepCard");
const { default: FuzzyToolsCard } = await import("../src/components/explorer/FuzzyToolsCard");
const { default: GitSafetyCard } = await import("../src/components/explorer/GitSafetyCard");
const { default: RecolorCard } = await import("../src/components/explorer/RecolorCard");
const { default: StarshipCard } = await import("../src/components/explorer/StarshipCard");
const { default: DotsCliCard } = await import("../src/components/explorer/DotsCliCard");
const { default: HerdrCard } = await import("../src/components/explorer/HerdrCard");
const { default: GhosttyTerminalCard } = await import("../src/components/explorer/GhosttyTerminalCard");
const { default: BtopCard } = await import("../src/components/explorer/BtopCard");

const COMPONENTS: Record<string, React.ComponentType> = {
  dots: DotsCliCard,
  lazygit: LazygitCard,
  ghostty: GhosttyPaletteCard,
  "ghostty-terminal": GhosttyTerminalCard,
  btop: BtopCard,
  mise: MiseCard,
  packages: PackagesCard,
  hyprland: HyprlandCard,
  neovim: NeovimCard,
  ripgrep: RipgrepCard,
  herdr: HerdrCard,
  "git-safety": GitSafetyCard,
  fuzzy: FuzzyToolsCard,
  recolor: RecolorCard,
  starship: StarshipCard,
};

const STATIC_CARDS = ["git-safety", "fuzzy", "recolor", "starship"];

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeList",
  "getComputedStyle",
  "DOMParser",
  "CSSStyleDeclaration",
  "MutationObserver",
  "requestAnimationFrame",
  "fetch",
] as const;

let savedGlobals: Array<[string, unknown]> | null = null;

/** Fresh happy-dom window per case so card ids never collide across renders. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function freshDom(): AnyDom {
  const g = globalThis as Record<string, unknown>;
  if (!savedGlobals) savedGlobals = GLOBAL_KEYS.map((k) => [k, g[k]]);

  const window = new Window({ url: "http://localhost/" });
  g.window = window;
  g.document = window.document;
  g.navigator = window.navigator;
  g.HTMLElement = window.HTMLElement;
  g.HTMLInputElement = window.HTMLInputElement;
  g.HTMLSelectElement = window.HTMLSelectElement;
  g.Element = window.Element;
  g.Node = window.Node;
  g.NodeList = window.NodeList;
  g.getComputedStyle = window.getComputedStyle.bind(window);
  g.DOMParser = window.DOMParser;
  g.CSSStyleDeclaration = window.CSSStyleDeclaration;
  g.MutationObserver = window.MutationObserver;
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0);
  // StarshipPlayground fires /api/starship on mount; keep it pending so the
  // audit sees the deterministic "rendering" state.
  g.fetch = () => new Promise(() => {});
  return { window, container: window.document.createElement("div") };
}

function restoreDom(): void {
  if (!savedGlobals) return;
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of savedGlobals) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
}

interface AxeViolation {
  id: string;
  nodes: Array<{ target: unknown[] }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderForAxe(element: React.ReactElement): Promise<AnyDom> {
  const { window, container } = freshDom();
  window.document.body.appendChild(container);
  const root = createRoot(container);
  root.render(element);
  // Let React flush and axe's virtual DOM settle.
  await new Promise((resolve) => setTimeout(resolve, 25));
  return { window, container };
}

async function axeViolations(container: HTMLElement): Promise<AxeViolation[]> {
  const results = (await axe.run(container, { resultTypes: ["violations"] })) as {
    violations: AxeViolation[];
  };
  return results.violations;
}

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map((v) => `${v.id} (${v.nodes.length} node(s): ${v.nodes.map((n) => JSON.stringify(n.target)).join(", ")})`)
    .join("; ");
}

async function audit(name: string, variant: string): Promise<void> {
  try {
    if (variant === "static") {
      current = { data: null, error: null };
    } else {
      const payload = FETCHERS.find((f) => f.name === name)!;
      current = variant === "error" ? { data: null, error: "HTTP 500" } : { data: variant === "live" ? payload.live : payload.fallback, error: null };
    }
    const Card = COMPONENTS[name];
    const { window, container } = await renderForAxe(createElement(Card));
    const violations = await axeViolations(container);
    expect(formatViolations(violations)).toBe("");
    window.happyDOM.abort();
  } finally {
    restoreDom();
  }
}

describe("axe strict audit (all rules incl. color-contrast)", () => {
  for (const { name } of FETCHERS) {
    for (const variant of ["live", "fallback", "error"] as const) {
      it(`${name} [${variant}]`, async () => {
        await audit(name, variant);
      }, 15000);
    }
  }

  for (const name of STATIC_CARDS) {
    it(`${name} [static]`, async () => {
      await audit(name, "static");
    }, 15000);
  }
});
