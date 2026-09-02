# Domain Docs

How engineering skills consume this repository's domain documentation.

## Before exploring

Read `CONTEXT.md` at the repository root and ADRs relevant to the work in
`docs/adr/`. If either is absent, proceed silently. The `domain-modeling`
skill creates them lazily when a term or decision is resolved.

## File structure

This is a single-context repository:

```
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Vocabulary and decisions

Use the glossary terms from `CONTEXT.md` in issue titles, specifications, test
names, and architecture proposals. If a relevant ADR conflicts with a proposed
change, surface that conflict rather than silently overriding it.
