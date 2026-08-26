# ROADMAP.md — Dotfiles Showcase

Executable plan. Work items have stable IDs, exclusive ownership, and measurable exit
criteria. Metrics that are unknown are marked **TBD** with the reason and an early task to
establish them. Do not invent baselines, owners, budgets, dates, or targets.

Linear project: `6a256cdee686` — **Dotfiles Showcase** (team **HJ**).
Historical placeholder `1e5540b9-7bb5-4d43-8c59-9f56a82b40cf` is superseded; all DEPLOY tickets live in `6a256cdee686`.
Work item IDs below are the canonical local IDs; map each to a Linear issue in that project
when sync happens.

---

## 1. Current State, Objective, Scope

**Current state:** Shipped local-first showcase; Cloudflare Workers public mirror already
deployed (ADR-001). Submodule already registered at
`/home/harlan/.local/share/chezmoi/dotfiles-showcase/`. v1 (M1–M6) and v2
(DEPLOY-01..08, TC-01, FB-01) are complete; see §6 integration checkpoints. It will become a git submodule of
`/home/harlan/.local/share/chezmoi` at `dotfiles-showcase/`.

**Objective:** Ship a local-first web app that visualizes chezmoi-managed dotfile
functionality, headlined by a Starship Playground that drives the real `starship` binary via
a Hono/Bun API and reproduces the exact prompt (including the `starship_status_prompt`
recolor) for a chosen shell state.

**Scope (v1 — local-first, shipped):**
- React 19 + Vite + TypeScript + Tailwind client (Bun).
- Hono/Bun API server for host-only work (starship execution, live config reads).
- Live config reads from `~/.config/*` with bundled fallback.
- Starship Playground (toggle/slider panel + live terminal preview).
- Broad Explorer via `manifest.ts`: Starship, recolor, git-safety diagram, lazygit
  ollama-commit, fzf/zoxide/atuin mini-demos, ghostty palette, mise table, Brewfile/pacman
  browser, hyprland dual-monitor diagram, neovim/LazyVim extras+plugins, ripgrep flags.
- Tests (recolor/ansi/starship), typecheck, manual dev run.

**Scope (v2 — public Workers, added DEPLOY-01 / ADR-001):**
- Dual-mode runtime: `bun run dev` (Bun, real starship) remains canonical; Cloudflare Workers
  is a read-only public mirror serving `dist/` + `/api/*` via Workers assets.
- On Workers: no `starship` binary, no `~/.config/*` host reads — `/api/starship` returns
  `{ degraded: true }` snapshot from `fallback/starship.toml` + recolor; every config read
  degrades to `fallback/*`; UI banners the degraded state.
- CI/CD via `wrangler deploy` (GitHub Actions, `workers.dev` previews).

**Non-goals (v1 + v2):** editing/syncing dotfiles from the app (read-only showcase in both modes).

**Assumptions:**
- A `starship` binary is available on the host where the API runs (the app is local-first).
- `~/.config/starship.toml` exists on the host; otherwise bundled fallback is used.
- The chezmoi repo already exists at `/home/harlan/.local/share/chezmoi` and supports
  `.chezmoiignore.tmpl` + submodule registration.
- Bun is the package manager and runtime.

**Resolved decisions (updated after execution):**
- D1: `dev.ts` Bun orchestrator spawns Vite + Hono via `Bun.spawn`; either exiting kills both.
- D2: bundled fallbacks follow a per-file strategy recorded in `fallback/README.md`
  (FULL-COPY / TRIMMED-SAMPLE / SYNTHETIC), each with its live source path and
  sanitization notes; no host secrets or host-identifying literals are ever committed.
- D3: git-safety diagram is static (agent cards + flow strip) — sufficient for v1.
- D4: manifest schema = typed registry (`src/manifest.ts`: id/title/blurb/kind) mapping to
  one component per card; server exposes `/api/cards/:key` with per-key builders.
- D5: submodule hosted at github.com/harlanljones/dotfiles-showcase (branch main).
- D6 (DEPLOY-01 / ADR-001): dual-mode runtime — local Bun+Hono (real starship, live configs)
  remains canonical; Cloudflare Workers (workerd, assets) is a read-only public mirror with
  degraded starship (`degraded: true` + fallback toml + recolor) and fallback-only config reads.
  See `docs/adr/001-workers-deployment.md` and `AGENTS.md §5b`.

