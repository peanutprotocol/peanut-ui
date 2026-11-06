'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aveniaApi } from '@/services/avenia'
import { aveniaDepositPhase, type AveniaDepositPhase } from '@/features/avenia/avenia.utils'
import { aveniaDepositQueryKey } from '@/features/avenia/aveniaDepositCode'

const POLLING_INTERVAL_MS = 5000
const SETTLED_PHASES: AveniaDepositPhase[] = ['completed', 'returned', 'expired']

/**
 * One Avenia Pix deposit from GET /avenia/deposit/:intentId: its code while
 * it can be paid, and its phase. A reload, back navigation and a deep link
 * read the same query, which POST /avenia/deposit seeds. Polls until the
 * deposit settles, and fires `onComplete` once when it completes.
 * Read-only: Avenia's webhook and the API's poller move the deposit.
 */
export function useAveniaDeposit(intentId: string, onComplete: () => void) {
    const completedRef = useRef(false)
    const query = useQuery({
        queryKey: aveniaDepositQueryKey(intentId),
        queryFn: () => aveniaApi.depositStatus(intentId),
        refetchInterval: (current) =>
            SETTLED_PHASES.includes(aveniaDepositPhase(current.state.data)) ? false : POLLING_INTERVAL_MS,
    })
    const phase = useMemo(() => aveniaDepositPhase(query.data), [query.data])

    useEffect(() => {
        if (phase === 'completed' && !completedRef.current) {
            completedRef.current = true
            onComplete()
        }
    }, [phase, onComplete])

    return {
        deposit: query.data,
        phase,
        isError: query.isError,
    }
}
