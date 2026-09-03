import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { act } from "react";
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

  it("switching to Git & Agents tab renders Git & Agents cards: Git Safety, lazygit, Herdr", async () => {
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
    expect(cardIds).toEqual(["git-safety", "lazygit", "herdr"]);
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
