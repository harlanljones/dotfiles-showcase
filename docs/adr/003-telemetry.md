# ADR-003: Aggregate telemetry on the Workers mirror

**Date:** 2026-08-28
**Status:** Accepted
**Deciders:** harlanljones
**Tickets:** ANALYTICS-01 (HJ-581) — Linear project `6a256cdee686`, team HJ
**Amends:** `PRODUCT.md` (privacy stance — the PROD-01 revision surfaces this line),
`AGENTS.md §2` (telemetry does not change the read-only showcase contract)

## Context

The public Workers mirror gets real traffic but the owner has zero visibility into
whether it is worth operating. The grill (v3, Q6/Q10/Q11/Q14) decided: full control
coverage, first-party, no third-party beacon, $0 spend, and — hard constraint —
**aggregate values only** (no branch names, no state payloads, no free text), nothing
emitted from local dev.

Options considered:

- **Cloudflare Web Analytics** — pageviews only; cannot express interaction events. Rejected by Q6.
- **Plausible** — native custom events, nice dashboard; third-party script on the mirror, subscription cost. Rejected per first-party/$0.
- **Self-hosted Umami** — full control, real dashboard; a second deployment unit to maintain. Rejected.
- **Workers Analytics Engine (AE)** — first-party, free, write-only binding, custom events
  via a tiny endpoint; queried via GraphQL/dashboard with weaker UX. **Selected.**

## Decision

1. **Transport:** `POST /api/t` exists on the **Workers composition only**
   (`server/worker.ts` + `server/routes/telemetry.ts`). The local Bun server never mounts
   it, and the client (`src/lib/telemetry.ts`) never emits on `localhost`/loopback/`*.local`
   — local dev is telemetry-free end to end, verified by tests.

2. **Event contract:** one AE data point per event. `index` = event name; `blobs` = name
   plus `k=v` field tokens. Client allowlist mirrors the server allowlist
   (`room_switch`, `annex_opened`, `annex_closed`, `preset_applied`, `status_changed`,
   `shell_changed`, `recolor_toggled`, `flag_toggled`, `range_committed`, `copy_ansi`,
   `copy_link`). Field values are aggregate tokens only: room names, scenario keys,
   shell names, clamped integers. The server caps body (512 B), fields (4), key (16 ch)
   and value (24 ch) lengths and drops non-scalar values — a hostile payload cannot
   smuggle state into the dataset.

3. **Continuous controls** (width slider, ahead/behind/duration) emit **on release**
   (`onPointerUp`/`onKeyUp`/`onBlur`), not per drag tick. Free-text input (branch) emits
   nothing — value transmission is prohibited by the aggregate-only rule.

4. **Provisioning:** the AE dataset (`dotfiles_showcase_events`) must be created in the
   Cloudflare dashboard before the binding works (user wizard step). Until then the
   endpoint validates and returns 204 without writing, so the UI never surfaces
   telemetry failure. Post-deploy smoke does not depend on telemetry.

5. **Cost & retention:** Workers AE free tier, $0 observed (reported per §9 cadence).

## Consequences

- The owner can answer "is the mirror used, and which rooms/controls matter" from the CF
  dashboard or GraphQL API without a third-party dependency.
- Event inventory changes require touching both allowlists (server + client) — kept in
  one file each, noted in ADR-003; drift is caught by the telemetry tests.
- Dashboard UX is query-driven rather than pre-built; acceptable at this scale.
- No cookies, no fingerprinting, no cross-site tracking: the beacon is first-party and
  stateless.
- Verified: `bun test` 309/309 (incl. 8 `/api/t` cases + 5 client-guard cases), typecheck
  clean, budget intact (68,545 B gzip ≤ 71,500 pinned).
