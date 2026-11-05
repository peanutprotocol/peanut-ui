# Browser contract build memory

User request: diagnose and fix failing checks on peanut-ui PR #3900.
This client cannot switch to Plan mode; this is the equivalent saved plan.

## Evidence and acceptance

At f1e1d2e7ad14c46cb1e30dd50813ac1a5f219eb1, Tests run 41464516586,
press-contract job 125341899149 aborts during `pnpm build`, before either
browser spec executes. Node 20.20.2 reports allocation failure at about 2 GiB
and `FATAL ERROR: Reached heap limit`. Unit, screen-tests, typecheck, lint,
format and native-export already pass. The PR changes no application code.

- A1: Browser contract production builds explicitly receive a bounded 4096 MiB
  V8 old-space budget, scoped to build steps rather than install or browser tests.
- A2: Preserve production/preview identities, mocked fonts, all browser assertions,
  failure propagation, retry counts and existing job/step deadlines.
- A3: Reproduce the missing-budget regression before editing workflow configuration;
  verify the corrected configuration, required local gates and the real build.
  Report hosted outcomes independently from local checks.

## What can go wrong

Presented to the user before implementation. These are technical invariants
from the existing contracts; no new business-policy decision is required.

| Category | Trigger / invariant | Test / decision |
| --- | --- | --- |
| Invalid inputs | Missing or overridden heap setting restores the failure | Parse effective build environment; 4096 MiB required |
| Concurrency | A job-wide override affects unrelated child processes | Build-step-only setting; independent jobs unchanged |
| Idempotency | Repeated builds must not introduce repeated external effects | Configuration-only; no new side effects |
| Timeouts | More memory must not hide a hung build | Retain current deadlines; bound local verification |
| Retries | Unchanged OOM must not be retried speculatively | No new retries or manual rerun before a changed condition |
| Partial failure | Build failure must not allow browser gates to pass | Keep build failure propagation and required specs |
| Auth | Dependency install must not gain settings or credentials | No credential/permission/checkout changes |
| Data limits | Runner memory remains finite | Explicit 4 GiB old-space cap; distinguish heap from total RSS |
| Migrations | Other application/build modes must remain compatible | No data/client migration; revert configuration to roll back |

## Plan and verification

1. Fresh spec-only test author on a different model freezes workflow acceptance.
   Shared filesystem is not an isolation boundary; author is instructed to read
   only its contract packet and runner conventions.
2. Apply the smallest build-environment change supported by the failure evidence.
3. Run regression checks, full Screen Library suite, configured local gates,
   affected formatting, real production build and browser contracts where available.
4. Inspect current PR/check state and deliver the fix without merge or deployment.

## Assumptions

4 GiB old-space is sufficient headroom over the observed 2 GiB exhaustion;
the actual build and hosted checks must verify this. Heap is not total RSS.

## Not handled

The extra local production build was stopped after roughly nine minutes of slow
compilation on the shared machine; no local build or browser success is claimed.
Hosted checks on the updated head remain required. Local Node 22 checks cannot
prove the hosted Node 20 build. No merge or deployment is part of this fix.

## Verification results

- Original hosted press build: confirmed fatal V8 heap exhaustion near 2 GiB;
  both browser specs were skipped. Original hosted SEO build subsequently passed.
- Fresh spec-only test author: gpt-6-astra, separate from the implementing model.
  No production source was supplied; filesystem separation is not enforced.
- Baseline: six checks, two pass and four fail on missing build budgets.
  Corrected configuration: six pass, including real child-process heap probes.
- Full Screen Library suite: 498 tests pass, zero failures/skips (72.8 seconds).
- All configured local gates pass inside the existing 420-second total budget:
  Screen Library acceptance, auth/push Jest (26 suites, 152 tests), ESLint
  (zero errors, 62 pre-existing warnings), history lint/syntax and formatting.
- New test ESLint, affected-file Prettier and whitespace checks pass.
- Disposable mutation removing both heap settings: four frozen tests fail.
  No production working copy was mutated for this experiment.
- No new fuzz/load campaign: this change only configures a fixed build-process
  resource limit. Existing screen property/fault cases ran in the full suite;
  the negative configuration matrix and actual child probes cover this change.
- Local build initially stopped at generator IPC because local process permissions
  blocked the tsx socket. Retried with required local permissions and the locked
  pnpm 10.30.1 on supported Node 22.23.2; the slow compile was stopped within the
  10-minute budget. Generated signup-path output was restored to its original
  bytes and is excluded from the fix.
- The automatic shell commit guard repeated the checks in the desktop runtime
  and exhausted its 420-second budget during lint. No commit was created by that
  blocked command; no check budget or assertion was relaxed. Repeat the exact
  configured gate runner under supported Node 22 before publication.
- No timeout, retry, command, permission, credential, assertion or job eligibility
  changed. The test parser resolves ESLint's declared js-yaml dependency; no
  application or dependency changes are needed.
