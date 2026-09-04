/**
 * Config palette search (HJ-715 wave 1).
 *
 * Pure module: a corpus goes in, ranked results come out. No fetching, no
 * component state. The config half of the corpus is HJ-719's generated
 * artifact (`server/lib/searchIndex.ts`); the entry shape here is
 * structurally identical so the generated module can be passed straight in.
 */

export interface ConfigIndexEntry {
  /** Showcase demo (Explorer card) that renders this setting. */
  demoId: string;
  /** Live host path the setting is read from (never host-identifying). */
  configPath: string;
  /** Bundled fallback file the entry was extracted from. */
  fallbackFile: string;
  /** Setting key (section-qualified where the format has structure). */
  key: string;
  /** Setting value as it appears in the fallback snapshot. */
  value: string;
}

export interface DemoRef {
  id: string;
  word: string;
  title: string;
  route: string;
}

export interface SearchCorpus {
  demos: readonly DemoRef[];
  configs: readonly ConfigIndexEntry[];
}

export type SearchResult =
  | { kind: "demo"; demoId: string; label: string; detail: string; score: number }
  | { kind: "config"; demoId: string; label: string; detail: string; score: number };

const DEFAULT_LIMIT = 12;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Ranked matches for `query`: demo-name hits first (exact word/id, then
 * prefix, then substring over word/title), then configuration-content hits
 * (exact key, key prefix, key substring, value/config-path substring). Each
 * config hit carries the demo that renders it, so selecting it navigates to
 * an answer rather than a dead end.
 */
export function searchCorpus(corpus: SearchCorpus, query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const out: SearchResult[] = [];

  for (const demo of corpus.demos) {
    const word = norm(demo.word);
    const title = norm(demo.title);
    const id = norm(demo.id);
    let score: number | null = null;
    if (q === word || q === id) score = 0;
    else if (word.startsWith(q) || id.startsWith(q)) score = 1;
    else if (word.includes(q) || title.includes(q) || id.includes(q)) score = 2;
    if (score !== null) {
      out.push({ kind: "demo", demoId: demo.id, label: demo.title, detail: demo.route, score });
    }
  }

  for (const entry of corpus.configs) {
    const key = norm(entry.key);
    const value = norm(entry.value);
    const path = norm(entry.configPath);
    let score: number | null = null;
    if (q === key) score = 3;
    else if (key.startsWith(q)) score = 4;
    else if (key.includes(q)) score = 5;
    else if (value.includes(q) || path.includes(q)) score = 6;
    if (score !== null) {
      out.push({
        kind: "config",
        demoId: entry.demoId,
        label: entry.key,
        detail: `${entry.value} · ${entry.configPath}`,
        score,
      });
    }
  }

  out.sort((a, b) => (a.score === b.score ? a.label.localeCompare(b.label) : a.score - b.score));
  return out.slice(0, Math.max(0, limit));
}