**Unresolved decisions (open — see §8 decision gates):**
- D5 (BLOCKER for SUB-02): Submodule hosting / remote URL. `git submodule add <url>
  dotfiles-showcase` requires a resolvable URL; the chezmoi new-machine bootstrap
  (`chezmoi init`) will fail on `git submodule update --init` if the showcase repo is not
  hosted where bootstrap can fetch it. Must be resolved (push to a remote, or document
  `--skip-submodules` / optional-submodule guarding) BEFORE SUB-02 executes.

**Resolved design decisions (from critique — do not reopen without re-review):**
- **Color mode (F2):** the server serves starship a config copy with `true_color = false`,
  forcing 8-color `36m` output so the dotfiles' recolor code demonstrably applies. Truecolor
  TTYs are a known limitation, surfaced in the UI (see `AGENTS.md §5a`). This is canonical.
- **Recolor shell semantics (F1):** support BOTH `shell: "zsh"` (cyan-only, 8 variants) and
  `shell: "bash"` (all-foreground → red) via a request param + UI toggle, so the divergence
  between `dot_zshrc` and `dot_bashrc` is visible. Default `zsh`.
- **ANSI→HTML (F7):** use a vetted library (`ansi-to-html`) verified under Bun, wrapped for
  safe HTML output; add explicit tests for prefixed + truecolor sequences.
- **Nerd Font (F9):** self-host JetBrainsMono Nerd Font via `@font-face` (bundled in the
  client) rather than relying on a system install, so glyphs render in the browser preview.
- **Per-card scope (F10):** fzf/zoxide/atuin cards are explicitly SIMULATED mini-demos (those
  tools are TUI/native-DB and cannot run meaningfully in-browser). Each card has a "done"
  definition: Star = live-or-fallback config rendered + demo functional.

---

## 2. Metrics

No baselines exist yet (empty repo, no running app). Targets marked TBD are to be established
by the early tasks noted. Do not treat TBD as zero.

| Metric | Baseline | Target / Threshold | Measurement Method | Owner | Review Cadence |
|---|---|---|---|---|---|
| Build/install success on fresh clone | established M1 | `bun install` + `bun run build` succeed | fresh-clone CI run | M1 owner | per merge |
| Typecheck clean | clean (M1–M5) | `tsc --noEmit` exits 0 | `bun run typecheck` | M1 owner | per merge |
| Unit test pass rate | 53/53 (M4) | 100% of recolor/ansi/starship/configs tests pass | `bun test` | M2/M3 owners | per merge |
| Starship render latency (server) | p50 ≈ 61 ms, p95 ≈ 73 ms (10 renders, incl. temp-repo build; re-measured DEPLOY-08) | **p95 < 500 ms** (proposed, accepted DG-4) | server timing via curl wall-clock | M3 owner | per merge |
| Workers degraded render latency (edge) | local workerd: p50 ≈ 6 ms, p95 ≈ 15 ms; **live deploy**: p50 ≈ 88 ms, p95 ≈ 150 ms incl. network RTT (8 renders, DEPLOY-08) | informational — no binary on edge | curl wall-clock vs `wrangler dev` + deployed workers.dev URL | DEPLOY-08 owner | per merge |
| Workers deployment | `https://dotfiles-showcase.harlanljones.workers.dev` (version b835f72f) | health + degraded starship + cards + SPA smoke green | curl against deployed URL | DEPLOY-08 owner | per deploy |
| Recolor correctness (8-color + truecolor) | golden tests green | both shell modes transform expected escapes; golden-file match | unit + behavioral tests | M2/M3 owner | per merge |
| Git-state sim parity vs real repos | behavioral goldens green (v1.26.0 pinned) | output matches real `starship` output per state | behavioral diff vs binary | M3 owner | per merge |
| Live-config fallback coverage | exercised: brew live-miss → fallback (Linux host); all others live | all live reads have a fallback path | code review + test | M4 owner | per milestone |
| chezmoiignore covers submodule | verified SUB-01 | `dotfiles-showcase/` in `.chezmoiignore.tmpl` | grep check | M1 owner | once, + per merge |
| Secrets committed | 0 | 0 | repo scan / review | all | per merge |
| No-fake-starship compliance | upheld (real binary only) | real binary invoked, no canned output | code review + test | M3 owner | per merge |

