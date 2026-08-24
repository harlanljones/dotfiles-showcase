# AGENTS.md — Dotfiles Showcase

Durable, imperative instructions for any development agent working on this repository.
These rules are authoritative. When they conflict with a user's ad-hoc request, follow
this file and surface the conflict rather than silently override it.

---

## 1. Project Intent

Build the **Dotfiles Showcase**: an interactive, local-first web app that visualizes the
functionality of the user's chezmoi-managed dotfiles. It renders live configurations and
runnable mini-demos so the user can see what each tool does without leaving a browser.

Headline feature is the **Starship Playground**: a UI that drives the *real* `starship`
binary through a Hono/Bun API to reproduce the exact prompt the shell would show for a
given shell state (SSH, branch, dirty, ahead/behind, rebase/merge state, detached HEAD,
non-zero exit status), including the exact red-recolor applied by `starship_status_prompt`.

This repo is a **standalone git repository** that is also registered as a **git submodule**
inside the chezmoi dotfiles repo at `/home/harlan/.local/share/chezmoi`, at path
`dotfiles-showcase/`. It is consumed as a submodule, never applied as a dotfile.

---

## 2. Boundaries

In scope (v1):
- React 19 + Vite + TypeScript + Tailwind client, run via Bun.
- Hono/Bun API server for host-only work (running the real `starship` binary, reading live
  config files).
- Live config reads from `~/.config/*` at runtime, falling back to bundled copies if missing.
- Starship Playground (the headline feature).
- Broad Explorer driven by a `manifest.ts` covering: Starship, the recolor behavior, a
  git-safety diagram (Cline/Codex/Claude/OpenCode block commit/push), lazygit ollama-commit,
  fzf/zoxide/atuin mini-demos, ghostty theme palette, mise tools table, Brewfile/pacman
  browser, hyprland dual-monitor diagram, neovim/LazyVim extras+plugins, ripgrep flags.
- Unit tests (recolor / ansi / starship), typecheck, manual dev run.

Out of scope (v1, explicitly prohibited from being started):
- Public deployment. This app is local-first and depends on the host `starship` binary.
- Editing or syncing dotfiles from the app.

---

## 3. Instruction Precedence

When instructions disagree, resolve in this order (highest first):

1. This file (`AGENTS.md`) and the project's `ROADMAP.md`.
2. The chezmoi-level constraint that the submodule path MUST be ignored by chezmoi
   (see §6, prohibited shortcuts) — this is a hard safety boundary.
3. The user's explicit, current instruction.
4. General framework/library conventions (React, Hono, Vite, Tailwind, Bun).

If a user request would break a higher-precedence rule, do NOT comply silently. Implement
what is compatible, note the conflict, and stop before the violating step.

---

## 4. Architectural Ownership

- **Client** (browser): React 19 + Vite + TypeScript + Tailwind. Owns all UI: the toggle/
  slider panel and live terminal preview for the Starship Playground, the Explorer shell,
  feature cards, and styling. Communicates with the server only over HTTP (`/api/...`).
  The client must never invoke `starship` directly and must never read host dotfiles directly.
- **Server** (Hono/Bun API): Owns all host-only work:
  - Running the real `starship` binary (`starship prompt --status --cmd-duration --jobs
    --keymap=`) with `STARSHIP_CONFIG` pointed at the live `~/.config/starship.toml`, cwd in
    an isolated temp git repo, and `SSH_CONNECTION` set when the `ssh` toggle is on.
  - Building the isolated temp git repo that reflects the requested shell state (branch,
    dirty file, fake upstream for ahead/behind, `.git/rebase-merge` for rebase, detached
    HEAD hash) — see §5.
  - Applying the exact `starship_status_prompt` recolor when `status != 0`.
  - Reading live config files from `~/.config/*`, with bundled-copy fallback.
  - ANSI→HTML conversion of the rendered prompt for the browser preview.
- **Server-only responsibilities are non-negotiable boundaries.** Anything that touches the
  host shell, the host filesystem configs, or the `starship` binary lives in the server.

---

