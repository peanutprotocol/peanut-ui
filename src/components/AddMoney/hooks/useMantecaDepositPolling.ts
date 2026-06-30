'use client'

import { mantecaApi } from '@/services/manteca'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'

const POLLING_INTERVAL = 5000

// Terminal TransactionIntentStatus values returned by GET /manteca/deposit/:id/status.
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED']

type MantecaDepositPollStatus = 'pending' | 'completed' | 'failed'

/**
 * Poll a BRL PIX deposit intent until it settles. Read-only: the webhook/poller
 * post the actual credit — this just mirrors `intent.status` so the QR screen can
 * advance to a success state. Fires `onComplete` exactly once on COMPLETED.
 */
export function useMantecaDepositPolling(depositId: string | undefined, onComplete: () => void) {
    const hasCompleted = useRef(false)

    const { data } = useQuery({
        queryKey: ['manteca-deposit-status', depositId],
        queryFn: () => mantecaApi.getDepositStatus(depositId!),
        enabled: !!depositId,
        gcTime: 0, // don't carry a settled status across navigations
        refetchInterval: (query) => {
            const status = (query.state.data as { data?: { status?: string } } | undefined)?.data?.status
            return status && TERMINAL_STATUSES.includes(status) ? false : POLLING_INTERVAL
        },
    })

    const status: MantecaDepositPollStatus = useMemo(() => {
        const s = data?.data?.status
        if (s === 'COMPLETED') return 'completed'
        if (s && TERMINAL_STATUSES.includes(s)) return 'failed'
        return 'pending'
    }, [data])

    useEffect(() => {
        if (status === 'completed' && !hasCompleted.current) {
            hasCompleted.current = true
            onComplete()
        }
    }, [status, onComplete])

    return { status }
}
