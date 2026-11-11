'use client'

import { useEffect, useState } from 'react'
import { countdownLabel } from '@/utils/countdown.utils'

/**
 * The time a Pix code has left, as "m:ss", ticking once a second while
 * `running`. The caller stops it once the code is paid; it stops by itself
 * once the code has lapsed. A null `expiresAtMs` (no expiry known) never expires.
 */
export function useExpiryCountdown(
    expiresAtMs: number | null,
    running: boolean
): { timeLeft: string | null; isExpired: boolean } {
    const [nowMs, setNowMs] = useState(() => Date.now())
    const remainingMs = expiresAtMs === null ? null : expiresAtMs - nowMs
    const isExpired = remainingMs !== null && remainingMs <= 0

    useEffect(() => {
        if (!running || isExpired || expiresAtMs === null) return
        const interval = setInterval(() => setNowMs(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [running, isExpired, expiresAtMs])

    return { timeLeft: remainingMs === null ? null : countdownLabel(remainingMs), isExpired }
}
