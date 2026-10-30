# Android signup AA24

Baseline d8e565e6c (origin/dev refreshed October 30). Sources: TASK-22823 https://app.notion.com/p/3e18381175798102a05eea749b938a69 and TASK-23931 https://app.notion.com/p/400838117579816ba174e18230323fbf.

## Scope and acceptance

The user requested investigation, attribution and a fix. The later task explicitly requests a registration-time layout check before account creation. Credential pinning landed September 30 (f508277ca); #3782 already implements error copy and session preservation. This client cannot toggle Plan mode; this is the persisted equivalent. No new business-policy decision is inferred from silence.

- A1: Android standard compact create clientDataJSON has the challenge property at byte 26; return the original credential unchanged.
- A2: Sorted Android data (challenge property at byte 41), malformed or missing data, and incompatible layouts reject before the SDK can submit register/verify or create a server account.
- A3: Classify this terminal failure as PASSKEY_PROVIDER_UNSUPPORTED and show existing translated testTransaction.errors.passkeyProviderUnsupported guidance. No raw credential/challenge/ID enters diagnostics. No automatic retry.
- A4: Authentication get calls, web/iOS, credential pinning and backup eligibility behavior remain unchanged. No address, validator or schema migration.
- A5: Existing concurrency, cancellation, timeout and late-response fences continue; a rejected registration allows a later supported retry.

## What can go wrong

| Category | Trigger, invariant, impact and test | Decision |
| --- | --- | --- |
| Invalid inputs | Invalid base64/JSON, wrong type, missing data, whitespace or shifted challenge: reject before commit; compact positive and Unicode origin retain exact bytes | Task layout check; unknown is not approval |
| Concurrency | Duplicate taps or late create: controller admits one owner, prevents late continuation; existing fault tests | Preserve controller contract |
| Idempotency | Double installation and retry: no double wrap or duplicate request; supported retry succeeds after rejection | Preserve contract |
| Timeouts | Native request never settles: existing bounded timeout, no new request or wait | Preserve deadline |
| Retries | Layout incompatibility terminal; cancellation/timeout retain existing classifications | Existing retry allowlist |
| Partial failure | OS may already save credential; never submit server verify or delete OS keys on rejection | Mitigation boundary |
| Auth | Keep credential pin, existing ownership and sessions; sanitized error/telemetry | Existing contract |
| Data limits | One linear local response check, no new network, prompt or batch | Load testing not relevant |
| Migration | Existing stranded users retain current recovery guidance; addresses and validators unchanged | No destructive migration |

## Verification

Fresh spec-only test author on a different available model, with no inherited history. Filesystem isolation is advisory because agents share a workspace. Freeze tests before production code, run red then green; use deterministic JSON-order permutations, controller fault/concurrency cases and a disposable guard-removal mutation. Run relevant signup/WebAuthn suites, configured gates, full Screen Library tests, lint, format and TypeScript. Device/provider behavior and hosted CI remain separate evidence.

## Limits and investigation

### Evidence and attribution

- TASK-22823 was filed September 20 and explicitly labels substitution as inferred, without device reproduction. Its own later notes say all five sampled affected users had one passkey. It cannot establish that every AA24 meant the wrong credential.
- SDK source toPasskeyValidator.ts passes the account authenticatorId allow-list for both default signing and custom callbacks. For a fresh undeployed wallet the address/validator are derived from the selected key; a persistent signup AA24 is not itself proof of stale ownership.
- The deployed validator selection is V0_0_3_PATCHED, mapped by the installed SDK to 0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69. TASK-23931 reports a real failing sorted signature which verifies cryptographically but puts the challenge property at byte 41, while this validator expects 23. Browser standard serialization places type then challenge; rewriting signed JSON would invalidate its signature (https://www.w3.org/TR/webauthn-2/#clientdatajson-serialization).
- Native signing encoder/integration was authored by kushagrasarathe in c8f374365 / 0fcaae5a2 on April 3, 2026, shipped in PR #1871 (https://github.com/peanutprotocol/peanut-ui/pull/1871), merged by Hugo0 on April 22. It accepted native provider outputs without validator-layout preflight. This is the earliest verified introduction of the integration gap, not proof of a new September regression or that this author changed the external provider.
- The fixed-position validator selection predates Android: Juan José Ramírez selected V0_0_3_PATCHED in 1afe5ea71 on September 18, 2025. It was not a new September 2026 validator change.
- Credential pinning was added by innolope-dev on September 30 in f508277ca and merged October 5 in #3550 (https://github.com/peanutprotocol/peanut-ui/pull/3550), also by innolope-dev. Do not reimplement it or attribute the remaining layout failure to that repair.
- #3782 (https://github.com/peanutprotocol/peanut-ui/pull/3782), authored/merged by abalinda October 21, explicitly fixes error copy, telemetry and signup logout only. It explicitly defers the registration guard. Its Done task status therefore does not establish full compatibility remediation.

### Implementation and verification record

The guard runs on the Android plugin create result, before the shim returns to simplewebauthn and the SDK submits register/verify. The inspected API register/options writes only a challenge; user creation occurs at verify. Supported results retain object identity and signed bytes. A terminal sanitized error selects existing four-locale provider guidance inline; get/web/iOS and existing addresses stay unchanged.

Spec-only acceptance tests established 22 meaningful failures and 9 positive baseline passes, plus a UI baseline failure. The old concurrency fixture string was replaced with a realistic registration object after independent review; expectations were not weakened. A separate finder and verifier reproduced an additional BOM-prefix bypass; a failing regression preceded the decoder fix. A disposable guard-removal variant fails the sorted-layout assertion while the original succeeds.

Local verification passed: 369 focused signup/passkey tests, 435 Screen Library tests, TypeScript, changed-file formatting/lint and all configured quality gates. Deterministic breadth enumerates all six property-order permutations; no random seed is needed. Fault/concurrency coverage uses existing native-controller and ceremony tests. Capacity load testing is not applicable to one local response check with no extra prompt/network operation. No new local hook was installed or activated.

Assumptions: registration and assertion serialization from the same provider is a useful preflight signal, not a guarantee; exact emitted bytes on a failing physical device still need confirmation before release.

Not handled: physical Android/provider validation, browser screenshots of the earlier inline error state, full hosted CI, deployment and audited dynamic-offset validator migration. Existing stranded accounts are not migrated; current finish-screen recovery guidance remains in place. This patch prevents new unsupported-layout server registrations, not successful signatures from every unsupported provider.

The sorted signature evidence comes from TASK-23931, not a new device reproduction. Registration layout is a preflight signal, not proof of every future assertion layout. An audited dynamic-offset validator changes new account addresses and is a separate migration. Verify exact provenance before attributing a regression to a person.
