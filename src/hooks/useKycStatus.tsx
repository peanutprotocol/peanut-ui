'use client'

import useUnifiedKycStatus from './useUnifiedKycStatus'

/**
 * thin wrapper around useUnifiedKycStatus for backward compatibility.
 * existing consumers keep the same api shape.
 */
export default function useKycStatus() {
    const { isBridgeApproved, isMantecaApproved, isSumsubApproved, isKycApproved, isBridgeUnderReview } =
        useUnifiedKycStatus()

    return {
        isUserBridgeKycApproved: isBridgeApproved,
        isUserMantecaKycApproved: isMantecaApproved,
        isUserSumsubKycApproved: isSumsubApproved,
        isUserKycApproved: isKycApproved,
        isUserBridgeKycUnderReview: isBridgeUnderReview,
    }
}
