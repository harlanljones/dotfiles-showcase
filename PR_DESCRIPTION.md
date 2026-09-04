# HJ-718: Hero and rail replaces the category grid of collapsed showcase cards

## Summary
A category view in the Explorer used to render a grid of collapsed showcase cards — a title, a
badge, a blurb, and an expand button — so a visitor's first screen was a table of contents. This
change replaces that with a hero and rail: a category view now renders exactly one showcase demo,
full-bleed, with no card frame or max-width container, and its sibling demos render above it as a
row of small tracked words (echoing the existing `.room-names` treatment) with the open demo
marked via `aria-current`. Clicking a sibling word swaps the hero to that demo. The landing route
moves from a bare System & Display view to Shell & Navigation with Starship open, since Starship
is the desk's signature and already the eager (chunk-free) demo. Along with the grid, two pieces of
dead weight are removed: the system-sans stylesheet that was scoped onto category tabs and card
titles, and the `onOpenPlayground` callback prop typing that was declared in three signatures in
`Explorer.tsx` and never passed or consumed by any of the eighteen card components. The catalogue
(category membership/ordering) and every showcase demo body are untouched.

## Changes
- `src/components/Explorer.tsx` — removed the collapse/expand state, the `category-grid` markup,
  and the vestigial `onOpenPlayground` prop typing on `EAGER`/`LOADERS`/`CARDS`; added a `demo-rail`
  of sibling words and a `demo-hero` that renders exactly one `CardWithSuspense`. The root-landing
  effect now normalizes to `{ category: "shell", targetCard: "starship" }` instead of `system`.
- `src/index.css` — deleted `.category-grid`, `.showcase-card*`, `.showcase-expand-btn`, and
  `.card-focused`; added `.demo-rail`, `.demo-rail-word`, and `.demo-hero`. Updated the
  `prefers-reduced-motion` block to reference the new hero class.
- `src/components/Explorer.grid.css` — deleted. This was the only stylesheet in the app applying a
  system-sans font stack (to `.category-tab` and `.showcase-card-title`); JetBrains Mono is now the
  only typeface anywhere in the shell.
- `src/components/explorer/explorer-expanded-card.css` — deleted. It only styled the
  `.showcase-card-expanded` modifier, which no longer exists.
- `src/components/explorer/ui.tsx` — dropped the now-dead import of
  `explorer-expanded-card.css`. `CardShell`/`SourceBadge`/etc. are otherwise unchanged and still used
  by every card.
- `src/components/Explorer.test.tsx` — rewritten for the new structure: asserts exactly one demo
  renders in `.demo-hero`, no `.category-grid`/`.showcase-card`/`.showcase-expand-btn`/
  `[aria-expanded]` exists anywhere, sibling demos render as `.demo-rail-word`s with the correct
  one marked `aria-current="true"`, clicking a rail word swaps the hero and updates the URL hash,
  deep links open the named demo directly, and landing on `/` resolves to Shell & Navigation with
  Starship open (tab `aria-current="page"`, rail word `aria-current="true"`, path `/shell`). Also
  adds a strict axe-core audit (all rules incl. color-contrast) over the rendered shell chrome +
  rail.

## Testing
- `bun test` — 465/465 pass (up from 461 on `main`; net new assertions in `Explorer.test.tsx`).
- `bun test src/components/explorer/render.test.tsx` (render-parity suite) — passes **unmodified**,
  18/18 cards render without throwing across live/fallback/error variants with matching provenance
  badges, proving demo bodies were not disturbed. Confirmed with `git diff main -- src/components/explorer/render.test.tsx` — zero diff.
- `bun test tests/axe.test.tsx` (per-card strict a11y audit, all rules incl. color-contrast) —
  passes unmodified, and `src/components/Explorer.test.tsx` now also runs a strict axe audit over
  the shell chrome (header, category tabs, demo rail) with zero violations.
- `bun test src/lib/router.test.ts src/lib/catalogue.test.ts` — pass unmodified; catalogue
  membership/ordering and router path parsing were deliberately not touched
  (`git diff main -- src/lib/router.ts src/lib/catalogue.ts` — zero diff). The landing-to-Starship
  behavior is implemented as an Explorer-level normalization (`navigate({ category: "shell",
  targetCard: "starship" }, true)` on mount when `pathname` is `/`), not a change to
  `parseRoute`'s own fallback — so ADR-002's hand-rolled router stays untouched and its test suite
  needed no changes.
- `bun run typecheck` — clean (`wrangler types && tsc --noEmit`).
- `bun run build` — clean; lazy-chunk splitting for the 17 non-eager cards is unaffected (verified
  chunk list in the Vite build output).

## Notes
- HJ-720, HJ-723, and eventually HJ-725/HJ-726 are blocked on this landing first — this PR is the
  structural fix for HJ-715 wave 1 (hero + rail); pager and config palette are separate tickets.
- Deep-linked legacy aliases (`/prompt`, `/palette`, `/desk`, `/dots`, etc.) and Starship's
  query-string state round-trip (`urlParams.ts`) are untouched and unaffected by this change — they
  operate below the Explorer component and never referenced the grid/card markup.
- The rail always lists every demo in the active category (including the currently open one) so
  a 2-demo category like Editor & Runtimes renders as the "two-word rail" the ticket describes,
  without special-casing single/short categories.
- No color values were touched — the rail reuses the existing `--phosphor`/`--ash`/`--ash-dim`
  tokens and the same opacity/hover treatment already established by `.room-names`.