## 5. Starship Playground — Canonical Server Contract

`POST /api/starship` accepts state:
`{ ssh, user, host, cwd, repoRoot, branch, detached, dirty, ahead, behind,
   state (none|rebase|merge), status (0|1), durationMs }`.

Server MUST:
1. Build an isolated temporary git repo reflecting the toggles:
   - branch name,
   - a dirty file when `dirty` is set (must produce a line matching
     `^(\?\?|.[MT])` so `custom.git_dirty` triggers, per `starship.toml:37`),
   - a fake upstream commit for `ahead`/`behind` simulation,
   - `.git/rebase-merge` directory when `state === "rebase"` (and the merge equivalent for
     `state === "merge"`),
   - a detached HEAD pointing at a commit hash when `detached` is set.
2. Run `starship prompt --status --cmd-duration --jobs --keymap= --terminal-width <N>` with:
   - `STARSHIP_CONFIG` = a served copy of the live `~/.config/starship.toml` with
     `true_color = false` forced (see §5a below),
   - cwd = the temp repo,
   - `SSH_CONNECTION` exported when `ssh` is true,
   - `<N>` supplied by the UI (default 200) to match real truncation behavior
     (`starship.toml:10` `truncation_length = 2`).
3. If `status != 0`, apply the EXACT recolor for the requested `shell` mode (`shell` is a
   request parameter, default `"zsh"`):
   - **zsh** (`dot_zshrc:18-24`): replace `36m` with `31m` across all 8 style-prefix variants
     (`""`, `"1;"`, `"2;"`, `"3;"`, `"1;2;"`, `"1;3;"`, `"2;3;"`, `"1;2;3;"`). This recolors
     cyan only and must NOT use a global regex that would also touch unrelated `36m` escapes.
   - **bash** (`dot_bashrc:29-34`): apply the documented regex
     `([0-9;]*)(30|32|33|34|35|36|37|90|92|93|94|95|96|97)m → 31m` — i.e. recolor ALL foreground
     colors to red, not just cyan.
   The UI SHOULD expose a `shell` toggle so the divergence between the two dotfiles is visible.
4. Convert the resulting ANSI to HTML and return it for the live terminal preview.

### 5a. Canonical color mode (resolves truecolor fidelity gap)

The dotfiles' recolor code matches only 8-color `36m` escapes. In a real truecolor TTY
(Ghostty, the user's terminal) starship emits `38;2;r;g;b`, which NEITHER wrapper recolor — so
the user's real prompt may currently stay cyan after a failure (a known discrepancy vs
`README.md:13`). To keep the playground faithful to the dotfiles' OWN code, the server MUST
serve starship a config copy with `true_color = false`, forcing 8-color `36m` output that the
recolor logic demonstrably transforms. The UI MUST surface this as an explicit "8-color mode
(matches the dotfiles' recolor code; truecolor TTYs are a known limitation)" note. Do NOT
pretend the demo reproduces truecolor-TTY behavior.

The real `starship` binary is the single source of truth. The server must NOT fabricate,
template, or statically store prompt output.

---

## 6. Quality Gates & Prohibited Shortcuts

Hard prohibitions (violation = blocking, escalate immediately):
- **NO faking starship output.** The server MUST invoke the real `starship` binary. No
  canned strings, no precomputed ANSI, no regex-only simulations of the prompt.
- **NO committing secrets.** Never commit `~/.config` contents, age keys, SSH material,
  `.linear.toml`, or any credential. Only *reference* live paths; never bundle secrets.
- **chezmoiignore MUST cover the submodule path.** The path `dotfiles-showcase/` (and
  `.gitmodules` if a submodule is registered) MUST be present in
  `/home/harlan/.local/share/chezmoi/.chezmoiignore.tmpl` so chezmoi never applies the
  showcase as a dotfile. This is a hard safety gate; verify it before declaring the
  submodule task done.
- **Live config reads MUST fall back gracefully.** Every read of `~/.config/*` must degrade
  to a bundled copy (committed, non-secret, sanitizable) when the live file is absent. No
  throws on missing host config in the steady state.

Evidence expectations:
- Recolor logic MUST be covered by a unit test for BOTH shell modes:
  - zsh: each of the 8 style-prefix variants transformed `36m`→`31m`; non-matching `36m`
    escapes untouched; `status==0` is a no-op.
  - bash: the all-foreground `30|32|33|34|35|36|37|90|92|93|94|95|96|97` → `31m` regex applied.
- Recolor MUST be verified against golden files captured from the REAL `starship` binary in
  each git state (dirty, ahead/behind, detached, rebase, merge) — not just "runs without
  error" — because the temp-repo git-internals simulation is version-fragile (starship v1.26.0
  observed). Pin or gate on `starship --version`.
