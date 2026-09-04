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

beforeEach(() => {
  windowRef = new Window({ url: "http://localhost/system" });
  globalThis.window = windowRef;
  globalThis.document = windowRef.document;
  globalThis.navigator = windowRef.navigator;
  globalThis.HTMLElement = windowRef.HTMLElement;

  container = windowRef.document.createElement("div");
  windowRef.document.body.appendChild(container);
});

afterEach(() => {
  windowRef.happyDOM.abort();
});

describe("Explorer: 4 category views & responsive card grid", () => {
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

  it("renders System category cards in responsive grid: Hyprland, Omarchy Palette, Ghostty Terminal, System Monitor, Packages, Dots CLI", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const grid = container.querySelector(".category-grid");
    expect(grid).not.toBeNull();

    const cardIds = Array.from<any>(container.querySelectorAll("article.showcase-card")).map(
      (el) => el.getAttribute("data-card"),
    );
    expect(cardIds).toEqual(["hyprland", "ghostty", "ghostty-terminal", "btop", "packages", "dots"]);
  });

  it("switching to Shell tab renders Shell cards: Starship, Failure Recolor, Fuzzy Tools, ripgrep, Shell Env", async () => {
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

    const cardIds = Array.from<any>(container.querySelectorAll("article.showcase-card")).map(
      (el) => el.getAttribute("data-card"),
    );
    expect(cardIds).toEqual(["starship", "recolor", "fuzzy", "ripgrep", "shell-env"]);
  });

  it("switching to Editor tab renders Editor cards: Neovim, mise", async () => {
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

    const cardIds = Array.from<any>(container.querySelectorAll("article.showcase-card")).map(
      (el) => el.getAttribute("data-card"),
    );
    expect(cardIds).toEqual(["neovim", "mise"]);
  });

  it("switching to Git & Agents tab renders Git & Agents cards: Git Safety, lazygit, Herdr, Agent Skills, Git Core", async () => {
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

    const cardIds = Array.from<any>(container.querySelectorAll("article.showcase-card")).map(
      (el) => el.getAttribute("data-card"),
    );
    expect(cardIds).toEqual(["git-safety", "lazygit", "herdr", "agent-skills", "git-core"]);
  });

  it("deep-links to /shell#starship and expands starship card", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell#starship");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const starshipCard = container.querySelector('article[data-card="starship"]');
    expect(starshipCard).not.toBeNull();
    expect(starshipCard?.classList.contains("showcase-card-expanded")).toBe(true);

    const body = container.querySelector("#card-detail-starship");
    expect(body).not.toBeNull();
  });

  it("supports inline card expansion and collapsing via toggle button", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const starshipCard = container.querySelector('article[data-card="starship"]');
    expect(starshipCard?.classList.contains("showcase-card-collapsed")).toBe(true);

    const expandBtn = starshipCard?.querySelector(".showcase-expand-btn") as HTMLButtonElement;
    expect(expandBtn.textContent).toContain("expand");

    await act(async () => {
      expandBtn.click();
    });

    expect(starshipCard?.classList.contains("showcase-card-expanded")).toBe(true);
    expect(expandBtn.textContent).toContain("collapse");
    expect(container.querySelector("#card-detail-starship")).not.toBeNull();

    // Collapse it
    await act(async () => {
      expandBtn.click();
    });

    expect(starshipCard?.classList.contains("showcase-card-collapsed")).toBe(true);
    expect(container.querySelector("#card-detail-starship")).toBeNull();
  });
});

/**
 * HJ-715 wave 1: pager status line, less-idiom keys, scroll escalation,
 * `/` palette, and first-view performance tracking.
 *
 * The page-arithmetic core lives in src/lib/pager.test.ts (pure, injected
 * heights); these tests assert the Explorer wiring: which demo is current,
 * what the status line says, where a key press lands, and what the session
 * remembers. sessionStorage is wired per-test (happy-dom isolates it per
 * window) and restored afterwards so no other suite observes it.
 */
function wireSessionStorage() {
  const g = globalThis as Record<string, unknown>;
  const prev = g["sessionStorage"];
  g["sessionStorage"] = windowRef.sessionStorage;
  return () => {
    if (prev === undefined) delete g["sessionStorage"];
    else g["sessionStorage"] = prev;
  };
}

function keydown(key: string) {
  return new windowRef.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
}

