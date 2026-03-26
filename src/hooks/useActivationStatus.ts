'use client'

import { useAuth } from '@/context/authContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import useKycStatus from '@/hooks/useKycStatus'
import { useMemo } from 'react'

export type ActivationStep = 'verify' | 'deposit' | 'outbound' | 'completed'

interface ActivationStatus {
    /** whether user has completed activation funnel (kyc + first outbound tx) */
    isActivated: boolean
    /** timestamp of activation, null if not yet activated */
    activatedAt: string | null
    /** current step in the activation funnel */
    activationStep: ActivationStep
    /** true while user data is still loading */
    isLoading: boolean
}

/**
 * derives the user's activation status for gating rewards/referral UI.
 *
 * activation funnel: registered → verified → funded → activated
 * (activated = kyc approved + ≥1 outbound transaction with fees)
 *
 * before backend ships isActivated, falls back to treating all users as activated
 * so no UI breaks during the transition.
 */
export function useActivationStatus(): ActivationStatus {
    const { user } = useAuth()
    const { balance, isFetchingBalance } = useWallet()
    const { isUserKycApproved } = useKycStatus()

    const isLoading = !user || isFetchingBalance

    const derived = useMemo(() => {
        if (!user?.user) {
            return { isActivated: false, activatedAt: null, activationStep: 'verify' as ActivationStep }
        }

        // TODO(rewards-v2): REVERT TO `?? true` before merging — this forces non-activated state for testing
        const isActivated = user.user.isActivated ?? true
        const activatedAt = user.user.activatedAt ?? null

        let activationStep: ActivationStep = 'completed'
        if (!isActivated) {
            if (!isUserKycApproved) {
                activationStep = 'verify'
            } else {
                const hasBalance = balance !== undefined && balance !== null && Number(balance) > 0
                activationStep = hasBalance ? 'outbound' : 'deposit'
            }
        }

        return { isActivated, activatedAt, activationStep }
    }, [user?.user, isUserKycApproved, balance])

    return { ...derived, isLoading }
}