**Why the TBDs matter / early tasks to establish them:**
- **Starship render latency baseline (TBD):** needed to set a real threshold; until measured
  we cannot claim performance adequacy. Early task: M3 measures p50/p95 on first working
  build and proposes a threshold.
- **Test/build baselines (TBD):** a fresh repo has no historical pass rate; baselines are
  established the first time M1/M2/M3 green. Record them in this table after first green run.
- **Live-config fallback coverage baseline:** 7/7 live cards (19 assertions) render from
  bundled fallbacks with all home configs hidden and the derived pacman command unavailable —
  `server/lib/cardsFallback.test.ts` (executable gate, runs with `bun test`).

---

## 3. Milestone Exit Gates

- **M1 (Scaffold + tooling + submodule/ignore/README):** all five PLANNED commands run on a
  fresh clone (`bun install`, `bun run dev`, `bun run build`, `bun test`, `bun run typecheck`);
  `dotfiles-showcase/` present in chezmoi `.chezmoiignore.tmpl`; submodule registered; README
  section links to the showcase.
- **M2 (recolor.ts + ansi.ts + tests):** 8-variant recolor test passes; ANSI→HTML test passes;
  `bun test` green.
- **M3 (starship.ts + StarshipPlayground):** `/api/starship` builds a temp repo per state,
  runs real starship, applies exact recolor on `status!=0`, returns ANSI→HTML; integration
  test (when starship present) passes; manual `bun run dev` shows live preview.
- **M4 (configs.ts + manifest.ts + feature components):** every manifest entry has a
  live-source + fallback; all feature components render with live-or-fallback config.
- **M5 (Explorer shell + styling):** all cards reachable from the explorer; responsive/Tailwind
  styling consistent; no console errors in manual run.
- **M6 (Verification):** `bun test` + `bun run typecheck` green; manual `bun run dev` walkthrough
  of Playground + Explorer succeeds; chezmoiignore + no-secret checks confirmed.

**Requirement → critique → work traceability:**

| Requirement / Critique | Addresses | Work item(s) |
|---|---|---|
| Real starship binary must render, not faked | no-fake-starship gate | S-01, S-02, S-03 |
| Exact recolor matches `dot_zshrc` (8 variants) | correctness of failure coloring | RC-01, S-03 |
| Live config with graceful fallback | resilience, no hard failures | CFG-01, MAN-01 |
| Submodule must never be applied by chezmoi | safety boundary | SUB-01, SUB-02 |
| Broad coverage of dotfile tools | user value / scope | MAN-01, FE-01..FE-10 |
| Local-first, no deploy | scope boundary | ARCH (M1) |
| No secrets committed | security | SUB-01, all |

---

## 4. Dependency Graph, Critical Path, Concurrency Waves

**Predecessors:**
- M1 → (everything)
- M2 → M1
- M3 → M1, M2 (needs recolor + ansi)
- M4 → M1 (configs) and can start partly after M2 (ansi for display)
- M5 → M3, M4
- M6 → M5

**Critical path:** M1 → M2 → M3 → M5 → M6 (Playground is the headline; Explorer (M4) can
float but must finish before M5).

**Concurrency waves (safe parallel, distinct ownership):**
- **Wave 0 (parallel within M1):** SCA-01 (scaffold/client), SCA-02 (server scaffold),
  SUB-01 (chezmoiignore), SUB-02 (submodule+README). All independent files.
- **Wave 1 (after M1):** RC-01 (recolor) and AN-01 (ansi) in parallel (distinct files, both
  pure functions).
- **Wave 2 (after M2):** S-01 (temp-repo builder), S-02 (starship runner) can partly run
  after M1 but depend on ansi at integration; FE components for Explorer (FE-01..FE-10) can
  start after M1 in parallel with M3 work since they own distinct component files.
- **Wave 3 (after M4):** M5 explorer shell integrates all feature components.

Note: FE components (FE-01..FE-10) and manifest (MAN-01) and configs (CFG-01) are mostly
independent of each other file-wise and can be heavily parallelized once M1/M2 foundations
exist; coordinate ownership via the table in §5 to avoid file collisions.

---

## 5. Work Items

IDs are stable. "Ownership" = EXCLUSIVE file/component; no concurrent edit by another agent.
"Validation" + "Exit criterion" are how the item is accepted.

