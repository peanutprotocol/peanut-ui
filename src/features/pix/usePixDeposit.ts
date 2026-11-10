'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pixApi } from '@/services/pix'
import { ApiError } from '@/services/api-error'
import { pixDepositPhase, type PixDepositPhase } from '@/features/pix/pixFlow.utils'
import { pixDepositQueryKey } from '@/features/pix/pixDepositCode'

const POLLING_INTERVAL_MS = 5000
const SETTLED_PHASES: PixDepositPhase[] = ['completed', 'returned', 'expired']

/**
 * One Pix deposit from GET /pix/deposit/:intentId: its code while it can be
 * paid, and its phase. A reload, back navigation and a deep link read the same
 * query, which POST /pix/deposit seeds. Polls until the deposit settles, and
 * fires `onComplete` once per deposit when it completes: a screen that stays
 * mounted while the URL moves to another deposit reports that one too. A 404 (no such deposit for this
 * user) stops the polling: waiting will not change it. Read-only: the
 * provider's events and the API's poller move the deposit.
 */
export function usePixDeposit(intentId: string, onComplete: () => void) {
    const completedFor = useRef<string | undefined>(undefined)
    const query = useQuery({
        queryKey: pixDepositQueryKey(intentId),
        queryFn: () => pixApi.readDeposit(intentId),
        // the code POST /pix/deposit seeded is fresh: the first read waits for the next poll
        staleTime: POLLING_INTERVAL_MS,
        refetchInterval: (current) => {
            const { error, data } = current.state
            if (error instanceof ApiError && error.status === 404) return false
            return SETTLED_PHASES.includes(pixDepositPhase(data)) ? false : POLLING_INTERVAL_MS
        },
    })
    const phase = useMemo(() => pixDepositPhase(query.data), [query.data])

    useEffect(() => {
        // the query is keyed by the deposit, so a completed phase is this deposit's
        if (phase === 'completed' && completedFor.current !== intentId) {
            completedFor.current = intentId
            onComplete()
        }
    }, [phase, intentId, onComplete])

    return {
        deposit: query.data,
        phase,
        isError: query.isError,
    }
}
