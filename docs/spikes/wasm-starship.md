# Spike: starship WASM on Cloudflare Workers (WASM-01)

**Ticket:** HJ-433 (Linear project `6a256cdee686`, team HJ)
**Type:** Research spike — doc-only, no code, no proof-of-concept.
**Date:** 2026-08-26
**Reopens:** ADR-001 §"Alternatives considered" → "WASM starship — deferred".

---

## 1. Objective

ADR-001 (2026-08-25) explicitly **deferred** a WASM-compiled `starship` on Workers:

> *WASM starship — deferred: no stable `starship` WASM build that reproduces the exact prompt; degraded snapshot is sufficient for a read-only showcase and preserves the local high-fidelity path.*

This spike re-examines that deferral and produces a **Go / No-Go** recommendation on whether a WASM `starship` could replace the Workers degraded snapshot (`server/routes/starship.ts:renderDegradedStarship`, `degraded: true`) with *real* prompt output, while still honoring the project's hard gates:

- **No-fake gate** (`AGENTS.md §6`): local path must invoke the real binary; Workers is the *sole* allowed exception.
- **CFG-01 fidelity**: config reads degrade gracefully; no secrets/host-identifying literals.
- **Recolor contract** (`ROADMAP.md §5`): on `status != 0`, zsh (8-variant `36m→31m`) and bash (all-fg→`31m`) transformations must remain exact.

---

## 2. Current Workers baseline (what WASM would replace)

`renderDegradedStarship` (starship.ts:111–171) does **not** run `starship`. It:

1. Takes the already-explicit `PromptState` (`branch`, `dirty`, `ahead`, `behind`, `detached`, `state`, `ssh`, `status`, `durationMs`, `trueColor`) — the same toggles the UI sends.
2. Hand-builds a **synthetic** ANSI prompt (L128–146) that mirrors only the *fallback* `starship.toml` layout (`directory + git_branch + git_status + custom.git_dirty + git_commit + character`), using 8-color `36m` (or `38;2;46;222;250` in truecolor preview).
3. Runs the **same** `applyFailureColor` + `ansiToHtml` as the local path, so the recolor playground behaves identically.

Consequently the degraded prompt **cannot** reproduce:
- arbitrary modules from a user's real `starship.toml` (custom modules, cmd_duration, jobs, env vars, battery, etc.);
- multi-line prompts;
- the genuine git-internals detection that the local temp-repo sim (`server/lib/tempRepo.ts`, `node:fs` + `git`) produces.

That fidelity gap is precisely what a real WASM `starship` would close.

---

## 3. Feasibility blockers (the crux)

### 3.1 `starship` reads a **real on-disk git repository**
`starship`'s `git_branch` / `git_status` / `git_commit` modules call into a git checkout (via the `git` CLI or libgit2) rooted at the cwd. The local path satisfies this by building an isolated temp repo in `tempRepo.ts` (needs `node:fs` + the `git` binary). On Workers:
- `workerd` provides **no `node:fs` host filesystem** and **no `git` binary** (ADR-001:19; `server/lib/configs.ts:57`, `:77`).
- `PromptState` already carries the git *state* as explicit fields — but `starship` ignores those and re-derives state from the repo on disk.

So even a WASM `starship` still needs a git backend. Options:
- (a) Inject an in-memory/custom git backend into `starship` — requires **forking/patching** `starship` to accept injected git state; `starship` has no such API. High effort, fragile across versions (the project pins `starship v1.26.0` for exactly this reason — `ROADMAP.md` risks table, F5 golden tests).
- (b) Build a real repo in a Workers-compatible FS (e.g. an in-wasm `memfs` + a wasm `git`). Combines two unstable wasm builds and still fights `workerd`'s lack of a writable FS surface.

### 3.2 No stable `starship` WASM build
`starship` is a Rust binary that shells out to `git` and reads many host facilities (TTY width, `HOME`, `PATH`, `git`). There is no maintained `wasm32-unknown-unknown` target that reproduces the prompt without a host git. (This is the exact reason ADR-001 deferred it.)

### 3.3 Recolor + truecolor parity must be preserved
Any WASM path must still emit the ANSI that `recolor.ts` transforms: 8-color `36m` (default) and, in the opt-in truecolor preview, `38;2;46;222;250` (cyan → recolor to red). A wasm build driven without a truecolor TTY emits `36m` (same as the local `spawnSync` path, `ROADMAP.md §5a`), so the 8-color recolor stays byte-exact; the truecolor preview would still require the `elevateToTrueColor` step currently in `recolor.ts`/`starship.ts`. Net: recolor logic is *unaffected*, but the WASM output must be guaranteed to use named `36m` (not `38;2`) in default mode — a behavioral contract to enforce.

### 3.4 Maintenance & gate risk
- Adds a second code path that must track `starship` releases (currently pinned 1.26.0). The degraded snapshot is build-independent and version-stable.
- Risk of silently violating the no-fake gate if the wasm output is treated as "live" — it would still be a reconstructed repo, not the user's real shell state.

---

## 4. Options surveyed

| Option | Reproduces real prompt? | workerd-feasible? | Effort | Risk |
|---|---|---|---|---|
| **(A) Keep degraded snapshot** (current, ADR-001) | No (synthetic, fallback-layout only) | Yes | None | Low |
| **(B) WASM starship + patched git injection** | Yes (if fork maintained) | Only with invasive patch | Very high | High (version drift, gate risk) |
| **(C) WASM starship + in-wasm memfs/git** | Yes | Only with two unstable wasm deps | Very high | High |
| **(D) Pre-rendered prompt cache** | Partial | Yes | Medium | Drift vs live toml |

All WASM options concentrate effort in (3.1)/(3.2), which are unchanged since ADR-001.

---

## 5. Recommendation: **NO-GO** (keep ADR-001 deferral)

The deferral remains correct. The blocking constraints — `starship`'s dependence on a real git repo/fs, the absence of a stable wasm build, and `workerd`'s lack of `node:fs`/`git` — are architectural and unchanged. A WASM build would require forking `starship` to inject git state, then maintaining that fork against the pinned 1.26.0 (and future) releases, for marginal gain on a **read-only public mirror** whose purpose is shareability, not exact fidelity.

The current degraded snapshot is the right design: it preserves the local high-fidelity path (`bun run dev` + real binary) as canonical, keeps the recolor playground fully functional on Workers (same `recolor.ts`), and carries zero version-drift risk. No production change is warranted.

### If revisited later, gate the work on:
1. A `starship` release (or fork) that accepts **injected git state** via API (no on-disk repo).
2. A maintained `wasm32` target for that build.
3. Enforcement that default mode emits named `36m` so `recolor.ts` stays byte-exact.
4. A new ticket set (e.g. `WASM-02` survey-of-builds, `WASM-03` git-injection PoC, `WASM-04` workerd integration) — none opened now.

---

## 6. Verification of this spike

- Doc-only; no source/test changes. `bun run typecheck` and `bun test` remain green (no edits).
- Conclusions cite: `docs/adr/001-workers-deployment.md:37`, `server/routes/starship.ts:111–171`, `server/lib/tempRepo.ts`, `server/lib/configs.ts:57,77`, `AGENTS.md §5/§5a/§6`, `ROADMAP.md §5/§6`.
- No Linear state changed except the resolution comment on HJ-433.
