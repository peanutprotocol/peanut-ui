# UI incident preflight

## 2026-10-14: screenshot vote intent crossed a login switch

Independent review reproduced a browser `/me` response verified as Alice followed
by a vote POST authenticated as Bob after the session cookie changed. A frontend
check alone cannot fence that interval. The browser now preserves the captured
actorId with the request UUID; the server compares this optional rejection guard
with verified identity before replay. Ownership still comes only from Access.
Regression: mismatched-marker API requests leave no scope/vote/receipt, and a
browser response barrier switches identity between verification and posting.

Preflight: inspect `public/screen-library/votes.js` staged intents, account reset,
summary sequence checks and `scripts/screens/worker/votes.mjs` before mutation.
An actor-scoped receipt prevents replay duplication but alone cannot bind the
intent to the identity that originally staged it.

## 2026-10-14: vote refresh falsely settled an uncertain write

A timed-out POST can still be awaiting its D1 batch when a summary refresh reads
the old personal revision. Clearing the staged request at that revision hides
Retry and allows a later original commit to surprise the UI. Retain the original
UUID and disabled new actions until an explicit retry settles it or a newer
personal revision proves the original committed or is fenced. A definitive
400/403/404/409 rejection may clear on an authoritative refresh at the same revision.
Independent browser regression holds the original server work before D1, refreshes
the old version, then releases the commit and replays the exact request.

## Balance validation after a withdrawal starts (2026-10-13)

- Trigger: live balance decreases while the crypto withdrawal review remains mounted during execution or payment recording. The obsolete affordability warning flashes before success.
- Evidence: PostHog confirmed -> settled -> completed sequence on Android release b105626; user explicitly requested removal of the false warning.
- Root cause: ConfirmWithdrawView rendered insufficientBalance without checking processing or executed-spend state.
- Search: `rg -n 'insufficientBalance|alreadySpent|isProcessing' src/features/withdraw/views/ConfirmWithdrawView.tsx`; inspect all component call sites when changing these states.
- Invariant: suppress balance warnings during processing and after this charge has spent. Preserve the pre-sign balance check and real operation errors. Disable Retry while processing, including record-only recovery.
- Counterexample: an idle charge that has not spent and cannot afford the amount must still show the warning and block confirmation.
- Regression: ConfirmWithdrawView.processing-balance.test.tsx exhausts the eight processing/spent/shortage states and exercises refresh, unsuccessful execution, recording recovery, duplicate clicks and Send framing.

# Push identity incidents and regression checks

## 2026-10-13: explicit logout retained account push identity

Trigger: clear authentication and reload while the device remains linked in OneSignal. A fresh JavaScript tracker cannot prove the SDK is anonymous. SDK login can also settle after logout, and failed unlink must not clear the retry obligation.

User decision: logged-out devices may receive only notifications unrelated to an account. Keep the anonymous subscription enabled. Source: this explicit-logout investigation and fix.

Preflight: `rg -n 'login|logout|catch|inFlight|setTimeout|storage|isLoading|isFetchingUser' src/services/onesignal src/hooks/useNotifications.ts src/context/authContext.tsx`.

Inspect enclosing behavior; search hits alone are not defects. Counterexamples: an app lock or unresolved offline query is not logout; a fresh authenticated login may intentionally relink the device. Browser storage events can be stale after a newer trusted login.

Regression evidence:
- `identity-sync.test.ts`: persisted identity, duplicate calls, init/login/logout races, retries, all 81 length-four null/A/B sequences.
- `identity.test.ts` and `authContext-push-identity.test.tsx`: explicit unlink ordering, timeout, trusted login boundary, persistence/cross-tab propagation, paused query, stale hydration/setup.
- `identity-recovery.test.ts`: retry after a hung SDK operation; late completion compensation without timer-driven retry loops.
- `identity-late-order.test.ts`: simultaneous raw SDK completions cannot erase invalidation.
- `identity-storage-order.test.ts`: queued old logout event cannot override a newer trusted login.
- `identity-version.test.ts` and provider tests: distinct persisted receipts fence pending authenticated responses across tabs, before event delivery.

Disposable mutation: initializing the applied identity to null leaves the simulated persisted account linked; the initial signed-out acceptance test fails. Product source was not mutated.

Provider limit: native bridge promises resolve after invoking OneSignal, without a provider completion callback. Local tests prove dispatch/order and simulated convergence. They do not prove APNs/FCM delivery, recall already queued messages, or recover an SDK-internal init latch that never settles without a reload.

## 2026-10-14: cross-tab login retained the observer's logout latch

Verified PR finding: after one tab accepts a logout event, another tab's fresh login removes the shared active marker, but the observer remains latched anonymous. If the observer's prior SDK unlink failed, its next positive sync can also detach the new shared identity. An independent two-context harness reproduced both outcomes at 85215d1bc.

Preflight: `rg -n 'explicitlyLoggedOut|storage|verificationRevision|reconcileNotificationIdentity|onNotificationIdentityLoginAvailable|cancelRefetch' src/services/onesignal/identity.ts src/context/authContext.tsx`.

Invariant: marker removal only requests fresh profile verification; it is not evidence of an authenticated account. Release only the observer's in-memory latch after fresh proof and unchanged revision, durable logout receipt, and shared active state. Never erase shared state during observer reconciliation. Reject failed/null/invalid/expired results and pending work from a locked, logging-out, or unmounted provider; retry on a later lifecycle signal. Preserve ordinary guarded SDK-hook calls.

Regression evidence: `identity-cross-tab-login.test.ts` covers receipt/revision races, current-state event checks, verification timeout/late completion, storage failure and persisted startup. `authContext-cross-tab-login.test.tsx` covers fresh refetch, error/null results, recovery signals, blocked sessions and pending lock invalidation. Generic subscription and permission remain enabled.

Additional reachable race: the real provider/hook/QueryClient harness observed SDK B -> A -> B when login(B) emitted a subscription callback before React rendered profile B. Hook callbacks now use `syncNotificationIdentityFromHook`, retaining the last auth-selected identity. Authorized auth sync remains compatible. CT14/15 and `authContext-cross-tab-hook-race.test.tsx` forbid any transient former-account login; same-account metadata updates also cannot restart pending verification.

A queued online task reproduced the same sequence without an SDK event: React had not rendered the updated cache yet. Provider lifecycle callbacks read current `QueryClient.getQueryData([USER])`, and skip unknown data. `authContext-cross-tab-lifecycle-race.test.tsx` freezes the actual TanStack event ordering; do not replace its real client with a synchronous cache stub.
