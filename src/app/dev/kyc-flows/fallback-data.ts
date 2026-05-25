// auto-generated snapshot of mono/engineering/projects/kyc-2.0/flow-diagram.md
// to refresh: copy the file content from mono and replace this string
// last synced: 2026-05-05
export const FALLBACK_MARKDOWN = `# KYC Flow — Complete State Machine

> canonical reference for all KYC code paths, entry points, providers, and failure modes.
> last updated: 2026-05-05

---

## 1. entry points & user intent

\`\`\`mermaid
flowchart TD
    QR[QR Scan] -->|PAY_QR| Gate{KYC Gate}
    Bank[Bank Deposit] -->|FIAT_ONRAMP| Gate
    LATAM[LATAM Deposit] -->|SEND_RECEIVE| Gate
    Withdraw[Withdrawal] -->|OFFRAMP| Gate
    Card[Card Rain] -->|CARD_ISSUE| Gate
    Profile[Regions Page] -->|UNLOCK_REGION| Gate

    Gate -->|already verified| Pass[Proceed to Action]
    Gate -->|not verified| Modal[Show KYC Modal]
    Gate -->|in progress| Progress[In Progress Modal]
\`\`\`

**gate logic** (\`useQrKycGate\` / \`useUnifiedKycStatus\`):
- checks sumsub, bridge, and manteca statuses in priority order
- already approved for the target region = proceed
- any verification in progress = show waiting modal

---

## 2. sumsub verification flow (core state machine)

\`\`\`mermaid
stateDiagram-v2
    [*] --> NOT_STARTED: user created

    NOT_STARTED --> IN_PROGRESS: POST /users/identity\\n(SDK token returned)
    IN_PROGRESS --> PENDING: user submits docs in SDK

    PENDING --> APPROVED: webhook GREEN
    PENDING --> ACTION_REQUIRED: webhook RED+RETRY or onHold
    PENDING --> REJECTED_FINAL: webhook RED+FINAL

    ACTION_REQUIRED --> IN_PROGRESS: user retries (same applicant)
    APPROVED --> PROVIDER_SUBMISSION: submitToProviders()

    REJECTED_FINAL --> [*]: contact support only

    note right of PENDING
        LATAM: only APPROVED on
        applicantWorkflowCompleted
        (both levels done)
    end note

    note right of ACTION_REQUIRED
        reject labels shown to user:
        DOCUMENT_DAMAGED, SELFIE_MISMATCH,
        POOR_QUALITY, etc.
    end note
\`\`\`

### status mapping

| sumsub webhook | reviewAnswer | reviewRejectType | unified status | user-facing |
|---|---|---|---|---|
| applicantCreated | — | — | NOT_STARTED | — |
| sdk opened | — | — | IN_PROGRESS | "Verifying..." |
| applicantPending | — | — | PENDING | "Under review" |
| applicantReviewed | GREEN | — | APPROVED | "Verified" |
| applicantReviewed | RED | RETRY | ACTION_REQUIRED | "Action needed" + reasons |
| applicantReviewed | RED | FINAL | REJECTED_FINAL | "Verification failed" |
| applicantPending (onHold) | — | — | ACTION_REQUIRED | "Additional info needed" |
| applicantWorkflowCompleted | GREEN | — | APPROVED (LATAM) | "Verified" |

### reverification (cross-region)

when a previously APPROVED user changes region intent (e.g., STANDARD → LATAM):
1. \`POST /users/identity\` with \`crossRegion=true\`
2. backend calls \`sumsubService.moveToLevel(applicantId, newLevel)\`
3. status → REVERIFYING, metadata updated with new regionIntent
4. user repeats KYC at new level (gets questionnaire for LATAM)

---

## 3. provider submission & rail states

\`\`\`mermaid
flowchart TD
    Approved[SUMSUB APPROVED] --> Fetch[Fetch Sumsub data<br/>applicant + questionnaire + images]
    Fetch --> Backfill[Backfill user profile<br/>email, firstName, lastName]
    Backfill --> DupCheck{Duplicate email?}
    DupCheck -->|yes| DupError[ACTION_REQUIRED<br/>DUPLICATE_EMAIL]
    DupCheck -->|no| Submit[Submit to providers]

    Submit --> Bridge[BRIDGE<br/>Standard: EU/NA]
    Submit --> Manteca[MANTECA<br/>LATAM]
    Submit --> Rain[RAIN<br/>Card - dev]
\`\`\`

### bridge (standard region)

\`\`\`mermaid
flowchart TD
    Transform[Transform payload<br/>tax ID, address, docs, endorsements] --> Post[POST /v0/customers<br/>idempotency guard: check bridgeCustomerId]
    Post -->|success| ReqInfo[REQUIRES_INFORMATION<br/>needs ToS acceptance]
    Post -->|fail| Pending[Stay PENDING<br/>Layer 1 retry]
    ReqInfo -->|user accepts ToS| Enabled[ENABLED]
    ReqInfo -->|user skips| Later[Reminder in activity drawer<br/>no deadline]

    Enabled -->|Bridge requests docs| ExtraInfo[REQUIRES_EXTRA_INFORMATION]
    ExtraInfo -->|user uploads via Sumsub additional-docs| ReqInfo2[REQUIRES_INFORMATION]
    ReqInfo2 -->|Bridge re-reviews| Enabled2[ENABLED]
\`\`\`

**bridge-specific details:**
- tax ID mapped per country: ARG→cuil, BRA→cpf, USA→ssn, MEX→rfc, GBR→nino
- endorsements submitted: \`[base, sepa, spei, faster_payments]\`
- document types: passport, drivers_license, national_id
- subdivision must be ISO 3166-2 code (use \`resolveSubdivisionCode()\`)

### manteca (LATAM region)

\`\`\`mermaid
flowchart TD
    Transform[Transform payload<br/>nationality, sex, PEP/FATCA/FEP,<br/>occupation, marital status] --> Post[POST /onboarding-actions/initial]
    Post --> Upload[Upload identity images<br/>FRONT + BACK via S3 presigned URLs]
    Upload -->|success| Enabled[ENABLED immediately]
    Upload -->|fail| Pending[Stay PENDING<br/>Layer 1 retry]
\`\`\`

**manteca-specific details:**
- exchange determined by country: BRL→BRAZIL, ARS→ARGENTINA
- geo codes: ARGENTINA→AR, BRAZIL→BR, CHILE→CL, COLOMBIA→CO, MEXICO→MX
- nationality uses spanish names: "Brasil", "Argentina", etc.
- idempotent: checks \`GET /users/external/{externalId}\` before creating

### rain (card — dev branch)

\`\`\`mermaid
flowchart TD
    Share[Share Sumsub token<br/>via RAIN_SUMSUB_CLIENT_ID] --> Review[Rain independent review]
    Review -->|approved/exempt| Enabled[ENABLED<br/>card issued automatically]
    Review -->|needsVerification| ReqInfo[REQUIRES_INFORMATION<br/>user must complete Rain portal KYC]
    Review -->|denied| Rejected[REJECTED<br/>permanent]
    Review -->|pending| Pending[PENDING<br/>awaiting Rain review]

    ReqInfo -->|user completes Rain portal| Review2[Rain re-reviews]
    Review2 -->|approved| Enabled
\`\`\`

**rain-specific details:**
- two-stage KYC: peanut sumsub + rain's own review
- requires SELFIE with liveness at minimum
- on approval: creates arbitrum collateral contract per user
- spending limits: perAuthorization, per24HourPeriod, per30DayPeriod, perAllTime

---

## 4. rail state machine

\`\`\`mermaid
stateDiagram-v2
    [*] --> PENDING: autoEnrollUserRails()

    PENDING --> ENABLED: Manteca success
    PENDING --> REQUIRES_INFORMATION: Bridge success (needs ToS)
    PENDING --> REQUIRES_INFORMATION: Rain needsVerification
    PENDING --> FAILED: max 5 attempts exhausted

    REQUIRES_INFORMATION --> ENABLED: Bridge ToS accepted
    REQUIRES_INFORMATION --> REQUIRES_EXTRA_INFORMATION: Bridge requests docs

    REQUIRES_EXTRA_INFORMATION --> REQUIRES_INFORMATION: additional docs submitted

    ENABLED --> [*]: user can use payment method
    FAILED --> [*]: Sentry alert, support needed
\`\`\`

### region → rails mapping

| region intent | sumsub level | rails enrolled | provider |
|---|---|---|---|
| STANDARD | peanut-kyc-standard | ACH_US, SEPA_EU, SPEI_MX, FASTER_PAYMENTS_GB | BRIDGE |
| LATAM | peanut-kyc-latam | PIX_BR, BANK_TRANSFER_AR, MERCADOPAGO_QR_AR | MANTECA |
| CARD | rain-card-application | CARD_RAIN (global, USD) | RAIN |

---

## 5. self-healing retry pipeline

\`\`\`mermaid
flowchart TD
    Fail[Provider submission fails] --> L1[Layer 1: inline retry<br/>3 attempts, 1s → 2s → 4s backoff]
    L1 -->|success| Done[Rail ENABLED / REQUIRES_INFORMATION]
    L1 -->|all 3 fail| Track[Rail stays PENDING<br/>attempts=1, error logged]

    Track --> L2[Layer 2: poller retry<br/>every polling cycle]
    L2 -->|backoff: 5m → 10m → 20m → 40m| Retry[Re-trigger submitToProviders]
    Retry -->|success| Done2[Rail ENABLED]
    Retry -->|fail| Inc[attempts++]
    Inc -->|attempts < 5| L2
    Inc -->|attempts = 5| Failed[Rail → FAILED<br/>Sentry alert fires]
\`\`\`

**total window: ~75 minutes from first failure to FAILED transition.**

**idempotency guards:**
- bridge: checks \`user.bridgeCustomerId\` — skips POST if already exists
- manteca: checks \`GET /users/external/{externalId}\` — returns existing user
- rain: token-based, inherently idempotent

**missed submissions (edge case):**
- poller catches rails with \`attempts=0\` AND \`createdAt > 10min ago\`
- these are "orphan" rails where \`submitToProviders()\` crashed before incrementing

---

## 6. frontend modal phases

\`\`\`mermaid
stateDiagram-v2
    [*] --> verifying: Sumsub SDK opens

    verifying --> preparing: SDK complete + APPROVED via WebSocket
    preparing --> bridge_tos: Bridge rails need ToS (STANDARD only)
    preparing --> complete: all rails settled (LATAM/Rain)

    bridge_tos --> complete: user accepts ToS
    bridge_tos --> complete: user clicks "Skip for now"

    complete --> [*]: onKycSuccess callback fired
\`\`\`

### preparing phase UX timeline

| elapsed | copy shown |
|---|---|
| 0-3s | "Preparing your payment methods..." |
| 3-8s | "Configuring your regions..." |
| 8s+ | "Almost there" |
| 30s+ | "This is taking longer than expected" + "Go Home" button |

### websocket events

| event | triggers |
|---|---|
| \`sumsub_kyc_status_update\` | update liveKycStatus, close SDK on APPROVED |
| \`user_rail_status_changed\` | update rail tracking, trigger modal phase changes |
| \`manteca_kyc_status_update\` | update manteca-specific status |

---

## 7. self-heal: provider rejection resubmit

\`\`\`mermaid
flowchart TD
    Reject[Provider rejects user<br/>Bridge or Manteca] --> Classify[classifyRejection provider, reasons<br/>src/kyc/self-heal/classifier.ts]
    Classify -->|isFixable=true| DB[DB: rejectType=PROVIDER_FIXABLE<br/>rejectLabels=provider rejection reasons]
    Classify -->|isFixable=false| Terminal[CONTACT_SUPPORT<br/>non-fixable rejection]
    DB --> UI[FE: user sees Re-submit CTA<br/>entry: home activation, JIT gate, settings]
    UI -->|user clicks| Post[POST /users/identity/resubmit<br/>body: provider BRIDGE or MANTECA]
    Post --> Action[Creates applicant action on existing applicant<br/>level: self-heal-reupload-id<br/>externalActionId: reheal-provider-userId8hex-attempt]
    Action --> Token[Returns SDK token + actionId<br/>applicantId, requiredAction, attempt/maxAttempts]
    Token --> SDK[Sumsub SDK opens<br/>kycSelfHealingDocUpload questionnaire<br/>user uploads new ID/address docs]
    SDK --> Webhook[Sumsub webhook: applicantReviewed<br/>for applicant action]
    Webhook -->|GREEN| Resubmit[handleSelfHealActionApproval<br/>src/kyc/self-heal/resubmitter.ts]
    Resubmit --> Download[Downloads doc images from action]
    Download -->|Bridge| BridgeResub[resubmitToBridge<br/>PUT /v0/customers/id<br/>rails REJECTED to REQUIRES_INFORMATION]
    Download -->|Manteca| MantecaResub[resubmitToManteca<br/>uploadIdentityImage FRONT+BACK<br/>rails REJECTED to PENDING]
    Webhook -->|RED or still fails| StillFailed{attempt < 3?}
    StillFailed -->|yes| UI
    StillFailed -->|no| Support[Contact support CTA<br/>max 3 attempts reached]
\`\`\`

**RequiredAction types:** \`REUPLOAD_ID\` | \`REUPLOAD_ADDRESS_PROOF\` | \`CONTACT_SUPPORT\`

**action ID format:** \`reheal-{provider}-{userId first 8 hex}-{attempt}\` (parsed by \`parseSelfHealActionId()\`)

---

## 8a. cross-region: STANDARD user wants LATAM

\`\`\`mermaid
flowchart TD
    A1[User APPROVED for STANDARD] -->|wants LATAM| A2[POST /users/identity<br/>regionIntent=LATAM, crossRegion=true]
    A2 --> A3[Creates manteca applicant action<br/>level: manteca-kyc-action<br/>externalActionId: manteca-userId]
    A3 --> A4[SDK opens action level<br/>collects PEP/FATCA, occupation, tax ID]
    A4 --> A5[Webhook: action GREEN]
    A5 --> A6[processApplicantActionApproval<br/>auto-enroll LATAM rails + submit to Manteca]
\`\`\`

## 8b. cross-region: LATAM user wants STANDARD

\`\`\`mermaid
flowchart TD
    B1[User APPROVED for LATAM] -->|wants STANDARD| B2[POST /users/identity<br/>regionIntent=STANDARD]
    B2 --> B3[No SDK needed<br/>actionType: bridge-direct]
    B3 --> B4[autoEnrollUserRails STANDARD<br/>submitToProviders async]
    B4 --> B5[Bridge submission<br/>rails: ACH_US, SEPA_EU, etc.]
\`\`\`

---

## 9. post-approval UX

\`\`\`mermaid
flowchart TD
    Approved[KYC APPROVED + Provider ENABLED] --> InApp{User in app?}
    InApp -->|yes| Modal[Modal: preparing 1-30s<br/>then bridge_tos if Bridge<br/>then complete]
    Modal --> Continue[Original flow continues inline<br/>QR payment / deposit / withdraw]
    InApp -->|no| Push[Push notification:<br/>Your identity has been verified<br/>deeplink to /home]
    Push --> Return{User returns?}
    Return -->|yes| Gate[Gate passes immediately<br/>user re-triggers action]
    Return -->|no| Nothing[Single push only<br/>no drip campaign post-approval]
\`\`\`

---

## 10. sumsub levels & action IDs reference

\`\`\`mermaid
flowchart LR
    subgraph Levels
        L1[peanut-kyc-standard<br/>Standard KYC]
        L2[peanut-kyc-latam<br/>LATAM KYC 2 levels]
        L3[peanut-additional-docs<br/>Bridge extra docs]
        L4[manteca-kyc-action<br/>Manteca questionnaire]
        L5[self-heal-reupload-id<br/>Provider rejection resubmit]
    end

    subgraph ActionIDs[Action ID Formats]
        ID1[reheal-bridge-a1b2c3d4-1<br/>self-heal: reheal-provider-userId8hex-attempt]
        ID2[manteca-userId<br/>cross-region: manteca- prefix + userId]
        ID3[userId-addl-docs<br/>additional docs: userId + -addl-docs suffix]
    end
\`\`\`

---

## 11. debug cheat sheet (sandbox mode)


### quick state simulation

| method | command / action | when to use |
|---|---|---|
| browser console | \`debug.approveKyc('manteca', 'AR')\` | wire local user to pre-provisioned Manteca identity |
| sumsub sandbox | use test documents from sumsub docs | full verification flow testing |
| DB manipulation | \`UPDATE user_kyc_verifications SET status='APPROVED'...\` | quick state setup |
| bridge sandbox | \`simulateKycApprovalAndPoll()\` in QA harness | bridge customer approval |
| websocket | send manual \`sumsub_kyc_status_update\` | UI event testing |
| sumsub dashboard | manually approve/reject applicant | end-to-end webhook testing |

### canonical test fixtures (\`engineering/qa/lib/fixtures/canonical.mjs\`)

| fixture | description |
|---|---|
| \`alice-ar-verified\` | argentine user, KYC-verified, manteca active |
| \`bob-us-verified\` | US user, KYC-verified, bridge approved |
| \`carol-us-unverified\` | US user, no KYC (for gating tests) |
| \`diana-us-kyc-recently-approved\` | KYC approved 7 days ago |
| \`eve-us-kyc-long-approved\` | KYC approved 1 year ago |

### test addresses per country (\`engineering/qa/lib/factories/sumsub.mjs\`)

| country | address |
|---|---|
| USA | 1 Test Street, San Francisco, CA 94103 |
| ARG | Av. Test 1234, Buenos Aires, C1000AAA |
| BRA | Rua Teste 100, Sao Paulo, SP 01000-000 |

---

## 12. key files

| area | path |
|---|---|
| entry points (FE) | \`peanut-ui/src/hooks/useQrKycGate.ts\`, \`useMultiPhaseKycFlow.ts\`, \`useUnifiedKycStatus.ts\` |
| KYC components (FE) | \`peanut-ui/src/components/Kyc/\` |
| initiation (BE) | \`peanut-api-ts/src/routes/sumsub/initiate-kyc.ts\` |
| status processor (BE) | \`peanut-api-ts/src/sumsub/status-processor.ts\` |
| provider submission (BE) | \`peanut-api-ts/src/kyc/provider-submission/index.ts\` |
| bridge adapter (BE) | \`peanut-api-ts/src/kyc/provider-submission/bridge-adapter.ts\` |
| manteca adapter (BE) | \`peanut-api-ts/src/kyc/provider-submission/manteca-adapter.ts\` |
| rails system (BE) | \`peanut-api-ts/src/kyc/rails.ts\`, \`rails.consts.ts\` |
| self-healing (BE) | \`peanut-api-ts/src/polling/submissionRetry.ts\` |
| rain (BE, dev) | \`peanut-api-ts/src/routes/rain/\`, \`src/rain/service.ts\` |
| webhooks (BE) | \`src/routes/sumsub/webhooks.ts\`, \`routes/bridge/webhooks/\`, \`routes/manteca/webhook.ts\` |
| QA harness | \`engineering/qa/\`, \`.env.sandbox\` |
| edge cases reference | \`engineering/projects/kyc-2.0/edge-cases.md\` |
`
