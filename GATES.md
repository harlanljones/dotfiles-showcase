# Gates: HJ-550 Dots CLI room

Scope: ship a read-only Dots CLI room whose UI is driven by parsed live or bundled source without executing `dots`

- [ ] G1: the Dots parser and cards API contract pass their focused tests
  CHECK: bun test server/lib/dots.test.ts server/lib/cardsData.test.ts server/lib/cardsFallback.test.ts
  EXPECT: 0 fail
  EVIDENCE: pending

- [ ] G2: the complete unit and integration suite has no regressions
  CHECK: bun test
  EXPECT: 0 fail
  EVIDENCE: pending

- [ ] G3: TypeScript accepts the client, Bun server, and Workers build
  CHECK: bun run typecheck
  EXPECT: tsc --noEmit
  EVIDENCE: pending

- [ ] G4: the production client bundle builds successfully
  CHECK: bun run build
  EXPECT: built in
  EVIDENCE: pending

- [ ] G5: every documented fallback snapshot and the embedded Workers bundle are current
  CHECK: bun run fallbacks:check
  EXPECT: done:
  EVIDENCE: pending

- [ ] G6: desktop and mobile browser review confirms the Dots room remains legible and interactive
  EVIDENCE: pending

- [ ] G7: security review confirms the implementation never executes `dots`, exposes no host-identifying literals, and preserves fallback-only Workers behavior
  EVIDENCE: pending
