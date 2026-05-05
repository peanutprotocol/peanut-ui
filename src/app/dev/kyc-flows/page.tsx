'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

const diagrams = [
    {
        title: '1. Entry Points & User Intent',
        code: `flowchart TD
    QR[QR Scan] -->|PAY_QR| Gate{KYC Gate}
    Bank[Bank Deposit] -->|FIAT_ONRAMP| Gate
    LATAM[LATAM Deposit] -->|SEND_RECEIVE| Gate
    Withdraw[Withdrawal] -->|OFFRAMP| Gate
    Card[Card Rain] -->|CARD_ISSUE| Gate
    Profile[Regions Page] -->|UNLOCK_REGION| Gate

    Gate -->|already verified| Pass[Proceed to Action]
    Gate -->|not verified| Modal[Show KYC Modal]
    Gate -->|in progress| Progress[In Progress Modal]

    style QR fill:#a5d8ff,stroke:#4a9eed
    style Bank fill:#a5d8ff,stroke:#4a9eed
    style LATAM fill:#a5d8ff,stroke:#4a9eed
    style Withdraw fill:#a5d8ff,stroke:#4a9eed
    style Card fill:#ffd8a8,stroke:#f59e0b
    style Profile fill:#a5d8ff,stroke:#4a9eed
    style Gate fill:#fff3bf,stroke:#f59e0b
    style Pass fill:#b2f2bb,stroke:#22c55e
    style Modal fill:#ffc9c9,stroke:#ef4444
    style Progress fill:#fff3bf,stroke:#f59e0b`,
    },
    {
        title: '2. Sumsub Verification Flow',
        code: `stateDiagram-v2
    [*] --> NOT_STARTED: user created

    NOT_STARTED --> IN_PROGRESS: POST /users/identity (level: peanut-kyc-standard or peanut-kyc-latam)
    IN_PROGRESS --> PENDING: user submits docs in SDK

    PENDING --> APPROVED: webhook GREEN (LATAM: only on applicantWorkflowCompleted)
    PENDING --> ACTION_REQUIRED: webhook RED+RETRY or onHold
    PENDING --> REJECTED_FINAL: webhook RED+FINAL

    ACTION_REQUIRED --> IN_PROGRESS: user retries (same applicantId, fresh token)
    APPROVED --> PROVIDER_SUBMISSION: submitToProviders()

    REJECTED_FINAL --> [*]: contact support only

    note right of PENDING
        LATAM: only APPROVED on
        applicantWorkflowCompleted
        (both levels done)
    end note`,
    },
    {
        title: '3. Provider Submission (Post-Approval)',
        code: `flowchart TD
    Approved[SUMSUB APPROVED] --> Enroll[autoEnrollUserRails based on regionIntent<br/>STANDARD: ACH_US, SEPA_EU, SPEI_MX, FASTER_PAYMENTS_GB<br/>LATAM: PIX_BR, BANK_TRANSFER_AR, MERCADOPAGO_QR_AR]
    Enroll --> Fetch[Fetch Sumsub data + questionnaire + images]
    Fetch --> Backfill[Backfill user profile email/name]
    Backfill --> DupCheck{Duplicate email?}
    DupCheck -->|yes| DupError[ACTION_REQUIRED + DUPLICATE_EMAIL<br/>resets Sumsub APPLICANT_DATA step<br/>user re-enters email in SDK]
    DupCheck -->|no| Submit[Submit to providers<br/>based on pending UserRails provider]

    Submit -->|rails belong to BRIDGE| Bridge[BRIDGE submission<br/>transform: tax ID, address, endorsements<br/>POST /v0/customers + idempotency guard]
    Submit -->|rails belong to MANTECA<br/>only if country=ARG/BRA| Manteca[MANTECA submission<br/>transform: nationality, PEP/FATCA, occupation<br/>POST /onboarding-actions + upload images S3]
    Submit -->|rails belong to RAIN| Rain[RAIN submission<br/>share Sumsub token via RAIN_SUMSUB_CLIENT_ID]

    Bridge -->|success| BridgeOK[REQUIRES_INFORMATION<br/>needs Bridge ToS acceptance]
    Bridge -->|fail| BridgeFail[Stay PENDING<br/>retry pipeline Layer 1+2]
    BridgeOK -->|ToS accepted| BridgeEnabled[ENABLED]

    Manteca -->|success| MantecaOK[ENABLED immediately]
    Manteca -->|fail| MantecaFail[Stay PENDING<br/>retry pipeline Layer 1+2]

    Rain -->|approved/exempt| RainEnabled[ENABLED + card issued]
    Rain -->|needsVerification| RainInfo[REQUIRES_INFORMATION<br/>user completes Rain portal]
    Rain -->|denied| RainDenied[REJECTED]

    style Approved fill:#b2f2bb,stroke:#22c55e
    style Enroll fill:#fff3bf,stroke:#f59e0b
    style Bridge fill:#d0bfff,stroke:#8b5cf6
    style Manteca fill:#b2f2bb,stroke:#22c55e
    style Rain fill:#ffd8a8,stroke:#f59e0b
    style BridgeEnabled fill:#b2f2bb,stroke:#22c55e
    style MantecaOK fill:#b2f2bb,stroke:#22c55e
    style RainEnabled fill:#b2f2bb,stroke:#22c55e
    style BridgeFail fill:#ffc9c9,stroke:#ef4444
    style MantecaFail fill:#ffc9c9,stroke:#ef4444
    style RainDenied fill:#ffc9c9,stroke:#ef4444
    style DupError fill:#ffc9c9,stroke:#ef4444`,
    },
    {
        title: '4. Rail State Machine',
        code: `stateDiagram-v2
    [*] --> PENDING: autoEnrollUserRails()

    PENDING --> ENABLED: Manteca success
    PENDING --> REQUIRES_INFORMATION: Bridge success (needs ToS)
    PENDING --> REQUIRES_INFORMATION: Rain needsVerification
    PENDING --> FAILED: max 5 attempts exhausted

    REQUIRES_INFORMATION --> ENABLED: Bridge ToS accepted
    REQUIRES_INFORMATION --> REQUIRES_EXTRA_INFORMATION: Bridge requests docs

    REQUIRES_EXTRA_INFORMATION --> REQUIRES_INFORMATION: additional docs submitted

    ENABLED --> [*]: user can use payment method
    FAILED --> [*]: Sentry alert, support needed`,
    },
    {
        title: '5. Self-Healing Retry Pipeline',
        code: `flowchart TD
    Fail[Provider submission fails] --> L1[Layer 1: inline retry<br/>3 attempts, 1s - 2s - 4s]
    L1 -->|success| Done[Rail ENABLED]
    L1 -->|all 3 fail| Track[Rail stays PENDING<br/>attempts=1, error logged]

    Track --> L2[Layer 2: poller retry]
    L2 -->|backoff: 5m - 10m - 20m - 40m| Retry[Re-trigger submitToProviders]
    Retry -->|success| Done2[Rail ENABLED]
    Retry -->|fail| Inc[attempts++]
    Inc -->|attempts < 5| L2
    Inc -->|attempts = 5| Failed[Rail FAILED<br/>Sentry alert]

    style Fail fill:#ffc9c9,stroke:#ef4444
    style L1 fill:#ffc9c9,stroke:#ef4444
    style L2 fill:#ffc9c9,stroke:#ef4444
    style Failed fill:#ffc9c9,stroke:#ef4444
    style Done fill:#b2f2bb,stroke:#22c55e
    style Done2 fill:#b2f2bb,stroke:#22c55e
    style Track fill:#fff3bf,stroke:#f59e0b`,
    },
    {
        title: '6. Frontend Modal Phases',
        code: `stateDiagram-v2
    [*] --> verifying: Sumsub SDK opens

    verifying --> preparing: SDK complete + APPROVED via WebSocket
    preparing --> bridge_tos: Bridge rails need ToS (STANDARD only)
    preparing --> complete: all rails settled (LATAM/Rain)

    bridge_tos --> complete: user accepts ToS
    bridge_tos --> complete: user clicks Skip

    complete --> [*]: onKycSuccess callback fired

    note right of preparing
        0-3s: Payment methods...
        3-8s: Configuring...
        8s+: Almost there
        30s+: Taking longer
    end note`,
    },
    {
        title: '7. Bridge Additional Docs Flow',
        code: `flowchart TD
    Enabled[ENABLED or REQUIRES_INFORMATION] -->|Bridge requests docs via webhook| Extra[REQUIRES_EXTRA_INFORMATION]
    Extra -->|User uploads via Sumsub additional-docs level| Submit[Backend submits docs to Bridge]
    Submit --> ReqInfo[REQUIRES_INFORMATION]
    ReqInfo -->|Bridge re-reviews| Enabled2[ENABLED]

    style Enabled fill:#b2f2bb,stroke:#22c55e
    style Extra fill:#fff3bf,stroke:#f59e0b
    style ReqInfo fill:#fff3bf,stroke:#f59e0b
    style Enabled2 fill:#b2f2bb,stroke:#22c55e`,
    },
    {
        title: '8. Self-Heal: Provider Rejection Resubmit',
        code: `flowchart TD
    Reject[Provider rejects user<br/>Bridge or Manteca] --> Classify[classifyRejection provider, reasons<br/>src/kyc/self-heal/classifier.ts]
    Classify -->|isFixable=true| DB[DB: rejectType=PROVIDER_FIXABLE<br/>rejectLabels=provider rejection reasons]
    Classify -->|isFixable=false| Terminal[CONTACT_SUPPORT<br/>non-fixable rejection]
    DB --> UI[FE: user sees Re-submit CTA<br/>entry: home activation, JIT gate, settings]
    UI -->|user clicks| Post[POST /users/identity/resubmit<br/>request body: provider BRIDGE or MANTECA]
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

    style Reject fill:#ffc9c9,stroke:#ef4444
    style Classify fill:#fff3bf,stroke:#f59e0b
    style DB fill:#ffd8a8,stroke:#f59e0b
    style UI fill:#ffd8a8,stroke:#f59e0b
    style Post fill:#ffd8a8,stroke:#f59e0b
    style Action fill:#ffd8a8,stroke:#f59e0b
    style SDK fill:#fff3bf,stroke:#f59e0b
    style Resubmit fill:#b2f2bb,stroke:#22c55e
    style BridgeResub fill:#d0bfff,stroke:#8b5cf6
    style MantecaResub fill:#b2f2bb,stroke:#22c55e
    style Terminal fill:#ffc9c9,stroke:#ef4444
    style Support fill:#ffc9c9,stroke:#ef4444`,
    },
    {
        title: '8b. Self-Heal: RequiredAction Types & Level Names',
        code: `flowchart LR
    subgraph Levels
        L1[peanut-kyc-standard<br/>Standard KYC]
        L2[peanut-kyc-latam<br/>LATAM KYC 2 levels]
        L3[peanut-additional-docs<br/>Bridge extra docs]
        L4[manteca-kyc-action<br/>Manteca questionnaire]
        L5[self-heal-reupload-id<br/>Provider rejection resubmit]
    end

    subgraph Actions
        A1[REUPLOAD_ID<br/>blurry/expired/unverifiable doc]
        A2[REUPLOAD_ADDRESS_PROOF<br/>proof of address failed]
        A3[CONTACT_SUPPORT<br/>non-fixable or unknown]
    end

    subgraph ActionIDs
        ID1[reheal-bridge-a1b2c3d4-1<br/>format: reheal-provider-userId8hex-attempt]
        ID2[manteca-userId<br/>format: manteca-prefix + userId]
        ID3[userId-addl-docs<br/>format: userId + suffix]
    end

    style L1 fill:#d0bfff,stroke:#8b5cf6
    style L2 fill:#b2f2bb,stroke:#22c55e
    style L3 fill:#d0bfff,stroke:#8b5cf6
    style L4 fill:#b2f2bb,stroke:#22c55e
    style L5 fill:#ffd8a8,stroke:#f59e0b
    style A1 fill:#ffd8a8,stroke:#f59e0b
    style A2 fill:#ffd8a8,stroke:#f59e0b
    style A3 fill:#ffc9c9,stroke:#ef4444`,
    },
    {
        title: '9. Cross-Region Flows',
        code: `flowchart TD
    subgraph STANDARD_to_LATAM[STANDARD approved user wants LATAM]
        A1[User APPROVED for STANDARD] -->|wants LATAM| A2[POST /users/identity<br/>regionIntent=LATAM, crossRegion=true]
        A2 --> A3[Creates manteca applicant action<br/>level: manteca-kyc-action<br/>externalActionId: manteca-userId]
        A3 --> A4[SDK opens action level<br/>collects PEP/FATCA, occupation, tax ID]
        A4 --> A5[Webhook: action GREEN]
        A5 --> A6[processApplicantActionApproval<br/>auto-enroll LATAM rails<br/>submit to Manteca]
    end

    subgraph LATAM_to_STANDARD[LATAM approved user wants STANDARD]
        B1[User APPROVED for LATAM] -->|wants STANDARD| B2[POST /users/identity<br/>regionIntent=STANDARD]
        B2 --> B3[No SDK needed<br/>actionType: bridge-direct]
        B3 --> B4[autoEnrollUserRails STANDARD<br/>submitToProviders async]
        B4 --> B5[Bridge submission<br/>rails: ACH_US, SEPA_EU, etc.]
    end

    style A1 fill:#b2f2bb,stroke:#22c55e
    style A3 fill:#ffd8a8,stroke:#f59e0b
    style A6 fill:#b2f2bb,stroke:#22c55e
    style B1 fill:#b2f2bb,stroke:#22c55e
    style B3 fill:#d0bfff,stroke:#8b5cf6
    style B5 fill:#d0bfff,stroke:#8b5cf6`,
    },
    {
        title: '10. Post-Approval UX & UI States',
        code: `flowchart TD
    Approved[KYC APPROVED + Provider ENABLED] --> InApp{User in app?}
    InApp -->|yes| Modal[Modal: preparing 1-30s<br/>then bridge_tos if Bridge<br/>then complete]
    Modal --> Continue[Original flow continues inline<br/>QR payment / deposit / withdraw]
    InApp -->|no| Push[Push notification:<br/>Your identity has been verified<br/>deeplink to /home]
    Push --> Return{User returns?}
    Return -->|yes| Gate[Gate passes immediately<br/>user re-triggers action]
    Return -->|no| Nothing[Single push only<br/>no drip campaign post-approval]

    style Approved fill:#b2f2bb,stroke:#22c55e
    style Modal fill:#c3fae8,stroke:#06b6d4
    style Continue fill:#b2f2bb,stroke:#22c55e
    style Push fill:#c3fae8,stroke:#06b6d4
    style Nothing fill:#ffc9c9,stroke:#ef4444`,
    },
]