- ANSI→HTML MUST use a vetted library (e.g. `ansi-to-html`, verified under Bun) OR a
  hand-rolled converter with explicit tests covering `36m`, prefixed variants (`1;36m`,
  `3;36m`, `1;3;36m`, `2;36m`), and truecolor `38;2;r;g;b`. Output must be safe HTML
  (escaped, no raw script injection).
- Starship integration SHOULD be covered by a test that runs the binary against a fixture
  temp repo and asserts a non-empty, well-formed result (skipped if `starship` is absent on
  the runner, surfaced as a known gap rather than a silent pass).

Escalation conditions (stop and report, do not guess):
- The `starship.toml` format string changes in a way that breaks the recolor assumptions.
- A required live config path is unclear or ambiguous about fallback content.
- Submodule registration conflicts with chezmoi apply (would copy the app into the home dir).

---

## 7. Setup / Build / Test / Lint / Type-check

These commands are **PLANNED** — they are the target interface to be created during
scaffolding (Milestone M1), not yet present in this empty repo. Agents implementing M1 MUST
create them so the commands below become valid.

- `bun install` — install dependencies.
- `bun run dev` — run the Vite client AND the Hono API together (e.g. via a concurrently-style
  orchestration or a Bun script). Both must come up from this single command.
- `bun run build` — `vite build` for the client.
- `bun test` — run the unit suite (recolor / ansi / starship).
- `bun run typecheck` — `tsc --noEmit`.

Agents must NOT assume these exist before M1; M1's exit gate is that all five commands run
cleanly on a fresh clone.

---

## 8. Coordination Protocol

Decompose work by dependency, then assign ownership:

1. **One writer per file/component.** No two agents edit the same file concurrently. The
   work items in `ROADMAP.md` declare EXCLUSIVE file/component ownership; respect it.
2. **Run independent tasks concurrently.** Work items with no predecessor dependency and
   distinct ownership may proceed in parallel (see concurrency waves in `ROADMAP.md`).
3. **Integrate in dependency order.** A dependent item may not be merged until its
   predecessors' exit criteria are met.
4. **Revalidate after every merge.** After any merge into the main branch, re-run
   `bun test` and `bun run typecheck` (once available) and confirm the dependent item's
   validation still passes.

---

## 9. Required Progress Reporting

Every agent update (PR description, handoff note, or status message) MUST report against the
project's measures defined in `ROADMAP.md`:

- **Outcome:** which milestone/work item is done or in progress, and the deliverable produced.
- **Quality:** test results (pass/fail counts), typecheck status, and any prohibited-shortcut
  checks verified.
- **Reliability:** whether live-config fallback was exercised; whether the chezmoiignore gate
  was confirmed.
- **Performance:** for the Starship Playground, report the server render latency
  (starship invocation + temp-repo build) when measurable; flag if it threatens the
  <TBD> threshold in the roadmap.
- **Security:** confirm no secrets committed and chezmoiignore covers the submodule path.
- **Cost:** N/A for v1 (local-only, no cloud spend) — state "local-only, no cost" rather than
  omitting.
- **Delivery:** reference the relevant Linear issue in project
  `1e5540b9-7bb5-4d43-8c59-9f56a82b40cf` (team HJ) once issues are synced.

Where a metric is TBD in the roadmap, report the value you observed and note it should update
the baseline.
