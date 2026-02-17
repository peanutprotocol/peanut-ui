'use client'

import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { useMemo } from 'react'
import { type SumsubKycStatus } from '@/app/actions/types/sumsub.types'
import { isSumsubStatusInProgress } from '@/constants/kyc.consts'

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
                (v) => v.provider === 'MANTECA' && v.status === MantecaKycStatus.ACTIVE
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

    const isSumsubApproved = useMemo(() => sumsubVerification?.status === 'APPROVED', [sumsubVerification])

    const sumsubStatus = useMemo(() => (sumsubVerification?.status as SumsubKycStatus) ?? null, [sumsubVerification])

    const sumsubRejectLabels = useMemo(() => sumsubVerification?.rejectLabels ?? null, [sumsubVerification])

    const isKycApproved = useMemo(
        () => isBridgeApproved || isMantecaApproved || isSumsubApproved,
        [isBridgeApproved, isMantecaApproved, isSumsubApproved]
    )

    const isBridgeUnderReview = useMemo(
        () => user?.user.bridgeKycStatus === 'under_review' || user?.user.bridgeKycStatus === 'incomplete',
        [user]
    )

    const isSumsubInProgress = useMemo(() => isSumsubStatusInProgress(sumsubStatus), [sumsubStatus])

    const isKycInProgress = useMemo(
        () => isBridgeUnderReview || isSumsubInProgress,
        [isBridgeUnderReview, isSumsubInProgress]
    )

    return {
        // combined
        isKycApproved,
        isKycInProgress,
        // bridge
        isBridgeApproved,
        isBridgeUnderReview,
        // manteca
        isMantecaApproved,
        // sumsub
        isSumsubApproved,
        sumsubStatus,
        sumsubRejectLabels,
    }
}
