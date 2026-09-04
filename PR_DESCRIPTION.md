# HJ-719: Config search index generator with deploy drift check

## Summary

The upcoming palette (HJ-725) needs to search the visitor's real configuration content, but the
Workers mirror has no filesystem — it can only read what's embedded at build time. This adds a
generator that walks the same bundled fallback snapshots (`fallback/*`) that already back the
mirror's config reads (CFG-01), extracts setting keys/values with a format-aware parser, and
emits a committed TS module (`server/lib/searchIndex.ts`) that both the Bun host and the
filesystem-less Workers mirror can import — the same embedding strategy already used for
`server/lib/fallbacks.ts`. A `--check` mode regenerates the index in memory and diffs it against
the committed file, hard-failing (non-zero exit) on drift, and is wired into the deploy gate
right next to the existing fallback integrity check it mirrors.

## Changes

- `scripts/generate-search-index.ts` (new) — the generator. Walks `src/manifest.ts`'s
  `MANIFEST` (each demo's declared `sources: { livePath, fallbackFile }[]`), reads the
  corresponding `fallback/*` snapshot, and extracts settings via a small per-format-family
  dispatcher (`extractSettings`): JSON leaf-walk, INI/TOML `[section]` + `key = value`, YAML-ish
  `key: value`, Lua table-literal `key = value` pairs, Brewfile `brew "x"` DSL lines, flat
  package-list lines (`pacman.txt`), CLI-flag lines (`ripgrep-rc`), and top-level bash function
  names (`dots`). Exports `generate()` (injectable `repoRoot`/`manifest`/`identity`/`checkOnly`
  for tests, mirroring `refresh()` in `scripts/refresh-fallbacks.ts`) and a `main()` CLI entry
  reading `--check` off `process.argv`.
- `server/lib/searchIndex.ts` (new, generated/committed) — `SEARCH_INDEX: SearchIndexEntry[]`,
  1,933 entries. Each entry carries `demoId` (the `CardId`/Explorer card that renders it),
  `configPath` (the live host path from the manifest), `fallbackFile`, `key`, and `value`.
- `package.json` — adds `search-index:build` / `search-index:check` scripts, matching the
  `fallbacks:refresh` / `fallbacks:check` pair's naming.
- `.github/workflows/deploy.yml` — adds a "Search index integrity" step running
  `bun run search-index:check` immediately after the existing "Fallback integrity" step, before
  the build step. Same hard-fail semantics: CI fails if the committed index doesn't match a
  fresh regeneration.
- `tests/generateSearchIndex.test.ts` (new) — unit tests for every extractor, `buildIndex`,
  `buildIndexModule` (determinism), and integration tests for `generate()` against a temp
  sandbox: write mode, no-op SAME on a second run, **drift on a mutated fallback snapshot
  causing check mode to fail (STALE, non-zero-exit semantics, disk untouched)**, first-run
  CREATED-in-check-mode, and the secret-scan / host-literal hard-fail paths. A final pair of
  tests runs `generate({ checkOnly: true })` against the real repo to assert the committed index
  is currently in sync and free of host-identifying literals.

## Testing

- `bun test tests/generateSearchIndex.test.ts` — 23 pass, 0 fail.
- `bun test` (full suite) — 484 pass, 0 fail.
- `bun run typecheck` — clean.
- `bun run search-index:build` — generates `server/lib/searchIndex.ts` (1,933 entries),
  reports `SAME` on a repeat run (already committed).
- **Drift-check failure path, demonstrated against the real repo** (not just the fixture
  sandbox): appended a line to `fallback/mise.toml`, ran `bun run search-index:check` → exited 1
  with `STALE` and "search index stale — run `bun run search-index:build` to update."; restored
  the file, re-ran the same command → exited 0 with `SAME`.

## Notes

- Secret/host-literal guards are re-run on each raw fallback file's content as it's read for
  extraction (reusing `findSecretMatches`/`findHostLeaks` from `scripts/refresh-fallbacks.ts`),
  not just on the serialized index — a `key = secret` line gets split into separate JSON fields
  once extracted, which breaks the credential-pattern regexes if scanned post-serialization. In
  practice `fallback/*` is already sanitized by the refresh script, so this is defense-in-depth,
  but it's exercised directly by two tests (secret-scan and host-literal hard-fail).
- The extractors are per-format, not one generic parser — the 18 bundled fallback files split
  cleanly into ~8 real shapes (JSON, TOML/INI, YAML-ish, Lua, Brewfile DSL, flat package list,
  CLI flags, bash function names); a single generic parser would have been lossier for less
  code.
- Demos without `sources` (e.g. `recolor`, `git-safety`, `fuzzy` — not backed by a config file)
  contribute nothing to the index, by design.
- No timestamps or other non-deterministic content are embedded — the generator's output depends
  only on `src/manifest.ts` + `fallback/*` content, so `--check` never reports drift from a clean
  re-run.
- Out of scope here (this is HJ-725, blocked on this ticket): the palette UI itself — search box,
  keybinding, results rendering, and ranking/matching logic against `SEARCH_INDEX`. This ticket
  only produces the data source HJ-725 will consume.
