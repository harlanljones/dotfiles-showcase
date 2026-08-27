# Dotfiles Showcase

A local-first, interactive web app that visualizes and explores chezmoi-managed dotfiles. Browse live configurations, explore tool settings, and run mini-demos—all from a single browser interface. Built with React, Vite, TypeScript, and Tailwind.

[AGENTS.md](./AGENTS.md) · [ROADMAP.md](./ROADMAP.md) · [DESIGN.md](./DESIGN.md) · [review captures](./docs/review/)

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager & runtime)
- `starship` binary on the host (drives the live Playground)
- `~/.config/starship.toml` (optional; or use bundled fallback)

### Installation & Running

```bash
# Install dependencies
bun install

# Start development server (both client + API together)
bun run dev

# Build for production
bun run build

# Run unit tests
bun test

# Type-check
bun run typecheck
```

The development server brings up:
- **Client:** http://localhost:5173 (React + Vite + Tailwind)
- **API:** http://localhost:3000 (Hono + Bun)

---

## Deployment (Cloudflare Workers, v2)

The app ships **dual-mode** (ADR-001): `bun run dev` remains the canonical,
high-fidelity path; Cloudflare Workers hosts a **read-only public mirror**.

```bash
# Regenerate Env types after editing wrangler.jsonc (never hand-write Env)
bun run wrangler:types

# Run the Workers build locally (workerd; serves dist/ + /api/*, degraded starship)
bun run wrangler:dev

# Deploy to Cloudflare Workers (needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
bun run wrangler:deploy
```

