# ADR-004: Merge into harlan-web as a subtree

**Date:** 2026-09-24
**Status:** Accepted
**Deciders:** harlanljones
**Tickets:** none yet (Phase 0 of the harlan-web merge/redesign project; Linear issues optional per that project's roadmap)
**Amends:** `AGENTS.md §3` Instruction Precedence

## Context

A user request now asks this repository to move: its code becomes `apps/dotfiles/` inside the private `harlanljones/harlan-web` repository, which then serves both apps behind one Cloudflare Worker at `www.harlanljones.com/dotfiles/`. Per `AGENTS.md §3` (this file and `ROADMAP.md` rank above a user's ad-hoc request), a change of this scope — moving the repository's code out of this repository entirely — cannot be silently carried out under the current precedence order. It must be authorized here, as an ADR, before any code moves.

This repository is also public and is both the source `git subtree split` admission evidence would need for a future atlas listing, and the target of a `dotfiles-showcase/` submodule inside the public `harlanljones/dotfiles` chezmoi repo (`AGENTS.md §6`, `.chezmoiignore.tmpl` requirement; harlan-web `02-invariants-and-conflicts.md` S7). harlan-web is private and holds cover letters and other material that must never become public, so the merge cannot simply make this repository's successor private too, or the submodule and any future atlas admission both break.

The decision was made by Harlan directly, through the harlan-web project's Phase 0 `grilling-interactive` session, and is recorded with its reasoning in that repository's `claude-project/knowledge/06-decisions.md` (D-05, D-01, D-04).

## Decision

**Merge this repository's code into harlan-web as `apps/dotfiles/`, keep this repository alive as a read-only public mirror, and amend this file's precedence order to defer to the merged repository's root rules.**

1. **Repo shape (harlan-web D-01).** The merged repository hosts the professional site at its root; this repository's code moves to `apps/dotfiles/`, imported with `git subtree add --prefix=apps/dotfiles` **without** `--squash`, so every commit SHA this repository has ever had survives unchanged (harlan-web D-04). This file continues to govern that subtree, scoped by path, but no longer sits at the top of the precedence order — see the amendment below.

2. **Repo fate (harlan-web D-05).** This repository is not archived and the chezmoi submodule is not dropped. Instead, harlan-web's CI runs `git subtree split` on `apps/dotfiles/` and fast-forward-pushes the result here, on an ongoing basis, after the first (manual, verified fast-forward) push. From that point, **harlan-web's `apps/dotfiles/` is the only writer** — this repository's own deploy workflow (`wrangler deploy` on push to `main`) must be neutralized before the first mirror push, or the two deployments will race and drift.

3. **Deploy topology (harlan-web D-02).** The public-facing app moves from this repository's own Workers deployment (`dotfiles-showcase.harlanljones.workers.dev` today, ADR-001) to `www.harlanljones.com/dotfiles/`, served by harlan-web's single composed Worker. This repository keeps deploying at its own `workers.dev` host only as a redirect shim for at least 90 days (harlan-web D-06), then that redirect Worker is retired.

4. **Framework (harlan-web D-03).** The React SPA is not ported to Astro as part of the merge. It stays exactly as this repository built it — same client, same Hono/Bun server contract, same no-fake-starship gate (§6) — just relocated and reachable under a base path instead of at the root. A later, separate decision (harlan-web D-03, amended 2026-09-24) now schedules an Astro-islands port as a committed post-retheme milestone, not an open maybe; when that lands, it happens inside harlan-web, in the merged repository, not here.

**Amendment to §3, Instruction Precedence:**

The precedence order becomes:

1. `harlan-web`'s root `CLAUDE.md` and `AGENTS.md`, once this repository's code lives at `apps/dotfiles/` inside it.
2. This file (`AGENTS.md`) and this project's `ROADMAP.md`, scoped to the `apps/dotfiles/` subtree.
3. The chezmoi-level constraint that the submodule path MUST be ignored by chezmoi (unchanged, still a hard safety boundary).
4. The user's explicit, current instruction.
5. General framework/library conventions (React, Hono, Vite, Tailwind, Bun).

This takes effect the moment this repository's code is imported into `apps/dotfiles/`; until then, the original order (this file above a user's ad-hoc request) still governs this standalone repository, including this merge decision itself.

Alternatives considered:
- **Archive this repository and drop the submodule** — rejected: it permanently rules out atlas admission (harlan-web H8 needs public source), and Harlan separately confirmed in the same session that he wants this repository admitted once the mirror exists (harlan-web D-20).
- **Make harlan-web public instead** — rejected outright by harlan-web's own invariants (H4): it holds cover letters and other private material that must never ship publicly.
- **Keep two independently deployed repositories, linked only by the atlas** — rejected: Harlan asked for a merge, not a link; a separately operated showcase was harlan-web D-02's option (b), not chosen.

## Consequences

- **Positive:** this repository's full commit history, issues and public visibility survive; the chezmoi submodule keeps resolving; a future atlas dossier (harlan-web D-20) has a public source to point at; one merged Worker lets the shared redesign (harlan-web Phase 3/4) unify the whole visitor journey.
- **Negative / accepted:** this repository is no longer the primary deployment — it becomes a mirror, one commit behind harlan-web's `apps/dotfiles/` by however long the split-and-push takes. Its own `wrangler deploy` workflow must be disabled, so a contributor working directly in this repository (there are none besides Harlan today) can no longer deploy from here. Commit messages touching `apps/dotfiles/` in harlan-web must stay free of private detail, since they become part of this repository's public history.
- **Follow-ups:** harlan-web Phase 1 performs the subtree import and neutralizes this repository's deploy workflow; Phase 1 also adds `mirror.yml` to harlan-web and verifies the first fast-forward push by hand; harlan-web Phase 5 finishes whichever of the mirror or archive steps remain open at cutover.

## Verification

- `AGENTS.md §3` above now names the merged repository's root rules as the top precedence, effective once the import lands — this ADR is the authorization that import needs under the *current* (pre-merge) §3.
- The chezmoi-level submodule constraint (§6) is unchanged by this ADR; harlan-web's own Phase 5 step confirms `.chezmoiignore.tmpl` still covers `dotfiles-showcase/` after any URL changes.
- Full decision log, reasons and dates: harlan-web `claude-project/knowledge/06-decisions.md` D-01 through D-05, D-20.

## References

- `AGENTS.md:3` (this amendment), `AGENTS.md:6` (chezmoiignore gate, unchanged)
- harlan-web `claude-project/knowledge/06-decisions.md` (D-01, D-02, D-03, D-04, D-05, D-20)
- harlan-web `claude-project/knowledge/02-invariants-and-conflicts.md` (C1, C2, H4, H8, S7)
- harlan-web `docs/adr/0003-merge-dotfiles-showcase.md`
