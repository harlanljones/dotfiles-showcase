# ADR-001: Cloudflare Workers deployment (dual-mode)

**Date:** 2026-08-25
**Status:** Accepted
**Deciders:** harlanljones
**Tickets:** DEPLOY-01 — DEPLOY-08 (Linear project `6a256cdee686`, team HJ)
**Amends:** `AGENTS.md §2` Boundaries, `AGENTS.md §5/§5b`, `AGENTS.md §6`, `AGENTS.md §7`, `ROADMAP.md §1`

## Context

`AGENTS.md:2` and `ROADMAP.md:35` explicitly marked public deployment as out-of-scope v1 (prohibited shortcut) because the Showcase depended on host-only capabilities:

- the real `starship` binary via `spawnSync` (`server/routes/starship.ts:97`)
- `~/.config/*` live reads with fallback (`server/lib/configs.ts`, `fallback/README.md`)
- `node:fs` / `node:child_process` / `tmpdir` / `homedir` (`server/lib/tempRepo.ts`)

A user request now asks for a public Cloudflare Workers deployment. Per `AGENTS.md:3` (instruction precedence: `AGENTS.md` > user request), this conflict must be surfaced and resolved via a scope amendment, not a silent override.

Separately, `workerd` (Workers runtime) cannot provide the host capabilities above: no `starship` binary, no `~/.config/*` filesystem, no `child_process`. A single-mode "move everything to Workers" would break the no-fake-starship gate and CFG-01 fidelity.

## Decision

**Allow public deployment as v2, dual-mode:**

1. **Local remains canonical:** `bun run dev` (Bun + `Bun.serve` at `server/index.ts:17`) continues to invoke the real `starship` binary, build isolated temp repos, read live `~/.config/*` with fallback, and apply exact recolor. This path upholds the existing no-fake gate (`AGENTS.md §6`) and `ROADMAP.md §6` golden-file checks.

2. **Workers is a read-only public mirror:** the same Hono app (`Hono`) + Vite `dist/` are deployed via **Workers with assets** (`wrangler.jsonc: { assets: { directory: "./dist" } }`). The Worker serves the SPA and `/api/*` from one deployment unit.

3. **Degraded starship on Workers:** `POST /api/starship` on Workers MUST NOT claim to run the binary. It returns `{ degraded: true, html, ansi, rawHtml, warnings }` derived from the committed `fallback/starship.toml` + the same `server/lib/recolor.ts` (zsh 8-variant / bash all-fg) and `ansiToHtml`. The UI (`StarshipPlayground.tsx`) MUST render an explicit banner when `degraded:true`. This is the sole allowed exception to the no-fake gate, scoped to `workerd`.

4. **Fallback-only configs on Workers:** every `~/.config/*` read degrades to `fallback/*` per `CFG-01`; no throws on missing host config. `fallback/README.md` remains the content authority; no secrets or host-identifying literals are bundled.

5. **Tooling:** `wrangler.jsonc` with `compatibility_date=today`, `compatibility_flags=["nodejs_compat"]`, `observability` enabled, `wrangler types` generating `Env` (never hand-written). CI/CD via `wrangler deploy` on push to `main` with `workers.dev` previews on PRs.

Alternatives considered:
- **Pages Functions** — rejected: would split static (Pages) and API (Functions) into two units; Workers+assets keeps one Hono app.
- **WASM starship** — deferred: no stable `starship` WASM build that reproduces the exact prompt; degraded snapshot is sufficient for a read-only showcase and preserves the local high-fidelity path.
- **Single-mode Workers-only** — rejected: violates no-fake gate and removes the ability to demo real binary behavior.

## Consequences

- **Positive:** public shareability without sacrificing local fidelity; one codebase, two runtimes; no new storage bindings required for v2 (fallback is static).
- **Negative / accepted:** public starship preview is a point-in-time snapshot, not live config; truecolor `38;2` recolor gap (`AGENTS.md §5a`) persists on Workers as well (UI must note it).
- **Follow-ups:** DEPLOY-02 scaffolds `wrangler.jsonc`; DEPLOY-03 gates Node APIs; DEPLOY-04 implements degraded response; DEPLOY-05 wires assets; DEPLOY-06 hardens env; DEPLOY-07 adds CI/CD; DEPLOY-08 verifies both runtimes.

## Verification

- `AGENTS.md §2` now lists v2 Workers as in-scope; `Out of scope` narrowed to editing/syncing only.
- `AGENTS.md §5b` documents degraded contract; `AGENTS.md §6` scopes no-fake exception to Workers; `AGENTS.md §7` adds `wrangler dev/deploy/types`.
- `ROADMAP.md §1` D6 records dual-mode; project ID corrected to `6a256cdee686`.
- `bun test` + `bun run typecheck` remain green; `grep` secret scan clean; `chezmoiignore` gate unchanged.

## References

- `AGENTS.md:2`, `AGENTS.md:3`, `AGENTS.md:5`, `AGENTS.md:5a`, `AGENTS.md:6`, `AGENTS.md:7`
- `ROADMAP.md:1`, `ROADMAP.md:6`, `fallback/README.md`
- `server/index.ts:17`, `server/routes/starship.ts:97`, `server/lib/configs.ts`, `server/lib/tempRepo.ts`
- `package.json:9`, `vite.config.ts:9`, `dev.ts:1`
- Skill references: `cloudflare` (Workers+assets decision), `workers-best-practices` (compat date, nodejs_compat, wrangler types, no global request state)
