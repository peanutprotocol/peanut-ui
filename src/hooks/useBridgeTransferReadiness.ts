'use client'

import { useMemo } from 'react'
import { useBridgeTosStatus } from './useBridgeTosStatus'
import useProviderRejectionStatus from './useProviderRejectionStatus'
import useKycStatus from './useKycStatus'

export type BridgeGateAction =
    | { type: 'accept_tos' }
    | { type: 'fixable_rejection'; userMessage: string | null }
    | { type: 'blocked_rejection'; userMessage: string | null }
    | { type: 'needs_kyc' }
    | { type: 'needs_enrollment' }
    | { type: 'ready' }

/**
 * unified pre-transfer gate for bridge bank flows.
 * determines what needs to happen before a transfer can proceed,
 * in the correct priority order:
 *   1. hard rejection (contact support — tos is moot)
 *   2. tos acceptance
 *   3. fixable rejection (user can submit additional details)
 *   4. needs standard kyc (fresh user)
 *   5. needs enrollment (sumsub approved, bridge not started)
 *   6. ready
 */
export function useBridgeTransferReadiness() {
    const { needsBridgeTos } = useBridgeTosStatus()
    const { bridge: bridgeRejection } = useProviderRejectionStatus()
    const { isUserSumsubKycApproved, isUserBridgeKycApproved, isUserBridgeKycUnderReview, isUserBridgeKycIncomplete } =
        useKycStatus()

    const gate: BridgeGateAction = useMemo(() => {
        // 1. hard rejection — contact support (checked first because tos is moot for hard-rejected users)
        if (bridgeRejection.state === 'blocked') {
            return { type: 'blocked_rejection', userMessage: bridgeRejection.userMessage }
        }

        // 2. tos acceptance — only if user can actually proceed after accepting
        if (needsBridgeTos) return { type: 'accept_tos' }

        // 3. fixable rejection — user can submit additional details
        if (bridgeRejection.state === 'fixable') {
            return { type: 'fixable_rejection', userMessage: bridgeRejection.userMessage }
        }

        // 4. fresh user needs standard kyc before creating a transfer.
        // an approved bridge rail still passes for legacy/out-of-band approvals.
        if (!isUserSumsubKycApproved && !isUserBridgeKycApproved) {
            return { type: 'needs_kyc' }
        }

        // 5. needs enrollment (sumsub approved but bridge not started/approved/in-progress)
        if (
            isUserSumsubKycApproved &&
            !isUserBridgeKycApproved &&
            !isUserBridgeKycUnderReview &&
            !isUserBridgeKycIncomplete
        ) {
            return { type: 'needs_enrollment' }
        }

        // 6. ready
        return { type: 'ready' }
    }, [
        needsBridgeTos,
        bridgeRejection,
        isUserSumsubKycApproved,
        isUserBridgeKycApproved,
        isUserBridgeKycUnderReview,
        isUserBridgeKycIncomplete,
    ])

    return { gate }
}

/** maps gate type to InitiateKycModal variant */
export function getKycModalVariant(gateType: BridgeGateAction['type']) {
    if (gateType === 'blocked_rejection') return 'blocked' as const
    if (gateType === 'fixable_rejection') return 'provider_rejection' as const
    if (gateType === 'needs_kyc') return 'default' as const
    if (gateType === 'needs_enrollment') return 'cross_region' as const
    return 'default' as const
}

/** extracts provider message from gate for InitiateKycModal */
export function getGateProviderMessage(gate: BridgeGateAction): string | undefined {
    if (gate.type === 'fixable_rejection' || gate.type === 'blocked_rejection') {
        return gate.userMessage ?? undefined
    }
    return undefined
}
