# HJ-715: Restructure the Explorer shell (wave 1)

## Summary

Implements the HJ-715 remainder against `main`: the parts of the wave-1 Explorer-shell
spec not owned by the four in-flight tickets. New work here is the **pager** (pure
`less`-idiom state machine + status line + `j/k/space/h/l//` keys + scroll hint→yield
escalation), the **`/` palette** (pure catalogue+config search module + dialog UI with a
persistent visible search control), the **wordless veil** (unlit glass + block cursor;
wake hands straight into the demo), and **first-view performance tracking** (a demo
performs the first time it opens in a session, renders instantly thereafter, never under
`prefers-reduced-motion`). Document scroll is restored (`overflow: hidden` removed, tabs
and status line pinned). No server/API changes, no new hues or typefaces, no demo-body
changes — render-parity passes untouched.

## Changes

- `src/lib/pager.ts` (new) — pure pager state machine, no DOM access. Owns page count
  (`ceil(content/viewport)`, min 1), current page, next/prev/goto with boundary clamps,
  mode selection from pointer coarseness (coarse → native, no hint, no escalation),
  remembered session override, the hint→yield escalation (`noteScrollIntent`), percent
  arithmetic, and the `less`-idiom status-line formatters (`formatStatusLine`,
  `formatIdleLine`) exposed as text.
- `src/lib/pager.test.ts` (new) — 19 tests: page arithmetic/boundaries, mode selection
  (fine/coarse/remembered-override), hint→yield→remember including the coarse path that
  never engages, and status-line text.
- `src/lib/search.ts` (new) — pure palette search: corpus in, ranked results out. Ranks
  exact demo word/id → prefix → substring over word/title, then exact key → key prefix →
  key substring → value/path substring. Every config hit carries the `demoId` that
  renders it. Entry shape is structurally identical to HJ-719's generated
  `SearchIndexEntry` so the artifact plugs in with no other change.
- `src/lib/search.test.ts` (new) — 9 tests over a fixture corpus: demo-name hits,
  config-content hits, hit→demo mapping, empty/blank/no-match, limit capping.
- `src/lib/configIndex.ts` (new) — wiring shim: exports the HJ-719-compatible
  `ConfigIndexEntry` type and an empty `CONFIG_INDEX` until HJ-719's generated
  `server/lib/searchIndex.ts` lands, at which point this one-line body becomes a
  re-export. Palette degrades to demo-name search rather than failing until then.
- `src/lib/session.ts` (new) — **byte-verbatim copy of HJ-717's module** (verified with
  `diff`): `isAwake/setAwake`, `seenDemos/markDemoSeen`, `pagerModeOverride/
  setPagerModeOverride`, storage-failure-safe. Required at runtime by the performance
  gate and pager override; copied identically so the merge keeps either side.
- `src/components/Palette.tsx` (new) — `/` dialog: catalogue + config search over the
  Explorer-built corpus, demo/config grouped hits, Enter selects top, Escape closes,
  `role="dialog"` + labelled searchbox + results list. `initialQuery` test seam.
- `src/components/Explorer.tsx` — pager integration: current-demo tracking
  (deep-link target → earliest expanded), `j/k/space` page the open demo's detail,
  `h/l` walk siblings (pushes history, so back moves between demos, never pages),
  `/` opens the palette, native non-passive wheel listener for hint→yield (persists via
  session override), deep-link/category change resets to page one, status line
  (`role="status"`, position + percent + hints), visible `search /` control in chrome,
  `data-performing` first-view marker (350 ms handoff, seen-set written at start,
  suppressed under reduced-motion), `data-pager` mode attr driving the field clamp.
- `src/App.tsx` — awake flag migrated to session helpers (same hunk as HJ-717);
  veil copy removed (title/subtitle/hint) leaving unlit glass + block cursor. Wake
  still gates the veil only — the performance is keyed on the seen-set, so returning
  visitors skip the gate but keep the main event.
