'use client'

import { useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import InfoCard from '@/components/Global/InfoCard'
import { Icon } from '@/components/Global/Icons/Icon'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { ActionListCard } from '@/components/ActionListCard'
import { getCardPosition } from '@/components/Global/Card/card.utils'

// kyc state components (rendered inline with mock data)
import { KycCompleted } from '@/components/Kyc/states/KycCompleted'
import { KycProcessing } from '@/components/Kyc/states/KycProcessing'
import { KycActionRequired } from '@/components/Kyc/states/KycActionRequired'
import { KycRequiresDocuments } from '@/components/Kyc/states/KycRequiresDocuments'
import { KycProviderRejection } from '@/components/Kyc/states/KycProviderRejection'
import { KycFailed } from '@/components/Kyc/states/KycFailed'
import { KycNotStarted } from '@/components/Kyc/states/KycNotStarted'

// modals
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'
import { GuestVerificationModal } from '@/components/Global/GuestVerificationModal'

// types
import type { ProviderRejectionInfo } from '@/hooks/useProviderRejectionStatus'

// ─── mock data ──────────────────────────────────────────────────

const MOCK_FIXABLE_REJECTION: ProviderRejectionInfo = {
    provider: 'BRIDGE',
    state: 'fixable',
    userMessage: 'We need an additional document to enable payments.',
    rejectedRails: [],
    kycVerification: null,
    selfHealAttempt: 1,
    maxAttempts: 3,
}

const MOCK_BLOCKED_REJECTION: ProviderRejectionInfo = {
    provider: 'BRIDGE',
    state: 'blocked',
    userMessage: "We couldn't enable payments for your account. Please contact support for assistance.",
    rejectedRails: [],
    kycVerification: null,
    selfHealAttempt: 3,
    maxAttempts: 3,
}

const MOCK_TOS_REJECTION: ProviderRejectionInfo = {
    provider: 'BRIDGE',
    state: 'fixable',
    userMessage: 'Please accept the terms to enable payments.',
    rejectedRails: [],
    kycVerification: null,
    selfHealAttempt: 0,
    maxAttempts: 3,
}

const MOCK_FIELDS_REJECTION: ProviderRejectionInfo = {
    provider: 'BRIDGE',
    state: 'fixable',
    userMessage: 'We need a few more details to enable payments.',
    rejectedRails: [],
    kycVerification: null,
    selfHealAttempt: 0,
    maxAttempts: 3,
}

// ─── helpers ────────────────────────────────────────────────────

function StateCard({
    label,
    scenario,
    children,
    problem,
}: {
    label: string
    scenario: string
    children: React.ReactNode
    problem?: string
}) {
    return (
        <div>
            <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-bold">{label}</p>
                    <p className="text-xs text-grey-1">{scenario}</p>
                </div>
                {problem && <StatusBadge status="failed" customText="issue" size="small" />}
            </div>
            <Card position="single" className="mt-2">
                {children}
            </Card>
            {problem && (
                <p className="mt-1 text-xs text-red-600">{problem}</p>
            )}
        </div>
    )
}

function CopyAuditRow({
    file,
    current,
    proposed,
    severity,
}: {
    file: string
    current: string
    proposed: string
    severity: 'HIGH' | 'MED' | 'LOW'
}) {
    const badgeStatus = severity === 'HIGH' ? 'failed' : severity === 'MED' ? 'pending' : 'processing'
    return (
        <Card position="single" className="mb-2">
            <div className="flex items-center gap-2">
                <StatusBadge status={badgeStatus} customText={severity} size="small" />
                <code className="text-xs text-grey-1">{file}</code>
            </div>
            <div className="mt-2 flex flex-col gap-1">
                <p className="text-sm text-red-600 line-through">{current}</p>
                <p className="text-sm font-medium text-green-700">{proposed}</p>
            </div>
        </Card>
    )
}

// ─── proposed regions page mockup ───────────────────────────────

function ProposedRegionsPage({ userState }: { userState: 'new' | 'verified-rfi' | 'eea' | 'happy' }) {
    const noop = () => {}

    // bridge rails — europe, us, mexico
    const europePayments = [
        { name: 'SEPA bank transfer', desc: '30+ countries' },
        { name: 'UK bank transfer', desc: 'Faster Payments' },
    ]
    const usPayments = [
        { name: 'US bank transfer', desc: 'ACH' },
        { name: 'US wire transfer', desc: 'Wire' },
        { name: 'Mexico SPEI', desc: 'Instant' },
    ]

    // manteca rails — separate enrollment per country
    const argPayments = [
        { name: 'MercadoPago QR', desc: 'Pay at stores' },
        { name: 'Bank transfer', desc: 'Send to your own accounts' },
    ]
    const brPayments = [
        { name: 'PIX QR', desc: 'Pay at stores and send to friends' },
        { name: 'Bank transfer', desc: 'Send to your own accounts' },
    ]

    return (
        <div className="flex flex-col space-y-6">
            <NavHeader title="Where you can pay" />

            {/* new user: onboarding */}
            {userState === 'new' && (
                <Card position="single">
                    <div className="flex flex-col items-center gap-4 py-4">
                        <div className="flex size-12 items-center justify-center rounded-full bg-primary-1">
                            <Icon name="globe-lock" size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold">Send money worldwide</p>
                            <p className="mt-1 text-sm text-grey-1">
                                Bank transfers, QR payments, and more. Confirm your ID to get started.
                            </p>
                        </div>
                        <Button variant="purple" shadowSize="4" className="w-full">
                            Get started
                        </Button>
                    </div>
                </Card>
            )}

            {/* eea deadline notice */}
            {userState === 'eea' && (
                <InfoCard
                    variant="warning"
                    title="Keep sending to Europe"
                    description="We need your date and country of birth by June 29 to keep European transfers active."
                />
            )}

            {/* active payment methods */}
            {userState !== 'new' && (
                <>
                    {/* europe (bridge) */}
                    <div>
                        <h2 className="mb-2 font-bold">Europe</h2>
                        {europePayments.map((p, i) => {
                            const needsAction = userState === 'eea' && p.name === 'SEPA bank transfer'
                            return (
                                <ActionListCard
                                    key={p.name}
                                    position={getCardPosition(i, europePayments.length)}
                                    leftIcon={needsAction ? <Icon name="alert" size={18} className="text-yellow-600" /> : undefined}
                                    title={p.name}
                                    description={needsAction ? 'Needs a quick update to stay active' : p.desc}
                                    descriptionClassName="text-xs"
                                    onClick={noop}
                                    rightContent={
                                        needsAction ? (
                                            <StatusBadge status="pending" customText="Action needed" size="small" />
                                        ) : (
                                            <StatusBadge status="completed" customText="All set" size="small" />
                                        )
                                    }
                                />
                            )
                        })}
                    </div>

                    {/* us & mexico (bridge) */}
                    <div>
                        <h2 className="mb-2 font-bold">US & Mexico</h2>
                        {usPayments.map((p, i) => {
                            const needsAction = userState === 'verified-rfi' && p.name === 'US bank transfer'
                            return (
                                <ActionListCard
                                    key={p.name}
                                    position={getCardPosition(i, usPayments.length)}
                                    leftIcon={needsAction ? <Icon name="alert" size={18} className="text-yellow-600" /> : undefined}
                                    title={p.name}
                                    description={needsAction ? 'One document needed to start sending' : p.desc}
                                    descriptionClassName="text-xs"
                                    onClick={noop}
                                    rightContent={
                                        needsAction ? (
                                            <StatusBadge status="pending" customText="Action needed" size="small" />
                                        ) : (
                                            <StatusBadge status="completed" customText="All set" size="small" />
                                        )
                                    }
                                />
                            )
                        })}
                    </div>

                    {/* argentina (manteca AR) — separate enrollment */}
                    <div>
                        <h2 className="mb-2 font-bold">Argentina</h2>
                        {argPayments.map((p, i) => (
                            <ActionListCard
                                key={p.name}
                                position={getCardPosition(i, argPayments.length)}
                                title={p.name}
                                description={p.desc}
                                descriptionClassName="text-xs"
                                onClick={noop}
                                rightContent={<StatusBadge status="completed" customText="All set" size="small" />}
                            />
                        ))}
                    </div>

                    {/* brazil (manteca BR) — separate enrollment */}
                    <div>
                        <h2 className="mb-2 font-bold">Brazil</h2>
                        {brPayments.map((p, i) => (
                            <ActionListCard
                                key={p.name}
                                position={getCardPosition(i, brPayments.length)}
                                title={p.name}
                                description={p.desc}
                                descriptionClassName="text-xs"
                                onClick={noop}
                                rightContent={<StatusBadge status="completed" customText="All set" size="small" />}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* new user: preview what they can unlock */}
            {userState === 'new' && (
                <div>
                    <h2 className="mb-2 font-bold text-grey-1">Available after setup</h2>
                    {[
                        { name: 'Europe', desc: 'SEPA and UK bank transfers to 30+ countries' },
                        { name: 'US & Mexico', desc: 'ACH, wire transfers, Mexico SPEI' },
                        { name: 'Argentina', desc: 'MercadoPago QR + bank transfers' },
                        { name: 'Brazil', desc: 'PIX QR + bank transfers' },
                    ].map((r, i, arr) => (
                        <ActionListCard
                            key={r.name}
                            position={getCardPosition(i, arr.length)}
                            leftIcon={<Icon name="lock" size={18} className="text-grey-1" />}
                            title={r.name}
                            description={r.desc}
                            descriptionClassName="text-xs"
                            onClick={() => {}}
                            isDisabled
                            rightContent={<StatusBadge status="custom" customText="Locked" size="small" />}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── page ───────────────────────────────────────────────────────

export default function KycUiAuditPage() {
    const [openModal, setOpenModal] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'proposed' | 'states' | 'modals' | 'audit'>('proposed')
    const noop = () => {}

    return (
        <div className="flex w-full flex-col space-y-6 px-4 pb-12 pt-4">
            <NavHeader title="KYC UI Audit" href="/dev" titleClassName="text-xl" />

            {/* tab nav */}
            <div className="flex gap-2 overflow-x-auto">
                {(['proposed', 'states', 'modals', 'audit'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm font-bold ${
                            activeTab === tab ? 'border-n-1 bg-black text-white' : 'border-n-1 text-grey-1'
                        }`}
                    >
                        {tab === 'proposed'
                            ? 'Proposed'
                            : tab === 'states'
                              ? 'Current States'
                              : tab === 'modals'
                                ? 'Modals'
                                : 'Copy Audit'}
                    </button>
                ))}
            </div>

            {/* ─── TAB: proposed page ─────────────────────────── */}
            {activeTab === 'proposed' && (
                <div className="flex flex-col space-y-8">
                    <InfoCard
                        variant="info"
                        title="What this page should answer"
                        items={[
                            'Where can I send money right now?',
                            'Is there anything I need to do to keep sending?',
                            'What else can I unlock?',
                        ]}
                    />

                    <div>
                        <h2 className="mb-2 font-bold">Brand new user</h2>
                        <p className="mb-3 text-xs text-grey-1">hasn&apos;t confirmed ID yet</p>
                        <ProposedRegionsPage userState="new" />
                    </div>

                    <div>
                        <h2 className="mb-2 font-bold">One payment method needs a document</h2>
                        <p className="mb-3 text-xs text-grey-1">everything works except US bank transfers — needs proof of address</p>
                        <ProposedRegionsPage userState="verified-rfi" />
                    </div>

                    <div>
                        <h2 className="mb-2 font-bold">European user with deadline</h2>
                        <p className="mb-3 text-xs text-grey-1">SEPA needs a small update by June 29 to stay active</p>
                        <ProposedRegionsPage userState="eea" />
                    </div>

                    <div>
                        <h2 className="mb-2 font-bold">Everything working</h2>
                        <p className="mb-3 text-xs text-grey-1">all set up, no actions needed</p>
                        <ProposedRegionsPage userState="happy" />
                    </div>
                </div>
            )}

            {/* ─── TAB: current drawer states ─────────────────── */}
            {activeTab === 'states' && (
                <div className="flex flex-col space-y-6">
                    <StateCard label="Completed" scenario="all set up, user can send everywhere">
                        <KycCompleted
                            bridgeKycApprovedAt="2026-05-15T10:30:00Z"
                            countryCode="US"
                            isBridge={true}
                            region="STANDARD"
                        />
                    </StateCard>

                    <StateCard label="Processing" scenario="documents submitted, reviewing">
                        <KycProcessing
                            bridgeKycStartedAt="2026-05-21T14:00:00Z"
                            countryCode="AR"
                            isBridge={true}
                        />
                    </StateCard>

                    <StateCard
                        label="Action Required (Sumsub)"
                        scenario="needs clearer photo"
                        problem="CTA says 'Re-submit verification' — should say 'Re-submit documents'"
                    >
                        <KycActionRequired
                            onResume={noop}
                            rejectLabels={['DOCUMENT_BAD_QUALITY', 'SELFIE_MISMATCH']}
                        />
                    </StateCard>

                    <StateCard
                        label="Bridge RFI"
                        scenario="needs source of funds, proof of address"
                        problem="Says 'verification documents' — should just say 'documents'"
                    >
                        <KycRequiresDocuments
                            requirements={['proof_of_source_of_funds', 'proof_of_address']}
                            onSubmitDocuments={noop}
                        />
                    </StateCard>

                    <StateCard
                        label="Provider fixable"
                        scenario="can resubmit a document"
                        problem="Says 'Verification action needed' — user is already verified"
                    >
                        <KycProviderRejection rejection={MOCK_FIXABLE_REJECTION} onStartResubmission={noop} />
                    </StateCard>

                    <StateCard
                        label="Provider blocked"
                        scenario="max attempts reached"
                        problem="Says 'Verification unavailable' — should say payments are paused"
                    >
                        <KycProviderRejection rejection={MOCK_BLOCKED_REJECTION} />
                    </StateCard>

                    <StateCard label="Accept ToS" scenario="needs to accept terms">
                        <KycProviderRejection rejection={MOCK_TOS_REJECTION} onStartResubmission={noop} />
                    </StateCard>

                    <StateCard label="Customer fields (EEA)" scenario="needs DOB + country of birth">
                        <KycProviderRejection rejection={MOCK_FIELDS_REJECTION} onStartResubmission={noop} />
                    </StateCard>

                    <StateCard label="Rejected (retryable)" scenario="bad document, can try again">
                        <KycFailed
                            rejectLabels={['DOCUMENT_BAD_QUALITY']}
                            isSumsub={true}
                            rejectType="RETRY"
                            failureCount={1}
                            bridgeKycRejectedAt="2026-05-20T09:00:00Z"
                            onRetry={noop}
                        />
                    </StateCard>

                    <StateCard label="Rejected (terminal)" scenario="permanent rejection">
                        <KycFailed
                            rejectLabels={['FRAUDULENT_PATTERNS']}
                            isSumsub={true}
                            rejectType="FINAL"
                            failureCount={3}
                            bridgeKycRejectedAt="2026-05-19T12:00:00Z"
                            onRetry={noop}
                        />
                    </StateCard>

                    <StateCard label="Not Started" scenario="abandoned before submitting">
                        <KycNotStarted onResume={noop} />
                    </StateCard>
                </div>
            )}

            {/* ─── TAB: modals ────────────────────────────────── */}
            {activeTab === 'modals' && (
                <div className="flex flex-col space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold">InitiateKycModal</h2>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'default', label: 'Fresh KYC' },
                                { key: 'provider_rejection', label: 'Needs docs' },
                                { key: 'blocked', label: 'Blocked' },
                                { key: 'cross_region', label: 'Cross region' },
                                { key: 'error', label: 'Error' },
                            ].map(({ key, label }) => (
                                <Button
                                    key={key}
                                    variant="stroke"
                                    size="small"
                                    onClick={() => setOpenModal(`initiate_${key}`)}
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <InfoCard
                        variant="warning"
                        title="What to look for"
                        items={[
                            "Fresh KYC: fine — first time, 'verify your identity' makes sense",
                            "Needs docs: fine — 'we need extra documents' is clear",
                            "Blocked: problem — tells user 'we couldn't verify your identity' when they ARE verified",
                            "Cross region: good — acknowledges ID is confirmed, explains what else is needed",
                        ]}
                    />

                    <div>
                        <h2 className="mb-2 font-bold">Guest modal</h2>
                        <Button variant="stroke" size="small" onClick={() => setOpenModal('guest')}>
                            Open
                        </Button>
                    </div>

                    {/* render modals */}
                    <InitiateKycModal visible={openModal === 'initiate_default'} onClose={() => setOpenModal(null)} onVerify={noop} variant="default" />
                    <InitiateKycModal visible={openModal === 'initiate_provider_rejection'} onClose={() => setOpenModal(null)} onVerify={noop} variant="provider_rejection" providerMessage="Please upload a clearer photo of your ID to continue." />
                    <InitiateKycModal visible={openModal === 'initiate_blocked'} onClose={() => setOpenModal(null)} onVerify={noop} variant="blocked" />
                    <InitiateKycModal visible={openModal === 'initiate_cross_region'} onClose={() => setOpenModal(null)} onVerify={noop} variant="cross_region" regionName="Brazil" />
                    <InitiateKycModal visible={openModal === 'initiate_error'} onClose={() => setOpenModal(null)} onVerify={noop} error="Bridge API returned an unexpected error." />
                    <GuestVerificationModal isOpen={openModal === 'guest'} onClose={() => setOpenModal(null)} description="You need to verify your identity to use bank transfers." secondaryCtaLabel="Continue as guest" />
                </div>
            )}

            {/* ─── TAB: copy audit ────────────────────────────── */}
            {activeTab === 'audit' && (
                <div className="flex flex-col space-y-6">
                    <div>
                        <h2 className="mb-2 font-bold">Copy issues</h2>
                        <p className="mb-3 text-sm text-grey-1">
                            The app tells users they&apos;re verified, then asks them to &quot;complete verification&quot; for a specific payment method.
                        </p>

                        <CopyAuditRow file="ActivationCTAs.tsx:103" current="Complete verification" proposed="One more step to start sending" severity="HIGH" />
                        <CopyAuditRow file="ActivationCTAs.tsx:105" current="We need a few more details to continue verification." proposed="We need one more document to set up your payments." severity="HIGH" />
                        <CopyAuditRow file="KycProviderRejection.tsx:44" current="Verification action needed / Verification unavailable" proposed="One more step / Payments paused — we're here to help" severity="HIGH" />
                        <CopyAuditRow file="InitiateKycModal.tsx:58" current="We couldn't verify your identity." proposed="We couldn't set up payments for this region. Our support team can help." severity="HIGH" />
                        <CopyAuditRow file="KycStatusItem.tsx:98" current="Verification issue" proposed="Payments paused" severity="HIGH" />
                        <CopyAuditRow file="KycRequiresDocuments.tsx:22" current="Our payment provider requires additional verification documents." proposed="We need one more document before you can send money." severity="MED" />
                        <CopyAuditRow file="KycActionRequired.tsx:30" current="Re-submit verification" proposed="Re-submit documents" severity="MED" />
                        <CopyAuditRow file="InitiateKycModal.tsx:43" current="Verification in progress" proposed="Setting up your payments" severity="MED" />
                        <CopyAuditRow file="InitiateKycModal.tsx:55" current="We're reviewing your verification." proposed="We're setting up your payments. This usually takes a few minutes." severity="MED" />
                        <CopyAuditRow file="KycVerifiedOrReviewModal.tsx:18" current="Your verification is under review" proposed="We're finishing your payment setup" severity="MED" />
                        <CopyAuditRow file="RegionsVerification.view.tsx:153" current="Complete verification to unlock countries" proposed="Confirm your ID to start sending money" severity="LOW" />
                        <CopyAuditRow file="FiatLimitsLockedCard.tsx:27" current="Complete identity verification to unlock fiat payments" proposed="Confirm your ID to send and receive money" severity="LOW" />
                    </div>

                    <div>
                        <h2 className="mb-2 font-bold">Principles</h2>
                        <InfoCard
                            variant="success"
                            items={[
                                "Users confirmed their ID. never walk that back or make them feel unverified again",
                                "When we need something extra, say what — 'we need a document', not 'complete verification'",
                                "Frame everything around what the user wants to do — send money, pay at stores",
                                "If one payment method is blocked, say which one. don't block everything",
                                "When things go wrong, offer a path forward — support link, retry, or timeline",
                                "Keep internal concepts (rails, providers, endorsements) out of user-facing copy",
                            ]}
                        />
                    </div>

                    <div>
                        <h2 className="mb-2 font-bold">Good example from today&apos;s code</h2>
                        <Card position="single" className="border-green-600">
                            <p className="text-center text-sm font-bold">
                                &quot;Your identity is already verified. To send money in this region, we need a valid ID from there.&quot;
                            </p>
                            <p className="mt-2 text-center text-xs text-grey-1">
                                cross_region variant — acknowledges the user, explains what&apos;s needed, ties it to their goal
                            </p>
                        </Card>
                        <Button
                            variant="stroke"
                            size="small"
                            className="mt-2"
                            onClick={() => {
                                setActiveTab('modals')
                                setTimeout(() => setOpenModal('initiate_cross_region'), 100)
                            }}
                        >
                            View this modal live
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
