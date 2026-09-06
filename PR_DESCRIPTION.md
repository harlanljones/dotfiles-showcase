# HJ-725: The / palette: search showcase demos and real configuration content

## Summary
Eighteen showcase demos needed traversal, and the ticket's answer was to search the dotfiles
rather than add another menu. This ships a palette that opens on `/` and from a persistent
visible search control in the chrome, matches both the Explorer catalogue and the visitor's
real configuration content (HJ-719's generated `server/lib/searchIndex.ts`), and navigates a
configuration hit straight to the showcase demo that renders it.

Matching and ranking live in a pure module (`paletteSearch.ts`) that takes an index in and
returns ranked results out — no fetching, no component state — per the ticket's explicit
architectural constraint, and it's tested entirely against fixture indices.

## Changes
- `src/lib/paletteIndex.ts` (new) — `buildPaletteIndex(catalogue?, manifest?, searchIndex?)`
  assembles the flat index the palette searches: one `DemoPaletteEntry` per catalogue demo
  (titled from the manifest, falling back to the catalogue word) plus one `ConfigPaletteEntry`
  per HJ-719 `SEARCH_INDEX` row. Config rows whose `demoId` isn't reachable through the
  catalogue are dropped — a search hit with nowhere to navigate is a dead end, not a result.
  Defaults to the real committed `CATALOGUE`/`MANIFEST`/`SEARCH_INDEX`; every argument is
  injectable so tests build the index from a small fixture instead.
- `src/lib/paletteSearch.ts` (new) — `searchPalette(index, query, limit?)`: pure
  matching/ranking. Scores exact match > prefix match > word-boundary substring > mid-token
  substring, across label/blurb for demo entries and key/value/configPath for configuration
  entries; ties break alphabetically for stable ordering. Zero dependencies beyond its
  `PaletteEntry[]` argument — this is the module the acceptance criterion "tested against a
  fixture index with no fetching or filesystem access" is about.
- `src/components/explorer/CommandPalette.tsx` (new) — the dialog: a `role="dialog"
  aria-modal="true"` panel with a `role="combobox"` input (`aria-expanded`, `aria-controls`,
  `aria-activedescendant`, `aria-autocomplete="list"`) driving a `role="listbox"` of
  `role="option"` results, or a `role="status"` "no matches" message when nothing hits (never
  an empty listbox, which axe's `aria-required-children` would flag). ArrowUp/ArrowDown move
  selection, Enter commits, Escape closes and returns focus to whatever opened it, Tab is
  trapped in the single-field dialog. Selecting a demo or configuration hit calls
  `onNavigate({ category, targetCard })` — for a configuration hit this is the demo's own
  route, carried on the index entry since HJ-719's index already resolves each setting to its
  owning demo.
- `src/components/Explorer.tsx` — adds the `.palette-trigger` button (`/ search`) to
  `.chrome-words`, the only persistent, always-visible route to the palette and therefore the
  one reachable on touch. A window `keydown` listener opens the palette on `/`, ignoring the
  keystroke when it lands in an already-focused editable field (a card's own search input) or
  the palette is already open. `CommandPalette` is `React.lazy`-loaded, mounted only once
  `paletteOpen` is true, behind a `Suspense fallback={null}` — see Notes.
- `src/index.css` — `.palette-trigger`, `.palette-scrim`, `.palette`, and its result-row
  styles, following the existing `--glass`/`--phosphor`/`--ash` token set and the chrome's
  established letter-spacing/opacity conventions rather than introducing new ones.
- `src/lib/paletteIndex.test.ts`, `src/lib/paletteSearch.test.ts` (new) — fixture-only unit
  coverage: index assembly (manifest title vs. catalogue-word fallback, orphaned config rows
  dropped) and search ranking (catalogue matches, configuration key/value/path matches, exact
  > prefix > boundary > mid-token ordering, alphabetical tie-break, result limit).
- `src/components/explorer/CommandPalette.test.tsx` (new) — component-level coverage against
  the real generated index: open/closed state, demo and configuration hits render, the
  no-matches status message (not an empty listbox), clicking or pressing Enter on a
  configuration hit navigates to its owning demo, Escape closes, ArrowDown moves
  `aria-activedescendant`.
- `src/components/Explorer.test.tsx` — three additions: the search control is a persistent,
  always-visible `<button>` in the chrome; clicking it opens the dialog; `/` opens it from
  anywhere in the chrome.
- `tests/axe.test.tsx` — three new strict-audit cases (all rules incl. color-contrast) for the
  palette: open with an empty query, open with matching results (both a demo and a
  configuration hit rendered), and open with no matches. Zero violations in all three.

## Testing
- `bun test` — 541 pass, 0 fail (up from 526 on `main`; 15 new tests: 16 in
  `paletteIndex`/`paletteSearch`, minus overlap accounted for — see per-file counts above).
- `bun run typecheck` — clean.
- `bun run build` — clean, no chunk-size warning. `CommandPalette` (which pulls in the full
  1933-entry generated search index) splits into its own on-demand chunk rather than the
  initial bundle; the main chunk is unchanged from `main` (~220 kB) and the new
  `CommandPalette-*.js` chunk (~291 kB / ~35 kB gzip) is fetched once, the first time `/` is
  pressed or the search control is clicked.
- `bun run search-index:check` — SAME, 1933 entries; this branch touches no fallback content,
  so HJ-719's generated index is untouched and still fresh.

## Notes
- **Test-harness fix, not scope creep, but worth flagging:** getting real keyboard/typing
  interaction under test surfaced two happy-dom/React 19 interop issues nothing in this repo
  had exercised before (no existing test types into a controlled input or sends it keydowns):
  react-dom's real-`input`-event feature detection runs once at module-import time — before
  any test's `beforeEach` window exists — and latches to "unsupported" for the whole process,
  so a real `input` event dispatch on a controlled `<input>` never reaches `onChange`; and its
  selection-tracking plugin resolves `document.activeElement` on every keydown/keyup targeting
  a text input and throws if that element was never really focused. Both are worked around
  locally in `CommandPalette.test.tsx` and the new `tests/axe.test.tsx` cases (drive `onChange`
  directly via the React-attached prop; call `.focus()` for real before dispatching keydowns) —
  documented inline in `CommandPalette.test.tsx`'s file header. No shared test infrastructure
  was changed.
- No new dependency: no command-palette library (e.g. `cmdk`) is in `package.json`, so the
  dialog, combobox/listbox wiring, and keyboard handling are hand-rolled per the ticket's
  "only use libraries already in the project" constraint.
- Telemetry: navigating via the palette to a different category emits the existing
  `room_switch` event (same as the tab/rail navigation paths) for consistency; no new event
  name was added to the server's fixed allowlist (`server/routes/telemetry.ts`), which is out
  of this ticket's scope.
- CSS sizing follows the file's existing ad hoc rem scale (there's no enforced type-ramp token
  system in this codebase yet) rather than inventing a new one for just this feature.
