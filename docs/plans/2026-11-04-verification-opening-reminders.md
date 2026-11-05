# Verification opening reminders UI

The user decided on 4 November 2026 that opening verification starts a durable reminder even before answers are saved. POST `/users/kyc/opened` accepts only an optional feature; older APIs may return 404. Sends remain off/dry-run. No copy or binary changes.

## Acceptance and milestones

1. Displayed authenticated verification entry records once per mounted scope, including unanswered paperwork. Background reads do not. Network outcomes never block verification.
2. Bind requests to the initiating account; cancel on scope, account, auth or route changes and prevent delayed hydration from using a later session. Send no identifiers or answers.
3. Wire independently authored frozen acceptance tests to real UI, demonstrate baseline failure, implement and verify fault cases and a disposable mutation. CI, device and provider evidence remain separate.
4. Preserve unrelated work; publish a signed branch and PR to dev with CI as merge boundary.

## What can go wrong

- Invalid inputs: feature is restricted to bank/card/local; body is empty or one field. Server validates independently.
- Concurrency and idempotency: rerenders, simultaneous surfaces, scope changes, logout and navigation may race. Cancel stale work; server owns durable idempotency. Test transitions and in-flight rerenders.
- Timeouts and retries: auth hydration may finish after logout; native transport may not cancel. Bound the request and never retry using another session. No automatic retry is required for this best-effort operation.
- Partial failure: 404, 503, timeout and rejection cannot block verification or claim delivery. Test statuses and rejection.
- Auth: ownership comes only from session; never send user, identity, residence, provider or answers. Test switch and clear.
- Data limits: body has fixed bounded fields; server validates and rate limits. No batching or unbounded UI storage.
- Migration: app-before-API 404 remains nonblocking; API-before-app records only after explicit entry. No flags or migration changes.

The failure list and opening behavior were accepted in the parent task. This client cannot switch Plan mode; this persisted plan is equivalent. The frozen UI oracle was authored by gpt-6-astra; implementation uses gpt-6.1-terra. Fuzz and load testing are not appropriate for a fixed bounded body; deterministic concurrency and fault tests cover the material risks. Device, provider and deployment checks are separate.

## Accepted scope fence and legacy correction

The rendered questions response supplies optional opaque `entryScope`; only that displayed response can authorize a best-effort opening POST. The request carries compare-only `x-kyc-entry-user` and `x-kyc-entry-scope`, and no identity or answer data in its body. A 409 does not trigger a scope refresh or retry. Older responses without scope remain usable without an unguarded POST. The real initial legacy SDK request instead carries `x-kyc-entry-start: 1` and the initiating owner on the existing identity endpoint. Background status and token refresh calls never receive the start flag. The API owns both checks and durable recording. These refinements and compatibility boundaries were accepted in the parent session on 4 November 2026; independent contract tests were revised before implementation.

## Issued-card continuation

An issued card remains usable while the optional `pendingVerification` action offers an explicit continuation. A tap alone sends the captured owner, scope and generation to the guarded resume endpoint; a dedicated SDK session uses that same capture for refresh. Closing or completing the session refetches card and profile, and must never invoke application or card issuance. Older APIs and failures preserve card management. In-flight results are aborted or ignored after account, scope, generation, action or route changes; the backend independently guards before and after token minting. Duplicate taps must not create multiple requests or SDK sessions. The 256-byte body and strict generation bounds are enforced by the API. The default reminder mode remains dry-run. A separate fresh spec-only author produced real-render acceptance cases from the accepted public contract; adapter wiring and execution remain pending.

## Verification record

- The old 17-case opening oracle had 9 expected failures and 8 passes before the scope contract. For the revised oracle, one named actual-entry test reached the wire assertion and failed because `x-kyc-entry-user` was missing; 24 cases were not run in that baseline. That baseline used Node 22 and ran in 19.3 seconds. An attempted `nice` priority change was denied, so low-priority activation was not established.
- A real-render card adapter has been drafted, but its first named test did not produce output within a 120-second outer limit under the escalated `agent-nice --heavy` wrapper. It was terminated and its matching process was absent afterward. This is not a behavioral baseline. Card production implementation must wait for an executable independent baseline.
- Open test-author corrections: optional feature cases claim a singular feature on an unanswered `/verify` entry, but current routing sends that case to plain `/verify`; and the legacy refresh fixture must select its initial session response before entry to exercise both real refresh paths. Preserve assertions until independently resolved.
- Browser/native/provider/CI validation, targeted mutation, required commit guard and PR remain unverified. Do not infer these from source inspection or an interrupted test.

## Issued-card test wiring receipt (unverified)

