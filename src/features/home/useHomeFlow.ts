'use client'

import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useCardInfo } from '@/hooks/useCardInfo'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useCallback, useEffect, useState } from 'react'
import { hideHomeCta, readHiddenHomeCtas } from '@/utils/home-carousel.utils'
import { useAccount, useDisconnect } from 'wagmi'
import { useBalanceVisibility } from './useBalanceVisibility'
import { useHomeWelcome } from './useHomeWelcome'

/**
 * flow hook for the home page — owns every behaviour so the page and views
 * stay dumb (same model as features/payments/flows/semantic-request).
 */
export function useHomeFlow() {
    const { spendableBalance, isFetchingSpendableBalance, isSpendableBalanceStale } = useWallet()
    const { user, isFetchingUser, fetchUser } = useAuth()
    const { isActivated, onboarding, isOnboardingComplete } = useActivationStatus()
    const { resetFlow: resetClaimBankFlow } = useClaimBankFlow()
    const { isConnected: isWagmiConnected } = useAccount()
    const { disconnect: disconnectWagmi } = useDisconnect()

    // fire-and-forget: warms the card-info cache so /card mounts fast.
    // return values intentionally unused — only the fetch side effect matters.
    useCardInfo()

    const username = user?.user.username
    const userId = user?.user.userId
    const { isBalanceHidden, toggleBalanceVisibility } = useBalanceVisibility(userId)
    const isPageLoading = isFetchingUser && !username
    const showWelcome = useHomeWelcome(
        userId,
        isPageLoading,
        onboarding.verify === 'done' || onboarding.addMoneyDone || onboarding.firstPaymentDone
    )

    // a hidden blocked card lives in the same store as carousel dismissals. Read after mount: per-device localStorage.
    const [hiddenHomeCtas, setHiddenHomeCtas] = useState<ReadonlySet<string>>(new Set())
    useEffect(() => {
        setHiddenHomeCtas(new Set(readHiddenHomeCtas(userId).keys()))
    }, [userId])
    const hideCta = useCallback(
        (id: string) => {
            hideHomeCta(userId, id)
            setHiddenHomeCtas((prev) => new Set(prev).add(id))
        },
        [userId]
    )

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

    return {
        isPageLoading,
        username,
        isActivated,
        onboarding,
        isOnboardingComplete,
        showWelcome,
        hiddenHomeCtas,
        hideCta,
        spendableBalance,
        isFetchingSpendableBalance,
        isSpendableBalanceStale,
        isBalanceHidden,
        toggleBalanceVisibility,
    }
}
