# TASK-23424: Android passkey classification, cancellation and diagnostics

User approved proposal items 2, 3 and 4 on 2026-10-19. No browser fallback, migration exemption, additional credential enrollment, merge or deployment. Cannot switch runtime Plan mode; this is the saved equivalent. Review target dev 05bd97193. Preserve existing user sessions. Native change needs a store binary and native fingerprint checks; never lower OTA floors.

## Acceptance

A1 NotFoundError (including native code/data.name wrappers) becomes PASSKEY_NOT_FOUND, distinct from cancellation, with localized app-cannot-access-passkey guidance in en/es-419/es-AR/pt-BR; no destructive auth cleanup.
A2 Android credential requests are single flight across login/signup/signing. Timeout requests cancellation of the exact attempt; canceled/late results cannot reach verification or persist auth. Retry only after original terminal settlement or a cancellation acknowledgement that guarantees terminal native settlement. Unknown cleanup blocks a further native call with restart guidance. Never cancel a newer attempt with an older request ID.
A3 Old binaries lacking control APIs retain operation support, and timeout remains bounded; no unsupported method can crash/hang startup. iOS/web behavior remains unchanged.
A4 Emit bounded sanitized diagnostic facts: native exception class/reason, duration, app/plugin/OS versions, manufacturer/model, Play Services availability/version when readable. No accounts, credential identifiers, challenge, tokens, raw exception messages or ROM/location inference. Failure to collect diagnostics cannot block auth. Unknown remains unknown.
A5 Native build integration and reproducible tests validate real pinned package patch; source-only checks are not native/device evidence.

## What can go wrong

| Category | Trigger and invariant | Test |
|---|---|---|
| Invalid input | Malformed request ID or diagnostic fields; reject/sanitize before side effects | Boundary table and sanitized allowlist tests |
| Concurrency | Timeout, late success, second tap, stale cancellation; one active request and no stale auth | Deferred promises/native callback order permutations |
| Idempotency | Duplicate cancellation or callback; settle once and never cancel another ID | Replay tests |
| Timeout | Provider or cancellation/diagnostics never resolves; bounded UI error, retain uncertain ownership | Fake timers and fault injection |
| Retry | User retries during uncertain cleanup; no new OS call; retry after confirmed settlement | Forbidden-call assertions |
| Partial failure | Cancel throws or provider returns success after timeout; discard result, retain/reconcile ownership | Fault injection |
| Auth | Missing passkey/timeout proves no invalid session; preserve cached auth | Existing hook integration regressions |
| Data limits | One pending request; bounded diagnostics, fixed metadata keys; no raw credential input in telemetry | Serialization/privacy tests |
| Migration | Old native plugin ignores ID/lacks controls; bounded fallback; new patch requires store update | Legacy/native capability tests and fingerprint check |

## Verification plan

Fresh spec-only test author on a different model from implementation, context separation only (shared filesystem). Freeze acceptance assertions before code. Parent integrates JS/classification/locales; separate native implementation role owns package patch. Run focused tests, configured gates, lint/typecheck, native compile where available; challenge a critical guard in disposable copy. Record environment and CI/device limits. Finder/verifier separated for review.

## Review corrections

Independent finder identified an outer-timeout ownership race and delayed-options continuation. Android SDK scopes now remain owned until their raw promise terminates, expire before cancellation, and associate the cancellation closure with the request ID. Signing participates in the same ceremony guard. Native request ownership remains separate and lasts until terminal settlement. An expired options fetch can only finish into an error; it cannot start another prompt. If an options/verify promise never settles, restart guidance remains the recovery path.

Independent verifier found that registration's legacy message-based pending handler swallowed the new cleanup guard. Named guard errors now bypass that legacy branch, preserving error propagation to signup's localized restart guidance.

Cancellation is fire-and-observe with zero UI wait (within the proposed 1-second budget). A hung cancel promise never changes the uncertain state. Native acknowledgement is terminal-only. Metadata collection has a separate 1-second deadline and cannot delay authentication.

## Release and rollback

The pinned 8.2.2 pnpm patch changes native Android source and the native fingerprint. Ship in a new store binary; do not treat this as an OTA-only repair or lower compatibility floors. Missing control/diagnostic APIs on older binaries fall back to unknown cleanup/no metadata. Rollback restores the previous dependency patch and requires the matching native binary/fingerprint; no database migration exists.

## Verification evidence

- Before classification changes, the frozen spec tests reproduced three missing-credential failures (three genuine-cancel cases passed). After implementation, 267 focused tests passed across 14 suites; the final signup/locale/conflict run passed 112 tests across four suites, and final controller/ceremony regressions passed 41 tests. Counts overlap across runs.
- Fresh spec-only author used GPT-6 Astra; parent implementation used its inherited model. Tests were frozen before implementation, with separate contexts but a shared filesystem. Finder and verifier were separate roles. Independent verifier passed 76 tests including its external signup regression.
- Native patch tests: 36,047 assertions, seed 23424, 2,000 sequential/replayed/interrupted requests; six transport assertions. Removing cancellation marking in a disposable copy caused the expected test failure. Diagnostic privacy corpus: 128 generated inputs, seed 0x1a2b3c4d. No live load testing: this is a single-flight client operation, not a service capacity change.
- Android library compilation succeeded: Gradle 8.14.3, AGP 8.13.0, AndroidX credentials 1.5.0, SDK 36; 19 tasks, 3m7s. Compiled Java byte-matched the patch. pnpm installed the exact patch in a disposable fixture and transport assertions passed against it. Root frozen lockfile validation passed.
- Configured Screen Library tests: 168 passed. Configured push-identity tests: 132 passed across 23 suites. Full lint passed with 63 warnings and zero errors; history lint/syntax passed. Formatting exhausted the aggregate 420-second run budget after the preceding checks, then passed separately with a 90-second bound. Final affected-source lint and formatting passed.
- Native fingerprint changed from 9b6f39e320a74b8d to 2b6d1933d4254e61 through the patch and native-plugin dependency inputs. No OTA compatibility floor was changed.
- No new hooks installed. This checkout has only sample Git hooks and no core.hooksPath; manual execution above is evidence of checks, not hosted CI. The existing Codex PreToolUse hook enforced direct commit syntax when a combined preparation/commit command was rejected; the preparation and commit were then separated.
- No APK/device/provider verification, screenshot capture, hosted CI, merge, release or deployment. China-specific root cause remains unconfirmed. All four locale catalogs, including resolved es-AR delta behavior, passed catalog tests.

- Full TypeScript check passed after fixing the new wrapper union type, generating standard Next types, and initializing the exact pinned content submodule. Initial missing asset/content declarations were environment prerequisites, not suppressed assertions. Final patch whitespace normalization changed its fingerprint only; coordinator/transport tests and pnpm application were revalidated.