### M1 — Scaffold, tooling, submodule/ignore/README
- **SCA-01** — Scaffold client. Deps: none. Role: scaffold agent.
  Ownership: `package.json`, `vite.config.*`, `tsconfig*.json`, `index.html`,
  `src/main.tsx`, `src/App.tsx`, Tailwind config, and self-hosted **JetBrainsMono Nerd Font**
  via `@font-face` (bundled asset) so preview glyphs render without a system install (F9).
  Deliverable: runnable Vite+React+Tailwind skeleton with the Nerd Font wired.
  Validation: `bun install` + `bun run dev` (client) starts; font loads in preview.
  Exit: client boots with a placeholder page; `bun run typecheck` scaffolds clean.

- **SCA-02** — Scaffold Hono/Bun API + dev orchestration. Deps: SCA-01. Role: scaffold agent.
  Ownership: `server/` entry (e.g. `server/index.ts`), `bun run dev` wiring (concurrently-style
  script starting both client and API).
  Deliverable: `bun run dev` brings up client + API; `bun run build` builds client.
  Validation: both processes start from one command; `bun test` runs (even if empty suite).
  Exit: all five PLANNED commands exist and run on fresh clone.

- **SUB-01** — chezmoiignore safety. Deps: none. Role: chezmoi-integration agent.
  Ownership: edit `/home/harlan/.local/share/chezmoi/.chezmoiignore.tmpl` to add
  `dotfiles-showcase/` (and `.gitmodules` if registered).
  Deliverable: ignore rule present and verified.
  Validation: grep confirms `dotfiles-showcase/` in the file; `chezmoi apply --dry-run`
  does not list the showcase as a target.
  Exit: chezmoiignore covers the submodule path (hard gate).

- **SUB-02** — Register submodule + README link. Deps: SUB-01 (ignore first).
  Role: chezmoi-integration agent.
  Ownership: `git submodule add` into chezmoi at `dotfiles-showcase/`; add a "Dotfiles
  Showcase" section to `/home/harlan/.local/share/chezmoi/README.md` linking the project.
  Deliverable: submodule registered; README section present.
  Validation: `git submodule status` shows the entry; README contains the section.
  Exit: submodule resolves and README links it.

### M2 — recolor.ts + ansi.ts + tests
- **RC-01** — recolor.ts. Deps: M1. Role: lib agent.
  Ownership: `src/server/lib/recolor.ts` (+ test `recolor.test.ts`).
  Deliverable: function replacing `36m`→`31m` across the 8 style-prefix variants only.
  Validation: unit test asserts each of `""/"1;"/"2;"/"3;"/"1;2;"/"1;3;"/"2;3;"/"1;2;3;"`
  is transformed and unrelated `36m` escapes are untouched; `status==0` is a no-op.
  Exit: test passes; behavior matches `dot_zshrc` `starship_status_prompt`.

- **AN-01** — ansi.ts (ANSI→HTML). Deps: M1. Role: lib agent.
  Ownership: `src/server/lib/ansi.ts` (+ test `ansi.test.ts`), wrapping the vetted
  `ansi-to-html` library (verify it runs under Bun; otherwise hand-roll with the same tests).
  Deliverable: ANSI escape → HTML converter for terminal preview, safe against injection.
  Validation: unit test for representative SGR sequences including `36m`, prefixed variants
  (`1;36m`, `3;36m`, `1;3;36m`, `2;36m`), and truecolor `38;2;r;g;b`; output escaped.
  Exit: test passes; output is safe HTML.

### M3 — starship.ts (temp repo sim) + StarshipPlayground
- **S-01** — temp-repo builder. Deps: M1. Role: server agent.
  Ownership: `src/server/lib/tempRepo.ts`.
  Deliverable: builds isolated temp git repo from state {branch, dirty, ahead, behind,
  detached, state(rebase/merge)} (fake upstream, `.git/rebase-merge`, detached HEAD hash).
  Validation: test creates repo and asserts branch/dirty/ahead-behind/rebase/detached reflect
  toggles.
  Exit: builder reproduces all documented states.