export default function KycFlowsPage() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const init = async () => {
            // @ts-expect-error - loaded via CDN script
            const mermaid = window.mermaid
            if (!mermaid) return

            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
                flowchart: { useMaxWidth: true, htmlLabels: true },
                stateDiagram: { useMaxWidth: true },
            })

            const nodes = containerRef.current?.querySelectorAll('.mermaid-diagram')
            if (!nodes) return

            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i] as HTMLElement
                const code = node.getAttribute('data-code')
                if (!code) continue

                try {
                    const { svg } = await mermaid.render(`mermaid-${i}`, code)
                    node.innerHTML = svg
                } catch (e) {
                    node.innerHTML = `<pre style="color:red">${e}</pre>`
                }
            }
        }

        // wait for mermaid script to load
        const check = setInterval(() => {
            // @ts-expect-error - loaded via CDN script
            if (window.mermaid) {
                clearInterval(check)
                init()
            }
        }, 100)

        return () => clearInterval(check)
    }, [])

    return (
        <>
            <Script
                src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"
                strategy="afterInteractive"
            />
            <div
                ref={containerRef}
                style={{
                    maxWidth: 1200,
                    margin: '0 auto',
                    padding: '40px 20px',
                    fontFamily: 'system-ui, sans-serif',
                }}
            >
                <h1 style={{ fontSize: 28, marginBottom: 8 }}>KYC Flows — State Machine Reference</h1>
                <p style={{ color: '#666', marginBottom: 40 }}>
                    All KYC code paths, entry points, providers, and failure modes. Updated 2026-05-05.
                </p>

                {diagrams.map((d) => (
                    <section key={d.title} style={{ marginBottom: 60 }}>
                        <h2 style={{ fontSize: 20, marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                            {d.title}
                        </h2>
                        <div
                            className="mermaid-diagram"
                            data-code={d.code}
                            style={{
                                background: '#fafafa',
                                border: '1px solid #eee',
                                borderRadius: 4,
                                padding: 20,
                                minHeight: 200,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <span style={{ color: '#999' }}>Loading diagram...</span>
                        </div>
                    </section>
                ))}

                <section style={{ marginTop: 60, padding: 20, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 4 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 12 }}>Debug Cheat Sheet (Sandbox)</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                                <th style={{ padding: '8px 12px' }}>Method</th>
                                <th style={{ padding: '8px 12px' }}>Command</th>
                                <th style={{ padding: '8px 12px' }}>Use Case</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 12px' }}>Browser console</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{`debug.approveKyc('manteca', 'AR')`}</td>
                                <td style={{ padding: '8px 12px' }}>Wire user to Manteca identity</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 12px' }}>Sumsub sandbox</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>Use test documents from Sumsub docs</td>
                                <td style={{ padding: '8px 12px' }}>Full flow testing</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 12px' }}>DB manipulation</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{`UPDATE user_kyc_verifications SET status='APPROVED'`}</td>
                                <td style={{ padding: '8px 12px' }}>Quick state setup</td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '8px 12px' }}>Bridge sandbox</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>simulateKycApprovalAndPoll()</td>
                                <td style={{ padding: '8px 12px' }}>Bridge customer approval</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '8px 12px' }}>WebSocket</td>
                                <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>sumsub_kyc_status_update</td>
                                <td style={{ padding: '8px 12px' }}>UI event testing</td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            </div>
        </>
    )
}
