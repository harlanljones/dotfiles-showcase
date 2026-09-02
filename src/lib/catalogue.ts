import { MANIFEST, getManifestEntry, type CardId } from "../manifest";

/**
 * Explorer catalogue (HJ-678): the single declaration of showcase-demo
 * topology. Placement (primary room vs annex receipt), canonical route
 * identity, display word, and lazy demo resolution are owned here — the
 * Explorer derives its navigation and rendering choices from this module
 * instead of parallel tables. The manifest (src/manifest.ts) retains the
 * content and provenance metadata (title, kind, blurb, live/fallback
 * sources); catalogue membership AND manifest membership are both required
 * for admission.
 */

export type DemoPlacement = "room" | "annex";

export interface CatalogueEntry {
  id: CardId;
  placement: DemoPlacement;
  /** Canonical route identity: room path (e.g. "/prompt") or annex receipt path (e.g. "/annex#git-safety"). */
  route: string;
  /** Display word used in room navigation / receipt identity. */
  word: string;
  /**
   * Lazy demo resolution: true ⇒ the demo renders as an on-demand chunk
   * (React.lazy); false ⇒ eager (wake path). Starship is eager so the first
   * paint never waits on a chunk (PERF-03).
   */
  lazy: boolean;
}

export const CATALOGUE: readonly CatalogueEntry[] = [
  // Primary rooms — promotion is explicit: a demo lives here only when
  // intentionally promoted out of the annex.
  { id: "starship", placement: "room", route: "/prompt", word: "prompt", lazy: false },
  { id: "ghostty", placement: "room", route: "/palette", word: "palette", lazy: true },
  { id: "hyprland", placement: "room", route: "/desk", word: "desk", lazy: true },
  { id: "dots", placement: "room", route: "/dots", word: "dots", lazy: true },

  // Annex receipts — every new showcase demo lands here first.
  { id: "git-safety", placement: "annex", route: "/annex#git-safety", word: "git safety", lazy: true },
  { id: "lazygit", placement: "annex", route: "/annex#lazygit", word: "lazygit", lazy: true },
  { id: "fuzzy", placement: "annex", route: "/annex#fuzzy", word: "fuzzy", lazy: true },
  { id: "mise", placement: "annex", route: "/annex#mise", word: "mise", lazy: true },
  { id: "packages", placement: "annex", route: "/annex#packages", word: "packages", lazy: true },
  { id: "neovim", placement: "annex", route: "/annex#neovim", word: "neovim", lazy: true },
  { id: "ripgrep", placement: "annex", route: "/annex#ripgrep", word: "ripgrep", lazy: true },
] as const satisfies readonly CatalogueEntry[];

export type RoomId = "starship" | "ghostty" | "hyprland" | "dots";

/**
 * Manifest entries that render inside a primary room rather than as their
 * own demo. Declared so the admission invariant can exempt them explicitly
 * instead of silently ignoring a manifest demo.
 */
export const ABSORBED_DEMOS: readonly CardId[] = ["recolor"];

export function getCatalogueEntry(id: CardId): CatalogueEntry | undefined {
  return CATALOGUE.find((entry) => entry.id === id);
}

/** Catalogue entries in primary-room navigation order. */
export function roomsInOrder(): CatalogueEntry[] {
  return CATALOGUE.filter((entry) => entry.placement === "room");
}

/** Primary room ids in navigation order, typed as RoomId. */
export function roomIds(): RoomId[] {
  return roomsInOrder().map((entry) => entry.id as RoomId);
}

/** Catalogue entries in annex receipt order. */
export function annexInOrder(): CatalogueEntry[] {
  return CATALOGUE.filter((entry) => entry.placement === "annex");
}

export function isRoom(id: CardId): boolean {
  return getCatalogueEntry(id)?.placement === "room";
}

export function isAnnexDemo(id: CardId): boolean {
  return getCatalogueEntry(id)?.placement === "annex";
}

/** Canonical annex receipt path for a demo, e.g. "/annex#git-safety". */
export function receiptPath(id: CardId): string {
  return `/annex#${id}`;
}

/**
 * Admission check (user story 14): every catalogue demo must have manifest
 * provenance, and every applicable manifest demo must be reachable through
 * the catalogue (or explicitly absorbed into a room). Returns human-readable
 * violations, empty when the catalogue and manifest agree.
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
    if (entry.placement === "annex" && entry.route !== receiptPath(entry.id)) {
      errors.push(`annex demo "${entry.id}" route "${entry.route}" is not its receipt path`);
    }
  }

  for (const entry of MANIFEST) {
    if (catalogueIds.has(entry.id)) continue;
    if (ABSORBED_DEMOS.includes(entry.id)) continue;
    errors.push(`manifest demo "${entry.id}" is not reachable through the catalogue`);
  }

  for (const id of ABSORBED_DEMOS) {
    if (!getManifestEntry(id)) {
      errors.push(`absorbed demo "${id}" has no manifest provenance`);
    }
  }

  return errors;
}