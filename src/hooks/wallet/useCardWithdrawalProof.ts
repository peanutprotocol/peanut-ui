'use client'

import { useRef } from 'react'
import { useAuth } from '@/context/authContext'
import type { SignedRainWithdrawal } from '@/hooks/wallet/useSignSpendBundle'

/**
 * The signed collateral withdrawal of one lock/cancel attempt, for a retry. If
 * the first try consumed it, signing again would be a second withdrawal. In
 * memory only, owned by the component that outlives the modal, scoped to user,
 * wallet and card, and dropped once it expires or the action settles.
 */
export const useCardWithdrawalProof = (cardId: string, wallet?: string) => {
    const userId = useAuth().user?.user?.userId
    const scope = `${userId}:${wallet?.toLowerCase()}:${cardId}`
    const saved = useRef<{ scope: string; proof: SignedRainWithdrawal } | undefined>(undefined)
    return {
        get: () =>
            saved.current?.scope === scope && saved.current.proof.expiresAt * 1000 > Date.now()
                ? saved.current.proof
                : undefined,
        save: (proof: SignedRainWithdrawal) => {
            saved.current = { scope, proof }
        },
        clear: () => {
            saved.current = undefined
        },
    }
}
