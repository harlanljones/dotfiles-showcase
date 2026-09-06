import type { PaletteEntry } from "./paletteIndex";

/**
 * Palette matching and ranking (HJ-725, SEARCH-01 consumer).
 *
 * Pure by design: takes an already-built `PaletteEntry[]` index in, returns
 * ranked `PaletteResult[]` out. No fetching, no filesystem access, no
 * component state — every dependency is a function argument, so it is
 * tested against fixture indices without touching the real (generated)
 * catalogue/search index.
 */

export type MatchField = "label" | "blurb" | "key" | "value" | "configPath";

export interface PaletteResult {
  entry: PaletteEntry;
  score: number;
  /** Which field produced the winning (highest-scoring) match. */
  matchedOn: MatchField;
}

function labelOf(entry: PaletteEntry): string {
  return entry.kind === "demo" ? entry.label : entry.key;
}

/** One (field, weight) candidate to test the query against. */
interface Candidate {
  field: MatchField;
  text: string;
  /** Base weight for an `includes` match; exact/prefix matches score higher. */
  weight: number;
}

function candidatesFor(entry: PaletteEntry): Candidate[] {
  if (entry.kind === "demo") {
    return [
      { field: "label", text: entry.label, weight: 70 },
      { field: "blurb", text: entry.blurb, weight: 30 },
    ];
  }
  return [
    { field: "key", text: entry.key, weight: 55 },
    { field: "value", text: entry.value, weight: 40 },
    { field: "configPath", text: entry.configPath, weight: 25 },
  ];
}

/** Scores one candidate field against a lowercased, trimmed query. */
function scoreCandidate(candidate: Candidate, query: string): number | null {
  const text = candidate.text.toLowerCase();
  if (!text) return null;
  if (text === query) return candidate.weight + 30; // exact match
  if (text.startsWith(query)) return candidate.weight + 15; // prefix match
  const idx = text.indexOf(query);
  if (idx === -1) return null;
  // Word-boundary matches (start of a `.`/`-`/`_`/space-delimited segment,
  // as real config keys and demo words are shaped) rank above a mid-token hit.
  const boundary = idx === 0 || /[\s.\-_/]/.test(text[idx - 1]);
  return candidate.weight + (boundary ? 8 : 0);
}

/** Ranks every index entry against `query`. Empty/whitespace query yields no results. */
export function searchPalette(index: readonly PaletteEntry[], query: string, limit = 25): PaletteResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: PaletteResult[] = [];
  for (const entry of index) {
    let best: { field: MatchField; score: number } | null = null;
    for (const candidate of candidatesFor(entry)) {
      const score = scoreCandidate(candidate, q);
      if (score !== null && (best === null || score > best.score)) {
        best = { field: candidate.field, score };
      }
    }
    if (best) results.push({ entry, score: best.score, matchedOn: best.field });
  }

  results.sort((a, b) => b.score - a.score || labelOf(a.entry).localeCompare(labelOf(b.entry)));
  return results.slice(0, limit);
}
