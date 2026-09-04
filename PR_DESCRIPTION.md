# HJ-716: Fix the vacuous post-deploy smoke assertions

## Summary
The post-deploy smoke job asserted HTTP 200 on five retired "room" routes (`/prompt`,
`/palette`, `/desk`, `/dots`, `/annex`) that no longer exist as category views. Because
`wrangler.jsonc` serves the app shell for any unmatched path
(`not_found_handling: "single-page-application"`) and the router is entirely client-side, a
bare 200 proves the Worker is up — nothing about whether the app actually routes anywhere.
The job would have stayed green even with the router deleted outright. This change replaces
the hardcoded curl loop with `scripts/smoke.ts`, which requires two independent layers to pass
before a route counts as verified: HTTP reachability (unchanged in spirit) **and** routing
resolution — importing the real `parseRoute` and asserting it resolves each path to the
specific category (or, for the demo deep link, the specific card) expected, not merely *some*
category via the router's permissive unknown-path fallback.

## Changes
- `scripts/smoke.ts` (new) — exports `CATEGORY_ROUTES` (derived from `CATEGORY_PATHS`, so it
  can't silently drift from the shipped catalogue), `DEMO_DEEPLINK` (`/shell#starship` —
  Starship is the one eager/wake-path card), `isCanonicalRoute`, `verifyRouting`,
  `verifyDemoInCatalogue`, `checkReachable`/`checkAllReachable` (injectable `fetch`), and a
  CLI `main()` that runs both layers against a base URL and exits non-zero on any failure.
- `tests/smoke.test.ts` — replaces the scaffold placeholder test with unit coverage of both
  layers, plus a `REGRESSION` test that runs the five retired room routes through
  `isCanonicalRoute` and asserts every one fails the gate, and a
  `router-deleted regression` describe block that shows an HTTP-only check stays green against
  a route the router no longer canonically recognizes while the routing-resolution layer
  correctly fails — the executable proof this job would have caught the described regression.
- `.github/workflows/deploy.yml` — the "Post-deploy smoke" step now runs
  `bun run scripts/smoke.ts "$BASE"` in place of the hardcoded route loop and the single
  `/dots` root-div grep. The degraded Starship assertion, fallback cache-control assertions,
  and the "Fallback integrity" gate step are untouched.

## Testing
- `bun test` — 472/472 pass (includes the 12 new/updated smoke tests).
- `bun run typecheck` — clean (`wrangler types && tsc --noEmit`).
- `bun run build` — succeeds; bundle output unaffected.
- Manual end-to-end sanity: ran `bunx vite preview` locally and pointed
  `bun run scripts/smoke.ts http://localhost:4321` at it — passes (`4 category route(s) + demo
  deep link "/shell#starship" — all reachable and correctly routed`).
- Demonstrated the regression this fixes: against that same local server, curling the old
  route list (`/ /prompt /palette /desk /dots /annex`) returns 200 for every path (confirming
  the old job's checks were vacuous), while `isCanonicalRoute` (exercised in
  `tests/smoke.test.ts`'s `REGRESSION` test) correctly rejects every one of those paths as not
  a current category view.

## Notes
- Category-route deep links use `#cardId` hash fragments, which per the HTTP spec never reach
  the server — `checkAllReachable` therefore curls only the pathname portion of the demo deep
  link, while `verifyRouting` independently exercises the actual bundled `parseRoute` logic
  (no network) to confirm the hash resolves to the specific expected card. Both layers must
  pass.
- `EXPECTED_CATEGORY_COUNT = 4` is a static tripwire: deriving routes from `CATEGORY_PATHS`
  keeps the list from drifting, but a gutted catalogue would otherwise yield an empty
  (vacuously-passing) route list — the same failure mode this ticket exists to close. The
  count assertion catches that.
- Legacy room-path aliases (`/prompt`, `/palette`, `/desk`, `/dots`) still resolve via
  `parseRoute`'s backwards-compat table for user-facing deep-link compatibility — that's
  unchanged and out of scope here. `isCanonicalRoute` is deliberately stricter than "does
  `parseRoute` resolve it to something": it only accepts paths that are exactly one of today's
  `CATEGORY_PATHS` values, which is what makes it able to flag those legacy paths as no longer
  legitimate smoke-test targets.
- Out of scope: this ticket is independent of the HJ-715/HJ-718 shell redesign. If a later
  ticket moves the landing route or category paths, `CATEGORY_ROUTES`/`DEMO_DEEPLINK` will need
  a follow-up update — but since routes are derived from `CATEGORY_PATHS`/`CATALOGUE`, only
  `DEMO_DEEPLINK`'s hardcoded card choice would need manual revisiting.
