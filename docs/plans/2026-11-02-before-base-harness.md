# Before capture synthetic API compatibility

User authorization: on 2026-11-02, capture the before side with the base branch's own synthetic API whenever a PR changes it, as its own PR to dev. No merge or deployment.

This client cannot enter Plan mode. This document is the equivalent implementation plan.

## Acceptance

- A1: Compare the transitive fixture identity from shared roots in both immutable
  trees, plus adapter/openapi answer code. Synthetic changes select base; capture
  code or catalogue-only fixes retain head to avoid artificial visual differences.
- A2: Base capture installs and runs in the target checkout with identical flags.
  Missing runner or unsupported flags visibly fall back to the unchanged head path.
- A3: Only a schema-1 base receipt matching before.commit permits harness, fixture,
  and adapter differences. Renderer identity always matches. Reports, comments and
  viewer explain that differences can include synthetic-data changes.
- A4: Base reuse requires an authenticated dev/main integration push at the exact
  before SHA, full retained capture and verified assets. Head reuse remains strict.
  The trusted publisher independently rechecks source run and original bytes.
- A5: Preserve trusted dev workflow pinning, per-attempt artifacts, bounded lookup,
  scoped coverage semantics and old head-mode artifacts.

## What can go wrong

All decisions below derive from the user's accepted design and existing NFRs.

| Category | Trigger and invariant | Verification |
| --- | --- | --- |
| Invalid input | Malformed receipt, wrong SHA or unknown mode cannot relax comparison | Negative receipt matrix |
| Concurrency | Stale run artifacts must not cross attempts | Existing workflow/artifact tests |
| Idempotency | Repeated decisions on immutable revisions produce identical modes | Deterministic trigger tests |
| Timeouts | Git/provider failure stays visible; retain bounded reads and lookup | Existing budget tests and source inspection |
| Retries | Cache rejection permits one existing fresh fallback; no new retry loop | Reuse/workflow tests |
| Partial failure | Failed capture or missing assets cannot become reusable complete baseline | Existing completeness and integrity checks |
| Auth | Manifest claims cannot prove producing harness; verify integration run | Forged/unknown source tests |
| Data limits | Retain graph, pagination and image budgets; no extra capture matrix | Existing limits and workflow checks |
| Migration | Old base runner/flags fall back visibly; old head artifacts stay valid | Capability and no-receipt tests |

## Milestones and verification

1. Freeze spec-only acceptance tests with a fresh different-model test author.
   Context separation is available; filesystem isolation is not enforced.
2. Implement shared trigger, workflow selection/receipt, comparison and reuse paths.
3. Run focused acceptance, full Screen Library Node suite, touched-file Prettier,
   configured local gates and relevant type/lint checks. Challenge the renderer
   guard in a disposable copy. No live capture/provider/deployment is authorized.
4. Inspect all comparison and baseline call sites; report counts and blocked checks.

## Assumptions

Base-mode permission is carried explicitly as a sidecar/report receipt, never
inferred from a mismatching manifest. Existing trusted source-run rules continue
to define artifact authenticity. Missing historical fixture roots select base
conservatively, then the base runner capability check can fall back to head.
Unprovable dependency graphs and Git failures remain visible errors.

## Not handled

Hosted CI/capture and dev-pinned publisher activation require review and merge.

## Changes

- `.github/workflows/screen-library.yml`: immutable refs output, capability
  fallback, separate target install/browser/capture steps, and sidecar receipt.
  The head install/browser/capture command bodies and trusted dev pins are retained.
- `scripts/screens/capture-impact.mjs`, `capture.ts`: share the fixture root list.
- `scripts/screens/before-harness.mjs`, `decide-before-harness.mjs`: bounded
  immutable-tree identity comparison and base runner capability selection.
- `scripts/screens/before-harness-receipt.mjs`, `write-before-harness.mjs`:
  validate, read and write the commit-bound sidecar and canonical explanation.
- `scripts/screens/core.mjs`, `report.mjs`, `publish.mjs`, `bundle.mjs`:
  permit only receipt-authorized synthetic identity differences and preserve the
  receipt across report, publication and offline recomputation.
- `scripts/screens/baseline-reuse.mjs`, `baseline-runs.mjs`,
  `baseline-source.mjs`, `select-before.mjs`, `verify-reused-baseline.mjs`,
  `resolve-baseline.mjs`, `publish-run.mjs`: authenticate the producing integration
  harness, retain head-mode compatibility, reverify source bytes, and explain base
  mode in the PR comment. The publisher recomputes the exact-revision trigger.
- `public/screen-library/viewer.js`: show the explanation in reports and collections.
- `scripts/screens/before-harness-acceptance.test.mjs`,
  `capture-cost-integration.test.mjs`, `workflow-policy.test.mjs`: frozen
  different-model acceptance, provider/fallback/offline/binary regression cases,
  and workflow structure coverage.
- `docs/engineering/NFR.md`, `preflight.md`, and this plan: record the invariant,
  incident, accepted decisions and verification evidence.

## Verification results

- Node 22.23.2: `node --test scripts/screens/*.test.mjs`: **491 passed, zero
  failed/skipped**, 41.3 seconds. Log: `/tmp/before-harness-full-final.log`.
- Configured `.codex/quality-gates.json` checks all passed within the 420-second
  budget: Screen Library acceptance **168 tests**; auth/push Jest **26 suites,
  152 tests**; full ESLint **zero errors, 62 existing warnings**; history lint,
  viewer syntax and configured formatting passed.
- `tsc --noEmit --incremental false`: passed. Affected-file ESLint passed.
- Touched files were formatted with `pnpm prettier --write`; touched-file
  `pnpm prettier --check` and `git diff --check` passed.
- Independent author: fresh `gpt-6-astra` context, spec-only, **42 frozen cases**;
  canonical fixture corrections were made without weakening assertions. Context
  separation was enforced by instructions, not a separate filesystem sandbox.
- Disposable renderer-guard mutation: removing environment matching made the
  frozen negative test fail. Production code was never mutated for this check.
- Existing seeded graph/permutation tests (seed `0x51c0ffee`) ran in the full
  suite. New coverage uses deterministic receipt/renderer/provenance matrices and
  raw binary identity collisions. No new load/fuzz campaign: no new service or
  capacity boundary; existing bounded graph/provider tests cover those limits.
- Local immutable objects: e6b32f1bf1dcc671b8014f8bfdaeca2e2333f1ca compared with
  itself selected head; compared with supplied incident revision
  3cd3971382562ea496be2482b4e8d9705b360e11 selected base.
- Initial full run had six missing-`jose` failures. Isolated npm dependency setup
  failed under DNS restriction (`ENOTFOUND`); the exact 6.2.12 package was restored
  from the local pnpm cache into ignored worktree dependencies. No second pnpm
  install was started. Final full suite includes all six previously blocked files.

## Remaining limits

No hosted jobs, real before/after browser capture, deployment or native/device
checks were run. Old dev publishing will still reject base-mode environment
differences until these publisher changes merge, as expected by the owner.
Unsupported base runners fall back visibly to head but cannot guarantee that an
incompatible synthetic contract will then capture successfully. Renderer changes
remain intentional hard failures even in base mode.
