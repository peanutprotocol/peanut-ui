'use client'

import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { useEffect } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useBalanceVisibility } from './useBalanceVisibility'

/**
 * flow hook for the home page — owns every behaviour so the page and views
 * stay dumb (same model as features/payments/flows/semantic-request).
 */
export function useHomeFlow() {
    const { spendableBalance, isFetchingSpendableBalance, isSpendableBalanceStale } = useWallet()
    const { user } = useUserStore()
    const { isFetchingUser, fetchUser } = useAuth()
    const { isActivated, activationStep, dismissCardStep } = useActivationStatus()
    const { resetFlow: resetClaimBankFlow } = useClaimBankFlow()
    const { isConnected: isWagmiConnected } = useAccount()
    const { disconnect: disconnectWagmi } = useDisconnect()

    // fire-and-forget: warms the card-info cache so /card mounts fast.
    // return values intentionally unused — only the fetch side effect matters.
    useCardInfo()

    const username = user?.user.username
    const userId = user?.user.userId
    const { isBalanceHidden, toggleBalanceVisibility } = useBalanceVisibility(userId)

    // re-fetch user on mount to pick up activation status changes (e.g. after qr payment)
    useEffect(() => {
        fetchUser()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // landing on home resets any in-progress money flows. (The withdraw flow
    // no longer needs a reset here: its provider is scoped to /withdraw and
    // unmounts on exit — TASK-21816.)
    useEffect(() => {
        resetClaimBankFlow()
    }, [resetClaimBankFlow])

    // always reset external wallet connection on home page
    useEffect(() => {
        if (isWagmiConnected) {
            disconnectWagmi()
        }
    }, [isWagmiConnected, disconnectWagmi])

    // respect the showFullName preference for the avatar initials; a
    // usernameless user still gets initials from their full name (initials
    // only — the preference governs showing the full name, not its initials)
    const avatarName = (user?.user.showFullName && user?.user.fullName) || username || user?.user.fullName || undefined

    return {
        isPageLoading: isFetchingUser && !username,
        username,
        avatarName,
        isActivated,
        activationStep,
        dismissCardStep,
        spendableBalance,
        isFetchingSpendableBalance,
        isSpendableBalanceStale,
        isBalanceHidden,
        toggleBalanceVisibility,
    }
}
