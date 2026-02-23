# KYC 2.0 — Testing Guide

## Prerequisites

- Backend (`peanut-api-ts`) running locally on `feat/kyc2.0`
- Frontend (`peanut-ui`) running locally on `feat/kyc2.0-error-retry-ui`
- Sumsub sandbox dashboard access
- A test user account

## How to simulate statuses

| Method | How |
|--------|-----|
| **Sumsub sandbox** | Use [test documents](https://docs.sumsub.com/docs/verification-document-templates) to trigger real review results |
| **DB manipulation** | Directly update `user_kyc_verifications` — see SQL snippets per test |
| **WebSocket** | Send manual `sumsub_kyc_status_update` message with `{ status, rejectLabels }` |
| **Sumsub dashboard** | Manually approve/reject applicant — fires real webhook |

---

## Test cases

### 1. Happy path — standard regions (Europe / North America)

- [ ] 1a. Open regions & verification → select Europe or North America → `regionIntent: 'STANDARD'` sent to backend
- [ ] 1b. StartVerificationModal appears with region info → click "Start verification"
- [ ] 1c. SumsubKycWrapper opens → StartVerificationView (privacy consent) shown → click "Start"
- [ ] 1d. Complete Sumsub SDK with valid test document → SDK fires `onApplicantSubmitted`
- [ ] 1e. Modal transitions to "Verification in progress" phase (verifying)
- [ ] 1f. Sumsub approves (webhook GREEN) → modal transitions to "preparing" phase
- [ ] 1g. Provider submission completes → Bridge rail → REQUIRES_INFORMATION → modal transitions to "bridge_tos" phase
- [ ] 1h. Accept Bridge ToS in iframe → rails transition to ENABLED → modal shows "complete" phase
- [ ] 1i. Activity feed shows "Verified" green badge, region unlocked

### 2. Happy path — LATAM

- [ ] 2a. Open regions & verification → select LATAM (e.g. Argentina) → `regionIntent: 'LATAM'` sent
- [ ] 2b. Complete SDK with questionnaire (tax ID, PEP, FATCA fields appear for LATAM template)
- [ ] 2c. Sumsub approves → modal transitions: verifying → preparing → complete (no bridge_tos phase)
- [ ] 2d. Manteca rail → ENABLED, region unlocked
- [ ] 2e. Backend logs: `submitToProviders` sends Manteca payload with questionnaire data

### 3. Happy path — foreign user (rest of world)

- [ ] 3a. Open regions & verification → select "Rest of world" (e.g. India) → `regionIntent: 'STANDARD'`
- [ ] 3b. Complete SDK, get approved → same flow
- [ ] 3c. QR payment access: `useQrKycGate` returns `PROCEED_TO_PAY` (provides tax ID per-payment for Manteca super user)
- [ ] 3d. Bank transfer access: should NOT have Bridge/Manteca rails enabled (no provider submission for foreign users)

### 4. Multi-phase completion modal

- [ ] 4a. Phase 1 (verifying): clock icon + "We're verifying your identity" + preventClose
- [ ] 4b. Phase 2 (preparing): "Identity verified!" + "Preparing your account..." spinner + preventClose
- [ ] 4c. Phase 2 timeout: after 30s, shows "This is taking longer than expected" + escape button
- [ ] 4d. Phase 3 (bridge_tos): ToS prompt + Bridge iframe (only for standard regions with Bridge rails)
- [ ] 4e. Phase 4 (complete): "All set!" + "Continue" button
- [ ] 4f. LATAM flow: skips bridge_tos phase entirely (verifying → preparing → complete)
- [ ] 4g. Close during preparing: activity drawer shows per-provider status as fallback

### 5. Bridge ToS acceptance

- [ ] 5a. After sumsub APPROVED + Bridge submission → Bridge rail = REQUIRES_INFORMATION
- [ ] 5b. BridgeTosStep shown inline in multi-phase modal with ToS iframe
- [ ] 5c. Accept ToS → backend confirms via Bridge API → rails transition to ENABLED
- [ ] 5d. Skip ToS (close modal) → BridgeTosReminder appears in activity feed
- [ ] 5e. Click BridgeTosReminder → reopens BridgeTosStep modal → accept → rails ENABLED

### 6. ACTION_REQUIRED state — activity drawer

DB: `UPDATE user_kyc_verifications SET status = 'ACTION_REQUIRED' WHERE user_id = '<id>' AND provider = 'SUMSUB';`

- [ ] 6a. Activity feed (`KycStatusItem`) shows "Action needed" subtitle with amber status pill
- [ ] 6b. Open drawer → shows "Action needed" badge, warning InfoCard, reject labels listed
- [ ] 6c. Click "Continue verification" → opens Sumsub SDK with `autoStart` (skips StartVerificationView)
- [ ] 6d. `useQrKycGate` returns `IDENTITY_VERIFICATION_IN_PROGRESS` — user blocked from QR payments

### 7. ACTION_REQUIRED state — regions page

DB: same as test 6

- [ ] 7a. Click a locked region → KycActionRequiredModal appears (not StartVerificationModal)
- [ ] 7b. Modal shows "Action needed" title, reject labels, "Re-submit verification" button
- [ ] 7c. Click "Re-submit verification" → SumsubKycWrapper opens with `autoStart` (skips consent screen)
- [ ] 7d. User re-submits in SDK → flow continues normally

### 8. REJECTED — retryable (RETRY) — activity drawer

DB: `UPDATE user_kyc_verifications SET status = 'REJECTED', reject_type = 'RETRY', reject_labels = '["DOCUMENT_BAD_QUALITY", "SELFIE_MISMATCH"]' WHERE user_id = '<id>' AND provider = 'SUMSUB';`

- [ ] 8a. Activity feed shows "Rejected" subtitle with red status pill
- [ ] 8b. Open drawer → human-readable reasons: "Poor document quality..." and "Selfie doesn't match..."
- [ ] 8c. "Retry verification" button visible (not terminal)
- [ ] 8d. Click retry → opens Sumsub SDK with `autoStart` and correct `regionIntent`

### 9. REJECTED — retryable (RETRY) — regions page

DB: same as test 8

- [ ] 9a. Click a locked region → KycRejectedModal appears with amber styling
- [ ] 9b. Title: "Verification unsuccessful", shows reject labels, "Retry verification" button
- [ ] 9c. Click retry → SumsubKycWrapper opens with `autoStart`
- [ ] 9d. User re-submits → flow continues normally

### 10. REJECTED — terminal (FINAL) — activity drawer

DB: `UPDATE user_kyc_verifications SET status = 'REJECTED', reject_type = 'FINAL', reject_labels = '["REGULATIONS_VIOLATIONS"]' WHERE user_id = '<id>' AND provider = 'SUMSUB';`

- [ ] 10a. Open drawer → `isTerminal = true`
- [ ] 10b. Shows "Your verification cannot be retried" InfoCard with lock icon, no retry button
- [ ] 10c. "Contact support" button opens Crisp support modal

### 11. REJECTED — terminal (FINAL) — regions page

DB: same as test 10

- [ ] 11a. Click a locked region → KycRejectedModal appears with red styling
- [ ] 11b. Title: "Verification failed", lock icon, "Your verification cannot be retried"
- [ ] 11c. "Contact support" button (no retry button)

### 12. REJECTED — terminal via labels (no rejectType needed)

DB: `UPDATE user_kyc_verifications SET status = 'REJECTED', reject_type = NULL, reject_labels = '["DOCUMENT_FAKE"]' WHERE user_id = '<id>' AND provider = 'SUMSUB';`

- [ ] 12a. Both drawer and regions page modal → terminal state triggered by `hasTerminalRejectLabel`
- [ ] 12b. Same locked UI — support contact only, no retry

### 13. REJECTED — terminal via failure count (2+ rejections)

DB: insert 2+ rows with `provider = 'SUMSUB'` and `status = 'REJECTED'` for the same user.

- [ ] 13a. Both drawer and regions page modal → `failureCount >= 2` triggers terminal
- [ ] 13b. Same locked UI — support contact only

### 14. PENDING / IN_REVIEW — regions page

DB: `UPDATE user_kyc_verifications SET status = 'PENDING' WHERE user_id = '<id>' AND provider = 'SUMSUB';`

- [ ] 14a. Click a locked region → KycProcessingModal appears
- [ ] 14b. Shows "Verification in progress" title, "We're reviewing your identity"
- [ ] 14c. Close button works, no retry/resubmit CTA

### 15. Status-aware modal routing on regions page

This tests the `getModalVariant()` logic:

- [ ] 15a. No verification → StartVerificationModal (start fresh)
- [ ] 15b. Status NOT_STARTED → StartVerificationModal
- [ ] 15c. Status PENDING/IN_REVIEW → KycProcessingModal
- [ ] 15d. Status ACTION_REQUIRED → KycActionRequiredModal
- [ ] 15e. Status REJECTED (retryable) → KycRejectedModal with retry
- [ ] 15f. Status REJECTED (terminal) → KycRejectedModal without retry
- [ ] 15g. Different regionIntent than existing → StartVerificationModal (new verification)

### 16. Stop verification flow

- [ ] 16a. During SDK verification, click "Stop verification process" button at bottom
- [ ] 16b. Confirmation modal appears: "Stop verification?" with description
- [ ] 16c. Click "Stop verification" → SDK destroyed, modal closes
- [ ] 16d. Click "Continue verifying" → confirmation modal closes, SDK still active
- [ ] 16e. "Having trouble?" button → help modal → "Chat with support" opens Crisp

### 17. WebSocket real-time updates

- [ ] 17a. Start KYC, complete SDK → "Verification in progress" modal (verifying phase)
- [ ] 17b. Sumsub dashboard approve → WebSocket fires `sumsub_kyc_status_update` with APPROVED
- [ ] 17c. Modal transitions to preparing phase (not closed immediately)
- [ ] 17d. `user_rail_status_changed` WebSocket fires as rails update
- [ ] 17e. All rails settled → modal transitions to complete phase
- [ ] 17f. REJECTED webhook → progress modal closes, user data refreshed for drawer

### 18. Resume abandoned flow

- [ ] 18a. Start KYC, begin SDK, stop verification → SDK destroyed
- [ ] 18b. Re-open KYC later → same applicant reused, SDK picks up where user left off

### 19. SDK error / script load failure

- [ ] 19a. Block `static.sumsub.com` in devtools network tab, open KYC, start verification
- [ ] 19b. Error UI: red alert icon, "Failed to load verification..." + Close button
- [ ] 19c. "Having trouble?" button (when SDK loads but hangs) → help modal → "Chat with support"

### 20. Bridge KYC status (regression check)

- [ ] 20a. User with `bridgeKycStatus: 'approved'` → activity feed "Approved" green badge, drawer shows completed
- [ ] 20b. User with `bridgeKycStatus: 'under_review'` → "In progress", drawer shows processing
- [ ] 20c. User with `bridgeKycStatus: 'rejected'` → drawer shows raw bridge reason (not mapped labels)

### 21. QR payment gating (`useQrKycGate`)

- [ ] 21a. No KYC at all → `REQUIRES_IDENTITY_VERIFICATION` — blocked
- [ ] 21b. Sumsub APPROVED → `PROCEED_TO_PAY`
- [ ] 21c. Manteca ACTIVE → `PROCEED_TO_PAY`
- [ ] 21d. Bridge approved → `PROCEED_TO_PAY`
- [ ] 21e. Sumsub PENDING / IN_REVIEW → `IDENTITY_VERIFICATION_IN_PROGRESS` — blocked
- [ ] 21f. Sumsub ACTION_REQUIRED → `IDENTITY_VERIFICATION_IN_PROGRESS` — blocked
- [ ] 21g. `paymentProcessor === 'SIMPLEFI'` → `PROCEED_TO_PAY` regardless

### 22. Provider submission (backend-only — check via logs/DB)

- [ ] 22a. Sumsub approved + PENDING Bridge rail → Bridge payload built, UserRail → `REQUIRES_INFORMATION`, UserRailEvent created
- [ ] 22b. Sumsub approved + PENDING Manteca rail → Manteca payload built, questionnaire data extracted, image uploaded, UserRail → `ENABLED`
- [ ] 22c. Bridge accepts, Manteca API down → Bridge `REQUIRES_INFORMATION`, Manteca stays `PENDING`, Sentry logged
- [ ] 22d. Both providers fail → both rails stay `PENDING`, errors logged
- [ ] 22e. Duplicate webhook → status unchanged → early exit, no duplicate submission
- [ ] 22f. `applicantCreated` webhook → `sumsubApplicantId` linked via `externalUserId` in DB
- [ ] 22g. WebSocket `user_rail_status_changed` fires for each rail status transition

### 23. Rail status tracking (frontend)

- [ ] 23a. After APPROVED, `useRailStatusTracking` starts polling (4s interval)
- [ ] 23b. WebSocket `user_rail_status_changed` → immediate status update without waiting for poll
- [ ] 23c. Bridge rail REQUIRES_INFORMATION → provider status = `requires_tos`
- [ ] 23d. Manteca rail ENABLED → provider status = `enabled`
- [ ] 23e. All rails settled → tracking stops automatically
- [ ] 23f. Rail FAILED → provider status = `failed`

### 24. Re-submit from activity drawer (KycStatusDrawer)

- [ ] 24a. ACTION_REQUIRED in drawer → click "Continue verification" → Sumsub SDK opens with `autoStart`
- [ ] 24b. Correct `regionIntent` derived from verification metadata (STANDARD vs LATAM)
- [ ] 24c. REJECTED (retryable) in drawer → click "Retry verification" → Sumsub SDK opens with `autoStart`
- [ ] 24d. Error from `useSumsubKycFlow` displayed in drawer below content
- [ ] 24e. REJECTED (terminal) in drawer → no retry button, "Contact support" only

---

## Known blockers

| Blocker | Impact | Workaround |
|---------|--------|------------|
| No self-healing submission retry | If `submitToProviders()` fails, rails stay PENDING forever | Manually re-trigger via DB or restart. Poller only polls sumsub status, not re-triggers submission. |
| `moderationComment` not in events | Can't show reviewer's human note | Label mapping covers common cases. |
| Bridge ToS not e2e tested | Full flow (create customer → ToS prompt → accept → ENABLED) untested with real Bridge customer | Test with sandbox Bridge account. |
| No ProviderStatusList component | After APPROVED, activity drawer doesn't show per-provider rail status breakdown | Check DB for rail statuses. |

---

## Issues found during testing

> Add any bugs, weird behavior, or unexpected results here. Include the test case number, what you expected, and what actually happened.

| # | Test case | Description | Severity | Fixed? |
|---|-----------|-------------|----------|--------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
