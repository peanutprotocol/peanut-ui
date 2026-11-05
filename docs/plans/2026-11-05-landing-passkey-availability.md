# First-screen native passkey availability

Default mode is active. The initial implementation and boat VM run used Peanut UI main at 6b37e0d01. The PR targets dev at 7855dc759 and retains dev's recovery drawer, signup analytics, and Android request cancellation changes.

## Acceptance

- A1. Native landing shows the existing signup label and recovery from the first render. Android silently checks candidates on mount.
- A2. A confirmed Android candidate reveals the normal Log in button. Per the November 5 follow-up, a successful empty result keeps Log in hidden. Signup and recovery stay visible. Locked providers and remote candidates leave the silent check inconclusive and can still be tried through manual login.
- A3. Unknown availability reveals the existing LinkButton at five seconds. Late Android results cannot override it.
- A4. Per the November 5 user decision, iOS may automatically open the system sign-in sheet when immediate credentials exist. Approval uses the existing login verification and redirect. A miss and a dismissal can both return cancellation, so keep the timed link fallback in those cases. Check the deadline immediately before submitting the request to AuthenticationServices. Abort JS preparation on unmount or when recovery opens.
- A5. Manual login, existing auth guards, signup, recovery, web and PWA retain existing behavior. Older native binaries fall back safely.

## What can go wrong

| Category | Trigger and invariant | Verification |
| --- | --- | --- |
| Invalid input | Malformed RP, unexpected response or provider rejection remains unknown | Unexpected and rejected response cases |
| Concurrency | Deadline, navigation and callbacks race. A stale attempt cannot change CTA or open a new prompt | Fake timers and unmount |
| Idempotency | Renders cannot replay login or create an account | Call counts and click assertions |
| Timeouts | Five seconds releases the fallback; approval of an already presented sheet retains the existing ceremony budget | Fake timers and late result |
| Retries | One check per landing visit and no automatic ordinary prompt | Forbidden-call assertions |
| Partial failure | Locked provider, remote candidate, unsupported silent check or ambiguous iOS cancellation keeps manual access available | Unavailable/unknown cases |
| Auth | Android only prepares candidates. iOS still verifies a user-approved assertion | Auth regressions and native cases |
| Data limits | One RP and option. Android returns only availability. No credentials or account identifiers in new logs | Inspect bridge contract |
| Migration | Old binary and Android below API 34 use fallback. No stored data migration | Mixed-version tests |

Freeze spec-only landing tests before implementation. Check affected JS, native compile where available, and challenge the late-result guard in a disposable copy. Keep device, capture and release evidence separate.

## Platform limits

- Android exposes candidate presence on API 34+. Framework preparation can return a successful empty result for no candidates and some failed provider queries. The November 5 follow-up treats that result as empty. Errors the app can observe and results with locked or remote candidates use the five-second fallback, since ordinary login can still work. See [the framework prepare session](https://android.googlesource.com/platform/frameworks/base/+/01d329349864f78f7f1b4c774341514e8719eb9c/services/credentials/java/com/android/server/credentials/PrepareGetRequestSession.java).
- Apple's [immediate-credential request](https://developer.apple.com/videos/play/wwdc2022/10092/?time=809) can return cancellation for both a silent miss and dismissal. AuthenticationServices controls when an accepted request appears. Navigation can abort JS preparation before the native handoff.

## Verification

- Independent spec-only test author used GPT-6 Astra and a fresh context. The test author and implementation roles shared a filesystem. Separate finder and verifier roles traced the Android ambiguity and the iOS bridge deadline race.
- The first frozen baseline run had 19 behavioral failures and one passing web case. The initial implementation passed 22 landing cases and 131 adjacent cases. Removing the Android late-result guard in a disposable copy failed the targeted acceptance case.
- The Android follow-up first reproduced the unwanted link after an empty result. After the change, all 23 landing cases passed and the Android bridge recompiled.
- The Android bridge compiled against Android 36, AndroidX Credentials 1.5.0, and Capacitor 8.2.0. The immediate iOS API typechecked against the iOS 16.4 deployment target, and the patched Swift source parsed.
- The CJS and ESM dependency transport checks passed for manual login, immediate login, aborted preparation, and expired preparation. Both patches reapplied byte-for-byte and the frozen lockfile validated offline. Affected TypeScript and formatting checks passed. ESLint reported one existing missing-dependency warning.
- The fake-timer and deferred-promise checks cover the bounded client workload. Device/provider behavior, Screen Library captures, full builds, and hosted CI remain unverified.
