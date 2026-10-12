# Passkey failures: recovery and reporting

Use the platform reason before the plugin's `NotAllowedError` class. That class
also covers association failures and device requirements. It does not prove that
the user canceled or that a passkey is missing.

| Outcome | User recovery | Exception policy |
| --- | --- | --- |
| Explicit Apple 1001 / Android cancellation | Try again when ready | Breadcrumb and ceremony analytics |
| Unspecified NotAllowedError | Neutral incomplete-verification guidance | Bounded warning at the owning login/signing catch |
| Device locked | Unlock, then try again | Breadcrumb and ceremony analytics |
| Biometry required | Verify with Face ID or Touch ID | Breadcrumb and ceremony analytics |
| Association check unavailable | Wait a few seconds, then try again | Error grouped by operation and reason |
| App/domain association mismatch | Update Peanut; contact support if it continues | Error grouped by operation and reason |
| Apple 1004 | Existing bounded login recovery; then retry guidance | Warning after recovery is exhausted |
| Unknown technical failure | Existing flow-specific error handling | Preserve the original diagnostic |

The signup flow retains its existing quiet handling for unspecified WebAuthn
refusals. Specific native failures receive the same recovery as login and signing.
Every ceremony remains observable through `webauthn_ceremony` (`outcome`,
`error_code`, `native_reason`, `purpose`, `duration_ms`). `native_reason` distinguishes
explicit cancellation from ambiguous refusals without sending raw platform messages.
Signup also retains its terminal failure
event. These attempt events are the denominator; exception counts are not.

## Ownership and grouping

`reportPasskeyFailure` owns known terminal failures at login, signup, and signing.
It emits at most one diagnostic per operation/reason every five minutes in a
running document. Re-reporting the same Error object does not add an exception.
This limit applies to diagnostics, not ceremony analytics or user retries.
Ordinary technical errors keep their existing reporting path.

Sentry and its PostHog exception mirror share the device-condition filter and
native-reason grouping. Device conditions stay out of both exception lists.
Legacy/global captures without operation tags group by native reason. A mixed
technical exception chain remains visible, even when a cause names cancellation
or a device condition. Do not add a blanket `NotAllowedError` ignore rule.

The bounded report tags are `passkey_reason` and `passkey_operation`. Do not add
credential IDs, assertions, challenges, biometric data, or transaction payloads.

## Recovery boundaries

Keep existing login/session state for platform refusals and device requirements.
An explicit server verification rejection retains the existing auth cleanup.
Preserve the current bounded iOS login recovery and registration retry policies.
Never automatically retry signing or payment submission in response to this
classifier. Payment flows own retry safety at their existing broadcast boundary.
Error copy must not claim that funds moved or did not move.

Do not recommend reinstalling, clearing storage, removing passkeys, disabling
Stolen Device Protection, or creating a second wallet as generic recovery.
Keep all app locales complete; es-AR resolves over es-419 and then English.

## Release validation and monitoring

Before release, test native iOS cancellation, device unlock, biometric verification,
association failure, and retry-to-success. Also test browser permission failures
and Android cancellation. Confirm the button unlocks and the session survives.
Browser and unit checks do not prove native device behavior.

After release, segment by release, binary build, OS, and ceremony purpose:

1. Compare failed ceremonies and affected users with successful ceremonies.
   Check subsequent success after each failure, not just exception volume.
2. Watch association failures as a separate actionable group. Inspect the live
   origin AASA file, Apple's cached association, and the signed binary's actual
   entitlements before changing configuration. Source entitlements alone are
   not proof of what a shipped binary contains.
3. Investigate repeated ambiguous refusals or 1004 failures with no later success.
   The client diagnostic limit means exception count undercounts repeated attempts.
4. Track device/biometric requirements through ceremony analytics. Escalate if
   users cannot recover after following the guidance.
5. Keep the historical mixed Sentry issue as history. New reason groups and
   successful device recovery are the release evidence; archiving is not a fix.

Use two monitoring tiers: a recovery dashboard for all outcomes, and actionable
alerts for association regressions and technical failures. Exclude explicit
cancellations and device requirements from exception paging. Compare unique
affected users and failure rates against the same platform/purpose baseline;
choose alert thresholds from observed traffic, with a minimum affected-user
count and a sustained window. Do not page on a single retryable refusal or a
drop in exception volume. Watch retry-to-success and abandoned flows alongside
the failure rate so a quieter release cannot hide a worse experience.
