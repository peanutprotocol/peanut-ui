'use client'

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'
import { usePixRefusalMessage } from '@/features/pix/usePixRefusalMessage'
import { pixApi } from '@/services/pix'
import { API_ERROR_CODES, apiErrorStatus, wireErrorCode } from '@/services/api-error'

/**
 * `accepted`: the API took the key, and its recovery queue pays the waiting money there.
 * `not-waiting`: a 409, the withdrawal no longer waits for a key (paid, refunded, or a key already given).
 */
export type PixRecoveryKeyPhase = 'idle' | 'submitting' | 'accepted' | 'not-waiting'

/** A refused key: `key` names it when the refusal is about that key (a field error), null for a flow failure. */
export interface PixRecoveryKeyRefusal {
    message: string
    key: string | null
}

// the same checks as the withdraw key step: the user fixes these by changing the key
const KEY_REFUSALS: ReadonlySet<string> = new Set([
    API_ERROR_CODES.PIX_KEY_NOT_OWN,
    API_ERROR_CODES.PIX_KEY_BLOCKED,
    API_ERROR_CODES.PIX_KEY_NOT_FOUND,
])

export interface PixRecoveryKey {
    /** Sends a key the lookup resolved to the user's own account. */
    submit: (pixKey: string) => Promise<void>
    phase: PixRecoveryKeyPhase
    /** Localized refusal (someone else's key, a blocked bank, Avenia unavailable); null when there is none. */
    refusal: PixRecoveryKeyRefusal | null
}

/**
 * A new Pix key for a withdrawal whose payout the bank refused for its key or
 * account: POST /pix/withdraw/:intentId/recovery-key. The API checks the
 * key the way the withdraw key step does (own CPF, not a blocked bank), so a
 * refusal reads like that step's. Either outcome moves the withdrawal's
 * history entry, so the entry is read again.
 */
export function usePixRecoveryKey(intentId: string): PixRecoveryKey {
    const refusalMessage = usePixRefusalMessage()
    const queryClient = useQueryClient()
    const [phase, setPhase] = useState<PixRecoveryKeyPhase>('idle')
    const [refusal, setRefusal] = useState<PixRecoveryKeyRefusal | null>(null)
    // a second tap before the first answer must not send the key twice
    const busyRef = useRef(false)

    const submit = useCallback(
        async (pixKey: string) => {
            if (busyRef.current || phase === 'accepted' || phase === 'not-waiting') return
            busyRef.current = true
            setRefusal(null)
            setPhase('submitting')
            try {
                await pixApi.setRecoveryKey(intentId, pixKey)
                setPhase('accepted')
                void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            } catch (caught) {
                if (apiErrorStatus(caught) === 409) {
                    setPhase('not-waiting')
                    void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                    return
                }
                const code = wireErrorCode(caught)
                setRefusal({ message: refusalMessage(caught), key: code && KEY_REFUSALS.has(code) ? pixKey : null })
                setPhase('idle')
            } finally {
                busyRef.current = false
            }
        },
        [intentId, phase, queryClient, refusalMessage]
    )

    return { submit, phase, refusal }
}
