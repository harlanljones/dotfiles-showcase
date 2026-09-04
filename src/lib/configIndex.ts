/**
 * Config-content half of the palette corpus (HJ-715 wave 1).
 *
 * WIRING POINT for HJ-719: that ticket generates `server/lib/searchIndex.ts`
 * (`SEARCH_INDEX: SearchIndexEntry[]`, committed, drift-checked in deploy).
 * When it lands, replace the empty array below with a re-export of the
 * generated artifact — the entry shape here is structurally identical, so
 * `src/lib/search.ts` and the palette need no other change. Until then the
 * palette degrades to demo-name search rather than failing.
 */
import type { ConfigIndexEntry } from "./search";

export type { ConfigIndexEntry };

export const CONFIG_INDEX: readonly ConfigIndexEntry[] = [];
