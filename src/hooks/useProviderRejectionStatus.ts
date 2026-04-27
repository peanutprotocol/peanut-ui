'use client'

import { useAuth } from '@/context/authContext'
import { useMemo } from 'react'
import type { IUserRail, IUserKycVerification } from '@/interfaces/interfaces'

export type ProviderRejectionState = 'happy' | 'processing' | 'fixable' | 'blocked'

export interface ProviderRejectionInfo {
    provider: 'BRIDGE' | 'MANTECA'
    state: ProviderRejectionState
    userMessage: string | null
    rejectedRails: IUserRail[]
    kycVerification: IUserKycVerification | null
    selfHealAttempt: number
    maxAttempts: number
}

const MAX_SELF_HEAL_ATTEMPTS = 3

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
            const rejectedRails = providerRails.filter((r) => r.status === 'REJECTED')
            const pendingRails = providerRails.filter((r) => r.status === 'PENDING')
            const enabledRails = providerRails.filter((r) => r.status === 'ENABLED')

            // find the most recent kyc verification for this provider
            const kycVerification =
                kycVerifications
                    .filter((v) => v.provider === providerCode)
                    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0] ??
                null

            const metadata = (kycVerification?.metadata ?? {}) as Record<string, unknown>
            const selfHealAttempt = (metadata.selfHealAttempt as number) || 0

            // no rails for this provider — not submitted
            if (providerRails.length === 0) {
                return {
                    provider: providerCode,
                    state: 'happy',
                    userMessage: null,
                    rejectedRails: [],
                    kycVerification,
                    selfHealAttempt,
                    maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
                }
            }

            // all enabled — happy
            if (enabledRails.length > 0 && rejectedRails.length === 0) {
                return {
                    provider: providerCode,
                    state: 'happy',
                    userMessage: null,
                    rejectedRails: [],
                    kycVerification,
                    selfHealAttempt,
                    maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
                }
            }

            // has rejected rails
            if (rejectedRails.length > 0) {
                const firstRejectedMetadata = (rejectedRails[0].metadata ?? {}) as Record<string, unknown>
                const isSelfHealable = firstRejectedMetadata.selfHealable === true
                const rejectType = kycVerification?.rejectType

                // check if fixable: selfHealable flag on rail + rejectType + attempt limit
                const isFixable =
                    isSelfHealable && rejectType !== 'PROVIDER_FINAL' && selfHealAttempt < MAX_SELF_HEAL_ATTEMPTS

                // extract user-facing message from rejection reasons or endorsement issues
                let userMessage: string | null = null
                const reasons = firstRejectedMetadata.rejectionReasons
                const endorsementIssues = firstRejectedMetadata.endorsementIssues
                if (Array.isArray(reasons) && reasons.length > 0) {
                    // bridge format: { reason: string, developer_reason: string }
                    // manteca format: { task: string, reason: string }
                    const first = reasons[0]
                    userMessage = first?.reason || first?.developer_reason || null
                } else if (Array.isArray(endorsementIssues) && endorsementIssues.length > 0) {
                    // bridge endorsement issues: plain strings like 'government_id_verification_failed'
                                        userMessage = `ID verification failed. Please upload a clearer photo.`
                }

                return {
                    provider: providerCode,
                    state: isFixable ? 'fixable' : 'blocked',
                    userMessage,
                    rejectedRails,
                    kycVerification,
                    selfHealAttempt,
                    maxAttempts: MAX_SELF_HEAL_ATTEMPTS,
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
            }
        }
    }, [rails, kycVerifications])

    const bridge = useMemo(() => getProviderState('BRIDGE'), [getProviderState])
    const manteca = useMemo(() => getProviderState('MANTECA'), [getProviderState])

    // overall: has any fixable rejection across providers
    const hasFixableRejection = bridge.state === 'fixable' || manteca.state === 'fixable'
    const hasBlockedRejection = bridge.state === 'blocked' || manteca.state === 'blocked'
    const hasAnyRejection = hasFixableRejection || hasBlockedRejection

    // the provider that needs attention first (fixable takes priority)
    const primaryRejection = bridge.state === 'fixable' ? bridge : manteca.state === 'fixable' ? manteca : bridge.state === 'blocked' ? bridge : manteca.state === 'blocked' ? manteca : null

    return {
        bridge,
        manteca,
        hasFixableRejection,
        hasBlockedRejection,
        hasAnyRejection,
        primaryRejection,
    }
}
