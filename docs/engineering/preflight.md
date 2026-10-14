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
