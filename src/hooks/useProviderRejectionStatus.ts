'use client'

import { useAuth } from '@/context/authContext'
import { useMemo } from 'react'
import type { IUserRail, IUserKycVerification } from '@/interfaces/interfaces'

export type ProviderRejectionState = 'happy' | 'processing' | 'fixable' | 'blocked'
export type ProviderRemediationPayloadType =
    | 'BRIDGE_TOS'
    | 'BRIDGE_IDENTIFYING_INFORMATION'
    | 'BRIDGE_DOCUMENT'
    | 'BRIDGE_CUSTOMER_FIELDS'
type ProviderRemediationStatus = 'APPROVED' | 'AWAITING_INPUT' | 'AWAITING_PROVIDER' | 'TERMINAL'

interface ProviderRemediationAction {
    payloadType: ProviderRemediationPayloadType
    requirementKey?: string
    maxAttempts?: number
}

interface ProviderRemediationClassification {
    status: ProviderRemediationStatus
    nextAction?: ProviderRemediationAction
    reason?: string
    terminalKeys?: string[]
}

export interface ProviderRejectionInfo {
    provider: 'BRIDGE' | 'MANTECA'
    state: ProviderRejectionState
    userMessage: string | null
    rejectedRails: IUserRail[]
    kycVerification: IUserKycVerification | null
    selfHealAttempt: number
    maxAttempts: number
    requiredAction: ProviderRemediationPayloadType | null
    actionLabel: string | null
}

const MAX_SELF_HEAL_ATTEMPTS = 3

const DEFAULT_ACTION_LABEL = 'Upload document'

function emptyProviderInfo(
    provider: 'BRIDGE' | 'MANTECA',
    kycVerification: IUserKycVerification | null,
    selfHealAttempt: number,
    maxAttempts = MAX_SELF_HEAL_ATTEMPTS
): ProviderRejectionInfo {
    return {
        provider,
        state: 'happy',
        userMessage: null,
        rejectedRails: [],
        kycVerification,
        selfHealAttempt,
        maxAttempts,
        requiredAction: null,
        actionLabel: null,
    }
}

function getActionLabel(payloadType?: ProviderRemediationPayloadType) {
    switch (payloadType) {
        case 'BRIDGE_TOS':
            return 'Accept terms'
        case 'BRIDGE_IDENTIFYING_INFORMATION':
            return 'Upload ID'
        case 'BRIDGE_CUSTOMER_FIELDS':
            return 'Provide details'
        case 'BRIDGE_DOCUMENT':
            return 'Upload document'
        default:
            return DEFAULT_ACTION_LABEL
    }
}

function getBridgeActionMessage(action?: ProviderRemediationAction) {
    switch (action?.payloadType) {
        case 'BRIDGE_TOS':
            return 'Please accept the terms to enable payments.'
        case 'BRIDGE_IDENTIFYING_INFORMATION':
            return 'We need a new identity document to enable payments.'
        case 'BRIDGE_CUSTOMER_FIELDS':
            return 'We need a few more details to enable payments.'
        case 'BRIDGE_DOCUMENT':
            return 'We need an additional document to enable payments.'
        default:
            return 'We need more information to enable payments.'
    }
}

const BRIDGE_TERMINAL_MESSAGES: Record<string, string> = {
    endorsement_not_available_in_customers_region:
        "We can't enable payments for your region right now. Contact support if you need help.",
    unsupported_country: 'Payments are not available in your country right now. Contact support if you need help.',
    prohibited_country: "We can't enable payments for your country. Contact support if you need help.",
    prohibited_state_province: "We can't enable payments for your state or province. Contact support if you need help.",
    person_is_deceased: "We couldn't enable payments with the information provided. Contact support if you need help.",
    potential_pep: 'Your payment setup needs additional compliance review. Contact support if you need help.',
    compromised_id_detected:
        "We couldn't accept the identity document you submitted. Contact support if you need help.",
    likely_fabrication_detected:
        "We couldn't accept the identity document you submitted. Contact support if you need help.",
    tampering_detected: "We couldn't accept the identity document you submitted. Contact support if you need help.",
}

function getBridgeBlockedMessage(remediation?: ProviderRemediationClassification | null) {
    const terminalKeys = remediation?.terminalKeys ?? []
    const terminalMessage = terminalKeys.map((key) => BRIDGE_TERMINAL_MESSAGES[key]).find(Boolean)
    if (terminalMessage) return terminalMessage

    return "We couldn't enable payments for your account. Please contact support for assistance."
}

