import { MANIFEST, type CardId, type ManifestEntry } from "../manifest";
import { SEARCH_INDEX, type SearchIndexEntry } from "../../server/lib/searchIndex";
import { CATALOGUE, type CatalogueEntry, type CategoryId } from "./catalogue";

/**
 * Palette index (HJ-725): the single flat list `searchPalette` (paletteSearch.ts)
 * ranks against. Assembled from two already-generated, already-committed
 * sources — never fetched, never read from disk here:
 *
 * - `CATALOGUE`/`MANIFEST` (HJ-696): the 18 showcase demos.
 * - `SEARCH_INDEX` (HJ-719, `server/lib/searchIndex.ts`): the visitor's real
 *   configuration content, extracted from the bundled fallback snapshots.
 *
 * Both inputs are injectable so tests can build an index from a small fixture
 * catalogue/manifest/search-index instead of the real (large) generated data.
 */

export interface DemoPaletteEntry {
  kind: "demo";
  demoId: CardId;
  category: CategoryId;
  route: string;
  /** Manifest title, e.g. "Starship Prompt". */
  label: string;
  blurb: string;
}

export interface ConfigPaletteEntry {
  kind: "config";
  demoId: CardId;
  category: CategoryId;
  /** Route of the showcase demo that renders this configuration. */
  route: string;
  /** Live host path the setting is read from, e.g. "~/.config/starship.toml". */
  configPath: string;
  /** Setting key (section-qualified where the format has structure). */
  key: string;
  /** Setting value as it appears in the fallback snapshot. */
  value: string;
}

export type PaletteEntry = DemoPaletteEntry | ConfigPaletteEntry;

/**
 * Builds the flat palette index. Config entries whose `demoId` is not (or no
 * longer) reachable through the catalogue are dropped — a search hit is
 * useless if there is nowhere for it to navigate to.
 */
export function buildPaletteIndex(
  catalogue: readonly CatalogueEntry[] = CATALOGUE,
  manifest: readonly ManifestEntry[] = MANIFEST,
  searchIndex: readonly SearchIndexEntry[] = SEARCH_INDEX,
): PaletteEntry[] {
  const manifestById = new Map(manifest.map((entry) => [entry.id, entry]));
  const catalogueById = new Map(catalogue.map((entry) => [entry.id, entry]));

  const demoEntries: DemoPaletteEntry[] = catalogue.map((entry) => ({
    kind: "demo",
    demoId: entry.id,
    category: entry.category,
    route: entry.route,
    label: manifestById.get(entry.id)?.title ?? entry.word,
    blurb: manifestById.get(entry.id)?.blurb ?? "",
  }));

  const configEntries: ConfigPaletteEntry[] = [];
  for (const setting of searchIndex) {
    const catalogueEntry = catalogueById.get(setting.demoId as CardId);
    if (!catalogueEntry) continue; // orphaned: nowhere to navigate to
    configEntries.push({
      kind: "config",
      demoId: catalogueEntry.id,
      category: catalogueEntry.category,
      route: catalogueEntry.route,
      configPath: setting.configPath,
      key: setting.key,
      value: setting.value,
    });
  }

  return [...demoEntries, ...configEntries];
}
