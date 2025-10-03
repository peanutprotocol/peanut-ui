'use client'

import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { useMemo } from 'react'

/**
 * Used to get the user's KYC status for all providers - currently only bridge and manteca
 * NOTE: This hook can be extended to support more providers in the future based on requirements
 * @returns {object} An object with the user's KYC status for all providers and a combined status for all providers, if user is verified for any provider, return true
 */
export default function useKycStatus() {
    const { user } = useAuth()

    const isUserBridgeKycApproved = useMemo(() => user?.user.bridgeKycStatus === 'approved', [user])

    const isUserMantecaKycApproved = useMemo(
        () =>
            user?.user.kycVerifications?.some((verification) => verification.status === MantecaKycStatus.ACTIVE) ??
            false,
        [user]
    )

    const isUserKycApproved = useMemo(
        () => isUserBridgeKycApproved || isUserMantecaKycApproved,
        [isUserBridgeKycApproved, isUserMantecaKycApproved]
    )

    return { isUserBridgeKycApproved, isUserMantecaKycApproved, isUserKycApproved }
}