CI/CD: `.github/workflows/deploy.yml` runs install → typecheck → test → build on every
push/PR; PRs get a `wrangler deploy --dry-run` gate and pushes to `main` deploy to
`https://dotfiles-showcase.<account>.workers.dev`. Set `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets — never commit them.

### Degraded mode on Workers

Workers has no `starship` binary and no host filesystem. There:

- `POST /api/starship` returns `{ degraded: true, ... }` — a static reconstruction from the
  bundled `fallback/starship.toml` with the exact recolor applied, plus a warning string.
- The UI renders an explicit **degraded banner**; it never claims to be a live render.
- Every config read degrades to the committed `fallback/*` snapshots (CFG-01). These are
  point-in-time sanitized copies — refresh them with `bun run fallbacks:refresh`
  (verify with `bun run fallbacks:check`) when your live configs change; see
  `fallback/README.md`.
- The local Bun path still invokes the real binary and reads live configs (no-fake gate).

---

## Architecture

### Client (React 19 + Vite + TypeScript + Tailwind)

Owned **entirely** by the browser. Responsible for:
- **Explorer UI:** Browse and explore feature cards for all dotfile tools
- **Live Previews:** Real-time visualization of configurations
- **Styling:** Responsive Tailwind design with bundled JetBrainsMono Nerd Font
- **Communication:** HTTP-only (`/api/...`) — no direct shell or filesystem access

### Server (Hono API + Bun Runtime)

Owned **entirely** by the server. Handles all host-only work:

1. **Live Config Reads:** Fetches `~/.config/*` at runtime with graceful fallback to bundled non-secret snapshots

2. **Tool Execution:** Runs host binaries safely in isolated contexts where applicable

   The Dots CLI is the deliberate exception: `/api/cards/dots` only reads and parses the
   Bash source. The app never invokes `dots`, `chezmoi`, `dots-push`, git, or Ollama for that room.

3. **Starship Playground:** Headline feature demonstrating real binary integration:
   - Runs actual `starship` binary with isolated temporary git repository
   - Reflects shell state (branch, dirty files, ahead/behind, rebase/merge/detached)
   - Live `~/.config/starship.toml` with `true_color = false` for recolor demonstration
   - Applies exact shell-specific recolor on non-zero exit status
   - Converts ANSI to HTML for browser preview

4. **ANSI→HTML Conversion:** Safely renders terminal escapes for browser display

### Directory Structure

```
.
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component
│   ├── manifest.ts              # Feature card registry
│   └── components/
│       ├── StarshipPlayground.tsx (headline demo)
│       └── explorer/
│           ├── StarshipCard.tsx
│           ├── RecolorDemo.tsx
│           └── ... (feature cards)
├── server/
│   ├── index.ts                 # Hono API server
│   ├── routes/
│   │   └── starship.ts          # POST /api/starship endpoint
│   └── lib/
│       ├── recolor.ts           # Recolor transformation logic
│       ├── ansi.ts              # ANSI→HTML converter
│       ├── tempRepo.ts          # Git state simulator
│       └── configs.ts           # Live config reader + fallback
├── tests/                       # Unit test suite
├── fallback/                    # Bundled non-secret config snapshots
├── public/                      # Static assets (Nerd Font)
├── dev.ts                       # Dev orchestrator (spawns client + server)
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies
```

---

## Feature Explorer

Browse and interact with your dotfile tools and configurations:

- **Starship:** Full interactive playground inline — drives the real binary from the card (no separate tab)
- **Recolor:** Shell failure-status color transformation showcase
- **Git Safety:** Diagram of commit/push guardrails (Cline/Codex/Claude/OpenCode blocks)
- **Lazygit + Ollama:** Commit message generation flow
- **fzf, zoxide, atuin:** Interactive mini-demos (simulated; these are TUI/native-DB tools)
- **Ghostty:** Theme palette browser
- **mise:** Tools and versions table
- **Brewfile & pacman:** Package manager browser
- **Hyprland:** Dual-monitor diagram
- **Dots CLI:** Read-only command map, sanitized workflow simulator, and exact served handler source
- **Neovim & LazyVim:** Extras and plugins reference
- **ripgrep:** Flags and options reference

Each card renders live configuration data where available, with bundled fallback content if the host config is absent.

---

## Starship Playground

The **Starship Playground** is the Explorer's Starship card — the headline feature, integrating with real host binaries. It sits inside the Explorer with the same weight as the other cards and drives the actual `starship` binary through a UI with toggles for:

- **SSH Mode:** Sets `SSH_CONNECTION` environment variable
- **Git State:** Branch name, detached HEAD, dirty working tree, ahead/behind commits
- **Rebase/Merge:** Simulates `.git/rebase-merge` or `.git/merge-head` state
- **Exit Status:** Non-zero exit to trigger shell-specific recolor
- **Command Duration:** Milliseconds for the duration module
- **Terminal Width:** Matches real truncation behavior

The server builds an isolated temporary git repository reflecting each state, runs `starship prompt` against it, and applies your dotfiles' exact recolor logic (both zsh and bash modes).

### Color Mode & Fidelity

The server forces `true_color = false` in the starship config to emit 8-color `36m` (cyan) escapes that your recolor code demonstrably transforms to `31m` (red). This demonstrates what the recolor logic *does* match in 8-color mode, though it surfaces a known gap: in a real truecolor TTY (Ghostty), starship emits `38;2;r;g;b` which the recolor code doesn't yet handle.

---

## Project Scope & Constraints

### In Scope (v1)

- React 19 + Vite + TypeScript + Tailwind client
- Hono/Bun API server for host-only work
- Live config reads with bundled fallback
- Feature Explorer covering 12 dotfile tools
- Starship Playground (live binary integration)
- Unit tests for recolor, ANSI, and starship integration
- Full typecheck, zero console errors

### Out of Scope (v1)

- **No dotfile editing or syncing.** The showcase is read-only and visualization-focused
  in both local and Workers modes.

### Hard Safety Boundaries

- **No faking binary output (local).** Any host binary execution is real—no canned strings, no precomputed output. The Workers degraded snapshot (`degraded: true`) is the sole, explicitly-bannered exception (ADR-001).
- **No secrets committed.** Never bundle credentials, SSH keys, age keys, or `.linear.toml`. Only reference live paths; bundled content is non-secret snapshots only.
- **chezmoiignore covers the submodule.** The path `dotfiles-showcase/` must be in `/home/harlan/.local/share/chezmoi/.chezmoiignore.tmpl` so chezmoi never applies the app as a dotfile.
- **Live config reads must fall back gracefully.** No throws or crashes when host config is absent — locally to `fallback/`, on Workers always `fallback/`.

---

## Submodule Integration

This repository is registered as a git submodule inside your chezmoi dotfiles repo at:

```
/home/harlan/.local/share/chezmoi/dotfiles-showcase/
```

The submodule is consumed as-is; it is **never** applied by chezmoi as a dotfile (guarded by `.chezmoiignore.tmpl`).

### Setup (New Machine)

When bootstrapping a new machine:

```bash
chezmoi init https://github.com/harlanljones/dotfiles
cd ~/.local/share/chezmoi
git submodule update --init dotfiles-showcase/
cd dotfiles-showcase
bun install
bun run build
```

---

## Development Workflow

### Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start dev server (client + API together) |
| `bun run dev:client` | Vite dev server only (port 5173) |
| `bun run dev:server` | Hono API server only (port 3000) |
| `bun run build` | Build client for production |
| `bun test` | Run unit test suite |
| `bun run typecheck` | Type-check (tsc --noEmit) |
| `bun run wrangler:types` | Regenerate Workers `Env` types from `wrangler.jsonc` |
| `bun run wrangler:dev` | Run the Workers build locally via workerd (degraded starship) |
| `bun run wrangler:deploy` | Deploy to Cloudflare Workers |

### Testing Strategy

- **Unit tests** for recolor logic (both zsh and bash modes)
- **Unit tests** for ANSI→HTML conversion (including truecolor `38;2;r;g;b` handling)
- **Integration tests** for starship invocation (if binary is available; skipped otherwise)
- **Golden file tests** to ensure temp-repo git-state simulation matches real `starship` output
- **Parser and fallback tests** for the Dots CLI source map; the suite never executes `dots`

### Type Safety

Strict TypeScript configuration:
- `strict: true` for full type checking
- ESNext target with bundler module resolution
- React JSX transform (React 19)

---

## Dependencies

### Runtime

- **[react](https://react.dev)** (19.1.0) — UI framework
- **[react-dom](https://react.dev)** (19.1.0) — Browser rendering
- **[hono](https://hono.dev)** (4.9.0) — Web API framework
- **[ansi-to-html](https://www.npmjs.com/package/ansi-to-html)** (0.7.2) — Terminal escape to HTML

### Dev / Build

- **[vite](https://vitejs.dev)** (7.1.0) — Frontend bundler
- **[@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)** (5.0.0) — React integration
- **[tailwindcss](https://tailwindcss.com)** (4.0.0) — Utility-first CSS
- **[@tailwindcss/vite](https://tailwindcss.com)** (4.0.0) — Tailwind + Vite integration
- **[typescript](https://www.typescriptlang.org)** (5.9.0) — Language & type checker
- **[bun](https://bun.sh)** — Package manager & runtime

---

## Roadmap

This project follows an explicit milestone-based roadmap with measurable exit criteria. See [ROADMAP.md](./ROADMAP.md) for:

- **Milestones M1–M6:** Scaffolding → libraries → Starship Playground → Explorer → integration → verification
- **Work item breakdown:** 20+ clearly scoped items with exclusive ownership
- **Metrics & gates:** Build success, typecheck, test pass rates, recolor correctness, latency baselines
- **Dependency graph & concurrency:** Safe parallelization across independent tasks
- **Risk matrix:** Known gaps and mitigation strategies

### Current Status

**v1 (local-first showcase) — Shipped.** Milestones M1–M6 are complete; integration checkpoints IC-1 through IC-5 remain the historical shipped record. The Starship Playground drives the real `starship` binary (v1.26.0, pinned). Post-v2 work HJ-550 adds Dots as the fourth room: its ten commands come from live-or-fallback Bash source, while every transcript is labeled simulated and remains read-only.

**v2 (Cloudflare Workers public mirror, ADR-001) — Deployed & verified.** `DEPLOY-08` shipped the read-only public mirror to `https://dotfiles-showcase.harlanljones.workers.dev` (version `b835f72f`); health + degraded starship + cards + SPA smoke are green. Latency baselines are recorded in [ROADMAP.md](./ROADMAP.md) §2: local starship render p95 ≈ 73 ms (threshold p95 < 500 ms); live Workers degraded render p50 ≈ 88 ms / p95 ≈ 150 ms. The Workers path serves `dist/` + `/api/*` via Workers assets and returns `{ degraded: true }` for `/api/starship`, with the UI bannering the degraded state (local `bun run dev` remains the canonical high-fidelity path).

See [ROADMAP.md](./ROADMAP.md) §2 (metrics) and §6 (integration checkpoints) for the authoritative shipped state.

---

## Contributing

Work items are defined in [ROADMAP.md](./ROADMAP.md) with exclusive file/component ownership to prevent collisions. When working on a task:

1. **Confirm the work item ID and ownership** from the roadmap
2. **Run the full test suite** before and after (`bun test` + `bun run typecheck`)
3. **Report progress against the project's metrics** (quality, reliability, security, performance)
4. **Do NOT violate the hard safety boundaries** in [AGENTS.md](./AGENTS.md) §6; escalate conflicts

---

## Known Limitations

### Truecolor TTY Recolor

In your real terminal (Ghostty), starship emits `38;2;r;g;b` (truecolor) when `true_color = true` **and** the active palette defines `cyan`/`red` as hex colors. The dotfiles' recolor wrappers now handle truecolor: `starship_status_prompt` (zsh) and `starship_precmd` (bash) remap the palette-cyan `38;2;r;g;b` → palette-red, preserving each shell's semantics (zsh: cyan-only; bash: all-foreground→red). See **TC-01 / HJ-431**.

The playground forces `true_color = false` by default to demonstrate the shipped 8-color recolor path. An opt-in **Truecolor preview (proposed fix)** toggle lets you see the fix in action. Because the server renders starship via `spawnSync` (no truecolor TTY), the binary only emits 8-color `36m` — so the preview elevates the real binary's output to `38;2` (cyan → `#2EDEFA`) and replays the exact recolor logic. It is clearly labeled as a proposed-fix preview, not current behavior.

### TUI Tools Are Simulated

fzf, zoxide, and atuin are terminal user interface tools with native databases—they cannot run meaningfully in the browser. The Explorer cards show *simulated* mini-demos of their functionality, clearly labeled as such.

### Starship Version Pinning

The temp-repo git-state simulator is version-specific. The project currently targets `starship v1.26.0`. Format changes in `starship.toml` or git-internals simulation may require updates.

---

## Security & Privacy

- **Local-first:** No data leaves your machine. The app runs on your host and reads only local config files.
- **No secrets:** The repository never commits credentials, SSH keys, or sensitive config content—only non-secret snapshots.
- **Host-only execution:** The server runs processes on your local machine; no remote APIs or cloud services are involved.

---

## License

See your chezmoi dotfiles repository for licensing details.

---

## Getting Help

- **AGENTS.md:** Architectural constraints and quality gates for development
- **ROADMAP.md:** Detailed milestone breakdown, work items, and decision gates
- Issues & discussions: [GitHub Discussions](https://github.com/harlanljones/dotfiles-showcase/discussions)

---

**Built with ❤️ for dotfile enthusiasts.**
