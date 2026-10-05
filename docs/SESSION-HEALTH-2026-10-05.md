# Session health fixes and follow-ups — 2026-10-05

Sources: live PostHog project 138913 and Sentry `peanut-c34d84c05/peanut-ui`,
plus current UI/API `origin/dev`. Counts below are approximate rolling seven-day
observations, not the screenshot's fixed digest interval. Issue populations overlap;
do not add their session counts or percentage-point estimates.

## Implemented in this UI change

| Problem | Change | Verification / limit |
| --- | --- | --- |
| React #418 hydration mismatches, about 496 distinct sessions across the two main groups | Device and unsupported-WebView snapshots match prerendering during hydration. Native builds consistently use the app provider tree at both the bootstrap root and deep-link destinations. | Real `renderToString` → `hydrateRoot` regression on iPhone/Android; native route regression. These fix confirmed mismatch paths; private maps are needed to attribute every historical #418 event. |
| ZeroDev sponsor validation, about 357 sessions across the two main groups | Remove viem's `paymasterContext` and `parameters` before ZeroDev serializes `userOp`. Preserve op fields, fee override, and preview/consume semantics. | The sampled provider explicitly rejected `paymasterContext`. Test the installed SDK's actual outgoing request without making a network call; wallet-flow regressions. |
| Duplicate sponsorship/signing exceptions | Remove the extra console exception when the owning flow explicitly captures the error. | Original flow capture and failure propagation remain. No silent payment retry. |
| Expected passkey outcomes and repeated wrappers | Stop mirroring confirmed cancellation messages and already-reported `ServiceUnavailableError`, `ConnectionTimeoutError`, and `PasskeyError` rethrows; apply the same leaf policy to PostHog autocapture. | Cancellations retain ordinary passkey outcome events. Ambiguous `NotAllowedError`, generic aborts, biometric error 1004, hydration defects, and malformed sponsorship survive. |
| Optional service worker registration/update | Catch `registration.update()` rejection; record registration/update failures as warnings rather than extra exception events. | Online app use can continue. Native service-worker eviction remains. This does not repair all browser network failures. |
| Repeated display FX requests | Share a cache-miss request across concurrent consumers; cache only a successful rate. Remove the exchange-rate action's duplicate console exception. | Concurrent/failure/currency isolation tests and existing currency tests. Money-commit quotes remain live and uncached; no fabricated/stale fallback rate. |
| Support badge request timeouts | Fetch only for an authenticated user while visible and online; cancel stale/background requests; coalesce triggers and back off failures. Optional timeouts retain API timing and breadcrumbs. | Preserve the last known badge on failure; reset on account switch. Request/auth/foreground/backoff/late-response regressions. There is no polling loop. |
| Unreadable native JS frames | Generate hidden maps, inject debug IDs, privately upload to Sentry in Android/iOS/staging-OTA/production-OTA release lanes, then delete all export maps. Release lanes fail on missing credentials/maps or upload failure. | Full native export and installed CLI debug-ID linkage pass. Local/PR builds need no upload token. Real authenticated upload still needs release-lane verification. |

Hydration-only sessions were about 383 (4.8 percentage points of the initial observed
denominator), and sponsor-only sessions about 280 (3.5 points). These are ceilings for
eliminating the respective historical issue families, not promised improvements.
They overlap and require successful rollout, adoption, and post-release measurement.

## Separate Android binary change

`innolope/android-renderer-health` keeps the existing foreground-deferred Activity
rebuild after WebView loss. Recoverable OS reclamation in the background is an info
diagnostic. A real renderer crash, foreground loss, or loss that cannot be recovered
remains an error. Events carry `renderer.did_crash`, `renderer.foreground`,
`renderer.recovery_scheduled`, and priority-at-exit.

The sampled Sentry `PEANUT-UI-TA0` event had `app.in_foreground=false`; the issue had
76 events / 33 users in the inspected window. Reporting classification is not a
fix for every native crash cause and does not manufacture crash-free process sessions.
Android compilation and nine unit tests pass. Physical-device background-memory
reclamation, foreground crash recovery, deep-link preservation, and repeat-loss
acceptance are required on a new native binary.

## Live PostHog changes

Both generic fetch grouping rules now match an exact quoted browser-engine message
(`"(Failed to fetch|Load failed)"`) instead of any substring. Their existing
user-visible-message split remains. Bridge FX wrappers, Unauthorized history errors,
and service-worker script failures therefore keep their actionable identities for
new grouping. Existing historical assignments may remain. No live suppression rule
or historical event deletion was added.

