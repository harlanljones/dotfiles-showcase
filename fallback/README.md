# Bundled Fallbacks — Content Strategy (D2)

Every live config read (`~/.config/*`) has a bundled fallback in this directory so
the app renders correctly on hosts missing a given file (CFG-01). This document is
the authoritative per-file content strategy; it resolves roadmap decision **D2**.

## Strategies

- **FULL-COPY** — verbatim copy of the live file plus a two-line provenance header
  (`# Fallback snapshot: …` / `# Live source: …`). Used when the file contains no
  secrets and fidelity matters for rendering.
  JSON files cannot carry comments: they are byte-identical copies with provenance
  recorded here only.
- **TRIMMED-SAMPLE** — curated subset that preserves every load-bearing setting
  (dropping only comments/redundancy), or colors-only extracts of generated state.
  Used when the full file is noisy or host-specific.
- **SYNTHETIC** — representative content authored by hand because the live source
  does not exist on this host (or is derived output, not a file).

## Sanitization rules (apply to every file)

1. Never bundle credentials: tokens, API keys, age/SSH material, `.linear.toml`, passwords.
2. Never bundle host-identifying literals: hostname strings (e.g. the machine name),
   usernames where avoidable, IPs, MAC addresses. Substitute generic styling/placeholders.
3. Provenance headers must state the live source path so staleness is auditable.

## Per-file decisions

| File | Strategy | Live source | Notes |
| --- | --- | --- | --- |
| `Brewfile` | SYNTHETIC | none on Linux host | macOS-parity manifest, package names + taps only |
| `ghostty-config` | TRIMMED-SAMPLE | `~/.config/ghostty/config` | comments dropped, all effective settings kept (font, window, cursor, shell-integration, keybinds, scroll, async-backend) |
| `ghostty-theme.conf` | TRIMMED-SAMPLE | `~/.local/state/omarchy/current/theme/ghostty.conf` | generated omarchy state: background/foreground/palette lines only; refresh after theme switch |
| `hypr-monitors.lua` | FULL-COPY | `~/.config/hypr/monitors.lua` | header replaces the two wiki comment lines; rest verbatim |
| `lazygit.yml` | FULL-COPY | `~/.config/lazygit/config.yml` | verbatim modulo provenance header (ollama custom command) |
| `lazy-lock.json` | FULL-COPY (byte-identical) | `~/.config/nvim/lazy-lock.json` | JSON: no header possible; public plugin pins, complete inventory |
| `lazyvim.json` | FULL-COPY (byte-identical) | `~/.config/nvim/lazyvim.json` | JSON: no header possible |
| `mise.toml` | FULL-COPY | `~/.config/mise/config.toml` | `[tools]` table verbatim; no env/secrets sections exist |
| `pacman.txt` | DERIVED-SNAPSHOT | `pacman -Qe` on host | explicit package names, one per line; regenerate with `pacman -Qe \| awk '{print $1}' > fallback/pacman.txt` |
| `ripgrep-rc` | FULL-COPY | `~/.config/ripgrep/rc` | header replaces the file's own first comment line; rest verbatim |
| `starship.toml` | SANITIZED SAMPLE | `~/.config/starship.toml` | structure mirrors live (format string, git_commit/git_state/repo_root_format, custom.git_dirty); **hostname literal sanitized away**, username block genericized |

## Refresh procedure

The executable form of this procedure is the refresh script (FB-01). It reads the
per-file table above as its manifest, regenerates each snapshot from its live
source, applies the sanitization rules, hard-fails on credential-like patterns,
and keeps the embedded Workers bundle (`server/lib/fallbacks.ts`) in sync.

```bash
# Verify snapshots are fresh without writing (exit 1 if stale) — CI/pre-deploy gate
bun run fallbacks:check

# Regenerate stale/missing snapshots + rebuild the embedded bundle
bun run fallbacks:refresh
```

Behavior notes:

- Missing live source → that file is **skipped** (never throws; CFG-01 contract).
- `SYNTHETIC` files (e.g. `Brewfile`) are never touched — hand-authored.
- `DERIVED-SNAPSHOT` (`pacman.txt`) re-runs `pacman -Qe`; unavailable command = skip.
- Provenance headers of existing snapshots are preserved byte-for-byte; only bodies regenerate.
- Host-identifying literals (known machine names, username, IPv4, MACs) are substituted;
  a unique machine hostname that survives is a **hard failure**, not a silent write.
- Credential-like patterns (tokens, keys, `AGE-SECRET`, private-key blocks) are a
  **hard failure** — nothing is written for the offending file.

Manual alternative (kept for auditability of the original one-off process):

```bash
# FULL-COPY files (repeat pattern per file)
{ printf '# Fallback snapshot: <name>.\n# Live source: <path>\n\n'; cat <path>; } > fallback/<file>

# Derived snapshot
pacman -Qe | awk '{print $1}' > fallback/pacman.txt

# Generated theme state: switch omarchy theme, then re-copy palette lines from
# ~/.local/state/omarchy/current/theme/ghostty.conf
```

After refreshing, re-run the secret scan:

```bash
grep -rniE 'ghp_|github_pat_|api[_-]?key|token|password|secret|AGE-SECRET|BEGIN (OPENSSH|RSA|PGP)' fallback/
```