- **S-02** — starship runner + /api/starship. Deps: S-01, RC-01, AN-01. Role: server agent.
  Ownership: `src/server/routes/starship.ts` (+ integration test `starship.test.ts`).
  Deliverable: `POST /api/starship` runs real `starship prompt --status --cmd-duration
  --jobs --keymap= --terminal-width <N>` with `STARSHIP_CONFIG`=served copy of live
  `~/.config/starship.toml` forced to `true_color = false`, cwd=temp repo,
  `SSH_CONNECTION` when ssh, `shell` param selecting zsh/bash recolor; applies recolor on
  `status!=0`; returns ANSI→HTML. Pin/gate on `starship --version` (observed v1.26.0).
  Validation: integration test runs binary against fixture temp repos and asserts non-empty
  well-formed result; GOLDEN-FILE tests assert the simulated output matches real `starship`
  output for each state (dirty, ahead/behind, detached, rebase, merge) — skipped if starship
  absent, surfaced as a gap; recolor test for `status!=0` in both shell modes.
  Exit: endpoint returns real rendered prompt; no faking; matches `AGENTS.md §5/§5a` contract.

- **S-03** — StarshipPlayground UI. Deps: S-02, AN-01. Role: client agent.
  Ownership: `src/components/StarshipPlayground.tsx` (+ its styles/hook).
  Deliverable: toggle/slider panel for state + live terminal preview calling `/api/starship`.
  Validation: manual `bun run dev` shows live preview updating with toggles, including red
  recolor on `status=1`.
  Exit: UI drives the real endpoint and renders the preview correctly.

### M4 — configs.ts + manifest.ts + feature components
- **CFG-01** — live config reader. Deps: M1. Role: server agent.
  Ownership: `src/server/lib/configs.ts`.
  Deliverable: reads `~/.config/*` with bundled-copy fallback for every needed config.
  Validation: test for missing-file fallback; no throws on absent host config.
  Exit: all reads have a fallback path.

- **MAN-01** — manifest.ts. Deps: CFG-01. Role: content agent.
  Ownership: `src/manifest.ts` (schema per D4).
  Deliverable: declares all Explorer entries (Starship, recolor, git-safety, lazygit
  ollama-commit, fzf/zoxide/atuin, ghostty, mise, Brewfile/pacman, hyprland, neovim/LazyVim,
  ripgrep) each with live-source + fallback.
  Validation: every entry references a CFG-01 source or fallback; typecheck clean.
  Exit: manifest enumerates all required cards.

- **FE-01..FE-10** — feature components (one ID per card group, exclusive component files
  under `src/components/explorer/`): FE-01 Starship card, FE-02 recolor demo, FE-03
  git-safety diagram, FE-04 lazygit ollama-commit, FE-05 fzf/zoxide/atuin, FE-06 ghostty
  palette, FE-07 mise table, FE-08 Brewfile/pacman browser, FE-09 hyprland dual-monitor
  diagram, FE-10 neovim/LazyVim + ripgrep. Deps: MAN-01 (each consumes manifest).
  Role: client agents (parallelizable, distinct files).
  Ownership: `src/components/explorer/<Feature>.tsx` each.
  Deliverable: card renders live-or-fallback config + demo. FE-05 (fzf/zoxide/atuin) is an
  explicitly SIMULATED mini-demo (those tools are TUI/native-DB; cannot run in-browser).
  Validation: manual dev run shows each card; no console errors; FE-05 labeled "simulated".
  Exit: each card meets its deliverable with a clear "done" definition.

### M5 — Explorer shell + styling
- **EXP-01** — Explorer shell + layout/styling. Deps: S-03, FE-01..FE-10. Role: client agent.
  Ownership: `src/components/Explorer.tsx`, app routing/layout, global Tailwind styles.
  Deliverable: all cards reachable; consistent responsive styling; Playground + Explorer
  navigable.
  Validation: manual walkthrough; typecheck + test green.
  Exit: no console errors; all sections reachable.

### M6 — Verification
- **VER-01** — Final verification. Deps: EXP-01. Role: QA agent.
  Ownership: repo-wide (no new source; runs gates).
  Deliverable: `bun test` + `bun run typecheck` green; manual `bun run dev` walkthrough;
  chezmoiignore + no-secret checks.
  Validation: all M1–M5 exit criteria reconfirmed.
  Exit: project meets v1 objective; ready for Linear issue closure.

---

## 6. Integration Checkpoints

- **IC-1 (after M1):** fresh clone runs all five commands; chezmoiignore verified.
- **IC-2 (after M2):** recolor + ansi unit suites green; lib functions importable by server.
- **IC-3 (after M3):** `/api/starship` returns real rendered prompt end-to-end; Playground
  UI live. Re-run `bun test` + `typecheck`.
