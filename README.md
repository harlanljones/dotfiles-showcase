# Dotfiles Showcase

A local-first, interactive web app that visualizes chezmoi-managed dotfiles with live configurations and runnable mini-demos. See what each tool does directly in your browser without leaving your development environment.

**Headline feature:** The **Starship Playground** — a real-time UI that drives the actual `starship` binary through a Hono/Bun API, reproducing the exact shell prompt for any given state, including the precise red-recolor applied by your failure handlers.

[AGENTS.md](./AGENTS.md) · [ROADMAP.md](./ROADMAP.md)

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager & runtime)
- `starship` binary on the host (for the playground to work)
- `~/.config/starship.toml` (or use bundled fallback)

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

## Architecture

### Client (React 19 + Vite + TypeScript + Tailwind)

Owned **entirely** by the browser. Responsible for:
- **UI:** toggle/slider panel for shell state and live terminal preview
- **Explorer:** feature-card browser for all dotfile tools
- **Styling:** responsive Tailwind design with bundled JetBrainsMono Nerd Font
- **Communication:** HTTP-only (`/api/...`) — no direct shell or filesystem access

### Server (Hono API + Bun Runtime)

Owned **entirely** by the server. Handles all host-only work:

1. **Starship Invocation:** Runs the real `starship` binary with:
   - Isolated temporary git repository reflecting the requested state (branch, dirty files, ahead/behind, rebase/merge/detached)
   - Live `~/.config/starship.toml` with `true_color = false` (8-color mode for recolor fidelity)
   - `SSH_CONNECTION` environment variable set when toggled
   - Configurable terminal width for prompt truncation

2. **Recolor Logic:** Applies exact shell-specific transformations on non-zero exit status:
   - **zsh:** Replaces `36m` (cyan) → `31m` (red) across all 8 SGR prefix variants
   - **bash:** Recolors all foreground colors → red via `([0-9;]*)(30|32|33|34|35|36|37|90|92|93|94|95|96|97)m → 31m`

3. **Live Config Reads:** Fetches `~/.config/*` at runtime with graceful fallback to bundled copies (non-secret snapshots)

4. **ANSI→HTML Conversion:** Safely renders terminal escapes for browser preview

### Directory Structure

```
.
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component
│   ├── manifest.ts              # Feature card registry
│   └── components/
│       ├── StarshipPlayground.tsx
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

## Starship Playground

### What It Does

The Playground drives your real `starship` binary through a UI with toggles for:

- **SSH Mode:** Sets `SSH_CONNECTION` environment variable
- **Git State:** Branch name, detached HEAD, dirty working tree, ahead/behind commits
- **Rebase/Merge:** Simulates `.git/rebase-merge` or `.git/merge-head` state
- **Exit Status:** Non-zero exit to trigger recolor
- **Command Duration:** Milliseconds for the duration module
- **Terminal Width:** Matches real truncation behavior

The server builds an isolated temporary git repository reflecting each state, runs `starship prompt` against it, and applies your dotfiles' exact recolor logic.

### Color Mode & Fidelity

The server forces `true_color = false` in the starship config to emit 8-color `36m` (cyan) escapes that your recolor code demonstrably transforms to `31m` (red). This keeps the demo faithful to your dotfiles' OWN logic, though it surfaces a known gap: in a real truecolor TTY (Ghostty), starship emits `38;2;r;g;b` which the recolor code doesn't yet handle.

---

## Feature Explorer

Covers the following dotfile tools and configurations with live or fallback content:

- **Starship:** Prompt configuration and rendering
- **Recolor:** Failure-status color transformation demo
- **Git Safety:** Diagram of commit/push guardrails (Cline/Codex/Claude/OpenCode blocks)
- **Lazygit + Ollama:** Commit message generation flow
- **fzf, zoxide, atuin:** Simulated mini-demos (these are TUI/native-DB tools; browser rendering is simulation only)
- **Ghostty:** Theme palette browser
- **mise:** Tools and versions table
- **Brewfile & pacman:** Package manager browser
- **Hyprland:** Dual-monitor diagram
- **Neovim & LazyVim:** Extras and plugins reference
- **ripgrep:** Flags and options reference

Each card renders live configuration data where available, with bundled fallback content if the host config is absent.

---

## Project Scope & Constraints

### In Scope (v1)

- React 19 + Vite + TypeScript + Tailwind client
- Hono/Bun API server for host-only work
- Live config reads with bundled fallback
- Starship Playground (headline feature)
- Broad Explorer covering 11+ dotfile tools
- Unit tests for recolor, ANSI, and starship integration
- Full typecheck, zero console errors

### Out of Scope (v1)

- **No public deployment.** This app is strictly local-first and depends on your host `starship` binary.
- **No dotfile editing or syncing.** The showcase is read-only and visualization-focused.

### Hard Safety Boundaries

- **No faking starship output.** The server invokes the real `starship` binary—no canned strings, no precomputed ANSI.
- **No secrets committed.** Never bundle credentials, SSH keys, age keys, or `.linear.toml`. Only reference live paths; bundled content is non-secret snapshots only.
- **chezmoiignore covers the submodule.** The path `dotfiles-showcase/` must be in `/home/harlan/.local/share/chezmoi/.chezmoiignore.tmpl` so chezmoi never applies the app as a dotfile.
- **Live config reads must fall back gracefully.** No throws or crashes when host config is absent.

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

### Testing Strategy

- **Unit tests** for recolor logic (both zsh and bash modes)
- **Unit tests** for ANSI→HTML conversion (including truecolor `38;2;r;g;b` handling)
- **Integration tests** for starship invocation (if binary is available; skipped otherwise)
- **Golden file tests** to ensure temp-repo git-state simulation matches real `starship` output

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

- **Milestones M1–M6:** Scaffolding → libraries → Playground → Explorer → integration → verification
- **Work item breakdown:** 20+ clearly scoped items with exclusive ownership
- **Metrics & gates:** Build success, typecheck, test pass rates, recolor correctness, latency baselines
- **Dependency graph & concurrency:** Safe parallelization across independent tasks
- **Risk matrix:** Known gaps (truecolor TTY) and mitigation strategies

### Current Status

**M1 (Scaffold + tooling + submodule/ignore/README)** — In progress. All foundational commands and configuration are being established.

---

## Contributing

Work items are defined in [ROADMAP.md](./ROADMAP.md) with exclusive file/component ownership to prevent collisions. When working on a task:

1. **Confirm the work item ID and ownership** from the roadmap
2. **Run the full test suite** before and after (`bun test` + `bun run typecheck`)
3. **Report progress against the project's metrics** (quality, reliability, security, performance)
4. **Do NOT violate the hard safety boundaries** in [AGENTS.md](./AGENTS.md) §6; escalate conflicts

---

## Known Limitations

### Truecolor TTY Mismatch

In your real terminal (Ghostty), starship emits `38;2;r;g;b` (truecolor) when `true_color = true`. The dotfiles' recolor logic only handles 8-color `36m` escapes. The Playground forces `true_color = false` to demonstrate what the recolor *does* match, but this means the preview may not perfectly reflect your real prompt in a truecolor TTY until the recolor code is updated.

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
