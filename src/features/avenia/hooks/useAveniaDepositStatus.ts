'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aveniaApi } from '@/services/avenia'
import { aveniaDepositPhase, type AveniaDepositPhase } from '@/features/avenia/avenia.utils'

const POLLING_INTERVAL_MS = 5000

/**
 * Polls an Avenia Pix deposit until it ends. Read-only: Avenia's webhook and
 * the API's poller move the deposit; this mirrors it so the code screen can
 * move on. Fires `onComplete` once when the deposit completes. `expiresAt` is
 * the code's expiry, for a screen that lost the deposit itself (a reload).
 */
export function useAveniaDepositStatus(intentId: string | undefined, onComplete: () => void) {
    const completedRef = useRef(false)

    const { data } = useQuery({
        queryKey: ['avenia-deposit-status', intentId],
        queryFn: () => aveniaApi.depositStatus(intentId!),
        enabled: !!intentId,
        // a settled status must not carry over to the next deposit
        gcTime: 0,
        refetchInterval: (query) => {
            const phase = aveniaDepositPhase(query.state.data)
            return phase === 'completed' || phase === 'returned' || phase === 'expired' ? false : POLLING_INTERVAL_MS
        },
    })

    const phase: AveniaDepositPhase = useMemo(() => aveniaDepositPhase(data), [data])

    useEffect(() => {
        if (phase === 'completed' && !completedRef.current) {
            completedRef.current = true
            onComplete()
        }
    }, [phase, onComplete])

    return { phase, expiresAt: data?.expiresAt ?? null }
}