- **IC-4 (after M4):** every Explorer card renders with live-or-fallback config.
  ✅ Verified live in-browser + automated (`render.test.tsx`, `cardsFallback.test.ts`):
  all 11 cards walked; badges observed — recolor/lazygit/ghostty/mise/hyprland/neovim/
  ripgrep LIVE (ghostty & neovim dual-source), packages FALLBACK(brew)+LIVE(pacman),
  fuzzy SIMULATED, git-safety static.
- **IC-5 (after M5):** full app walkthrough; revalidate all prior gates.
  ✅ Walked via `bun dev` in-browser: Playground drives the real starship binary
  ("Git main ❯" with dirty state toggled), then all 11 Explorer cards — zero
  console/page errors. Gates revalidated: 106/106 tests, typecheck 0 errors,
  production build clean.

After each IC, re-run `bun test` and `bun run typecheck` (once available) before proceeding.

---

## 7. Risks, Triggers, Mitigations

| Risk | Trigger | Mitigation |
|---|---|---|
| chezmoi applies the app as a dotfile | `dotfiles-showcase/` missing from `.chezmoiignore.tmpl` | SUB-01 hard gate; verify with `chezmoi apply --dry-run` (IC-1) |
| Fake starship output slips in | cached/precomputed ANSI in server | RC/S-02 tests assert real binary; code review (no-fake gate) |
| Recolor diverges from `dot_zshrc` | starship.toml format change | RC-01 test pins 8 variants; escalate on format change |
| Missing live config crashes app | host lacks `~/.config/*` file | CFG-01 fallback; test missing-file path |
| Secrets committed | bundling host configs | SUB-01/CFG-01 sanitize; repo scan in VER-01 |
| Submodule vs chezmoi conflict | registration breaks `chezmoi apply` | SUB-01 before SUB-02; escalate on conflict |
| Render latency too high | measured p95 > TBD threshold | S-02 timing log; optimize temp-repo build |
| Parallel file collisions | two agents edit same file | exclusive ownership in §5; one writer per file |
| Playground misrepresents real prompt (truecolor TTY) | starship emits `38;2;...` in real TTY; recolor code only matches `36m` | force `true_color=false` served config (§5a); surface limitation in UI; F2 |
| zsh vs bash recolor divergence | two dotfiles differ (cyan-only vs all-fg→red) | expose `shell` toggle, both implemented (F1) |
| Submodule bootstrap fails on new machine | no remote URL for `git submodule update --init` | resolve D5 hosting before SUB-02; document `--skip-submodules` fallback (F3) |
| Git-state sim drifts from real starship | starship version change breaks temp-repo internals | golden-file tests + version pin (F5) |

---

## 8. Decision Gates

- **DG-0 (BEFORE M1):** resolve D5 (submodule hosting/remote). If no remote is chosen,
  SUB-02 must use an optional/guarded submodule or `--skip-submodules` bootstrap. Hard gate.
- **DG-1 (M1):** resolve D1 (dev orchestration) — pick concurrently-style Bun script.
- **DG-2 (M4):** resolve D2 (fallback content) and D4 (manifest schema) before FE work.
- **DG-3 (M4):** resolve D3 (git-safety diagram static vs interactive).
- **DG-4 (M3):** accept the measured Starship render latency baseline and set the TBD
  threshold in §2; also accept the recolor-correctness and git-state-parity golden baselines.
- **DG-5 (TC-01 / HJ-431):** accept the truecolor recolor extension that amends the canonical
  F2 decision. Both dotfiles wrappers now recolor truecolor cyan `38;2;r;g;b` (palette cyan) →
  red, preserving per-shell semantics. The palette cyan/red RGB is matched exactly
  (`[46,222,250]`/`[255,102,92]` defaults, i.e. `#2EDEFA`/`#FF665C`); if a custom hex palette
  is introduced the wrapper constants must be revisited. The showcase exposes this behind an
  explicit opt-in "Truecolor preview (proposed fix)" toggle, labeled as not-current behavior.
  Implementation note: the server renders starship via `spawnSync` (no truecolor TTY), so the
  binary emits 8-color `36m`; the preview elevates that output to `38;2` (cyan → `#2EDEFA`) and
  replays the real recolor. Pinned to starship 1.26.0.

Open decisions not resolvable here (flagged to user): D1, D3–D4 above; D5 (submodule hosting).
(D2 is resolved: see `fallback/README.md` for the per-file fallback strategy and sanitization.)