Two table insights were appended to [Engineering / Ops](https://eu.posthog.com/project/138913/dashboard/684263):

- [Captured-exception session health](https://eu.posthog.com/project/138913/insights/CZl3tRNW)
- [Platform and JS-release cohorts](https://eu.posthog.com/project/138913/insights/7ph7Mx1Z)

At the first saved-query verification: 7,895 observed sessions, 1,477 with an
exception, 664 with an unhandled exception, and 120 with unknown handling.
The exception-free percentage was 81.29%; free of unhandled **or unknown** exceptions
was 90.44%. These are captured-event measures. Sentry native release-health metrics
need their own process-session denominator; the screenshot digest formula was not
verified as a native crash measure.

Definitions are exploratory because the governed metric catalog returned no rows.
Both SQL insights use a rolling seven-day UTC window, include all environments/test
traffic, exclude missing session IDs, and ignore dashboard date chips. The release
table attributes a session to its latest observed `app_release` and treats localhost
as native, split by OS. It shows the 50 largest cohorts; small cohorts are volatile.
Telemetry blocking or sampling can miss failures.

## More low-hanging fruit, in priority order

| Priority | Item | Evidence | Next concrete action |
| --- | --- | --- | --- |
| P1 | Roll out existing receipt lookup repair and verify the full PDF path | Receipt PDF 404s: 38 events / 15 sessions in a broad query; latest sample came from history with a `<txHash>-<logIndex>` ID. API commit `caea3b4b4` already accepts that key and is in current `main`. Its existing 27-test regression suite passes. | Verify the exact production API deployment and a native authenticated PDF fetch. Keep reporting new 404s: branch inclusion does not prove the deployed route is fixed. Avoid a duplicate patch. |
| P1 | Move clients off the old setup TDZ bundle | `PEANUT-UI-T4A` still occurs on release `6db5526` (September 11). It predates merged UI PR #3155 (September 14), which removed the setup import cycle and added regression coverage. | Verify an affected old client upgrades and starts `/home` and `/setup`. Do not add a broad ReferenceError ignore. |
| P1 | Symbolicate Android startup failures | `PEANUT-UI-T4J` calls missing `JobScheduler.forNamespace` inside WorkManager startup. Latest inspected event is September 29, sideloaded 1.7.0 on a low-memory x86_64 Pixel profile; it is a real fatal event. | Upload the exact archived R8 mapping, resolve the dependency/frame and reproduce against the affected API image. An SDK/dependency change needs evidence and a native binary. |
| P2 | Recover push initialization after transient failure | The OneSignal adapter loader and adapter `initPromise` cache a rejected promise; `initStarted` also stays true after failure. Push can stay unavailable until reload. Sampled `Rejected` push errors have opaque frames. | Add bounded retry after online/foreground recovery, clear failed loader state, and test that listeners/login are attached once. First distinguish transient transport from SDK/configuration rejection. |
| P2 | Extend chunk recovery to any uncovered lazy entry points | ChunkLoadError: about 16 sessions. Shared reload-once and `importWithChunkRetry` already exist; OneSignal adapter imports do not use the latter. | Apply one import retry at concrete uncovered call sites; preserve the reload guard and final failure reporting. Verify stale web deployment and native resume separately. |
| P2 | Deduplicate/display FX outage failures once per provider request | Bridge FX wrappers caused over 200 events across about 20 sessions in the initial generic-fetch group. Concurrent requests are now shared, but consumers can still log the same rejected rate. | Capture one provider-level failure with status/currency context and retain clear retry UI. Compare request counts and affected sessions after rollout; preserve fresh commit-path quotes. |
| P2 | Separate injected-wallet/reader failures using origin evidence | About 11 sessions in an injected-wallet-looking group; sample mutates `window.ethereum.selectedAddress`, but the frame has no source URL. | Use new maps and event provenance to confirm origin before filtering. Existing extension/executor-frame filters remain. Do not suppress arbitrary `window.ethereum` or no-stack errors. |
| P2 | Diagnose opaque cross-origin `Script error.` | About 15 sessions; missing stack prevents safe classification. | Identify the script URL and check CORS/crossorigin reporting or SDK integration, then filter only a confirmed external source. |
| P2 | Reduce genuine authentication timeouts | CeremonyTimeout: about 58 sessions. A cancellation is expected; a ceremony timeout can block login/payment. | Split by platform/purpose/release, reproduce the slow/resume path, and repair its lifecycle or timeout ownership. Keep technical failures visible. |

## Release acceptance

1. Merge through normal review. The JS/provider fixes can ship through the normal
   web/OTA lanes; the Android reporting change requires a new binary.
2. Confirm private JS maps upload for the exact released commit and symbolicate a
   real native event. Confirm no `.map` is in the exported/Capgo bundle.
3. Verify preview sponsorship and a money-commit flow with real provider credentials;
   preserve consuming sponsorship only where intended.
4. Compare the new release cohort over a complete seven-day window. Check captured
   exceptions alongside login, payment completion, API timing, and native crash health.
   Noise classification gains and genuine reliability gains should remain distinguishable.
