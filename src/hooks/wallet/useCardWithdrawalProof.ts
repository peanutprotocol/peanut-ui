'use client'

import { useRef } from 'react'
import { useAuth } from '@/context/authContext'
import type { SignedRainWithdrawal } from '@/hooks/wallet/useSignSpendBundle'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'

/**
 * A 409 with one of these codes never judged the signed return, or the return
 * is still confirming. The same proof goes with the retry: once a full return
 * has landed the backend ignores it, and a new signature would only meet the
 * provider's cool-down.
 */
const KEPT_ON_CONFLICT: ReadonlySet<string> = new Set([
    'card_action_in_progress',
    'card_action_incomplete',
    API_ERROR_CODES.STALE_CARD_APPROVAL,
    API_ERROR_CODES.WITHDRAWAL_PENDING_CONFIRMATION,
])

/**
 * True when the backend's refusal means this signed return was used or can
 * never verify, so a retry must sign again: an expired signature (410), a
 * request the backend refuses as it stands (400, 404), and any other 409, such
 * as "Intent already completed" or a partial return (`CARD_BALANCE_REMAINS`).
 * A network error or a 5xx proves nothing about the signature, so it stays.
 */
const isSpent = (error: unknown): boolean => {
    const status = apiErrorStatus(error)
    if (status === 400 || status === 404 || status === 410) return true
    return status === 409 && !KEPT_ON_CONFLICT.has(wireErrorCode(error) ?? '')
}

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
    const clear = () => {
        saved.current = undefined
    }
    return {
        get: () =>
            saved.current?.scope === scope && saved.current.proof.expiresAt * 1000 > Date.now()
                ? saved.current.proof
                : undefined,
        save: (proof: SignedRainWithdrawal) => {
            saved.current = { scope, proof }
        },
        clear,
        /** After a failed lock or cancel: drops the proof when that failure spent it. */
        dropIfSpent: (error: unknown) => {
            if (isSpent(error)) clear()
        },
    }
}
