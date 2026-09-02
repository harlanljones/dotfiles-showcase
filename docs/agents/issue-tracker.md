# Issue tracker: Linear

Issues and specs for this repo live in **Linear**.

## Command and scope

- Command: `linear`
- Workspace: `harlanljones`
- Team: `HJ`
- Project: Dotfiles Showcase (`1e5540b9-7bb5-4d43-8c59-9f56a82b40cf`; slug `6a256cdee686`)

Run the command's `--version` and `--help` once at the start of a tracker
session. The installed CLI's help is authoritative. If it is unavailable, do
not substitute GitHub issues, local markdown, or direct API calls; report the
setup gap and continue work that does not need the tracker.

## States and labels

Linear workflow states and labels are separate. Canonical triage roles such as
`ready-for-agent` are labels; applying one does not move workflow state unless
the invoking skill says to.

The triage label mapping lives in `docs/agents/triage-labels.md`.

## Common operations

- Create: `linear issue create --no-interactive --team HJ --title "..." --description-file <path>`
- Read: `linear issue view <ID> --json --no-download`
- Query: `linear issue query --team HJ --all-states --all-assignees --json`
- Comment: `linear issue comment add <ID> --body-file <path>`
- Incremental labels: `linear issue update <ID> --add-label "..."` / `--remove-label "..."`
- Claim: `linear issue update <ID> --assignee self`
- Complete: `linear issue update <ID> --state completed`

Use Markdown files outside the repository for multi-line descriptions and
comments. Never print or store the API token in the repository.

## Pull requests as a triage surface

**PRs as a request surface: no.** Linear and the code host do not share a
number space. Reference a Linear issue by its full identifier.