describe("Explorer pager: status line and keys", () => {
  it("shows an idle line naming the catalogue size when no demo is open", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const status = container.querySelector(".pager-status");
    expect(status).not.toBeNull();
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.textContent).toContain("6 demos");
    expect(status?.textContent).toContain("/ search");
  });

  it("shows demo, position and key hints once a demo is open", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell#starship");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const status = container.querySelector(".pager-status");
    expect(status?.textContent).toContain("starship");
    expect(status?.textContent).toContain("1/1");
    expect(status?.textContent).toContain("j/k");
    expect(status?.textContent).toContain("/ search");
  });

  it("j/k page without writing history; h/l walk siblings between demos", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell#starship");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });
    const before = windowRef.location.href;

    await act(async () => {
      windowRef.dispatchEvent(keydown("j"));
    });
    expect(windowRef.location.href).toBe(before);
    expect(container.querySelector(".pager-status")?.textContent).toContain("starship");

    await act(async () => {
      windowRef.dispatchEvent(keydown("k"));
    });
    expect(windowRef.location.href).toBe(before);

    // l walks forward to the next sibling demo (back moves between demos).
    await act(async () => {
      windowRef.dispatchEvent(keydown("l"));
    });
    expect(windowRef.location.hash).toBe("#recolor");
    expect(
      container
        .querySelector('article[data-card="recolor"]')
        ?.classList.contains("showcase-card-expanded"),
    ).toBe(true);

    await act(async () => {
      windowRef.dispatchEvent(keydown("h"));
    });
    expect(windowRef.location.hash).toBe("#starship");
  });

  it("ignores pager keys while typing in a field", async () => {
    windowRef.happyDOM.setURL("http://localhost/shell#starship");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    const probe = windowRef.document.createElement("input");
    container.appendChild(probe);
    await act(async () => {
      probe.dispatchEvent(keydown("l"));
    });
    // Still on starship: the keystroke belonged to the input, not the pager.
    expect(windowRef.location.hash).toBe("#starship");
  });
});

describe("Explorer pager: scroll hint → yield → remember", () => {
  it("first scroll intent flashes a hint; continued intent yields and remembers", async () => {
    const restore = wireSessionStorage();
    try {
      windowRef.happyDOM.setURL("http://localhost/shell#starship");
      const root = createRoot(container);
      await act(async () => {
        root.render(<Explorer />);
      });

      const field = container.querySelector("main.field");
      expect(field?.getAttribute("data-pager")).toBe("paged");

      await act(async () => {
        field.dispatchEvent(new windowRef.Event("wheel", { bubbles: true, cancelable: true }));
      });
      const status = container.querySelector(".pager-status");
      expect(status?.getAttribute("data-hint")).toBe("true");
      expect(status?.textContent).toContain("scroll again for native scrolling");
      expect(field?.getAttribute("data-pager")).toBe("paged");

      await act(async () => {
        field.dispatchEvent(new windowRef.Event("wheel", { bubbles: true, cancelable: true }));
      });
      expect(container.querySelector(".pager-status")?.textContent).toContain("native scroll");
      expect(field?.getAttribute("data-pager")).toBe("native");
      expect(windowRef.sessionStorage.getItem("pager-mode")).toBe("native");
    } finally {
      restore();
    }
  });

  it("a remembered native yield survives a fresh mount", async () => {
    const restore = wireSessionStorage();
    try {
      windowRef.sessionStorage.setItem("pager-mode", "native");
      windowRef.happyDOM.setURL("http://localhost/shell#starship");
      const root = createRoot(container);
      await act(async () => {
        root.render(<Explorer />);
      });
      expect(container.querySelector("main.field")?.getAttribute("data-pager")).toBe("native");
      expect(container.querySelector(".pager-status")?.textContent).toContain("native scroll");
    } finally {
      restore();
    }
  });
});

