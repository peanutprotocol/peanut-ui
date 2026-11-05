# First QR payment refusals and pending outcomes

User request, 2026-11-05: publish ready-for-review PRs. Return typed 4xx for PAYER_BLOCKED and MERCHANT_BLOCKED with a reason and alternative; hide Pix QR for Brazilian residents before scan; require a digit in tax numbers; measure Pix outcomes by host.

Plan mode cannot be switched in this client. This persisted plan is the equivalent. User-requested behavior is accepted; extra financial cancellation policy is not inferred.

## Acceptance

- QR1: Expected provider 400/404/409/422 payer/merchant blocks return registered terminal 422 codes, safe reason-specific copy and alternatives. Provider 5xx, auth faults and unknown errors retain server-error semantics.
- QR2: UI consumes both wire code and legacy error token, stops automatic and amount retries, names the reason, and offers support for payer blocks.
- QR3: Brazilian residence (verified preferred, declared before verification) removes the Pix QR offer before scan. Scans, paste and direct URLs cannot initialize Pix for that residence; server guard enforces canonical residence before provider or funding side effects. Nationality, document issuer and location do not determine this rule. Argentina QR stays available.
- QR4: Tax numbers must contain at least one ASCII digit, retaining valid alphanumeric formats. Letters, punctuation, Unicode-only digits and zero-only placeholders fail before provider writes; masked unchanged values stay unchanged. Existing stored alphabetic tax numbers cannot shadow a usable QR identity document.
- QR5: Bounded Pix-host labels distinguish basspago, other dynamic providers, static/key and unknown QR. Measure scan/init and submitted-payment outcomes without QR payloads, keys, paths, queries or PII. Unknown and pending never count as success or failure.
- QR6: Investigate hours-long pending payments. Preserve durable reconciliation and refunds. A timer alone must never mark a funded payment failed, successful or safe to retry.

## What can go wrong

| Category        | Trigger and invariant                                                                                                   | Test and decision                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Invalid input   | Missing/malformed/unicode/oversized tax and EMV; no digit is refused, parsing is bounded, identity docs remain distinct | Negative tables and bounded generated parser inputs; accepted QR4/QR5                                           |
| Concurrency     | Duplicate scans/submits, delayed user/residence update; no new funding path, existing claims remain authoritative       | Existing idempotency tests plus eligibility hydration and direct route guard; preserve contract                 |
| Idempotency     | Same init key replay or key mismatch; terminal blocks do not spend retry budget                                         | Classifier/retry tests and existing key regression tests; accepted QR1/QR2                                      |
| Timeouts        | Lock timeout or provider still pending after funding; unknown remains unknown                                           | Existing completion wait/record-pending tests; no invented cancellation threshold                               |
| Retries         | Deterministic block vs transient provider outage                                                                        | All allowed 4xx statuses and 5xx negatives; accepted QR1/QR2                                                    |
| Partial failure | Funding mined, provider order/status read failed; durable pending intent retained                                       | Inspect completion/poller/refund paths; no settlement mutation in this fix                                      |
| Auth            | Direct/deep link bypass; canonical server residence checked after authentication and ownership                          | Route test verifies no lock/funding work for blocked residence                                                  |
| Data limits     | Host labels/cardinality and parser cost; no arbitrary URL/QR data exported                                              | Closed labels, EMV length bound, fuzz seed/work budget recorded                                                 |
| Migration       | Older clients/API builds and stored tax values                                                                          | Additive codes, legacy token fallback, no schema migration; fallback to valid document for old invalid tax data |

## Verification and rollout

Spec-only tests are written before production changes by a fresh different-model agent with context separation; filesystem isolation is not enforced. Targeted debugging checks and changed-file formatting/lint run locally. Full CI-equivalent suites stay in GitHub per user preference; required hooks and protections remain intact. No deployment or live provider payments are authorized by this PR request. Mixed-version API rollout stops old UI retry loops via 422; updated UI adds localized reason and support. Rollback is code-only, with no database migration.

## Pending investigation

Confirm current pending/refund flow and available incident evidence. Provider-specific rejection/settlement and the Brazilian-residence correlation are reported evidence, not independently reproduced live.

## Investigation and verification

- Current classifier is src/routes/manteca/qr-payment.errors.ts. Both provider block codes lacked mapping on fetched dev. Completion already waits 15 seconds before recording pending work; no time-only cancellation was added.
- Independent test author: gpt-6-astra, fresh spec-only context; implementation: parent model. Filesystem access was shared. Fixture corrections retained behavior: PT card collection exercises the generic tax field; a valid PT prefix normalizes to compact digits.
- API: 14 focused suites, 400 tests passed. UI: 11 focused suites, 266 tests passed; the follow-up transport/support/controller set passed 48 tests. Seven Screen Library catalogue/state checks passed. Payer, merchant, residence and scanner states are registered for hosted four-locale captures.
- Parser fuzz: seed 0x51f00d, 256 malformed cases up to 512 characters, parser bound 4096. Finite status/residence tables and 24 generated no-digit tax variants passed. Existing concurrency/idempotency regressions passed. Capacity load tests were skipped because no provider concurrency, queue or throughput contract changed.
- Disposable guard-removal variants failed: API refusal/digit protections caused 32 failed assertions; UI residence removal caused 10. Working checkouts were never mutated for the challenge.
- Changed-file UI lint is clean; API lint has one existing unused-disable warning. Prettier applied to supported touched files. Local checks reused installed dependency snapshots on Node 26; required GitHub checks use the configured runtime and remain the merge boundary. Full CI-equivalent local suites were not duplicated.
- Separate finder/verifier reviews caught funded replay ordering, missing birth-settlement events, misleading URL types and residence hydration hiding unknown submissions. Repairs preserve pending replay responses and keep submitted unknown outcomes visible. The existing in-memory duplicate path now consults durable pending recovery too.
- Managed worktree creation did not return/register a checkout. Isolated Git worktrees under the authorized aggregate workspace preserve the unrelated dirty product checkouts. Git pre-commit files were absent, but the runtime PreToolUse commit guard actively refused an unconfigured API checkout and compound commits. Added API local test/lint gates with a 300-second budget. Existing UI gates remain unchanged; no trust records or hook installation were altered.

## Analytics and release boundary

The scan carries pix_qr_host; pix_qr_init_result distinguishes ready/refused/unavailable. Client/server qr_payment_stage events carry the bounded host and client attempt UUID through submission. Pending/unknown are not success or failure. BRL QR intents persist only bounded host and normalized attempt UUID. pix_qr_settlement records committed immediate and eventual terminal states with a deterministic ingestion UUID per intent/status. Deduplicate by transaction_intent_id and use the latest terminal outcome; never sum stage rows or treat HTTP success as settlement. Missing old-client attribution is unknown. Labels: basspago, mercadopago, other-dynamic, static, unknown.

Publish ready-for-review API/UI PRs against dev. No merge, deployment, real payment, provider configuration change or device validation is included. Live basspago settlement remediation and the Brazilian-residence correlation remain unverified; this code does not claim to repair the upstream processor.

Hosted visual inspection found that payer/merchant captures inherited the Brazilian demo residence and rendered the residence refusal instead. All existing Pix QR scenario fixtures now explicitly use an eligible Portuguese residence; the dedicated Brazilian refusal/scanner fixture retains BR. This fixes capture setup, not production eligibility. The original green capture was not evidence of distinct refusal states.
