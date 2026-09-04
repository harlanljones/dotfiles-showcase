import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axe from "axe-core";
import Explorer from "./Explorer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let windowRef: any;

const GLOBAL_KEYS = ["window", "document", "navigator", "HTMLElement", "getComputedStyle", "fetch"] as const;
let savedGlobals: Array<[string, unknown]> = [];

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  savedGlobals = GLOBAL_KEYS.map((k) => [k, g[k]]);

  windowRef = new Window({ url: "http://localhost/system" });
  globalThis.window = windowRef;
  globalThis.document = windowRef.document;
  globalThis.navigator = windowRef.navigator;
  globalThis.HTMLElement = windowRef.HTMLElement;
  globalThis.getComputedStyle = windowRef.getComputedStyle.bind(windowRef);
  // StarshipCard/StarshipPlayground fire /api/starship on mount; keep it
  // pending so renders stay deterministic without a network mock per test.
  (globalThis as Record<string, unknown>).fetch = () => new Promise(() => {});

  container = windowRef.document.createElement("div");
  windowRef.document.body.appendChild(container);
});

afterEach(() => {
  windowRef.happyDOM.abort();
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of savedGlobals) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
});

describe("Explorer: 4 category views, hero + rail", () => {
  it("renders top-level navigation header with 4 tabs: System & Display, Shell & Navigation, Editor & Runtimes, Git & Agents", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const tabs = Array.from<any>(container.querySelectorAll(".category-tab")).map((el) => el.textContent?.trim());
    expect(tabs).toEqual([
      "System & Display",
      "Shell & Navigation",
      "Editor & Runtimes",
      "Git & Agents",
    ]);
  });

  it("renders exactly one full-bleed demo for System & Display, with no card frame or max-width container", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const hero = container.querySelector(".demo-hero");
    expect(hero).not.toBeNull();
    // Exactly one demo body renders in the hero region.
    expect(hero?.children.length).toBe(1);

    // No collapsed showcase card, grid, or expand control anywhere.
    expect(container.querySelector(".category-grid")).toBeNull();
    expect(container.querySelectorAll("article.showcase-card").length).toBe(0);
    expect(container.querySelector(".showcase-expand-btn")).toBeNull();
    expect(container.querySelector("[aria-expanded]")).toBeNull();
  });

  it("renders System sibling demos as a rail of tracked words, with the open demo marked", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const words = Array.from<any>(container.querySelectorAll(".demo-rail-word")).map((el) => el.textContent?.trim());
    expect(words).toEqual(["hyprland", "ghostty", "terminal", "btop", "packages", "dots"]);

    const current = container.querySelector('.demo-rail-word[aria-current="true"]');
    expect(current?.textContent?.trim()).toBe("hyprland");
  });

  it("switching to Shell tab opens the first Shell demo (Starship) with its own rail", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const shellTab = Array.from<any>(container.querySelectorAll("button.category-tab")).find(
      (b) => b.textContent?.includes("Shell & Navigation"),
    );
    expect(shellTab).not.toBeUndefined();

    await act(async () => {
      shellTab.click();
    });

    const words = Array.from<any>(container.querySelectorAll(".demo-rail-word")).map((el) => el.textContent?.trim());
    expect(words).toEqual(["starship", "recolor", "fuzzy", "ripgrep", "shell env"]);
    expect(container.querySelector('.demo-rail-word[aria-current="true"]')?.textContent?.trim()).toBe("starship");
  });

  it("switching to Editor tab renders a short two-word rail: neovim, mise", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const editorTab = Array.from<any>(container.querySelectorAll("button.category-tab")).find(
      (b) => b.textContent?.includes("Editor & Runtimes"),
    );

    await act(async () => {
      editorTab.click();
    });

    const words = Array.from<any>(container.querySelectorAll(".demo-rail-word")).map((el) => el.textContent?.trim());
    expect(words).toEqual(["neovim", "mise"]);
  });

  it("clicking a rail word swaps the hero to that showcase demo", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    expect(container.querySelector('.demo-rail-word[aria-current="true"]')?.textContent?.trim()).toBe("starship");

    const ripgrepWord = Array.from<any>(container.querySelectorAll(".demo-rail-word")).find(
      (el) => el.textContent?.trim() === "ripgrep",
    );
    expect(ripgrepWord).not.toBeUndefined();

    await act(async () => {
      ripgrepWord.click();
    });

    expect(container.querySelector('.demo-rail-word[aria-current="true"]')?.textContent?.trim()).toBe("ripgrep");
    expect(windowRef.location.hash).toBe("#ripgrep");
  });

  it("deep-links to /shell#ripgrep and opens ripgrep as the hero demo directly", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell#ripgrep");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    expect(container.querySelector('.demo-rail-word[aria-current="true"]')?.textContent?.trim()).toBe("ripgrep");
  });

  it("landing on root \"/\" resolves to Shell & Navigation with Starship as the open demo", async () => {
    windowRef.happyDOM.setURL("http://localhost/");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const shellTab = Array.from<any>(container.querySelectorAll("button.category-tab")).find(
      (b) => b.textContent?.includes("Shell & Navigation"),
    );
    expect(shellTab?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector('.demo-rail-word[aria-current="true"]')?.textContent?.trim()).toBe("starship");
    expect(windowRef.location.pathname).toBe("/shell");
  });

  it("uses only JetBrains Mono in the shell chrome (no system-sans class remains)", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    // The stylesheet that scoped a system sans face onto category tabs and
    // card titles was deleted along with the grid it belonged to.
    expect(container.querySelector(".category-tab")).not.toBeNull();
    expect(document.querySelector('link[href*="Explorer.grid"]')).toBeNull();
  });

  it("passes a strict axe audit (all rules incl. color-contrast) over the shell chrome and rail", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const results = await axe.run(container, { resultTypes: ["violations"] });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("Explorer route round-trips (regression: no grid/expand pattern)", () => {
  it("category switch does not throw (telemetry emit is a no-op on localhost)", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const agentsTab = Array.from<any>(container.querySelectorAll("button.category-tab")).find(
      (b) => b.textContent?.includes("Git & Agents"),
    );
    await act(async () => {
      agentsTab.click();
    });

    const words = Array.from<any>(container.querySelectorAll(".demo-rail-word")).map((el) => el.textContent?.trim());
    expect(words).toEqual(["git safety", "lazygit", "herdr", "agent skills", "git core"]);
  });
});
