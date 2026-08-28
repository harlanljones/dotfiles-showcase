# ADR-002: Deep linking & state URLs (client-side routing)

**Date:** 2026-08-28
**Status:** Accepted
**Deciders:** harlanljones
**Tickets:** NAV-01..03 (HJ-567..569) — Linear project `6a256cdee686`, team HJ
**Amends:** `PRODUCT.md` (open question "whether room URLs exist" → resolved: yes), `ROADMAP.md §3 M7`

## Context

PRODUCT.md left room URLs as an open question. With four primary rooms plus the annex
(`src/components/Explorer.tsx`), navigation was pure component state: no shareable links,
no browser back/forward, and a refresh always dropped the visitor back into Starship.
The Workers mirror is public — a stranger who wants to share a specific prompt state
(rebase gone wrong, SSH detached hotfix) had no way to do so.

Constraints:

- Zero-dependency client (no react-router); the app is a small SPA and the bundle budget
  matters (PERF-01/PERF-02 track it).
- The veil wake model (`App.tsx`) must keep working: first paint is an unlit monitor, and
  waking must land in the room the URL asked for, not always Starship.
- Workers already serves the SPA with `not_found_handling: "single-page-application"`
  (`wrangler.jsonc`), so deep paths rewrite to `index.html` on the edge with zero config.
- Read-only showcase: URLs encode *view state only* — never secrets, never host paths.

## Decision

1. **Hand-rolled History-API router** (`src/lib/router.ts`): canonical room paths
   `/prompt`, `/palette`, `/desk`, `/dots`, plus `/index` (annex; `/annex` alias) and
   `/starship|/ghostty|/hyprland` aliases. Hash fragments (`#/dots`, `#index`) are
   honored as a fallback for static hosting. No router dependency is added.

2. **Starship state lives in the query string** (`src/lib/urlParams.ts`): compact,
   non-default-only encoding of the playground state (`branch`, `dirty`, `ahead`,
   `behind`, `detached`, `state`, `ssh`, `shell`, `status`, `durationMs`, `width`,
   `trueColor`). Default state produces a clean URL with no query string.

3. **History discipline:** room changes `pushState` (back/forward works); playground
   control changes debounce `replaceState` (150 ms) so slider drags do not spam history.
   `popstate` hydrates both the room and the playground state.

4. **Scenario awareness:** `findScenarioKey` (`StarshipPlayground.tsx`) re-derives the
   active scenario preset from decoded state so the preset highlight survives URL
   round-trips.

5. **No server changes:** both runtimes (Bun dev via Vite proxy; Workers via assets SPA
   fallback) already rewrite unknown paths to `index.html`. The API contract
   (`POST /api/starship`, `GET /api/cards/:key`) is untouched.

Alternatives considered:

- **react-router / wouter** — rejected: adds a dependency for six routes; the router is
  ~120 lines and fully typed.
- **Hash-only routing** — rejected as primary: ugliest share URLs and double bookkeeping
  with query params; kept only as a legacy fallback in the parser.
- **Server-side route table on Workers** — rejected: SPA fallback already covers it;
  a Worker route table would duplicate the client's path map as drift risk.

## Consequences

- Any room or prompt state is now shareable as a URL on both local and the public mirror.
- Room URLs exist: PRODUCT.md's open question is resolved; "room URLs" may be moved to
  Locked on the next PRODUCT.md revision.
- The path map (`ROOM_PATHS`/`PATH_TO_ROOM`) is client-owned; adding a room requires
  touching `src/lib/router.ts` (single file, covered by `src/lib/router.test.ts`).
- URL params are display state only — no auth, no PII; nothing to sanitize server-side.
- Verified: `bun test` 267/267 (includes router + urlParams suites), `tsc --noEmit`
  clean, production build clean.