- `src/index.css` — document `overflow: hidden` → `overflow-x: clip` (vertical scroll
  restored, page never scrolls sideways); sticky pinned chrome + bottom status line;
  pager-status/palette/performing styles in existing phosphor/ash/fail tokens only;
  paged-mode detail clamp; dead veil-copy rules removed; reduced-motion covers the new
  animation. Grid/card/system-sans rules untouched (HJ-718's).
- `src/components/Explorer.test.tsx` — 11 new tests, all 7 pre-existing tests
  untouched: idle/open status lines, j/k history-neutral paging + h/l sibling walk,
  input-focus key guard, wheel hint→yield→remember + remembered-yield remount,
  palette open/close + seeded-query search/select/Escape, first-view performing +
  session memory + reduced-motion instant, strict axe audit (all rules incl.
  colour-contrast) over header + status + open palette.

## Testing

- `bun test` — **500 pass, 0 fail** (baseline on `main` was 461; +28 pager/search pure
  suites, +11 Explorer suites). Render-parity (`render.test.tsx`), catalogue, router,
  per-card axe, smoke, and all server suites pass **unmodified** (zero diff).
- `bun run typecheck` — clean (`wrangler types && tsc --noEmit`, exit 0).
- `bun run build` — clean; lazy-chunk splitting for the 17 non-eager cards unchanged.
- How to test manually: `bun run dev`, open any category — status line shows
  `N demos · …`; expand/deep-link a demo (`/shell#starship`) — status shows
  `word · 1/1 · 100% · j/k …`; `j/k/space` page, `h/l` walk siblings, `/` palette,
  first wheel shows the scroll hint, second yields to native (remembered per session);
  block cursor + status persist; veil is cursor-only on first load, skipped on revisit.
- Performance: client-only wave, no server path touched — nothing to time against the
  starship-invocation budget. Cost: $0 (local-only, no Workers change).

## Notes

- **Overlaps with in-flight work (implemented against `main`, nothing duplicated):**
  - *HJ-718 (hero+rail, In Review)* owns the grid→hero+rail restructure, landing→
    Shell/`#starship`, `onOpenPlayground` removal, and system-sans removal. This ticket
    deliberately does NOT touch those: pager/keys/status/palette are wired onto
    `main`'s grid (`showcase-card` classes, `expandedCards` set) so the tree merges,
    but the ~40-line Explorer wiring plus the `.field[data-pager]` clamp selectors
    must be **ported onto HJ-718's `.demo-hero`/`.demo-rail` tree at merge** (logic is
    identical: open demo = hero, siblings = rail; only class names and the
    collapse/expand state shape change). Likewise the new Explorer tests assert grid
    class names and will need the same mechanical port HJ-718 already applied to the
    old suite. Suggest landing HJ-718 first, then porting this branch's Explorer
    hunk + its tests.
  - *HJ-717 (session persistence, In Review)* owns `src/lib/session.ts`,
    `src/lib/session.test.ts`, and the App.tsx awake-flag hunk. `session.ts` here is
    a byte-identical copy (merge keeps either); the App.tsx hunk matches HJ-717's.
    `session.test.ts` is NOT duplicated — HJ-717's suite covers the module; usage is
    covered here via the wheel-remember and performance tests.
  - *HJ-719 (search index generator, In Review)* owns the generator, the committed
    `server/lib/searchIndex.ts` artifact, package.json scripts, and deploy drift
    gate. This ticket consumes that artifact through `src/lib/configIndex.ts`, whose
    body is a one-line swap to a re-export at merge. Until then config-content search
    degrades to demo-name search (spec-compliant fallback, surfaced in code comment).
  - *HJ-716 (smoke assertions, In Review)* owns story 45 fully (scripts/smoke.ts,
    deploy job, regression tests). Untouched here.
- **Deferred inside HJ-715 by explicit spec carve-outs:** `CardShell` `inspect`
  disclosure removal (lives inside demo bodies — would break the untouched
  render-parity gate; belongs to the per-demo deepening waves); design-doc + domain-
  glossary rewrites (spec: after landing, from the shipped artifact); new telemetry
  event names for rail/palette moves (server allowlist change = out-of-scope server
  change; category switches keep emitting `room_switch`).
- **Test-environment finding (worth knowing):** React 19 evaluates
  `isInputEventSupported` once at module load — before happy-dom globals exist under
  `bun test` — so synthetic `"input"` events never reach `onChange` (only `onInput`;
  verified against the installed `react-dom-client` source). Live typing is therefore
  covered by the pure search suite, and the component test seeds `initialQuery`.
  Real browsers are unaffected (feature-detect passes at load). No existing suite
  simulates typing either, so this is a standing gap, not a regression.
- **Assumptions made:** page = `ceil(content/viewport)` with unmeasurable heights
  yielding a single page; `h/l` clamp (no wrap) at rail ends; 350 ms performing
  handoff; wheel-yield persists `native` while an explicit `paged` override restores
  paging; palette lists demo hits above config hits at equal relevance by score tier.
- Security: no secrets/tokens/host literals added (`grep` clean — only bounded
  catalogue/manifest tokens flow through search/pager); storage access failure-safe
  via the session module; palette renders manifest/catalogue text only (no
  `dangerouslySetInnerHTML`).
