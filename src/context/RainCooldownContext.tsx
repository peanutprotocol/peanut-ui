'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Icon } from '@/components/Global/Icons/Icon'
import type { RainCooldownEventDetail } from '@/services/rain'

/**
 * Global UI state for the Rain withdrawal-signature cooldown.
 *
 * Rain enforces a per-user lock on withdrawal signatures: one active sig at
 * a time, 5min expiry + ~2min cooldown. When a user signs from collateral
 * and then tries to spend again before the lock clears, they hit a 425.
 * Without UX the wait feels broken — this context drives both:
 *   1. An initial informative modal the first time the user trips the lock.
 *   2. A persistent bottom-right Toast (countdown content) until the lock
 *      clears, so subsequent attempts make sense to the user.
 *
 * The pill is a `duration: 'persistent'` Toast with id `COOLDOWN_TOAST_ID`,
 * not a bespoke widget — keeps animation + positioning shared with every
 * other notification in the app.
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

const COOLDOWN_TOAST_ID = 'rain-cooldown'

function formatRemaining(ms: number): string {
    const totalSec = Math.max(0, Math.ceil(ms / 1000))
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}

/** Toast inner content — its own component so it ticks via setInterval
 *  without re-animating the parent toast (id-de-dupe keeps the toast stable). */
const CooldownPillContent = ({ endsAt }: { endsAt: number }) => {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000)
        return () => window.clearInterval(id)
    }, [])
    const remainingMs = Math.max(0, endsAt - now)
    return (
        <div className="flex items-center gap-2">
            <Icon name="clock" className="h-4 w-4 text-n-1" />
            <span className="text-sm font-bold tabular-nums text-n-1">
                Card cool-down · {formatRemaining(remainingMs)}
            </span>
        </div>
    )
}

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

    const { toast, dismiss } = useToast()

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<RainCooldownEventDetail>).detail
            if (!detail || typeof detail.retryAfterSec !== 'number') return
            const endsAt = Date.now() + detail.retryAfterSec * 1000
            const prev = cooldownEndsAtRef.current
            // Fresh cooldown = no active end-time. When prev exists we're
            // mid-cooldown (the toast is already on screen) — keep the
            // longer end-time and don't re-pop the intro modal on retry.
            const isFresh = prev === null
            const next = !isFresh && prev > endsAt ? prev : endsAt
            cooldownEndsAtRef.current = next
            setCooldownEndsAt(next)
            if (isFresh) setShowIntroModal(true)
        }
        window.addEventListener('rain:cooldown', handler)
        return () => window.removeEventListener('rain:cooldown', handler)
    }, [])

    // Push a persistent toast whenever a cooldown is active. Toast's id-dedupe
    // means re-firing on a mid-cooldown retry is a no-op — no re-animation.
    useEffect(() => {
        if (cooldownEndsAt === null) {
            dismiss(COOLDOWN_TOAST_ID)
            return
        }
        toast({
            id: COOLDOWN_TOAST_ID,
            duration: 'persistent',
            position: 'bottom-right',
            className: 'border-yellow-1',
            content: <CooldownPillContent endsAt={cooldownEndsAt} />,
        })
    }, [cooldownEndsAt, toast, dismiss])

    // Clear the cooldown end-time once it actually elapses so the toast is
    // dismissed via the effect above. One scheduled timeout per cooldown.
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
