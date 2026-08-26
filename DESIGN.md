---
name: Dotfiles Showcase
description: A sleeping display that wakes into a working model of a rice desk.
colors:
  glass: "#04060a"
  glass-lit: "#060912"
  phosphor: "#6fa3a0"
  ash: "#959aa4"
  ash-dim: "#5f656e"
  fail: "#b16371"
  line: "rgba(149, 154, 164, 0.16)"
typography:
  body:
    fontFamily: "JetBrainsMono Nerd Font, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  room-name:
    fontFamily: "JetBrainsMono Nerd Font, ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.18em"
  prompt:
    fontFamily: "JetBrainsMono Nerd Font, ui-monospace, monospace"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  field-mobile: "24px 24px 40px"
  field-desktop: "32px 36px 56px"
  chrome: "28px 36px 0"
components:
  veil:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.phosphor}"
  room-name-idle:
    textColor: "{colors.ash-dim}"
  room-name-current:
    textColor: "{colors.phosphor}"
  chrome-word:
    textColor: "{colors.ash-dim}"
  inspect-summary:
    textColor: "{colors.ash}"
  terminal:
    backgroundColor: "{colors.glass-lit}"
    textColor: "{colors.ash}"
    padding: "38px 32px 42px"
---

## Overview

The Sleeping Display. First paint is unlit glass and a block cursor. A pointer or key wakes the visitor into Starship occupying the field. Four rooms (prompt, palette, desk, safety) are faint names. Leftovers live behind the word `index`. The prize is the word `source`. No sidebar, no kickers, no byline, no dashboard cards.

## Colors

Dark because this is a monitor at night. Ground is unlit glass `#04060a`. Lit terminal panes use Ghostty's `#060912`. Phosphor `#6fa3a0` is the live accent (current room, success, primary marks). Ash `#959aa4` is body. Failure `#b16371` is the only other hue — degraded banners, deny rules, error command. Do not reintroduce the incumbent cyan `#69e7d1` or violet `#aa9cff`.

## Typography

One face: self-hosted JetBrainsMono Nerd Font. It is the desk's actual terminal face, required for prompt glyphs. Room names and chrome words are small, tracked, lowercase. The prompt itself is the display size. No second family. No kickers.

## Layout

Full-bleed display. Chrome is a thin top row: four room names left, `index` and `source` right. The field is padding, not a max-width card column. After wake there is no foyer — switching rooms replaces the field. Index is a full overlay of compact leftover receipts, not a fifth peer. Phone wraps chrome; all four rooms must remain usable.

## Elevation & Depth

Almost none. Terminal and code surfaces may carry a single offset shadow into the glass. No glassmorphism, no zero-offset glows, no card stacks.

## Shapes

Square. Radius is refused except where a native control (range input) cannot comply. Borders are 1px hairlines in `line`.

## Components

- **Veil** — full-viewport unlit glass, centered block cursor, blink. Click/key wakes once per session.
- **Room names** — opacity 0.38 idle, 0.82 current in phosphor. Hover (fine pointer only) lifts opacity.
- **Inspect** — a `details` disclosure holding title, provenance badges, and blurb. Closed by default.
- **Terminal** — the Starship prompt occupies the field; controls sit below as text, not a sidebar panel.
- **Index receipts** — leftover demos inside `details` rows. Same CardShell inspect grammar, quieter door.

## Do's and Don'ts

**Do** let the artifact lead. **Do** disclose live/fallback/simulated on inspect. **Do** banner Starship degraded mode. **Do** keep `source` as a single unmarked word to the chezmoi repo.

**Don't** add a sidebar, hero, kicker, or section numbers. **Don't** announce the author. **Don't** restore eleven peer cards. **Don't** treat leftovers as first-paint rooms. **Don't** fake a live starship on Workers.