function getBridgeRemediation(
    providerRails: IUserRail[],
    kycVerification: IUserKycVerification | null
): ProviderRemediationClassification | null {
    const railMetadata = providerRails
        .map((rail) => rail.metadata?.bridgeRemediation)
        .find((value) => value && typeof value === 'object')
    const verificationMetadata = kycVerification?.metadata?.bridgeRemediation
    const remediation = railMetadata ?? verificationMetadata

    if (!remediation || typeof remediation !== 'object') return null

    const candidate = remediation as Partial<ProviderRemediationClassification>
    if (
        candidate.status !== 'APPROVED' &&
        candidate.status !== 'AWAITING_INPUT' &&
        candidate.status !== 'AWAITING_PROVIDER' &&
        candidate.status !== 'TERMINAL'
    ) {
        return null
    }

    return candidate as ProviderRemediationClassification
}

export function deriveProviderRejectionInfo(
    providerCode: 'BRIDGE' | 'MANTECA',
    providerRails: IUserRail[],
    kycVerifications: IUserKycVerification[]
): ProviderRejectionInfo {
    const rejectedRails = providerRails.filter((r) => r.status === 'REJECTED')
    const pendingRails = providerRails.filter((r) => r.status === 'PENDING')
    const enabledRails = providerRails.filter((r) => r.status === 'ENABLED')

    // find the most recent kyc verification for this provider
    const kycVerification =
        kycVerifications
            .filter((v) => v.provider === providerCode)
            .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0] ?? null

    const metadata = (kycVerification?.metadata ?? {}) as Record<string, unknown>
    const selfHealAttempt = (metadata.selfHealAttempt as number) || 0

    // no rails for this provider — not submitted
    if (providerRails.length === 0) {
        return emptyProviderInfo(providerCode, kycVerification, selfHealAttempt)
    }

    const bridgeRemediation = providerCode === 'BRIDGE' ? getBridgeRemediation(providerRails, kycVerification) : null
    const bridgeAction = bridgeRemediation?.nextAction
    const maxAttempts = bridgeAction?.maxAttempts ?? MAX_SELF_HEAL_ATTEMPTS
    const bridgeAttentionRails =
        providerCode === 'BRIDGE'
            ? providerRails.filter((rail) => rail.status === 'REJECTED' || rail.status === 'REQUIRES_EXTRA_INFORMATION')
            : rejectedRails

    if (bridgeRemediation?.status === 'TERMINAL') {
        return {
            provider: providerCode,
            state: 'blocked',
            userMessage: getBridgeBlockedMessage(bridgeRemediation),
            rejectedRails: bridgeAttentionRails,
            kycVerification,
            selfHealAttempt,
            maxAttempts,
            requiredAction: bridgeAction?.payloadType ?? null,
            actionLabel: null,
        }
    }

    if (bridgeRemediation?.status === 'AWAITING_PROVIDER') {
        return {
            provider: providerCode,
            state: 'processing',
            userMessage: "We're reviewing your documents. We'll update your payment setup when the review is complete.",
            rejectedRails: bridgeAttentionRails,
            kycVerification,
            selfHealAttempt,
            maxAttempts,
            requiredAction: null,
            actionLabel: null,
        }
    }

    if (bridgeRemediation?.status === 'AWAITING_INPUT' && selfHealAttempt < maxAttempts) {
        return {
            provider: providerCode,
            state: 'fixable',
            userMessage: getBridgeActionMessage(bridgeAction),
            rejectedRails: bridgeAttentionRails,
            kycVerification,
            selfHealAttempt,
            maxAttempts,
            requiredAction: bridgeAction?.payloadType ?? null,
            actionLabel: getActionLabel(bridgeAction?.payloadType),
        }
    }

    if (bridgeRemediation?.status === 'AWAITING_INPUT') {
        return {
            provider: providerCode,
            state: 'blocked',
            userMessage: 'Verification retry limit reached. Please contact support for assistance.',
            rejectedRails: bridgeAttentionRails,
            kycVerification,
            selfHealAttempt,
            maxAttempts,
            requiredAction: bridgeAction?.payloadType ?? null,
            actionLabel: null,
        }
    }

    // all enabled — happy
    if (enabledRails.length > 0 && rejectedRails.length === 0) {
        return emptyProviderInfo(providerCode, kycVerification, selfHealAttempt)
    }

    // has rejected rails
    if (rejectedRails.length > 0) {
        const firstRejectedMetadata = (rejectedRails[0].metadata ?? {}) as Record<string, unknown>
        const isSelfHealable = firstRejectedMetadata.selfHealable === true
        const rejectType = kycVerification?.rejectType

        // check if fixable: selfHealable flag on rail + rejectType + attempt limit
        const isFixable =
            isSelfHealable &&
            rejectType !== 'PROVIDER_FINAL' &&
            rejectType !== 'FINAL' &&
            selfHealAttempt < MAX_SELF_HEAL_ATTEMPTS

        // extract user-facing message from rejection reasons or endorsement issues
        let userMessage: string | null = null
        const reasons = firstRejectedMetadata.rejectionReasons
        const endorsementIssues = firstRejectedMetadata.endorsementIssues

        if (!isFixable) {
            // permanently rejected — generic message regardless of underlying reason
            userMessage =
                providerCode === 'BRIDGE'
                    ? "We couldn't enable payments for your account. Please contact support for assistance."
                    : "We couldn't verify your identity. Please contact support for assistance."
        } else if (Array.isArray(reasons) && reasons.length > 0) {
            // bridge format: { reason: string, developer_reason: string }
            // manteca format: { task: string, reason: string }
            const first = reasons[0]
            userMessage = first?.reason || first?.developer_reason || null
        } else if (Array.isArray(endorsementIssues) && endorsementIssues.length > 0) {
            userMessage = 'ID verification failed. Please upload a clearer photo.'
        }

        return {
            provider: providerCode,
            state: isFixable ? 'fixable' : 'blocked',
            userMessage,
            rejectedRails,
            kycVerification,
            selfHealAttempt,
            maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
            requiredAction: null,
            actionLabel: isFixable ? DEFAULT_ACTION_LABEL : null,
        }
    }

    // has pending rails (submitted but not yet reviewed)
    if (pendingRails.length > 0) {
        return {
            provider: providerCode,
            state: 'processing',
            userMessage: null,
            rejectedRails: [],
            kycVerification,
            selfHealAttempt,
            maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
            requiredAction: null,
            actionLabel: null,
        }
    }

    // default: processing (REQUIRES_INFORMATION, REQUIRES_EXTRA_INFORMATION, etc.)
    return {
        provider: providerCode,
        state: 'processing',
        userMessage: null,
        rejectedRails: [],
        kycVerification,
        selfHealAttempt,
        maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
        requiredAction: null,
        actionLabel: null,
    }
}