describe("Explorer palette: / key, visible control, demo + config search", () => {
  it("opens on / and on the visible search control, and closes on Escape", async () => {
    windowRef.happyDOM.setURL("http://localhost/system");
    const root = createRoot(container);
    await act(async () => {
      root.render(<Explorer />);
    });

    // Visible control: the only route to the palette on touch.
    const control = container.querySelector(".chrome-search");
    expect(control).not.toBeNull();
    await act(async () => {
      control.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      windowRef.dispatchEvent(keydown("Escape"));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      windowRef.dispatchEvent(keydown("/"));
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("palette searches demo names and selects the demo that renders a hit", async () => {
    // NOTE: React 19 feature-detects "input"-event support once at module
    // load (before these happy-dom globals exist), so synthetic "input"
    // events never reach onChange here — live typing is covered by the pure
    // search module suite (src/lib/search.test.ts). This test drives the
    // same component and corpus the Explorer builds, with a seeded query.
    const { CATALOGUE } = await import("../lib/catalogue");
    const { getManifestEntry } = await import("../manifest");
    const { default: Palette } = await import("./Palette");
    const demoRefs = CATALOGUE.map((entry) => ({
      id: entry.id,
      word: entry.word,
      title: getManifestEntry(entry.id)?.title ?? entry.word,
      route: entry.route,
    }));
    const selected: string[] = [];
    let closed = 0;
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Palette
          demos={demoRefs}
          initialQuery="star"
          onSelect={(id) => selected.push(id)}
          onClose={() => {
            closed += 1;
          }}
        />,
      );
    });

    const hits = Array.from(container.querySelectorAll(".palette-hit")) as HTMLElement[];
    expect(hits.length).toBeGreaterThan(0);
    // Exact demo-name hit ranks first.
    expect(hits[0].textContent).toContain("Starship Prompt");

    await act(async () => {
      (hits[0] as HTMLButtonElement).click();
    });
    expect(selected).toEqual(["starship"]);

    // Escape closes the palette.
    const input = container.querySelector(".palette-input");
    await act(async () => {
      input.dispatchEvent(keydown("Escape"));
    });
    expect(closed).toBe(1);
  });
});

describe("Explorer performance: first view performs, revisits are instant", () => {
  it("marks the first-view demo performing and remembers it for the session", async () => {
    const restore = wireSessionStorage();
    try {
      windowRef.happyDOM.setURL("http://localhost/shell#starship");
      const root = createRoot(container);
      await act(async () => {
        root.render(<Explorer />);
      });

      expect(
        container.querySelector('article[data-card="starship"]')?.getAttribute("data-performing"),
      ).toBe("true");
      expect(windowRef.sessionStorage.getItem("seen-demos")).toContain("starship");

      // A later visit in the same session renders instantly.
      await act(async () => {
        root.unmount();
      });
      const again = createRoot(container);
      await act(async () => {
        again.render(<Explorer />);
      });
      expect(container.querySelector('[data-performing="true"]')).toBeNull();
    } finally {
      restore();
    }
  });

  it("never performs under prefers-reduced-motion", async () => {
    const restore = wireSessionStorage();
    const prevMatch = windowRef.matchMedia;
    windowRef.matchMedia = (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    try {
      windowRef.happyDOM.setURL("http://localhost/shell#starship");
      const root = createRoot(container);
      await act(async () => {
        root.render(<Explorer />);
      });
      // Paging still works: the demo is open and the status line reports it.
      expect(container.querySelector("#card-detail-starship")).not.toBeNull();
      expect(container.querySelector('[data-performing="true"]')).toBeNull();
      expect(container.querySelector(".pager-status")?.textContent).toContain("starship");
    } finally {
      windowRef.matchMedia = prevMatch;
      restore();
    }
  });
});

describe("Explorer shell: strict axe audit over new chrome", () => {
  it("passes with zero violations over header, status line and open palette", async () => {
    const g = globalThis as Record<string, unknown>;
    const prevGCS = g["getComputedStyle"];
    const prevFetch = g["fetch"];
    g["getComputedStyle"] = windowRef.getComputedStyle.bind(windowRef);
    g["fetch"] = () => new Promise(() => {});
    try {
      windowRef.happyDOM.setURL("http://localhost/shell#starship");
      const root = createRoot(container);
      await act(async () => {
        root.render(<Explorer />);
      });
      await act(async () => {
        windowRef.dispatchEvent(keydown("/"));
      });
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();

      const results = await axe.run(container, { resultTypes: ["violations"] });
      expect(results.violations.map((v) => v.id)).toEqual([]);
    } finally {
      if (prevGCS === undefined) delete g["getComputedStyle"];
      else g["getComputedStyle"] = prevGCS;
      if (prevFetch === undefined) delete g["fetch"];
      else g["fetch"] = prevFetch;
    }
  });
});
