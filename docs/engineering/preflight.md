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