The drafted adapter mounts the actual `CardPage`, `YourCardScreen`, React Query, authentication context, kernel/loading/modal/toast/cooldown providers and the actual shared `SumsubKycWrapper`. Only its external web/native SDK drivers, authenticated fixture, router and network I/O are substituted. The existing read-only control is the card face's “Show card details” button; its real revealed face's “Hide card details” button is the observed view. The test primes a synthetic step-up token and returns synthetic card details through the real service path. Requests classify GET `/rain/cards` as overview, GET `/users/me` as profile, POST `/rain/verification/resume` as resume and POST `/rain/cards` as apply; other traffic remains `other`. The `rainApi.applyForCard` spy delegates to its original implementation if reached. Fake overview changes enter through real query invalidation; departure unmounts the actual page. Direct fetch and WebSocket access are blocked by the network fixture. The baseline profile fixture contains an account ID, empty accounts/rails and empty capabilities; funding access defaults to legacy. SDK sessions are observed from the external driver mount and its actual callbacks.

This is a wiring proposal, not evidence: initial adapter import/render and all assertions remain unverified after the 120-second timeout. Provider wiring, SDK behavior and selectors may require corrections grounded in execution; no production or test decision is represented by an adapter-generated CTA. The automatic approval review rejected private-source export to the proposed VM because explicit authorization was absent; no remote transfer occurred. A local implementation was continued only after the parent clarified that the independently derived tests preceded source and the attempted behavioral baseline was impractical under the observed machine starvation. No gate is waived.

## API contract audit

The UI snapshot was replaced with the locally generated backend-branch OpenAPI, not staging. The paired changes add optional `entryScope` to questions and `pendingVerification` to the card overview, plus guarded opening and card-resume endpoints. `useVerificationOpening` sends only optional feature in the body; `rainApi.resumeVerification` sends only generation, with both comparison headers. Old scope-less responses skip the opening request; absent card action hides the CTA; non-2xx and malformed token responses do not open an SDK. The legacy explicit-start headers are conditional and absent from polling/refresh. The new API must be available before a newly actionable card continuation is relied on.

The previous UI snapshot also lagged existing backend changes on unrelated routes. The fresh schema tightens Rain preparation/charge IDs and perk usage IDs to UUIDs, adds Rhino's optional `chargeId` query parameter, and adds the document-check route. Existing wallet flows forward preparation IDs returned by the server; locally persisted recovery IDs are only checked as nonempty strings, so compatibility with any historical non-UUID persisted value is not established by this audit. Rhino already sends the optional query, and the QR perk UI no longer calls `/perks/claim`. These unrelated pre-existing differences are not a claim of live validation. Generated types and configured checks remain required.

## Later local verification and continuity correction

The corrected opening oracle passed 28/28 against the actual entry. The independently authored card suite passed 40/40 against the real card surface and callbacks under Node 22 and the supported low-priority wrapper. An earlier full card run reached only 3/40 because its synthetic funding response lacked the required management field; the adapter was corrected using the existing demo response shape, without changing assertions. The card adapter also installs the real query, Nuqs, profile and application providers; its synthetic funding read returns ready state.

Independent finder and verifier reviews found that normal overview polling can remove an active SDK after a successful start, because checking is not an actionable task. The accepted additive contract distinguishes an owned open or checking context, authoritative none, unavailable, and older omitted metadata. Only an open action creates a CTA; matching checking or missing/unavailable metadata retains an existing capture, while explicit none or changed binding invalidates it. A fresh spec-only author derived 47 real-surface continuity cases before this correction. Tests and implementation remain pending. An independently authored pre-dispatch race suite is also being wired to real auth and transports; account clear must prevent a stale rendered CTA or parked opening from dispatching.

The independent continuity author corrected the prior action-removal fixture: the unchanged original remains at `/tmp/peanut-addon-ui-spec/addonCardContinuation.acceptance.test.ts`, while the integrated copy adds `verificationContext: { status: 'none' }` when removing that action. Every stale-result assertion remains unchanged. The reason and correction are recorded in `/tmp/peanut-card-continuity-spec/PROVENANCE_AND_LIMITATIONS.md`.

The named pre-fix polling check reproduced SDK removal after a real interval read. The corrected real-screen suite subsequently passed 47/47, including real interval and focus-triggered requests. The focus fixture advances wall-clock staleness and sends bubbling visibility events to the real Query listener; it never invokes a refetch itself. The independently authored pre-dispatch suite passed 20/20 across native/web and token/cookie-only fixtures. Web cookie-only covers a retained screen, not a cold mount. A disposable local copy with the opening dispatch guard removed failed all four selected auth-clear race cases; the working source was untouched.

An independent verifier identified another launch-lifetime gap at the real web SDK boundary: delayed callbacks from a retired launch may select a replacement launch's current callbacks. A fresh author has frozen separate integration assertions, and their real-SDK test adapter and correction remain pending. Native old-instance event routing is not independently established by source alone.

The real-card SDK lifetime harness could not complete its positive case under the unchanged five-second setup deadline on the loaded host; it is not counted as passing. An additive actual `useSumsubWebSdk` boundary test reproduced the bug (the old launch returned the new launch's token), then passed with 55 existing web/native SDK tests after launch-bound callback invalidation. This narrower result does not replace the full real-card acceptance cases or native-device verification.

The earlier timeout and draft notes above are historical, not the final test state. Legacy-start acceptance, continuity and auth-race checks, mutation, project guard, signed commit, PR and CI remain outstanding. No live provider or device behavior is inferred.