/**
 * derives per-provider fixable/blocked/processing state from rails + kycVerifications.
 * shared by ActivationCTAs and KycStatusItem (DRY — hugo's comment #11).
 */
export default function useProviderRejectionStatus() {
    const { user } = useAuth()

    const rails = user?.rails ?? []
    const kycVerifications = user?.user?.kycVerifications ?? []

    const getProviderState = useMemo(() => {
        return (providerCode: 'BRIDGE' | 'MANTECA'): ProviderRejectionInfo => {
            const providerRails = rails.filter((r) => r.rail.provider.code === providerCode)
            return deriveProviderRejectionInfo(providerCode, providerRails, kycVerifications)
        }
    }, [rails, kycVerifications])

    const bridge = useMemo(() => getProviderState('BRIDGE'), [getProviderState])
    const manteca = useMemo(() => getProviderState('MANTECA'), [getProviderState])

    // overall: has any fixable rejection across providers
    const hasFixableRejection = bridge.state === 'fixable' || manteca.state === 'fixable'
    const hasBlockedRejection = bridge.state === 'blocked' || manteca.state === 'blocked'
    const hasAnyRejection = hasFixableRejection || hasBlockedRejection

    // the provider that needs attention first (fixable takes priority)
    const primaryRejection =
        bridge.state === 'fixable'
            ? bridge
            : manteca.state === 'fixable'
              ? manteca
              : bridge.state === 'blocked'
                ? bridge
                : manteca.state === 'blocked'
                  ? manteca
                  : null

    return {
        bridge,
        manteca,
        hasFixableRejection,
        hasBlockedRejection,
        hasAnyRejection,
        primaryRejection,
    }
}
