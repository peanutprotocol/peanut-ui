'use client'

import { useAvatarKey } from '@/components/Avatar/useAvatarKey'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
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
    const { resetWithdrawFlow } = useWithdrawFlow()
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

    // landing on home resets any in-progress money flows
    useEffect(() => {
        resetClaimBankFlow()
        resetWithdrawFlow()
    }, [resetClaimBankFlow, resetWithdrawFlow])

    // always reset external wallet connection on home page
    useEffect(() => {
        if (isWagmiConnected) {
            disconnectWagmi()
        }
    }, [isWagmiConnected, disconnectWagmi])

    // the picked avatar (TASK-22142); null keeps the first-letter fallback,
    // which the top nav seeds from the username, never the display name
    const avatarKey = useAvatarKey(user?.user.avatarKey, user?.user.userId)

    return {
        isPageLoading: isFetchingUser && !username,
        username,
        avatarKey,
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
