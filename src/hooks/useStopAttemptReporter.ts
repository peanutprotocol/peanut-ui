'use client'

import { useRef } from 'react'
import { useAuth } from '@/context/authContext'
import type { StopAttempt } from '@/hooks/useCardStopConfirmation'

/**
 * Lets a lock/cancel/unlock modal hand its stop attempt up to the card page,
 * which outlives the modal. `begin()` captures the user and wallet at action
 * start; the returned report is dropped if either changed by the time it lands.
 */
export const useStopAttemptReporter = (wallet: string | undefined, onStopAttempt?: (a: StopAttempt | null) => void) => {
    const userId = useAuth().user?.user?.userId
    const latest = useRef({ userId, wallet })
    latest.current = { userId, wallet }
    return () => {
        const start = { userId, wallet }
        return (attempt: Pick<StopAttempt, 'attemptId' | 'stop'> | null) => {
            if (start.userId !== latest.current.userId || start.wallet !== latest.current.wallet) return
            onStopAttempt?.(attempt && { ...attempt, ...start })
        }
    }
}
