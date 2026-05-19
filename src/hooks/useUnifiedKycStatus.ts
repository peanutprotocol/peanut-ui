'use client'

import { useAuth } from '@/context/authContext'
import { useMemo } from 'react'
import { type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { isKycStatusApproved, isSumsubStatusInProgress } from '@/constants/kyc.consts'

/**
 * single source of truth for kyc status across all providers (bridge, manteca, sumsub).
 * all kyc status checks should go through this hook.
 */
export default function useUnifiedKycStatus() {
    const { user } = useAuth()

    const isBridgeApproved = useMemo(() => user?.user.bridgeKycStatus === 'approved', [user])

    const isMantecaApproved = useMemo(
        () =>
            user?.user.kycVerifications?.some(
                (v) =>
                    (v.provider === 'MANTECA' || (v.provider === 'SUMSUB' && !!v.mantecaGeo)) &&
                    isKycStatusApproved(v.status)
            ) ?? false,
        [user]
    )

    // pick the most recently updated sumsub verification in case of retries
    const sumsubVerification = useMemo(
        () =>
            user?.user.kycVerifications
                ?.filter((v) => v.provider === 'SUMSUB')
                .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0] ?? null,
        [user]
    )

    const isSumsubApproved = useMemo(() => isKycStatusApproved(sumsubVerification?.status), [sumsubVerification])

    const sumsubStatus = useMemo(() => (sumsubVerification?.status as SumsubKycStatus) ?? null, [sumsubVerification])

    const sumsubRejectLabels = useMemo(() => sumsubVerification?.rejectLabels ?? null, [sumsubVerification])

    const sumsubRejectType = useMemo(
        () => (sumsubVerification?.rejectType as 'RETRY' | 'FINAL' | null) ?? null,
        [sumsubVerification]
    )

    // region intent used during the sumsub verification (stored in metadata by initiate-kyc)
    const sumsubVerificationRegionIntent = useMemo(
        () => (sumsubVerification?.metadata?.regionIntent as string) ?? null,
        [sumsubVerification]
    )

    const isKycApproved = useMemo(
        () => isBridgeApproved || isMantecaApproved || isSumsubApproved,
        [isBridgeApproved, isMantecaApproved, isSumsubApproved]
    )

    // bridge is actively reviewing submitted docs
    const isBridgeUnderReview = useMemo(() => user?.user.bridgeKycStatus === 'under_review', [user])

    // user still needs to complete requirements (tos, proof of address, etc.)
    const isBridgeIncomplete = useMemo(() => user?.user.bridgeKycStatus === 'incomplete', [user])

    const isSumsubActionRequired = useMemo(() => sumsubStatus === 'ACTION_REQUIRED', [sumsubStatus])

    const isSumsubInProgress = useMemo(() => isSumsubStatusInProgress(sumsubStatus), [sumsubStatus])

    const isKycInProgress = useMemo(
        () => isBridgeUnderReview || isBridgeIncomplete || isSumsubInProgress,
        [isBridgeUnderReview, isBridgeIncomplete, isSumsubInProgress]
    )

    return {
        // combined
        isKycApproved,
        isKycInProgress,
        // bridge
        isBridgeApproved,
        isBridgeUnderReview,
        isBridgeIncomplete,
        // manteca
        isMantecaApproved,
        // sumsub
        isSumsubApproved,
        isSumsubActionRequired,
        sumsubStatus,
        sumsubRejectLabels,
        sumsubRejectType,
        sumsubVerificationRegionIntent,
    }
}
