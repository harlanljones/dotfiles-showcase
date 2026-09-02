# Domain glossary

## Explorer catalogue

The catalogue is the authoritative description of where a showcase demo appears
in the Explorer and how a visitor reaches it. It distinguishes primary rooms
from annex receipts while preserving each demo's manifest provenance. New demos
begin as annex receipts; promotion to a primary room is deliberate.
An annex receipt has a shareable link that opens that specific demo on arrival.

## Dots workflow

A Dots workflow is the read-only, sanitized explanation of one `dots` command:
its parsed handler facts, permitted preview options, and simulated trace. It
never executes the command or alters the user's dotfiles. Its trace is an
explicitly authored safe scenario, not a derivation that claims execution.
It may accept local-only editable values when they remain visibly simulated. An
unfamiliar parsed command is shown as unsupported evidence; an incomplete
required command uses the bundled fallback snapshot.

## Showcase demo

A showcase demo is an interactive or static read-only presentation of a
dotfiles capability. New demos may be placed in a primary room or an annex
receipt. A demo is admitted only when it has both manifest provenance and an
Explorer catalogue entry. Every interactive safe scenario persistently states
that it is simulated and performs no execution.
