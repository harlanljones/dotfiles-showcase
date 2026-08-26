# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary visitor: a stranger on the public Cloudflare Workers mirror. They already sit at a rice desk (terminal, compositor, configs as craft). They arrive curious, glance on a phone, linger on a desk. They are not operating a dashboard and they are not here to hire the author first.

Secondary: the owner, locally. Same atlas; data upgrades from reconstructed snapshots to live host configs and the real `starship` binary.

## Product Purpose

An interactive, read-only working model of a chezmoi-managed environment. Public success is desire: the visitor leaves wanting the chezmoi rice at https://github.com/harlanljones/dotfiles. The door is the single word `source`. Comprehension of every tool is not the job.

## Positioning

These surfaces run, or honestly reconstruct, real configs. A neighboring screenshot dump or rice gallery cannot truthfully say that.

## Operating Context

Dual-mode by contract (ADR-001): `bun run dev` is the canonical high-fidelity path (real `starship`, live `~/.config/*`); Workers is a read-only public mirror with no binary and no host filesystem. Degraded Starship is bannered and never claimed live. Every live config read falls back to committed `fallback/*` snapshots.

The rice spans two machines (Hadrian / Augustus) and sits on Omarchy / Ghostty / Hyprland / Starship. Machine lore is reserved; the product name is deferred (working title remains Dotfiles Showcase). Author is discoverable, never announced.

## Capabilities and Constraints

First-paint rooms (four): Starship (recolor lab absorbed into this room and deleted as a peer), Ghostty, Hyprland, Git Safety.

Annex: a compact leftover directory reached by a quiet chrome word `index` — lazygit, fzf/zoxide/atuin, mise, packages, neovim, ripgrep. Leftovers keep demos as receipts, not peers.

Session: empty veil once per tab; first pointer/tap wakes into Starship; after that the visitor stays in rooms. Other rooms are faint names, always. No prescribed walk. No distinct foyer after the first gesture. Phone: all four rooms must work. Desk: linger, inspect, leftovers.

Honesty: live / fallback / simulated / degraded disclosed on inspect, except the required Starship degraded banner. Quiet status, great degraded — public is designed to be excellent on snapshots.

Locked: read-only (no editing or syncing dotfiles); no-fake local starship; bannered Workers degraded mode; no secrets; chezmoiignore covers the submodule; live→fallback; JetBrainsMono Nerd Font for prompt glyphs.

Open (do not invent): product name; visual world; whether room URLs exist; leftover receipt density.

## Brand Commitments

Working title: Dotfiles Showcase. Do not invent a replacement name. Author is not the hero. Anti-goals: dashboard, personal brand site, fake terminal wallpaper.

## Evidence on Hand

Runnable rooms backed by live-or-fallback configs (`src/manifest.ts`, `fallback/*`). Real Starship renders locally; Workers reconstructs from `fallback/starship.toml` + recolor. Ghostty palette from omarchy theme state. Hyprland dual-monitor layout from `monitors.lua`. Git Safety is a static diagram of agent commit/push blocks. Do not fabricate testimonials, customer counts, or live-binary claims on Workers.

## Product Principles

1. The artifact leads; chrome recedes.
2. Honesty is a status, not a warning dump — except where the contract requires a banner.
3. Cut until it hurts; leftovers live in an annex, not as peers.
4. Public-first: design the snapshot to be excellent; local is an upgrade.
5. Desire for the rice is the proof; the author is not announced.
