import { describe, expect, it } from "bun:test";
import { MANIFEST, getManifestEntry } from "../manifest";
import {
  CATEGORIES,
  CATALOGUE,
  categoriesInOrder,
  categoryIds,
  cardsForCategory,
  getCatalogueEntry,
  getCategoryForCard,
  isCard,
  cardPath,
  receiptPath,
  catalogueAdmissionErrors,
} from "./catalogue";

describe("Explorer catalogue: 4 category views", () => {
  it("declares exactly four categories in nav order", () => {
    expect(categoryIds()).toEqual(["system", "shell", "editor", "agents"]);
    expect(categoriesInOrder().map((c) => c.id)).toEqual(["system", "shell", "editor", "agents"]);
  });

  it("each category has the required tab label and route", () => {
    expect(CATEGORIES).toEqual([
      { id: "system", label: "System & Display", route: "/system" },
      { id: "shell", label: "Shell & Navigation", route: "/shell" },
      { id: "editor", label: "Editor & Runtimes", route: "/editor" },
      { id: "agents", label: "Git & Agents", route: "/agents" },
    ]);
  });
});

describe("Explorer catalogue: card migration into categories", () => {
  it("migrates System cards cleanly: Hyprland, Omarchy Palette, Ghostty Terminal, System Monitor, Packages, Dots CLI", () => {
    const cards = cardsForCategory("system");
    expect(cards.map((c) => c.id)).toEqual(["hyprland", "ghostty", "ghostty-terminal", "btop", "packages", "dots"]);
  });

  it("migrates Shell cards cleanly: Starship, Failure Recolor, Fuzzy Tools, ripgrep", () => {
    const cards = cardsForCategory("shell");
    expect(cards.map((c) => c.id)).toEqual(["starship", "recolor", "fuzzy", "ripgrep"]);
  });

  it("migrates Editor cards cleanly: Neovim, mise", () => {
    const cards = cardsForCategory("editor");
    expect(cards.map((c) => c.id)).toEqual(["neovim", "mise"]);
  });

  it("migrates Git & Agents cards cleanly: Git Safety, lazygit, Herdr", () => {
    const cards = cardsForCategory("agents");
    expect(cards.map((c) => c.id)).toEqual(["git-safety", "lazygit", "herdr"]);
  });

  it("starship is the only eager card (lazy = false) for fast wake paint", () => {
    const eager = CATALOGUE.filter((c) => !c.lazy);
    expect(eager.map((c) => c.id)).toEqual(["starship"]);
  });

  it("all other cards are lazy (lazy = true)", () => {
    const lazy = CATALOGUE.filter((c) => c.lazy);
    expect(lazy.length).toBe(14);
  });
});

describe("Explorer catalogue: accessors & deep-linking routes", () => {
  it("getCatalogueEntry returns entry for known ids", () => {
    expect(getCatalogueEntry("starship")?.route).toBe("/shell#starship");
    expect(getCatalogueEntry("hyprland")?.route).toBe("/system#hyprland");
    expect(getCatalogueEntry("neovim")?.route).toBe("/editor#neovim");
    expect(getCatalogueEntry("herdr")?.route).toBe("/agents#herdr");
  });

  it("returns undefined for unknown ids", () => {
    expect(getCatalogueEntry("nonexistent" as never)).toBeUndefined();
  });

  it("getCategoryForCard returns correct category", () => {
    expect(getCategoryForCard("hyprland")).toBe("system");
    expect(getCategoryForCard("starship")).toBe("shell");
    expect(getCategoryForCard("neovim")).toBe("editor");
    expect(getCategoryForCard("herdr")).toBe("agents");
  });

  it("isCard checks whether an id is a valid card", () => {
    expect(isCard("starship")).toBe(true);
    expect(isCard("hyprland")).toBe(true);
    expect(isCard("nonexistent")).toBe(false);
  });

  it("cardPath and receiptPath return the canonical /<category>#<cardId> route", () => {
    expect(cardPath("starship")).toBe("/shell#starship");
    expect(cardPath("hyprland")).toBe("/system#hyprland");
    expect(receiptPath("git-safety")).toBe("/agents#git-safety");
  });
});

describe("Explorer catalogue: admission invariant", () => {
  it("every catalogue demo has manifest provenance", () => {
    for (const entry of CATALOGUE) {
      expect(getManifestEntry(entry.id), `${entry.id} in manifest`).toBeDefined();
    }
  });

  it("every manifest demo is reachable through the catalogue", () => {
    const catalogueIds = new Set(CATALOGUE.map((e) => e.id));
    for (const entry of MANIFEST) {
      expect(catalogueIds.has(entry.id), `manifest card "${entry.id}" reachable`).toBe(true);
    }
  });

  it("catalogueAdmissionErrors returns zero errors for the shipped state", () => {
    expect(catalogueAdmissionErrors()).toEqual([]);
  });
});