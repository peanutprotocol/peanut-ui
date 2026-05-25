'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RainCooldownEventDetail } from '@/services/rain'

/**
 * Global UI state for the Rain withdrawal-signature cooldown.
 *
 * Rain enforces a per-user lock on withdrawal signatures: one active sig at
 * a time, 5min expiry + ~2min cooldown. When a user signs from collateral
 * and then tries to spend again before the lock clears, they hit a 425.
 * Without UX the wait feels broken — this context drives both:
 *   1. An initial informative modal the first time the user trips the lock.
 *   2. A persistent floating bottom-right MM:SS countdown until the lock
 *      clears, so subsequent attempts make sense to the user.
 *
 * Activation is event-driven: `rainRequest` (services/rain.ts) dispatches a
 * `rain:cooldown` window event whenever /withdraw/prepare returns a 425 with
 * a real retryAfterSec, so every spend callsite benefits without threading
 * state through the call.
 */
interface RainCooldownContextType {
    cooldownEndsAt: number | null
    showIntroModal: boolean
    dismissIntroModal: () => void
}

const RainCooldownContext = createContext<RainCooldownContextType | undefined>(undefined)

export function RainCooldownProvider({ children }: { children: ReactNode }) {
    const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null)
    const [showIntroModal, setShowIntroModal] = useState(false)
    // Mirror cooldownEndsAt in a ref so the event handler can decide
    // "fresh cooldown vs retry-during-cooldown" synchronously, without
    // depending on when React's state updater runs.
    const cooldownEndsAtRef = useRef<number | null>(null)
    useEffect(() => {
        cooldownEndsAtRef.current = cooldownEndsAt
    }, [cooldownEndsAt])

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<RainCooldownEventDetail>).detail
            if (!detail || typeof detail.retryAfterSec !== 'number') return
            const endsAt = Date.now() + detail.retryAfterSec * 1000
            const prev = cooldownEndsAtRef.current
            // Fresh cooldown = no active end-time. When prev exists we're
            // mid-cooldown (the floating timer is already on screen) — keep
            // the longer end-time and don't re-pop the intro modal on retry.
            const isFresh = prev === null
            const next = !isFresh && prev > endsAt ? prev : endsAt
            cooldownEndsAtRef.current = next
            setCooldownEndsAt(next)
            if (isFresh) setShowIntroModal(true)
        }
        window.addEventListener('rain:cooldown', handler)
        return () => window.removeEventListener('rain:cooldown', handler)
    }, [])

    // Clear the cooldown end-time once it actually elapses so the floating
    // timer unmounts itself. One scheduled timeout per cooldown — no polling.
    useEffect(() => {
        if (cooldownEndsAt === null) return
        const remaining = cooldownEndsAt - Date.now()
        const clear = () => {
            cooldownEndsAtRef.current = null
            setCooldownEndsAt(null)
        }
        if (remaining <= 0) {
            clear()
            return
        }
        const id = window.setTimeout(clear, remaining)
        return () => window.clearTimeout(id)
    }, [cooldownEndsAt])

    const dismissIntroModal = useCallback(() => setShowIntroModal(false), [])

    const value = useMemo(
        () => ({ cooldownEndsAt, showIntroModal, dismissIntroModal }),
        [cooldownEndsAt, showIntroModal, dismissIntroModal]
    )

    return <RainCooldownContext.Provider value={value}>{children}</RainCooldownContext.Provider>
}

export function useRainCooldown(): RainCooldownContextType {
    const ctx = useContext(RainCooldownContext)
    if (!ctx) throw new Error('useRainCooldown must be used within RainCooldownProvider')
    return ctx
}
