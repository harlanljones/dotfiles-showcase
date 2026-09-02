# HJ-678: Deepen Dots workflows and Explorer catalogue for annex-first demos

## Summary

Introduces two new modules — the Dots workflow module (`src/lib/dotsWorkflow.ts`) and the Explorer catalogue module (`src/lib/catalogue.ts`) — that eliminate the parallel declarations that made adding a new Dots command or showcase demo unnecessarily costly. The Dots workflow module turns parsed command facts into a safe, explicitly authored display model with evidence-vs-simulated discrimination and a persistent no-execution disclosure. The Explorer catalogue module is the single source of truth for demo topology (placement, route identity, display word, lazy resolution), while the manifest retains content and provenance metadata. Annex receipt URLs (`/annex#<id>`) round-trip through the router, select and expose the targeted demo on arrival, and are validated against the catalogue to prevent orphaned targets.

## Changes

- **`src/lib/dotsWorkflow.ts`** (new) — Pure display-model module: 10 authored per-command workflows (`sync`, `diff`, `status`, `absorb`, `edit`, `cd`, `update`, `push`, `doctor`, `help`) each owning canonical identity, effect, permitted preview controls, and an explicit safe scenario. Unsupported parsed commands get an evidence-only view with no invented behavior. Every scenario carries a persistent no-execution disclosure and marks trace lines as `command`, `evidence` (parsed handler facts), or `simulated` (authored transcript).

- **`src/lib/catalogue.ts`** (new) — Explorer topology source: 11 entries (4 rooms + 7 annex receipts) each declaring `placement`, `route`, `word`, and `lazy`. `ABSORBED_DEMOS` declares `recolor` as absorbed into the starship room. `catalogueAdmissionErrors()` enforces the invariant that every catalogue demo has manifest provenance and every applicable manifest demo is reachable (or explicitly absorbed).

- **`src/lib/explorer/DotsCliCard.tsx`** — Rewritten to consume `projectDotsWorkflow()`. The hardcoded `invocation`/`transcript`/`OPTION_LABELS`/`DEFAULT_TARGET` are replaced by the workflow module. The terminal renders trace lines with kind-based styling (command: phosphor, evidence: italic dim, simulated: normal). Unsupported commands show a warning notice and a disclosure. Options are rendered from the workflow's control declarations, and the exact handler source remains visible below. Test coverage: 57 new tests.

- **`src/components/Explorer.tsx`** — Refactored to derive rooms, annex, display words, and lazy resolution from the catalogue. The ROOMS nav, ANNEX overlay, CARDS map, and ROOM_WORD are no longer parallel tables. Annex receipt deep-links (`/annex#<id>`) set the targeted `<details>` open, scroll into view, and apply a `receipt-focused` highlight. The existing ESC-to-close, telemetry, and lazy-chunking (PERF-03) are preserved.

- **`src/lib/router.ts`** — Receipt validation: `parseRoute` now accepts only catalogue annex ids as `targetReceipt`; unknown or absorbed ids are dropped. `getRoutePath` uses `receiptPath()` from the catalogue. Canonical room paths and aliases (ADR-002) are retained.

- **`src/lib/router.test.ts`** — Added annex-receipt URL round-trip tests: every annex receipt path round-trips through `parseRoute`/`getRoutePath`; absorbed/recolor and unknown ids are rejected.

- **`src/lib/catalogue.test.ts`** (new) — 24 tests covering primary rooms, annex receipts, accessors, and the admission invariant (zero violations for the shipped state, every manifest id reachable or absorbed).

- **`src/lib/dotsWorkflow.test.ts`** (new) — 33 tests covering every supported command's evidence+scenario, control behavior (dry-run, `--all`, `--print`, editable target), unsupported commands with evidence-only views, and no-execution disclosure.

- **`src/index.css`** — Added `.dots-line-command`, `.dots-line-evidence`, `.dots-line-simulated` classes for trace-line kind styling, and `.dots-disclosure` for the persistent no-execution disclosure. Added `.index-list details.receipt-focused` highlight.

## Testing

- `bun test`: 367 pass, 4 pre-existing environment-dependent starship failures (identical on main)
- `bun run typecheck`: clean
- `bun run build`: production build clean, initial bundle 69.05 KB gzip (under 71.5 KB hard-fail budget)
- Relevant test files: `src/lib/dotsWorkflow.test.ts` (33), `src/lib/catalogue.test.ts` (24), `src/lib/router.test.ts` (annex receipt round-trips), `src/components/explorer/render.test.tsx` (render parity preserved), `tests/axe.test.tsx` (a11y audit clean)

## Notes

- The 4 pre-existing starship failures are environment-dependent (glyph/marker mismatch on this host's starship version); they also fail on `main`.
- Entry bundle grew slightly (+0.85 KB gzip) because `catalogue.ts` is now imported by `router.ts` → `Explorer.tsx` (entry). Still well under the 71.5 KB budget.
- `recolor` is declared as absorbed into the starship room (matching the existing render-test assertion "recolor is absorbed into the prompt room, not a peer"). The catalogue admission invariant exempts it explicitly.
- The Dots workflow module is a pure TypeScript module with no React or server dependencies — it accepts parsed command facts, never executes commands.
- Shareable receipt links (`/annex#<id>`) are supported by the router and focused-receipt arrival. A copy-link affordance per receipt summary is a follow-up opportunity.