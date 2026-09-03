import { MANIFEST, getManifestEntry, type CardId } from "../manifest";

/**
 * Explorer catalogue (HJ-696): the single declaration of showcase-demo
 * topology across 4 top-level categories:
 * - System & Display (/system)
 * - Shell & Navigation (/shell)
 * - Editor & Runtimes (/editor)
 * - Git & Agents (/agents)
 *
 * Route identity, display word, and lazy demo resolution are owned here.
 */

export type CategoryId = "system" | "shell" | "editor" | "agents";

/** Backward compatibility alias for legacy room types */
export type RoomId = CategoryId;

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  route: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: "system", label: "System & Display", route: "/system" },
  { id: "shell", label: "Shell & Navigation", route: "/shell" },
  { id: "editor", label: "Editor & Runtimes", route: "/editor" },
  { id: "agents", label: "Git & Agents", route: "/agents" },
] as const;

export interface CatalogueEntry {
  id: CardId;
  category: CategoryId;
  /** Canonical route identity with card anchor, e.g. "/shell#starship". */
  route: string;
  /** Display word used in navigation / identity. */
  word: string;
  /**
   * Lazy demo resolution: true => on-demand chunk (React.lazy);
   * false => eager (wake path). Starship is eager so first paint
   * never waits on a chunk (PERF-03).
   */
  lazy: boolean;
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  // System & Display
  { id: "hyprland", category: "system", route: "/system#hyprland", word: "hyprland", lazy: true },
  { id: "ghostty", category: "system", route: "/system#ghostty", word: "ghostty", lazy: true },
  { id: "ghostty-terminal", category: "system", route: "/system#ghostty-terminal", word: "terminal", lazy: true },
  { id: "btop", category: "system", route: "/system#btop", word: "btop", lazy: true },
  { id: "packages", category: "system", route: "/system#packages", word: "packages", lazy: true },
  { id: "dots", category: "system", route: "/system#dots", word: "dots", lazy: true },

  // Shell & Navigation
  { id: "starship", category: "shell", route: "/shell#starship", word: "starship", lazy: false },
  { id: "recolor", category: "shell", route: "/shell#recolor", word: "recolor", lazy: true },
  { id: "fuzzy", category: "shell", route: "/shell#fuzzy", word: "fuzzy", lazy: true },
  { id: "ripgrep", category: "shell", route: "/shell#ripgrep", word: "ripgrep", lazy: true },

  // Editor & Runtimes
  { id: "neovim", category: "editor", route: "/editor#neovim", word: "neovim", lazy: true },
  { id: "mise", category: "editor", route: "/editor#mise", word: "mise", lazy: true },

  // Git & Agents
  { id: "git-safety", category: "agents", route: "/agents#git-safety", word: "git safety", lazy: true },
  { id: "lazygit", category: "agents", route: "/agents#lazygit", word: "lazygit", lazy: true },
  { id: "herdr", category: "agents", route: "/agents#herdr", word: "herdr", lazy: true },
] as const satisfies readonly CatalogueEntry[];

export const ABSORBED_DEMOS: readonly CardId[] = [];

export function getCatalogueEntry(id: CardId): CatalogueEntry | undefined {
  return CATALOGUE.find((entry) => entry.id === id);
}

export function categoriesInOrder(): readonly CategoryMeta[] {
  return CATEGORIES;
}

export function categoryIds(): CategoryId[] {
  return CATEGORIES.map((cat) => cat.id);
}

export function cardsForCategory(category: CategoryId): CatalogueEntry[] {
  return CATALOGUE.filter((entry) => entry.category === category);
}

export function getCategoryForCard(id: CardId): CategoryId | undefined {
  return getCatalogueEntry(id)?.category;
}

export function isCard(id: string): id is CardId {
  return CATALOGUE.some((entry) => entry.id === id);
}

/** Canonical route for a card, e.g. "/shell#starship". */
export function cardPath(id: CardId): string {
  const entry = getCatalogueEntry(id);
  return entry ? entry.route : `/#${id}`;
}

/** Legacy receipt path alias for backwards compatibility */
export function receiptPath(id: CardId): string {
  return cardPath(id);
}

/**
 * Admission check: every catalogue demo must have manifest
 * provenance, and every manifest demo must be reachable through
 * the catalogue.
 */
export function catalogueAdmissionErrors(): string[] {
  const errors: string[] = [];

  const catalogueIds = new Set(CATALOGUE.map((entry) => entry.id));
  if (catalogueIds.size !== CATALOGUE.length) {
    errors.push("catalogue declares duplicate demo ids");
  }

  for (const entry of CATALOGUE) {
    const manifest = getManifestEntry(entry.id);
    if (!manifest) {
      errors.push(`catalogue demo "${entry.id}" has no manifest provenance (orphaned)`);
    }
    const expectedRoute = `/${entry.category}#${entry.id}`;
    if (entry.route !== expectedRoute) {
      errors.push(`demo "${entry.id}" route "${entry.route}" does not match expected "${expectedRoute}"`);
    }
  }

  for (const entry of MANIFEST) {
    if (catalogueIds.has(entry.id)) continue;
    if (ABSORBED_DEMOS.includes(entry.id)) continue;
    errors.push(`manifest demo "${entry.id}" is not reachable through the catalogue`);
  }

  return errors;
}